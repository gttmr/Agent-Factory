# Runtime Contract Review

Review runtime support as contracts, not taxonomy categories.

## Contract Locations

- `analysis-result.json.runtimeContracts[]`
- `scaffold-plan.json.runtime_contracts[]` after artifact sync

## Contract Kinds

Use only current runtime contract kinds:

- `mcp_legacy_adapter`
- `eai_legacy_adapter`
- `context_manager`
- `callback_broker`
- `adk_callback`
- `async_resume`

## Review Questions

| Area | Required decision |
| --- | --- |
| identifiers | job, transaction, correlation, callback, or audit identifiers |
| policies | auth, timeout, retry, fallback, idempotency, compensation |
| graph annotations | where wait/resume/callback behavior appears in Graph IR |
| LLM exposure | safe summary or reference, never raw legacy payload |
| status | `approved`, `needs_info`, `draft`, or `rejected` |

## Build Gate

Build requires approved runtime contracts. The skill may report readiness but must not patch `manifest.approvals.runtime_contracts_approved`.

## Stop Conditions

- Required runtime contract missing.
- Required contract remains `draft` or `needs_info`.
- External callback is modeled as an ADK Agent receiving raw callback traffic.
- Context Manager is treated as ADK memory instead of workflow execution state.

## Grounding

- `scripts/artifact-validation/constants.mjs`
- `scripts/validate-artifacts.mjs`
- `scripts/adk-source/context.mjs`
- `packages/web/src/analyzer/types.ts`
