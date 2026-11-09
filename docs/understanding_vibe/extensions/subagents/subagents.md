# Subagents in Mistral Vibe

> **Status**: This document explains the subagent architecture, implementation, and usage in Mistral Vibe.
> **Last Updated**: 2026-11-02
> **Owner**: Mistral Vibe Core Team

---

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
  - [Agent Types](#agent-types)
  - [Subagent Architecture](#subagent-architecture)
- [Built-in Subagents](#builtin-subagents)
- [Using Subagents](#using-subagents)
  - [The Task Tool](#the-task-tool)
  - [Delegation Workflow](#delegation-workflow)
  - [Example Usage](#example-usage)
- [Implementation Details](#implementation-details)
  - [Core Module](#core-module)
  - [Agent Profiles](#agent-profiles)
  - [Task Tool Implementation](#task-tool-implementation)
- [UI Representation](#ui-representation)
  - [Python Textual CLI](#python-textual-cli)
  - [Rust CLI](#rust-cli)
- [App Server Integration](#app-server-integration)
- [Configuration](#configuration)
- [Lifecycle and Management](#lifecycle-and-management)
- [Testing](#testing)
- [Limitations and Constraints](#limitations-and-constraints)
- [Architecture References](#architecture-references)
- [See Also](#see-also)

---

## Overview

Subagents in Mistral Vibe are specialized agents that run independently to perform delegated tasks. They enable parallel work streams, allowing the main agent to offload specialized or time-consuming tasks while maintaining user interaction in the primary conversation.

### Key Characteristics

- **Independent Execution**: Subagents run with their own context and conversation history
- **Read-Only by Default**: Built-in subagents (like `explore`) have restricted tool permissions
- **No User Interaction**: Subagents cannot directly interact with the user; they work autonomously
- **Single-Level Depth**: Subagents cannot spawn other subagents (depth limit of 1)
- **Parent-Child Relationship**: Main agent is the parent; subagents are children with linked sessions

---

## Core Concepts

### Agent Types

Mistral Vibe defines two agent types in [`vibe/agents.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/agents.py):

```python
class AgentType(StrEnum):
    AGENT = auto()      # Regular agents (main conversation)
    SUBAGENT = auto()   # Subagents (delegated tasks)
```

Each agent profile explicitly declares its type. Only agents with `agent_type=AgentType.SUBAGENT` can be used with the `task` tool.

### Subagent Architecture

The subagent system follows these architectural principles:

1. **Parent-Child Model**: The main conversation is the parent; subagents are children
2. **Session Isolation**: Each subagent maintains its own session, context, and history
3. **Effect Tracking**: Subagent execution is tracked as "subagent effects" in the event system
4. **Projection**: Subagent state is projected to the UI through the app server

**Architecture Layers:**

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │  Python Textual CLI │  │      Rust CLI (Ratui)   │  │
│  └─────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   App Server Layer                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Unified Harness Backend Adapter                     │  │
│  │  - Subagent spawning and management                 │  │
│  │  - Session lifecycle                                │  │
│  │  - State projection to clients                      │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Core Engine                            │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  vibe/core/      │  │  vibe/core/subagents.py   │  │
│  │  - Agent Manager │  │  - TaskArgs, TaskResult    │  │
│  │  - Agent Profiles│  │  - SubagentRunnerPort      │  │
│  │  - Config        │  │  - SubagentRunAccumulator │  │
│  └──────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Built-in Subagents

### Explore Subagent

The primary built-in subagent for codebase exploration.

**Profile Definition** (`vibe/core/agents/models.py`):

```python
EXPLORE = AgentProfile(
    name="explore",
    display_name="Explore",
    description="Read-only subagent for codebase exploration",
    safety=AgentSafety.SAFE,
    agent_type=AgentType.SUBAGENT,
    overrides={
        "enabled_tools": ["grep", "read_file", "skill"],
        "system_prompt_id": "explore",
    },
)
```

**Characteristics:**
- **Safety**: SAFE (read-only operations only)
- **Enabled Tools**: `grep`, `read_file`, `skill`
- **System Prompt**: Custom `explore` prompt for codebase analysis
- **Use Case**: Codebase exploration, documentation reading, file searching

**Location in Agent Registry**:
- Built-in agents are registered in `BUILTIN_AGENTS` dict
- Accessible via `BuiltinAgentName.EXPLORE`

---

## Using Subagents

### The Task Tool

The primary mechanism for delegating work to subagents is the `task` tool.

**Tool Definition** (`vibe/core/tools/builtins/task.py`):

```python
class TaskArgs(BaseModel):
    task: str = Field(description="The task for the agent to perform")
    agent: str = Field(
        default="explore",
        description="The type of specialized subagent to use for this task",
    )

class TaskResult(BaseModel):
    response: str = Field(description="The accumulated response from the subagent")
    turns_used: int = Field(description="Number of turns the subagent used")
    completed: bool = Field(description="Whether the task completed normally")
```

**Tool Configuration:**
- **Permission**: ASK (requires user approval by default)
- **Allowlist**: `["explore"]` (only explore subagent allowed by default)
- **Effect Kind**: SUBAGENT

### Delegation Workflow

1. **User Request**: User asks main agent to perform a task
2. **Agent Decision**: Main agent decides to delegate using the `task` tool
3. **Permission Check**: Tool checks if agent is in allowlist
4. **Subagent Validation**: Verifies the target agent is a subagent (not a regular agent)
5. **Session Creation**: New subagent session is created with parent reference
6. **Task Execution**: Subagent executes the delegated task
7. **Result Streaming**: Events are streamed back to parent
8. **Result Aggregation**: Final result is compiled and returned

**Sequence Diagram:**

```
User → Main Agent: "Explore the codebase structure"
Main Agent → Task Tool: task(task="Analyze project structure", agent="explore")
Task Tool → Agent Manager: Validate "explore" is a subagent
Agent Manager → Subagent Runner: Create subagent session
Subagent Runner → Explore Subagent: Execute with isolated context
Explore Subagent → Tools: Use grep, read_file as needed
Explore Subagent → Subagent Runner: Stream events
Subagent Runner → Task Tool: Forward events to parent
Task Tool → Main Agent: Return TaskResult
Main Agent → User: Present summarized results
```

### Example Usage

#### User Interaction

```
> Can you explore the codebase structure while I work on something else?

🤖 I'll use the task tool to delegate this to the explore subagent.

> task(task="Analyze the project structure and architecture", agent="explore")
```

#### Programmatic Usage

```python
from vibe.core.tools.builtins.task import Task, TaskArgs

# Create task arguments
task_args = TaskArgs(
    task="Find all usages of the subagent system",
    agent="explore"
)

# Execute via tool
async for event in task.run(task_args, ctx):
    # Handle streaming events
    if isinstance(event, ToolStreamEvent):
        print(event.message)
    elif isinstance(event, TaskResult):
        print(f"Completed in {event.turns_used} turns")
```

#### Creating Custom Subagents

Add `agent_type = "subagent"` to your agent configuration:

```toml
# ~/.vibe/ai/mistral/vibe/agents/my-researcher.toml
Display_name = "Researcher"
description = "Research-focused subagent for documentation analysis"
agent_type = "subagent"
safety = "safe"

[overrides]
enabled_tools = ["read_file", "grep", "web_search"]
system_prompt_id = "researcher"
```

**Note**: Custom subagents must be explicitly added to the `task` tool's allowlist in configuration.

---

## Implementation Details

### Core Module

**File**: [`vibe/core/subagents.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/subagents.py)

**Key Components:**

```python
# Data Models
class TaskArgs(BaseModel):
    """Arguments for subagent task delegation"""
    task: str
    agent: str = "explore"

class TaskResult(BaseModel):
    """Result from subagent execution"""
    response: str
    turns_used: int
    completed: bool

# Protocol for subagent runners
class SubagentRunnerPort(Protocol):
    """Abstract interface for subagent execution"""
    def run(self, args: TaskArgs, ctx: InvokeContext) -> AsyncGenerator[...]: ...

# Event accumulator for streaming results
@dataclass(slots=True)
class SubagentRunAccumulator:
    """Accumulates events from subagent execution"""
    _response: list[str]
    _completed: bool
    
    def observe(self, event: BaseEvent, *, tool_call_id: str) -> ToolStreamEvent | None:
        """Process subagent events and convert to stream events"""
    
    def build_result(self, *, turns_used: int) -> TaskResult:
        """Build final result from accumulated events"""
```

**Helper Function:**

```python
def prepare_subagent_prompt(task: str, ctx: InvokeContext) -> str:
    """Prepare subagent prompt with scratchpad directory context"""
    if ctx.scratchpad_dir is None:
        return task
    return (
        f"Scratchpad directory: {ctx.scratchpad_dir}\n"
        "You can read and write files here without permission prompts.\n\n"
        f"{task}"
    )
```

### Agent Profiles

**File**: [`vibe/core/agents/models.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/agents/models.py)

**AgentProfile Class:**

```python
@dataclass(frozen=True)
class AgentProfile:
    name: str
    display_name: str
    description: str
    safety: AgentSafety
    agent_type: AgentType = AgentType.AGENT
    overrides: dict[str, Any] = field(default_factory=dict)
    install_required: bool = False
    instructions: str | None = None
    source_path: Path | None = None
    
    @classmethod
    def from_toml(cls, path: Path) -> AgentProfile:
        """Load agent profile from TOML file"""
```

### Task Tool Implementation

**File**: [`vibe/core/tools/builtins/task.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/tools/builtins/task.py)

**Key Methods:**

```python
class Task(BaseTool[TaskArgs, TaskResult, TaskToolConfig, BaseToolState]):
    effect_kind = ToolEffectKind.SUBAGENT
    
    def resolve_permission(self, args: TaskArgs) -> PermissionContext | None:
        """Check if agent is in allowlist/denylist"""
        # Uses fnmatch for pattern matching
        
    async def run(
        self, args: TaskArgs, ctx: InvokeContext | None = None
    ) -> AsyncGenerator[ToolStreamEvent | TaskResult, None]:
        # Validation checks:
        # 1. Context has agent_manager
        # 2. Current agent is not already a subagent (depth limit)
        # 3. Target agent exists
        # 4. Target agent is a subagent (not regular agent)
        # 5. Subagent runner is available
        
        async for event in ctx.subagent_runner.run(args, ctx):
            yield event
```

**Security Constraints:**

1. **Depth Limit**: Subagents cannot spawn other subagents
2. **Type Check**: Only `AgentType.SUBAGENT` can be used with task tool
3. **Permission Control**: Default allowlist is `["explore"]` only

---

## UI Representation

### Python Textual CLI

**Files:**
- [`vibe/cli/textual_ui/widgets/subagent_transcripts.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/cli/textual_ui/widgets/subagent_transcripts.py)
- [`vibe/cli/textual_ui/widgets/chat_input/subagent_list.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/cli/textual_ui/widgets/chat_input/subagent_list.py)

**Features:**
- **Subagent List**: Displays all known subagents with name, type, live status, and context size
- **Status Indicators**: Shows active/ready/idle states
- **Navigation**: Use Up/Down to highlight, Enter to open, Escape to return to main
- **Transcript View**: View subagent conversation history
- **Context Gauge**: Shows subagent context usage in bottom-right
- **Configurable**: `show_subagent_status_list = false` in `config.toml` to hide

**Visual Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Main Conversation                                    [X] │
├─────────────────────────────────────────────────────────┤
│  User: Can you explore the codebase?                     │
│  Agent: I'll use the task tool...                       │
│                                                         │
│  ── Subagents ──                                         │
│  > Main conversation                                      │
│    explore     subagent  ready    12,345 tokens          │
│    researcher  subagent  idle     0 tokens               │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- With empty prompt, press Down to focus subagent list
- Press Up/Down to navigate, Enter to open a subagent view
- Mouse hover to highlight, click to open
- Press Escape from subagent view to return to main
- Ctrl+C adds error message: "subagents cannot be controlled directly"

### Rust CLI

**Files:**
- [`vibe/cli-rust/src/subagents/`](https://github.com/rrobbes/mistral-vibe/tree/main/vibe/cli-rust/src/subagents) - Subagent management
- [`vibe/cli-rust/src/transcript/subagent.rs`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/cli-rust/src/transcript/subagent.rs) - Subagent transcript handling
- [`vibe/cli-rust/src/ui/subagent_list.rs`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/cli-rust/src/ui/subagent_list.rs) - Subagent list UI

**Module Structure:**

```
subagents/
├── mod.rs          # Main module exports
├── child.rs        # Child subagent management
├── display.rs      # Display formatting
├── fetch.rs        # Subagent data fetching
├── list.rs         # Subagent list widget
├── transcripts.rs  # Transcript management
└── view.rs         # Subagent view
```

**UI Components:**
- **Subagent List**: Ratatui-based list with keyboard navigation
- **Status Display**: Visual indicators for subagent state
- **Transcript View**: Read-only view of subagent conversations
- **Keyboard Shortcuts**: Consistent with Python TUI

---

## App Server Integration

**Files:**
- [`vibe/app_server/_agent_types.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/app_server/_agent_types.py)
- [`vibe/app_server/_unified_harness_backend_adapter.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/app_server/_unified_harness_backend_adapter.py)
- [`vibe/app_server/_projection.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/app_server/_projection.py)

**Key Functions:**

1. **Agent Type Registration**: Subagent types are registered in the app server
2. **Session Management**: Subagent sessions are managed alongside main sessions
3. **State Projection**: Subagent state is projected to connected clients
4. **RPC Methods**: JSON-RPC methods for subagent operations
5. **Notifications**: Real-time notifications for subagent state changes

**Ownership (per ADR 0009):**
- App server owns session, config, persistence, and subagent lifecycle
- Both Python and Rust TUIs consume the same app server interface
- Presentation state (widgets, layout) remains in each client

---

## Configuration

### Schema

**File**: [`vibe/core/config/vibe_schema.py`](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/config/vibe_schema.py)

Subagent-related configuration includes:
- Task tool permissions (allowlist/denylist)
- Subagent display settings
- Session limits

### Example Configuration

```toml
# ~/.vibe/config.toml

[tools.task]
permission = "ask"  # or "always", "never"
allowlist = ["explore", "my-researcher"]
denylist = ["unsafe-*"]

# UI Settings
show_subagent_status_list = true
```

### Agent Configuration

**Built-in Location**: Agent profiles can be installed to:
- `~/.vibe/ai/mistral/vibe/agents/*.toml` (user-level)
- Project-local `.vibe/agents/*.toml` (project-level)

**Profile Example:**

```toml
# my-researcher.toml
[profile]
display_name = "Researcher"
description = "Subagent for researching documentation"
agent_type = "subagent"
safety = "safe"

[overrides]
enabled_tools = ["read_file", "grep", "web_search"]
disabled_tools = ["write_file", "edit", "bash"]
system_prompt_id = "researcher"

# Custom model configuration
[overrides.models]
active_model = "mistral-large-latest"
```

---

## Lifecycle and Management

### Subagent Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Created   │────▶│   Running   │────▶│   Ready     │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                   │                   │
       │                   ▼                   ▼
┌──────┴───────┐     ┌─────────────┐     ┌─────────────┐
│   Stopped   │◀────│   Busy      │     │   Killed    │
└─────────────┘     └─────────────┘     └─────────────┘
```

**States:**
- **Created**: Session initialized, not yet started
- **Running**: Actively processing first task
- **Ready**: Idle, waiting for next task
- **Busy**: Processing a task
- **Stopped**: Explicitly stopped by parent
- **Killed**: Error or forced termination

### Management Operations

1. **Spawn**: Create new subagent session
   - Triggered by `task` tool invocation
   - Requires parent session
   - Validates agent type

2. **Stop**: Terminate subagent session
   - Called from parent agent
   - Clean shutdown of subagent context
   - Removes from active list

3. **List**: Get all active subagents
   - Returns name, type, status, context size
   - Used for UI display

4. **View**: Open subagent transcript
   - Shows conversation history
   - Read-only access

### Parent-Child Relationship

**Parent (Main Agent):**
- Can spawn subagents via `task` tool
- Can stop subagents
- Receives streamed events from subagents
- Cannot directly control subagent actions (must request via task)

**Child (Subagent):**
- Has isolated context and history
- Cannot spawn other subagents (depth limit)
- Cannot directly interact with user
- Runs with restricted permissions
- References parent session ID

---

## Testing

### Test Structure

**Python Tests:**
```
tests/
├── core/test_subagents.py              # Core subagent functionality
├── app_server/test_subagents.py        # App server integration
├── cli/textual_ui/
│   ├── test_subagent_list.py           # Subagent list widget
│   └── test_subagent_transcripts.py    # Transcript widget
└── e2e/
    ├── test_programmatic_subagents.py   # Programmatic API
    └── agent_loop_characterization/test_subagents.py
```

**Rust Tests:**
```
vibe/cli-rust/tests/
├── subagent_notification.rs            # Notification handling
└── units/
    ├── subagent_list.rs                 # List widget
    ├── subagent_sessions.rs            # Session management
    └── subagent_transcript.rs           # Transcript handling
```

**E2E Scenarios:**
```
client-e2e/scenarios/
├── conversation/
│   ├── subagent_child_history.py      # Child history viewing
│   ├── subagent_grouping.py           # Grouped subagent display
│   ├── subagent_list_disabled.py      # Disabled list
│   ├── subagent_list_navigation.py    # List navigation
│   ├── subagent_view_empty.py         # Empty view
│   ├── subagent_view_killed.py        # Killed subagent view
│   ├── subagent_view_open.py          # Open view
│   └── subagent_view_status.py        # Status display
└── text_selection/
    ├── subagent_list_collapses_composer_selection.py
    └── subagent_list_click_collapses_composer_selection.py
```

**Test Doubles:**
- Mock subagent runners in unit tests
- Fake agent profiles for testing
- Stubs for subagent sessions

### Running Tests

```bash
# Run all subagent-related tests
uv run pytest tests/core/test_subagents.py -v
uv run pytest tests/app_server/test_subagents.py -v

# Run E2E tests
uv run pytest tests/e2e/test_programmatic_subagents.py -v

# Run Rust tests
cd vibe/cli-rust
cargo test subagent
```

---

## Limitations and Constraints

### Security Constraints

1. **Depth Limit**: Subagents cannot spawn other subagents
   - Enforced in `task.py`: checks `agent_manager.active_profile.agent_type is AgentType.SUBAGENT`
   - Prevents recursive subagent spawning

2. **Type Restriction**: Only `AgentType.SUBAGENT` can be used with `task` tool
   - Regular agents cannot be delegated to
   - Enforced with explicit type check

3. **Permission Model**: Default allowlist is restrictive
   - Only `explore` subagent is allowed by default
   - Custom subagents must be explicitly allowed

### Operational Constraints

1. **No Direct User Interaction**: Subagents cannot:
   - Ask user questions
   - Request permissions
   - Display interactive prompts

2. **Context Isolation**: Subagents:
   - Have separate conversation history
   - Cannot access parent context directly
   - Receive only the delegated task description

3. **Parent Control**: Parent agent:
   - Cannot directly send messages to subagent
   - Must use `task` tool for each delegation
   - Can stop subagent but not control its actions

### UI Constraints

1. **Read-Only Access**: Users can only:
   - View subagent transcripts
   - See subagent status
   - Cannot send messages to subagents directly

2. **Navigation**: 
   - Must return to main conversation to give subagent new tasks
   - Subagent view is read-only

---

## Architecture References

### ADRs (Architecture Decision Records)

| ADR | Title | Subagent Relevance |
|-----|-------|-------------------|
| [0001](docs/adr/0001-architecture-principles.md) | Architecture Principles | Module boundaries, simplicity |
| [0002](docs/adr/0002-core-engine-and-delivery-surfaces.md) | Core Engine and Delivery Surfaces | Engine vs UI separation |
| [0003](docs/adr/0003-event-driven-agent-loop.md) | Event Driven Agent Loop | Event streaming to parent |
| [0004](docs/adr/0004-typed-permissioned-tools.md) | Typed Permissioned Tools | Task tool permissions |
| [0006](docs/adr/0006-local-sessions.md) | Local Sessions | Subagent session logging |
| [0007](docs/adr/0007-extension-mechanisms.md) | Extension Mechanisms | Agents, subagents, skills |
| [0009](docs/adr/0009-app-server-boundary.md) | App Server Boundary | Subagent ownership, lifecycle |
| [0013](docs/adr/0013-queue-edit-mode.md) | Queue Selection and Edit Mode | Subagent interaction patterns |

### Key Architectural Decisions

1. **Subagents are Sessions**: Subagents are implemented as child sessions with parent references
2. **Server Ownership**: App server owns subagent lifecycle (ADR 0009)
3. **Effect Tracking**: Subagent execution tracked as SUBAGENT effect kind
4. **Projection Model**: Subagent state projected to clients via notifications
5. **Depth Limit**: Single-level delegation enforced at tool level

---

## See Also

### Related Documentation

- [README.md - Subagents and Task Delegation](https://github.com/rrobbes/mistral-vibe#subagents-and-task-delegation)
- [ADR 0007 - Extension Mechanisms](docs/adr/0007-extension-mechanisms.md)
- [ADR 0009 - App Server Boundary](docs/adr/0009-app-server-boundary.md)

### Implementation Files

- [vibe/core/subagents.py](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/subagents.py)
- [vibe/core/agents/models.py](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/agents/models.py)
- [vibe/core/tools/builtins/task.py](https://github.com/rrobbes/mistral-vibe/blob/main/vibe/core/tools/builtins/task.py)
- [vibe/cli-rust/src/subagents/](https://github.com/rrobbes/mistral-vibe/tree/main/vibe/cli-rust/src/subagents)

### External References

- [Agent Client Protocol (ACP)](https://github.com/modelcontextprotocol/agent-client-protocol) - Subagent support in ACP
- [Mistral AI Documentation](https://docs.mistral.ai/) - Model and provider configuration

---

## Appendix A: File Locations

### Core Implementation
```
vibe/
├── agents.py                          # AgentType enum
├── core/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── models.py                  # AgentProfile, EXPLORE definition
│   │   └── manager.py                 # AgentManager
│   ├── config/vibe_schema.py          # Configuration schema
│   ├── subagents.py                   # Subagent types and runner
│   └── tools/builtins/task.py          # Task tool
└── app_server/
    ├── _agent_types.py
    ├── _unified_harness_backend_adapter.py
    └── ... (subagent projection files)
```

### CLI Implementations
```
vibe/cli/
└── textual_ui/widgets/
    ├── subagent_transcripts.py
    └── chat_input/subagent_list.py

vibe/cli-rust/src/
├── subagents/
│   ├── mod.rs, child.rs, display.rs
│   ├── fetch.rs, list.rs, transcripts.rs
│   └── view.rs
├── transcript/subagent.rs
└── ui/subagent_list.rs
```

### Test Files
```
tests/
├── core/test_subagents.py
tests/app_server/test_subagents.py
tests/cli/textual_ui/test_subagent_*.py
tests/e2e/test_programmatic_subagents.py
tests/e2e/agent_loop_characterization/test_subagents.py

vibe/cli-rust/tests/
├── subagent_notification.rs
└── units/subagent_*.rs

client-e2e/scenarios/
├── conversation/subagent_*.py
└── text_selection/subagent_*.py
```

---

*This document was generated from the Mistral Vibe codebase on 2026-11-02. For the latest information, refer to the source files directly.*
