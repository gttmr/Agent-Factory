# ADK 2.3 Human Input

Use this reference to review generated `human_input` lowering. Do not claim every ADK graph must use this exact pattern; it is the current Agent Factory generator behavior.

## Graph IR Inputs

Relevant fields:

- node `node_kind: "human_input"`
- node `human_input_contract.message`
- node `human_input_contract.payload_schema_ref`
- node `human_input_contract.response_schema_ref`
- node `human_input_contract.choice_options`
- node `human_input_contract.accepted_aliases`
- node `human_input_contract.default_choice`

## Generator Mapping

The generator emits a function that:

- reads the first resume input
- yields `RequestInput(message=..., payload=..., response_schema=...)` when no resume input exists
- returns a payload with the human response after resume
- declares a `FunctionNode(..., rerun_on_resume=True)` wrapper

`response_schema_ref` is currently runnable only when absent/null or `"str"`. Numeric choice aliases may intentionally omit `response_schema=str`.

## ADK Runtime Source

Installed ADK source confirms:

- `RequestInput` has `interrupt_id`, `payload`, `message`, and `response_schema`
- `FunctionNode` has a `rerun_on_resume` constructor parameter

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop if `response_schema_ref` is anything except null/absent or `"str"` for runnable output.

## Grounding

- `https://adk.dev/graphs/human-input/ (captured 2026-07-08)`
- `scripts/adk-source/emitters/hitl.mjs`
- `scripts/validate-artifacts.mjs`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/events/request_input.py`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_function_node.py`
