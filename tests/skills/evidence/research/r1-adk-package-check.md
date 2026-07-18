# Phase 0-1 installed ADK package check

Status: installed-source and CLI verification complete. This is a version-specific evidence record, not an ADK implementation guide.

## Installed version and interpreter

- Environment: `.agent-factory/runtime/.venv`
- Interpreter: Python `3.13.12`
- Distribution: `google-adk 2.3.0`, confirmed by both `pip show google-adk` and installed source:

  ```text
  .agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/version.py:15-16
  # version: major.minor.patch
  __version__ = "2.3.0"
  ```

- Installed source root: `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk`
- Method: source inspection plus import/`inspect.signature` probes under the same venv. No API below is inferred from memory.

## A. Callbacks and plugins

### Imports and constructor surface

Use:

```python
from google.adk.agents import Agent, BaseAgent, LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.tool_context import ToolContext
from google.adk.plugins import BasePlugin, PluginManager
```

`Agent` is exactly a type alias for `LlmAgent`, not a separate class (`google/adk/agents/llm_agent.py:1138`):

```python
Agent: TypeAlias = LlmAgent
```

The installed classes are Pydantic models, so callback constructor parameters are declared as fields rather than a handwritten `__init__`:

```text
google/adk/agents/base_agent.py:149,163
before_agent_callback: Optional[BeforeAgentCallback] = None
after_agent_callback: Optional[AfterAgentCallback] = None

google/adk/agents/llm_agent.py:403,418,447,462
before_model_callback: Optional[BeforeModelCallback] = None
after_model_callback: Optional[AfterModelCallback] = None
before_tool_callback: Optional[BeforeToolCallback] = None
after_tool_callback: Optional[AfterToolCallback] = None
```

Runtime `inspect.signature` confirmed these are keyword constructor parameters on `BaseAgent`/`LlmAgent`/`Agent`, along with `on_model_error_callback` and `on_tool_error_callback` on `LlmAgent`. A callback or an ordered list is accepted.

Actual callback callable shapes are:

```text
google/adk/agents/base_agent.py:61-74
(CallbackContext) -> Content | None | Awaitable[Content | None]

google/adk/agents/llm_agent.py:73-91
before: (CallbackContext, LlmRequest) -> LlmResponse | None | Awaitable[...]
after:  (CallbackContext, LlmResponse) -> LlmResponse | None | Awaitable[...]

google/adk/agents/llm_agent.py:103-121
before tool: (BaseTool, dict[str, Any], ToolContext) -> dict | None | Awaitable[...]
after tool:  (BaseTool, dict[str, Any], ToolContext, dict) -> dict | None | Awaitable[...]
```

`CallbackContext` and `ToolContext` are compatibility aliases for the unified `Context`:

```text
google/adk/agents/callback_context.py:17-22  CallbackContext = Context
google/adk/tools/tool_context.py:20-26       ToolContext = Context
```

### Plugins

Plugins are present in the installed version. `google.adk.plugins` publicly exports `BasePlugin`, `PluginManager`, and three built-in plugin types (`plugins/__init__.py:19-38`). The key signatures are:

```text
google/adk/plugins/base_plugin.py:105
def __init__(self, name: str)

google/adk/plugins/base_plugin.py:198-219
before_agent_callback(*, agent: BaseAgent, callback_context: CallbackContext)
after_agent_callback(*, agent: BaseAgent, callback_context: CallbackContext)

google/adk/plugins/base_plugin.py:233-255
before_model_callback(*, callback_context: CallbackContext, llm_request: LlmRequest)
after_model_callback(*, callback_context: CallbackContext, llm_response: LlmResponse)

google/adk/plugins/base_plugin.py:297-328
before_tool_callback(*, tool, tool_args, tool_context)
after_tool_callback(*, tool, tool_args, tool_context, result)
```

These are Runner-level/global hooks; agent callback fields remain per-agent. Nothing requested in this callback/plugin area was absent.

## B. `RequestInput` and resume/function-response flow

Public import:

```python
from google.adk.events import RequestInput
```

Installed shape:

```text
google/adk/events/request_input.py:28,37,51,53,58
class RequestInput(BaseModel):
interrupt_id: str = Field(...)
payload: Optional[Any] = None
message: Optional[str] = Field(...)
response_schema: Optional[SchemaType] = Field(...)
```

The actual flow is:

1. A workflow node yields `RequestInput`. `BaseNode.run` recognizes it and converts it to an interrupt `Event` (`workflow/_base_node.py:196-230`).
2. The conversion emits a model `FunctionCall` named `adk_request_input`; its `id` is `interrupt_id`, and the same ID is added to `long_running_tool_ids` (`workflow/utils/_workflow_hitl_utils.py:40-69`).
3. Resume input is a `google.genai.types.FunctionResponse` with the same `id`, name `adk_request_input`, and response mapping. The installed helper signature is:

   ```text
   google/adk/workflow/utils/_workflow_hitl_utils.py:94-114
   def create_request_input_response(
       interrupt_id: str,
       response: Mapping[str, Any],
   ) -> types.Part
   ```

4. A new Runner call receives that part inside `new_message`. Runner extracts function-response IDs and response bodies into `resume_inputs`, forbids mixing function responses with text, and resolves the original invocation by matching each response ID to a prior function call (`runners.py:646-709`). It passes `resume_inputs` to `NodeRunner` (`runners.py:461-558`).
5. For generator-style HITL logic that must execute again after resume, `FunctionNode` must opt into rerun:

   ```text
   google/adk/workflow/_function_node.py:169-180
   def __init__(self, *, func, name=None, rerun_on_resume=False,
                retry_config=None, timeout=None, auth_config=None,
                parameter_binding='state', state_schema=None)
   ```

The response helper is internal: `from google.adk.events import create_request_input_response` is **not present in installed version**. Build the `types.Part(function_response=...)` directly or consciously use the internal utility; do not document it as a public events export.

## C. A2A

### Remote consumer

Exact import:

```python
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.a2a.agent import A2aRemoteAgentConfig, RequestInterceptor
from a2a.types import AgentCard
```

`RemoteA2aAgent` is present, but `from google.adk.agents import RemoteA2aAgent` is **not present in installed version** (`agents/__init__.py:19-57` omits it).

Constructor signature from source:

```text
google/adk/agents/remote_a2a_agent.py:138-156
def __init__(self, name: str, agent_card: Union[AgentCard, str], *,
             description: str = "", httpx_client=None, timeout: float = 600.0,
             genai_part_converter=..., a2a_part_converter=...,
             a2a_client_factory=None, a2a_request_meta_provider=None,
             full_history_when_stateless: bool = False,
             config: Optional[A2aRemoteAgentConfig] = None,
             use_legacy: bool = True, **kwargs)
```

`agent_card` accepts an actual external `a2a.types.AgentCard`, a URL string, or a JSON file path (`remote_a2a_agent.py:123-136,159-178`). Config/interceptor fields are:

```text
google/adk/a2a/agent/config.py:57-76
RequestInterceptor(before_request=..., after_request=...)

google/adk/a2a/agent/config.py:83-111
A2aRemoteAgentConfig(..., request_interceptors: Optional[list[RequestInterceptor]] = None)
```

`before_request` receives `(InvocationContext, A2AMessage, ParametersConfig)` and asynchronously returns `(A2AMessage | Event, ParametersConfig)`; `after_request` receives `(InvocationContext, A2AEvent, Event)` and returns `Event | None` asynchronously.

### A2A server and Agent Card

The server utility is present at this exact module path:

```python
from google.adk.a2a.utils.agent_to_a2a import to_a2a
```

```text
google/adk/a2a/utils/agent_to_a2a.py:79-91
def to_a2a(agent: BaseAgent | Workflow, *, host='localhost', port=8000,
           protocol='http', agent_card: AgentCard | str | None = None,
           push_config_store=None, task_store=None, runner=None, lifespan=None,
           agent_executor_factory=None) -> Starlette
```

This installed version can expose either `BaseAgent` **or `Workflow`**. With no card, it builds one; with a string, it loads card JSON from that path (`agent_to_a2a.py:60-75`). `AgentCardBuilder` accepts `BaseAgent | Workflow` and its `build() -> AgentCard` composes name, description, URL, version, capabilities, skills, modes, provider, and security schemes (`a2a/utils/agent_card_builder.py:43-99`).

`from google.adk.a2a.utils import to_a2a` is **not present in installed version** because that package `__init__.py` does not re-export it. The module-qualified import above is required.

## D. MCP

Public imports:

```python
from google.adk.tools.mcp_tool import (
    McpToolset,
    SseConnectionParams,
    StdioConnectionParams,
    StreamableHTTPConnectionParams,
)
from mcp import StdioServerParameters
```

Connection models from `google/adk/tools/mcp_tool/mcp_session_manager.py`:

```text
:101-111  StdioConnectionParams(*, server_params: StdioServerParameters, timeout: float = 5.0)
:114-137  SseConnectionParams(*, url: str, headers=None, timeout=5.0,
                              sse_read_timeout=300.0, httpx_client_factory=...)
:145-171  StreamableHTTPConnectionParams(*, url: str, headers=None, timeout=5.0,
                                         sse_read_timeout=300.0,
                                         terminate_on_close=True,
                                         httpx_client_factory=...)
```

Toolset signature:

```text
google/adk/tools/mcp_tool/mcp_toolset.py:95-120
def __init__(self, *, connection_params: StdioServerParameters |
             StdioConnectionParams | SseConnectionParams |
             StreamableHTTPConnectionParams,
             tool_filter: ToolPredicate | list[str] | None = None,
             tool_name_prefix=None, errlog=sys.stderr, auth_scheme=None,
             auth_credential=None, require_confirmation=False,
             header_provider=None, progress_callback=None,
             use_mcp_resources=False, sampling_callback=None,
             sampling_capabilities=None, credential_key=None)
```

`ToolPredicate` is `(tool: BaseTool, readonly_context: ReadonlyContext | None = None) -> bool` (`tools/base_toolset.py:40-57`). The uppercase `MCPToolset` also exists but is a deprecated subclass, not an identity alias (`mcp_toolset.py:484-493`); use `McpToolset`.

A generic `HttpConnectionParams` is **not present in installed version**. The actual HTTP class is `StreamableHTTPConnectionParams`; legacy SSE is separately represented by `SseConnectionParams`.

## E. Workflow and graph

Public imports are available from `google.adk.workflow` (`workflow/__init__.py:17-40`):

```python
from google.adk.workflow import JoinNode, START, Workflow, node
from google.adk.events import Event, EventActions
from google.adk.agents import Context
```

The source/runtime signatures are:

```text
google/adk/workflow/_workflow.py:146-173
Workflow(*, name, description='', rerun_on_resume=True, wait_for_output=False,
         retry_config=None, timeout=None, input_schema=None, output_schema=None,
         state_schema=None, edges=[], max_concurrency=None, graph=None)

google/adk/workflow/_join_node.py:47-77
JoinNode(*, name, description='', rerun_on_resume=False, wait_for_output=False,
         retry_config=None, timeout=None, input_schema=None, output_schema=None,
         state_schema=None)
```

`JoinNode` inherits the generated constructor from `BaseNode`, requires all predecessors, and emits `Event(output=node_input)`.

Event fields are not all top-level:

- `output` is top-level: `Event.output: Any | None` (`events/event.py:91-119`).
- `partial` is inherited from `LlmResponse`: `partial: Optional[bool]` (`models/llm_response.py:29-39,72-76`).
- `state_delta` and `route` live in `Event.actions`: `EventActions.state_delta` and `.route` (`events/event_actions.py:52-69,114-115`).
- Convenience kwargs `Event(state={...}, route=...)` are accepted and routed into `actions.state_delta`/`actions.route` by the pre-validator (`events/event.py:157-211`). A top-level declared `Event.state_delta` field is **not present in installed version**.

Dynamic node signatures:

```text
google/adk/workflow/_node.py:73-82
def node(node_like=None, *, name=None, rerun_on_resume=None,
         retry_config=None, timeout=None, parallel_worker=False,
         auth_config=None) -> Any

google/adk/agents/context.py:411-422
async def run_node(self, node, node_input=None, *, use_as_output=False,
                   run_id=None, use_sub_branch=False, override_branch=None,
                   override_isolation_scope=None, raise_on_wait=False) -> Any
```

`ctx.run_node(...)` must be directly awaited, and the calling node must have `rerun_on_resume=True`; the latter is enforced at `context.py:454-460`.

## F. Ambient and trigger surfaces

### API server

`adk api_server --help` in this venv confirms `--auto_create_session`, `--trigger_sources`, `--a2a`, `--extra_plugins`, session/artifact/memory service URIs, local-storage selection, host/port/CORS, UI, and feature flags. The relevant source option is:

```text
google/adk/cli/cli_tools_click.py:1722-1739
--trigger_sources TEXT  # comma-separated; e.g. pubsub,eventarc
```

The production FastAPI application exposes:

```text
google/adk/cli/api_server.py:1459-1460  POST /run -> list[Event]
google/adk/cli/api_server.py:1525-1526  POST /run_sse -> StreamingResponse
google/adk/cli/api_server.py:1610-1623  websocket /run_live
```

`RunAgentRequest` fields are `app_name`, `user_id`, `session_id`, optional `new_message`, `streaming`, optional `state_delta`, function-call/resume IDs, and custom metadata (`api_server.py:376-387`). `/run` delegates to `runner.run_async(...)` with `new_message`, `state_delta`, and `invocation_id` (`api_server.py:1477-1489`).

### Trigger endpoints and Pub/Sub

Trigger routes are opt-in: the API server registers them only when `trigger_sources` is non-empty (`api_server.py:1023-1028`). `TriggerRouter` supports exactly `pubsub` and `eventarc`, defaults to none, creates an ephemeral session, limits concurrency, and retries transient 429/resource-exhausted failures (`cli/trigger_routes.py:216-264`). Routes are:

```text
google/adk/cli/trigger_routes.py:400-413
POST /apps/{app_name}/trigger/pubsub
  (app_name, PubSubTriggerRequest, Request) -> TriggerResponse

google/adk/cli/trigger_routes.py:466-479
POST /apps/{app_name}/trigger/eventarc
  (app_name, EventarcTriggerRequest, Request) -> TriggerResponse
```

The Pub/Sub request model accepts the standard push envelope with base64 `message.data`, attributes, message ID, publish time, and subscription (`trigger_routes.py:120-147`). Eventarc accepts structured or binary CloudEvents (`:150-200`). These adapters are implemented directly as HTTP routes; a separate named `PubSubTriggerAdapter` class is **not present in installed version**.

An experimental `google.adk.tools.pubsub.PubSubToolset` source is also included. Its constructor accepts `tool_filter`, `PubSubCredentialsConfig`, and `PubSubToolConfig`, and exposes publish/pull/ack tools (`tools/pubsub/pubsub_toolset.py:32-94`). However, importing it in this exact venv fails because the optional Pub/Sub/grpc dependency is missing; `pip show google-cloud-pubsub grpcio` confirms that neither distribution is installed. Therefore: **Pub/Sub toolset source present, but usable Pub/Sub toolset import not present in installed environment**.

No `google.adk.ambient` module or named ambient-agent API was found: **not present in installed version**. Ambient/event-driven behavior in 2.3.0 is exposed through the generic `/run*` APIs and opt-in Pub/Sub/Eventarc trigger routes, not an `ambient` package.

## G. Sessions, state, and artifacts

### Session services and state scopes

Public service imports include:

```python
from google.adk.sessions import BaseSessionService, InMemorySessionService, Session, State
```

The abstract lifecycle signatures are:

```text
google/adk/sessions/base_session_service.py:61-68
async def create_session(*, app_name, user_id, state=None, session_id=None) -> Session

:83-90  async def get_session(*, app_name, user_id, session_id, config=None) -> Session | None
:94-96  async def list_sessions(*, app_name, user_id=None) -> ListSessionsResponse
:109-111 async def delete_session(*, app_name, user_id, session_id) -> None
:154     async def append_event(self, session: Session, event: Event) -> Event
```

State scope syntax is exact:

```text
google/adk/sessions/state.py:61-73
State.APP_PREFIX = "app:"
State.USER_PREFIX = "user:"
State.TEMP_PREFIX = "temp:"
State(value: dict, delta: dict, schema: type[BaseModel] | None = None)
```

- Unprefixed keys are session state.
- `user:` is shared by the same user within an app.
- `app:` is shared across users/sessions in the app.
- `temp:` exists only for the current invocation and is removed before persistence (`base_session_service.py:154-202`).
- `_session_util.extract_state_delta` removes app/user prefixes for their stores, keeps bare keys as session scope, and omits temp from persisted deltas (`sessions/_session_util.py:37-50`).

There is no `session:` prefix constant: a named `State.SESSION_PREFIX` is **not present in installed version**; session scope is the unprefixed default.

### Artifact services

Public imports include `BaseArtifactService`, `FileArtifactService`, `GcsArtifactService`, and `InMemoryArtifactService` from `google.adk.artifacts` (`artifacts/__init__.py:20-38`). Core signatures:

```text
google/adk/artifacts/base_artifact_service.py:91-100
async def save_artifact(*, app_name, user_id, filename,
                        artifact: types.Part | dict,
                        session_id=None, custom_metadata=None) -> int

google/adk/artifacts/base_artifact_service.py:126-134
async def load_artifact(*, app_name, user_id, filename,
                        session_id=None, version=None) -> types.Part | None
```

`save_artifact` returns a monotonically incremented revision starting at 0. `session_id=None` means user-scoped storage; providing it means session-scoped. The service also exposes list keys, delete, list versions, version metadata, and `get_artifact_version` (`base_artifact_service.py:153-259`).

Within callbacks/nodes, `Context` provides narrower session-bound wrappers:

```text
google/adk/agents/context.py:571-573
async def load_artifact(self, filename: str, version: int | None = None) -> types.Part | None

google/adk/agents/context.py:594-599
async def save_artifact(self, filename: str, artifact: types.Part,
                        custom_metadata: dict[str, Any] | None = None) -> int
```

The wrapper supplies current app/user/session IDs and records the resulting version in `event_actions.artifact_delta` (`context.py:584-621`).

## Structural conventions from the local Google Agents CLI skills

Inspected local copies:

| Skill | `SKILL.md` lines | Reference layout |
| --- | ---: | --- |
| `google-agents-cli-workflow` | 310 | Five small files: commands (12), internals (24), samples (59), spec template (25), terminology (11). |
| `google-agents-cli-adk-code` | 72 | A short router plus two deep references: `adk-python.md` (937) and `adk-workflows.md` (507). |
| `google-agents-cli-scaffold` | 246 | One focused `references/flags.md` (45). |
| `google-agents-cli-eval` | 434 | Five topic references: built-in tools (145), dataset schema (239), metrics (135), multimodal (142), user simulation (107). |

Conventions worth following for skills-vNext:

1. **Frontmatter:** all four use `name`, folded trigger-rich `description`, then `metadata.author`, `license`, `version`, and `requires.bins/install`. The descriptions include positive triggers plus explicit “do not use for” routing. Agent Factory should copy the routing clarity; richer metadata should be adopted only if its skill loader supports it.
2. **Entrypoint/work separation:** workflow is the lifecycle entrypoint; the work skills point back to it. `adk-code` is intentionally only 72 lines and routes detailed API material into references (`adk-code/SKILL.md:22-65`).
3. **Section order:** trigger/frontmatter -> title and prerequisite/continuity notice -> ordered phases or steps -> operational rules/gotchas -> reference index -> related skills/version/troubleshooting. The entrypoint owns lifecycle order; work skills own one phase.
4. **Stage/phase tables:** workflow uses one explicit Phase -> Skill -> When-to-load table (`workflow/SKILL.md:35-49`). Eval states a five-stage quality loop before command details (`eval/SKILL.md:39-75`). Other tables are decision maps, not duplicate workflows.
5. **Re-read before each stage:** workflow explicitly says to re-read the relevant skill **before** every phase because context compaction may have dropped it (`workflow/SKILL.md:35-37`). This is the strongest convention to carry into a multi-stage Agent Factory entrypoint.
6. **Reference layout:** `references/` is indexed by a compact “file / when to read” table. Large, specialist material stays out of the router; tiny command/terminology files remain separately addressable. Reference selection is progressive, not read-all-up-front.
7. **Exit criteria:** phase boundaries use observable stop language. Examples: do not proceed from Understand until user intent is obtained (`workflow:69-95`); do not leave sample study until reuse is stated (`:97-105`); do not deploy before eval thresholds and human approval (`:163-175`); eval requires final all-case evidence before deploy (`eval:417-424`). The form is condition -> evidence -> explicit stop/proceed rule.

Recommended structural adoption is therefore: one compact `af-workflow` phase router, one canonical Work Skill per phase, re-read-before-stage instructions, one-reference-at-a-time routing tables, explicit evidence-based exit criteria, and detailed API/contracts in topic references rather than a monolithic `SKILL.md`.

Checked date: 2026-07-18

Exact paths verified: `.agent-factory/runtime/.venv/bin/python`; `.agent-factory/runtime/.venv/bin/pip`; `.agent-factory/runtime/.venv/bin/adk`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/version.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/base_agent.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/llm_agent.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/callback_context.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/context.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/remote_a2a_agent.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/tool_context.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/plugins/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/plugins/base_plugin.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/events/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/events/request_input.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/events/event.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/events/event_actions.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/models/llm_response.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/runners.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_base_node.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_function_node.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_workflow.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_join_node.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_node.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_trigger.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/utils/_workflow_hitl_utils.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/agent/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/agent/config.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/utils/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/utils/agent_to_a2a.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/utils/agent_card_builder.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/mcp_tool/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/mcp_tool/mcp_session_manager.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/mcp_tool/mcp_toolset.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/base_toolset.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/cli/api_server.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/cli/cli_tools_click.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/cli/trigger_routes.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/pubsub/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/pubsub/config.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/pubsub/pubsub_credentials.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/pubsub/pubsub_toolset.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/tools/pubsub/message_tool.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/sessions/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/sessions/state.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/sessions/base_session_service.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/sessions/in_memory_session_service.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/sessions/_session_util.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/artifacts/__init__.py`; `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/artifacts/base_artifact_service.py`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/SKILL.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/references/commands.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/references/internals.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/references/samples.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/references/spec-template.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-workflow/references/terminology.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-adk-code/SKILL.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-adk-code/references/adk-python.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-adk-code/references/adk-workflows.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-scaffold/SKILL.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-scaffold/references/flags.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/SKILL.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/references/builtin-tools-eval.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/references/dataset_schema.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/references/metrics-guide.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/references/multimodal-eval.md`; `/home/ilmaswsl/.agents/skills/google-agents-cli-eval/references/user-simulation.md`.
