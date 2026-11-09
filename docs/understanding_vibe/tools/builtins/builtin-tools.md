# Built-in Tools

This document describes the tools that ship with Mistral Vibe — the **builtin tools** — what each one does, the arguments it accepts, and the permission it requires by default.

Builtin tools live in `vibe/core/tools/builtins/`. Each tool is a Python class implementing `BaseTool` (`vibe/core/tools/base.py`); its tool name is the snake_case form of the class name (e.g. `ReadFile` → `read_file`), unless the class overrides `get_name()`. The description shown to the model is loaded from a matching prompt file in `vibe/core/tools/builtins/prompts/<tool_name>.md`.

## Permission model

Every tool has a default permission level (`ToolPermission`, see `vibe/core/tools/models.py`):

| Level | Meaning |
|---|---|
| `ALWAYS` | The tool runs without asking the user. |
| `ASK` | The user is asked for approval before each call (or per session, depending on the approval flow). |
| `NEVER` | The tool is disabled. |

The default can be changed per tool in the Vibe configuration. File-based tools (`read_file`, `grep`, `edit`, `write_file`) additionally declare `sensitive_patterns`: file patterns that trigger an `ASK` even when the tool is configured as `ALWAYS`. The defaults (`DEFAULT_SENSITIVE_PATTERNS` in `vibe/core/tools/utils.py`) cover dotenv files: `**/.env`, `**/.env.*`, `**/.env~`, `**/.envrc`, `**/.envrc.*`, `**/.envrc~`.

## Tool outputs: the general contract

Every tool call ends in exactly one of two outcomes:

- **A result** — a typed `*Result` model (e.g. `ReadFileResult` in `vibe/core/tools/builtins/read_file.py`) serialized to the model. Each tool section below documents the fields of its result.
- **An error** — a `ToolError` is raised (file not found, `write_file` on an existing file, non-zero exit code on the simple `bash`, validation failure…). The model sees the error message, never a partial result. Adjust the call instead of retrying it verbatim.

Large outputs are never unbounded: they are capped by config (`max_read_bytes`, `max_output_bytes`, `max_content_bytes`, `max_write_bytes`) and flagged with a `was_truncated` / `truncated` boolean when cut short. Long-running shell output is spilled to a log file (`~/.vibe/shell-tool/sessions/`) and returned in chunks via a cursor (`next_cursor`).

### Output and use cases at a glance

| Tool | Main output | Use it when… |
|---|---|---|
| `read_file` | File content with line-number prefixes (`content`, `num_lines`, `start_line`, `total_lines`, `was_truncated`) | You need to see a file's exact content before editing it, or to inspect a config/log |
| `grep` | Matching `path:line: text` lines (`matches`, `match_count`, `was_truncated`) | You are looking for where something is defined/used, not reading a whole file |
| `write_file` | Confirmation + `bytes_written` | A genuinely new file must be created (never to modify an existing one) |
| `edit` | Confirmation + the applied `old_string`/`new_string` (diff shown in the UI) | An existing file needs a precise, reviewable change |
| `bash` (simple) | `command`, `shell`, `exit_code`, `stdout`, `stderr` (non-zero exit → error) | A quick stateless command: tests, builds, git, package inspection |
| `bash` (managed) | `session_id`, `status`, `exit_code`, `output`, `next_cursor`, `truncated`, `output_path` | A command may run long, needs input, or must stay inspectable (dev servers, REPLs, installers) |
| `bash_output` | Incremental `output` chunk + `next_cursor` + `status` | You are polling a live session started with `background=true` or a soft timeout |
| `bash_stdin` | `bytes_written` + `status` | A running process is waiting for input (confirmations, prompts, Ctrl-C) |
| `bash_sessions` | List/inspect of sessions (`sessions`, `session`, `output`) | You need to see what is still running, or kill/reset sessions |
| `bash_log_file` | Full session log content (or write confirmation) | You need the complete spilled output of a session, or to annotate its log |
| `web_search` | `answer` with cited `sources` | You need current information: recent events, updated docs, version checks |
| `web_fetch` | Page `content` as markdown + `content_type` + `was_truncated` | You have a specific URL to read (docs page, API response, PR diff) |
| `ask_user_question` | `answers` (question, answer, `is_other`) or `cancelled: true` | The task is ambiguous and the choice materially changes the result |
| `skill` | `name`, full `content` block, optional `skill_dir` | The user's request matches a specialized skill you should follow step by step |
| `task` | Subagent `response` + `turns_used` + `completed` | The work is multi-step and self-contained enough to delegate read-only |
| `todo` | The current `todos` list + `total_count` | The task has several steps to track and keep current |
| `exit_plan_mode` | `switched` + `message` | The plan is finalized and ready to be implemented |

## Tool overview

| Tool | Default permission | Availability | Purpose |
|---|---|---|---|
| `read_file` | `ALWAYS` | Always | Read a file, with paging |
| `grep` | `ALWAYS` | Always | Regex search in file contents |
| `write_file` | `ASK` | Always | Create a new file |
| `edit` | `ASK` | Always | Exact string replacement in a file |
| `bash` | `ASK` | Non-Windows / any OS with the simple shell | Run a one-off shell command (stateless) |
| `bash` (managed shell), `bash_log_file` | `ASK` | Non-Windows with managed-shell support | Session-based shell (PTY, background, interactive input) — replaces `bash` when available |
| `bash_output`, `bash_stdin`, `bash_sessions` | `ALWAYS` | Non-Windows with managed-shell support | Companion tools to poll output, send input, and manage managed-shell sessions |
| `git_bash`, `git_bash_log_file` | `ASK` | Windows with Git Bash available | Git Bash shell on native Windows |
| `git_bash_output`, `git_bash_stdin`, `git_bash_sessions` | `ALWAYS` | Windows with Git Bash available | Git Bash session companions |
| `powershell`, `powershell_log_file` | `ASK` | Windows with PowerShell available | PowerShell shell on native Windows |
| `powershell_output`, `powershell_stdin`, `powershell_sessions` | `ALWAYS` | Windows with PowerShell available | PowerShell session companions |
| `web_search` | `ASK` | Requires a Mistral API key | Search the web, returns cited answers |
| `web_fetch` | `ASK` | Always | Fetch a URL and return its content as markdown |
| `ask_user_question` | `ALWAYS` | Always | Ask the user structured multiple-choice questions |
| `skill` | `ALWAYS` | Always | Load a skill by name |
| `task` | `ASK` | Always | Launch a subagent for a complex task |
| `todo` | `ALWAYS` | Always | Read or replace the session todo list |
| `exit_plan_mode` | `ALWAYS` | Plan mode only | Signal that the plan is ready for implementation |

## File tools

### `read_file`

Read a file. Use absolute paths. For large files, page through with `offset`/`limit` instead of reading everything; prefer `grep` to locate content. Binary and model-weight files (`.bin`, `.safetensors`, `.pt`, `.gguf`) must not be read.

Arguments:

- `file_path` (string, required): absolute path to the file.
- `offset` (integer, optional, 1-indexed): line number to start reading from.
- `limit` (integer, default `2000`): maximum number of lines to read.

Output: `ReadFileResult` — `file_path`, `content` (line-number-prefixed), `num_lines`, `start_line`, `requested_offset`/`requested_limit`, `total_lines`, `was_truncated`. Output is capped by `max_read_bytes` (config). Line numbers are prefixed in the output — never include them when copying text into `edit`.

Use it when: you need the exact content of a file (before editing it, to inspect a config or a log). For large files, page with `offset`/`limit`; use `grep` to locate content instead of reading sequentially.

### `grep`

Search file contents with a regex (ripgrep-backed). Returns matching file paths, line numbers, and lines.

Arguments:

- `pattern` (string, required): the regex pattern.
- `path` (string, default `.`): file or directory to search in; defaults to the current working directory.
- `max_matches` (integer, optional): override the default maximum number of matches.
- `use_default_ignore` (boolean, default `true`): respect `.gitignore` and `.ignore` files.

Output: `GrepResult` — `matches` (one `path:line: text` per match), `match_count`, `pattern`, `was_truncated` (true when cut short by `max_matches` or `max_output_bytes`). Output is capped by `max_output_bytes` (config).

Use it when: you are looking for *where* something is defined, called, or mentioned — not reading a whole file. Narrow the scope with `path`.

### `write_file`

Create a new file. **Errors if the file already exists** — use `edit` to modify existing files. Prefer editing existing files over creating new ones, and do not proactively create documentation or README files.

Arguments:

- `file_path` (string, required): absolute path of the file to write.
- `content` (string, required): the content to write.

Output: `WriteFileResult` — `file_path`, `bytes_written`, `content`. Errors (via `ToolError`) if the file already exists, if `content` exceeds `max_write_bytes` (default 64 000), or if the path is invalid.

Use it when: a genuinely new file must be created — a new module, a scratchpad note, a config the user asked for. Never to modify an existing file (use `edit`), and do not proactively create documentation or README files.

### `edit`

Exact string replacement in a file. You must `read_file` the file first. `old_string` must match exactly (including whitespace) and occur exactly once, unless `replace_all` is set — otherwise provide more context to make it unique. If an edit fails, re-read the file before retrying.

Arguments:

- `file_path` (string, required): absolute path of the file to modify.
- `old_string` (string, required): the text to replace.
- `new_string` (string, required): the replacement text (must differ from `old_string`).
- `replace_all` (boolean, default `false`): replace all occurrences of `old_string`.

Output: `EditResult` — `file`, `message`, `old_string`, `new_string` (the UI renders a diff of the change). Errors if `old_string` is not found or matches multiple locations without `replace_all`.

Use it when: an existing file needs a precise, reviewable change. Always `read_file` the file first; if an edit fails, re-read before retrying.

## Shell tools

### `bash` (simple, stateless)

Execute a shell command and return its output. Each call starts a **fresh shell** from the user's profile — working directory, environment variables, and shell functions do **not** persist between calls, so prefer absolute paths. There is no background execution; avoid long-running or blocking processes.

Arguments:

- `command` (string, required): the shell command to execute.
- `timeout` (integer, optional, seconds): override the default timeout (300 s, configurable via `default_timeout`). The command is killed when the timeout expires.

Output: `CapturedShellResult` — `command`, `shell`, `exit_code`, `stdout`, `stderr` (separate streams, capped by `max_output_bytes`). A **non-zero exit code raises a `ToolError`** whose message embeds the return code and both streams, so failures surface as errors, not as results.

Use it when: a quick, stateless command is enough — running tests or builds (`uv run pytest`, `npm run build`), git operations, package-manager inspection, system checks. Each call is a fresh shell: state does not persist, there is no background execution, so long-running or interactive processes belong to the managed shell below.

The command runs under a permission model (allow / deny / ask) with allow/deny lists configured per tool (`allowlist`, `denylist`); a denied command means the user declined it — adjust your approach rather than retrying verbatim. Git guidance: interactive flags (`-i`) are unsupported, use the `gh` CLI for GitHub operations, commit or push only when the user asks, and do not append a co-authoring footer (the signature is added automatically).

### Session-based shells (managed shell)

On platforms where the managed-shell backend is supported, the simple `bash` is replaced by a **stateful session shell** with the same `bash` name, plus four companion tools. Sessions run in a PTY and keep a durable log file under `~/.vibe/shell-tool/sessions/`.

- **`bash`** — run a command in a session. Each call starts a **new** session; the returned `session_id` is then used with the companion tools below (`bash_output`, `bash_stdin`, `bash_sessions`). Key arguments: `command`, `timeout_seconds`, `background` (keep long-running processes alive, e.g. dev servers), `hard_timeout` (kill the process group on timeout instead of returning a live session), plus `timeout`, `cwd`, `env`, `shell`. A soft foreground timeout returns a live session you can poll later. Output: `ExperimentalBashResult` — `command`, `session_id`, `status`, `exit_code`, `shell`, `background`, `output` (PTY-interleaved stdout+stderr), `next_cursor`, `truncated`, `output_path`. Use it when: a command may run for a while, needs ongoing input, or should stay inspectable afterwards (builds, dev servers, watchers, REPLs, installers).
- **`bash_output`** — long-poll a session's output: `session_id`, `cursor` (byte offset into the log; pass the `next_cursor` from the previous call to resume without re-reading), `wait_seconds`, `max_bytes`. Returns when the process exits, the output cap is hit, the session is killed/reset, or the wait window expires. Output: `BashOutputResult` — `session_id`, `status`, `exit_code`, `output` (incremental chunk), `next_cursor`, `truncated`, `output_path`. Use it when: polling a live session (started with `background=true` or after a soft timeout).
- **`bash_stdin`** — send input to a session: `session_id` plus exactly one of `text` (e.g. `"y\n"` to answer a prompt), `control` (e.g. `["ctrl_c"]` to interrupt), or `bytes_base64` (raw bytes, base64-encoded). Output: `BashStdinResult` — `session_id`, `bytes_written`, `status`. Use it when: a running process waits for input — confirmations, prompts, REPLs, installers — or to interrupt it with a control key such as Ctrl-C.
- **`bash_sessions`** — manage sessions: `action` = `list` | `inspect` | `kill` | `reset` (with `session_id` for `inspect`/`kill`; `reset(clear_logs=true)` also deletes stored logs). Output: `BashSessionsResult` — `action`, `sessions` (for `list`), `session` (for `inspect`), `output`/`next_cursor` (for `inspect`). Use it when: you need to see what is still running, inspect one session, or kill/reset sessions.
- **`bash_log_file`** — read (`action="read"`) a session's full output file; `write`/`append` annotate it once the session has exited. Output: `BashLogFileResult` — `action`, `path`, plus `content`/`next_cursor`/`truncated` (for `read`) or `bytes_written` (for `write`/`append`). Use it when: you need the complete spilled output of a session, or to annotate its log after exit.

The same family exists under Windows-specific names, resolved automatically:

- **`git_bash`**, `git_bash_output`, `git_bash_stdin`, `git_bash_sessions`, `git_bash_log_file` — Git Bash (POSIX syntax) on native Windows, when a usable `bash.exe` is found. The simple fallback variant runs each command in a fresh stateless Git Bash process.
- **`powershell`, `powershell_output`, `powershell_stdin`, `powershell_sessions`, `powershell_log_file` — PowerShell (`pwsh.exe`, then `powershell.exe`) on native Windows; `cmd.exe` is never used.

In all shell variants, prefer the dedicated tools over shell utilities: `read_file` instead of `cat`/`head`/`tail`, `grep` instead of `grep`/`find`/`rg`, `edit`/`write_file` instead of `sed`/redirection.

## Web tools

### `web_search`

Search the web for current information. Returns answers with cited sources. Use for recent events, updated docs, and version checks.

Arguments:

- `query` (string, required): the search query.

Output: `WebSearchResult` — `query`, `answer` (with citations inline), `sources` (list of `WebSearchSource` with `title` and `url`).

Use it when: you need current information the model cannot know — recent events, updated docs, version checks, "what changed in X".

Configuration: `timeout` (default 120 s) and the Mistral model used for search. Only available when a Mistral API key is configured (otherwise the tool is hidden).

### `web_fetch`

Fetch content from a URL, returned as markdown. Read-only.

Arguments:

- `url` (string, required): the URL to fetch.
- `timeout` (integer, optional, seconds, max 120): override the default timeout (30 s, configurable via `default_timeout`).

Output: `WebFetchResult` — `url`, `content` (markdown), `content_type`, `was_truncated`. Returned content is capped by `max_content_bytes` (default 120 000 bytes).

Use it when: you have a specific URL to read — a docs page, an API response, a PR diff, a raw file on the web. For "find me information on X", use `web_search` instead.

## Interaction tools

### `ask_user_question`

Ask the user one or more structured questions with options. An "Other" free-text option is added automatically to each question.

Arguments:

- `questions` (array, required, at least 1 item; 1–4 recommended). Each question has:
  - `question` (string, required): the question text.
  - `header` (string, optional, max 20 chars): short chip/tag label.
  - `options` (array, required, at least 2 items; 2–4 recommended, not counting the automatic "Other"): each with a `label` and an optional `description`.
  - `multi_select` (boolean, default `false`): allow selecting multiple options.
  - `hide_other` (boolean, default `false`): hide the free-text "Other" option.
- `footer_note` (string, optional): subtle note displayed at the bottom of the question widget.

Output: `UserQuestionResult` — `answers` (each a `UserAnswer` with the original `question`, the chosen `answer`, and `is_other` for a custom free-text answer), plus `cancelled: true` if the user dismissed the widget without answering.

Use it when: the request is ambiguous and the answer materially changes what you do next — which approach to take, which file to touch, what the user prefers. Do not use it for things you can decide yourself or discover with other tools.

### `skill`

Load a specialized skill by name (from `available_skills`) and follow the returned instructions step by step.

Arguments:

- `name` (string, required): the name of the skill.

Output: `SkillResult` — `name`, the full skill `content` block (wrapped in a `<skill_content name="…">` marker), and optionally `skill_dir` (absolute path of the skill directory).

Use it when: the user's request matches one of the `available_skills` — load it and follow the returned instructions step by step, including its permission flow.

### `task`

Launch a subagent for complex multi-step work. Provide a self-contained description; the subagent runs read-only and returns a final message — summarize it to the user yourself.

Arguments:

- `task` (string, required): the task for the subagent to perform.
- `agent` (string, default `"explore"`): the type of specialized subagent to use.

Output: `TaskResult` (`vibe/core/subagents.py`) — `response` (the subagent's final message), `turns_used`, `completed`. The UI shows "Completed in N turns" or "Interrupted".

Use it when: the work is complex, multi-step, and self-contained enough to delegate (e.g. "find every place X is used and summarize") while you keep control of the main conversation. The subagent runs read-only — summarize its answer to the user yourself.

### `todo`

Track tasks for the current session. Use for multi-step work: write the list as soon as the steps are known, then keep it current as work progresses — after each step finishes, mark it completed and the next one `in_progress`. `action: "write"` replaces the **full** list, so include every item you want to keep.

Arguments:

- `action` (string, required): `read` to view the current list, or `write` to replace it.
- `todos` (array, required when `action="write"`): items with `id` (stable unique identifier, reused across updates), `content`, `status` (`pending` | `in_progress` | `completed` | `cancelled`), and `priority` (`low` | `medium` | `high`).

Output: `TodoResult` — `verb` ("Retrieved"/"Updated"), the full `todos` list, and `total_count`. Writing more than `max_todos` items or duplicating an `id` raises a validation error.

Use it when: the task has several steps — write the list as soon as the steps are known and keep it current as work progresses.

### `exit_plan_mode`

Signal that your plan is complete and ready for implementation. Call only after finalizing the plan — not before, and not if the user wants to keep planning. When the user chooses to proceed, they are offered options to auto-approve or keep requesting approval for edits.

Arguments: none.

Output: `ExitPlanModeResult` — `switched` (whether plan mode was actually exited) and a human-readable `message`. Raises a `ToolError` outside plan mode.

Use it when: the plan is finalized and ready for implementation — not before, and not if the user wants to keep planning.

## Related documentation

- [ADR 0004 — Typed Permissioned Tools](../../adr/0004-typed-permissioned-tools.md) — tool contracts, permissions, and output.
- [ADR 0007 — Extension Mechanisms](../../adr/0007-extension-mechanisms.md) — skills, subagents, and custom tools alongside the builtins.
- Tool source code: `vibe/core/tools/builtins/`; model-facing descriptions: `vibe/core/tools/builtins/prompts/`.
- [Interactive explorer](interactive/index.html) — a single-file interactive site (searchable tool cards with outputs and use cases, quiz, permission game) built from this document. It is a single static file with no dependencies: either open `docs/understanding_vibe/builtins/interactive/index.html` directly in a browser (double-click or `file://` URL), or serve the repo root with `uv run --no-project python -m http.server 8000` and open `http://localhost:8000/docs/understanding_vibe/builtins/interactive/`. Note: plain `uv run python -m http.server` first builds the whole project and can hang for minutes before serving anything — for a static file server, always use `--no-project`.
