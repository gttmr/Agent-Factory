# ADK 2.3 Data Handling

Use this reference to review generated state and artifact channel lowering. Do not add ad hoc data plumbing.

## Graph IR Inputs

Relevant edge fields:

- `edge_kind: "session_state"`, `"temp_state"`, `"user_state"`, `"app_state"`
- `state_key`
- `edge_kind: "artifact"`
- `artifact_key`

State edge scope comes from `edge_kind`. Bare `state_key` values are preferred; matching prefixes `temp:`, `user:`, and `app:` are tolerated only for the matching scope.

## Generator Mapping

| Graph IR | Generated behavior |
| --- | --- |
| agent outgoing state | usually `LlmAgent(output_key=...)` |
| function/adapter outgoing state | mirrors payload into `ctx.state[...]` |
| connected adapter incoming state | `_collect_tool_inputs(...)` reads reviewed channel payloads |
| artifact output | `ctx.save_artifact(...)` using reviewed `artifact_key` |
| artifact input | `ctx.load_artifact(...)`, currently for connected MCP adapters |

## Guardrails

Generation stops before writing runnable output when:

- one agent has multiple distinct outgoing state channels
- an agent produces artifact channels
- a non-connected node consumes state channels
- a non-connected node consumes artifact channels
- multiple producers write the same state key
- a state edge lacks `state_key`
- an artifact edge lacks `artifact_key`

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop on any state/artifact validation error or data-channel generator error.

## Grounding

- `https://adk.dev/graphs/data-handling/ (captured 2026-07-08)`
- `scripts/adk-source/channels.mjs`
- `scripts/adk-source/emitters/agent-node.mjs`
- `scripts/adk-source/emitters/function-node.mjs`
- `scripts/adk-source/emitters/connected-adapter.mjs`
- `scripts/adk-source/emitters/runtime-tool-inputs.mjs`
- `scripts/validate-artifacts.mjs`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/context.py`
