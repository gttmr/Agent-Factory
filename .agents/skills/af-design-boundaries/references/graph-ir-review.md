# Graph IR Review

Review Graph IR as the execution contract that Build consumes.

## Node Checks

- Module-bound nodes must reference existing module candidates.
- Synthetic nodes such as `input`, `output`, `join`, `router`, `loop_control`, `human_input`, and `callback_wait` must not bind to module candidates.
- Node kind must match candidate category: agent, workflow/workflow_call, adapter/adapter_call, remote_a2a/remote_agent_call.
- Local root containers should contain local graph/dynamic workflow nodes; remote boundaries stay explicit.

## Edge Checks

| Edge kind | Required fields |
| --- | --- |
| `route` | non-empty `route_condition` |
| state edges | non-empty `state_key` |
| `artifact` | non-empty `artifact_key` |
| `remote_a2a` | coherent remote endpoint and contract link |
| callback/resume | reviewed callback metadata and runtime contract tie |

Prefer bare `state_key`; use `temp:`, `user:`, or `app:` prefix only when it matches the edge kind.

## ADK Feature Review

- Routes and joins must be reachable and reviewed.
- State/artifact channels must satisfy generator guardrails.
- `human_input` nodes need reviewed prompt and runnable response schema.
- Loop/dynamic shapes need reviewed loop control metadata.
- Remote A2A edges need approved embedded contracts.

## Stop Conditions

- isolated active module-bound nodes
- graph validation errors
- unsupported static back-edge loop that has not been routed through dynamic lowering
- Graph IR edits that silently approve candidates or contracts

## Grounding

- `scripts/validate-artifacts.mjs`
- `scripts/artifact-validation/constants.mjs`
- `scripts/adk-source/graph/lowering.mjs`
- `scripts/adk-source/graph/dynamic.mjs`
- `packages/web/src/analyzer/types.ts`
