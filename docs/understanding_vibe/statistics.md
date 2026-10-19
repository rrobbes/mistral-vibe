# Mistral Vibe — Codebase Statistics

Last updated: 2026-10-19 (v2.26.1)

## Overview

| Metric | Value |
|---|---|
| Total source files | **2,858** |
| Total lines of code | **~634,700** |
| Python files | 2,049 |
| Rust files | 794 |
| Shell scripts | 8 |
| TCSS style files | 7 |
| Git commits | 96 |
| Python packages (dirs with `__init__.py`) | 70 |
| Rust crates | 2 (`vibe-rs`, `harness-core`) |

## By Language

| Language | Files | Total LOC | Source LOC | Test LOC | Avg lines/file |
|---|---|---|---|---|---|
| Python | 2,049 | 480,254 | 172,576 | 235,802 | 606 |
| Rust | 794 | 153,857 | 119,347 | 34,510 | 387 |
| Shell + TCSS | 15 | ~3,977 | — | — | ~265 |

Test-to-source ratio by lines: **Python 1.37:1**, **Rust 0.29:1**

## Python Source (`vibe/` + `scripts/`)

### By top-level module

| Module | Files | Lines | % of Python source |
|---|---|---|---|
| `vibe/core` (engine, agent loop, tools, config) | 268 | 65,375 | 38.1% |
| `vibe/app_server` (RPC server, session backends) | 110 | 56,768 | 33.1% |
| `vibe/cli` (Textual TUI) | 177 | 36,117 | 21.1% |
| `vibe/acp` (Agent Client Protocol bridge) | 20 | 5,398 | 3.1% |
| `vibe/setup` (first-run wizards) | 23 | 4,410 | 2.6% |
| `vibe/utils` | 22 | — | — |
| `vibe/observability` | 3 | — | — |
| `vibe/plugins` | 2 | — | — |
| `scripts/` | 6 | 1,599 | 0.9% |
| root (`pytest_vibe.py`) | 1 | 131 | 0.1% |

### File size distribution (`vibe/` source only)

| Bucket | Count |
|---|---|
| < 50 lines | 172 (27%) |
| 50–200 lines | 237 (37%) |
| 200–500 lines | 143 (23%) |
| > 500 lines | 82 (13%) |

### Code density (`vibe/` source, 170,846 total lines)

| Category | Lines | % |
|---|---|---|
| Blank lines | 22,684 | 13.3% |
| Comment lines (`#`) | 4,793 | 2.8% |
| Docstring markers (`"""`) | 2,468 | 1.4% |
| Actual code | ~140,901 | 82.5% |

### Largest Python files

| Lines | File |
|---|---|
| 10,750 | `vibe/app_server/_unified_harness_backend_adapter.py` |
| 6,730 | `vibe/cli/textual_ui/app.py` |
| 4,084 | `vibe/core/agent_loop/_loop.py` |
| 3,217 | `vibe/app_server/_runtime.py` |
| 2,510 | `vibe/app_server/protocol.py` |
| 2,493 | `vibe/core/tools/builtins/experimental_bash.py` |
| 2,127 | `vibe/core/plugins/_native.py` |

## Python Tests (`tests/`)

| Area | Files | Lines |
|---|---|---|
| `tests/cli` | 150 | 40,527 |
| `tests/core` | 143 | 45,353 |
| `tests/app_server` | 110 | 67,542 |
| `tests/agent_loop` | 39 | — |
| `tests/acp` | 24 | 7,516 |
| `tests/tools` | 23 | 15,236 |
| `tests/e2e` | 19 | — |
| `tests/backend` | 15 | — |
| `tests/skills` | 11 | — |
| `tests/session` | 9 | 4,637 |
| Other (snapshots, stubs, utils, etc.) | ~180 | ~55,000 |

**708 test files** for **633 source files** — more test files than source files.

### Largest test files

| Lines | File |
|---|---|
| 20,309 | `tests/app_server/test_unified_harness_backend_adapter.py` |
| 4,032 | `tests/app_server/test_session.py` |
| 3,737 | `tests/tools/test_bash.py` |
| 3,591 | `tests/app_server/test_local.py` |
| 2,827 | `tests/core/test_worktree.py` |
| 2,296 | `tests/core/config/test_config_resolution.py` |
| 2,135 | `tests/session/test_session_logger.py` |

## Rust Source

### By area

| Area | Files | Lines |
|---|---|---|
| `vibe/cli-rust/src` (Ratatui TUI) | 416 | 67,653 |
| `vibe/cli-rust/tests` | 234 | 34,510 |
| `harness/core/src` (app-server harness) | 144 | 51,694 |

### File size distribution (all Rust)

| Bucket | Count |
|---|---|
| < 50 lines | 136 (17%) |
| 50–200 lines | 393 (49%) |
| 200–500 lines | 220 (28%) |
| > 500 lines | 46 (6%) |

### Largest Rust files

| Lines | File |
|---|---|
| 3,646 | `harness/core/src/core/features/programmatic_tool_calling/code_mode/v8.rs` |
| 1,717 | `harness/core/src/core/features/programmatic_tool_calling/execution.rs` |
| 1,683 | `harness/core/src/tests/acceptance_scenarios/compaction.rs` |
| 1,354 | `harness/core/src/core/turn.rs` |
| 1,236 | `vibe/cli-rust/src/app.rs` |
| 1,225 | `harness/core/src/tests/acceptance_scenarios/permissions/programmatic.rs` |
| 1,216 | `harness/core/src/core/features/programmatic_tool_calling/state.rs` |
| 1,103 | `harness/core/src/tests/acceptance_scenarios/completion_and_tools.rs` |
| 1,041 | `harness/core/src/core/tools/execution/batch.rs` |
| 1,026 | `vibe/cli-rust/src/event_handler.rs` |

## Disk Usage

| Directory | Size |
|---|---|
| `vibe/` | 13 MB |
| `tests/` | 12 MB |
| `harness/` | 4.2 MB |
| `scripts/` | 108 KB |

## Project Metadata

- **Python**: 3.12+, managed with `uv`, Apache-2.0 license
- **Rust**: Edition 2021, two crates (`vibe-rs` for the Ratatui TUI, `harness-core` for the app-server harness)
- **Key Python deps**: `agent-client-protocol`, `httpx`, `textual`, `pydantic`, `gitpython`, `croniter`
- **Key Rust deps**: `ratatui 0.29`, `tokio`, `serde`, `clap 4`, `crossterm`
- **Version**: 2.26.1

## Observations

1. **Dual-language codebase**: The project is mid-migration from a Python Textual TUI (`vibe/cli`, 177 files) to a Rust Ratatui TUI (`vibe/cli-rust`, 416 source files). The Rust TUI is already larger by file count.
2. **App server is the largest Python module**: `vibe/app_server` (110 files, 57K lines) rivals `vibe/core` (268 files, 65K lines) in size despite having fewer files — the files are large, averaging ~516 lines.
3. **Heavy test coverage**: Python has 1.37 test lines per source line. The single largest file in the entire repo is a test file (20K lines).
4. **Many small files**: 27% of Python source files and 17% of Rust files are under 50 lines, consistent with the project's modular architecture (one concept per file).
5. **`_unified_harness_backend_adapter.py`** at 10,750 lines is a significant outlier — 60% larger than the next biggest Python file. It likely aggregates many backend concerns.
6. **The `v8.rs` file** in the harness (3,646 lines) handles JavaScript code-mode execution via V8 bindings — an unusually large single file for the Rust side.
