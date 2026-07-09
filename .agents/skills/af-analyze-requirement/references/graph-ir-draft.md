# Graph IR Draft

Draft Graph IR as reviewed process structure, not generated code.

## Process Flow Parts

Use existing schema vocabulary for:

- nodes
- edges
- containers
- lanes
- execution semantics
- validation warnings/errors

## Node Kinds

Use current node kinds such as:

- `input`
- `output`
- `agent`
- `adapter_call`
- `workflow_call`
- `router`
- `join`
- `human_input`
- `loop_control`
- `callback_wait`
- `remote_agent_call`

Module-bound node kinds must match candidate categories.

## Edge Kinds

Use current edge kinds:

- `event_output`
- `event_message`
- `session_state`
- `temp_state`
- `user_state`
- `app_state`
- `artifact`
- `route`
- `control`
- `remote_a2a`

State edges need `state_key`; artifact edges need `artifact_key`; route edges need `route_condition`.

## Drafting Rules

- Model sequence, fan-out/fan-in, loop, route, join, human input, callback wait, resume, and remote boundary details in Graph IR.
- Do not create new taxonomy categories for workflow details.
- Keep unsupported or uncertain runtime behavior as missing information or warnings.

## Grounding

- `packages/web/src/analyzer/types.ts`
- `scripts/artifact-validation/constants.mjs`
- `scripts/validate-artifacts.mjs`
