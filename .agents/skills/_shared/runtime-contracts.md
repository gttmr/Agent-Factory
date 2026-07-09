# Runtime Contracts

Runtime support is reviewed through `AnalysisResult.runtimeContracts`, not by adding taxonomy categories.

## Runtime Contract Kinds

Allowed `contract_kind` values:

- `mcp_legacy_adapter`
- `eai_legacy_adapter`
- `context_manager`
- `callback_broker`
- `adk_callback`
- `async_resume`

Allowed `contract_status` values: `draft`, `needs_info`, `approved`, `rejected`.

## Required Build Readiness

Before Build:

- required `runtimeContracts[]` are present in `analysis-result.json`
- required runtime contracts have `contract_status: "approved"`
- required `scaffold-plan.json.runtime_contracts[]` entries have `contract_status: "approved"`
- Remote A2A contracts are embedded in `analysis-result.json.a2aContracts[]`
- required A2A contracts have `contract_status: "approved"`

Skills report missing approvals; they do not toggle `manifest.approvals.*`.

## Runtime Support Notes

| Support | Record when |
| --- | --- |
| Context Manager | state must survive agent turns or legacy callbacks |
| Callback Broker | an HTTP/event boundary receives EAI or legacy callbacks |
| ADK callbacks | validation, masking, audit, tool blocking, or safe resume controls |
| Async resume | a legacy operation returns only a `job_id` or correlation id |

Expose safe summaries or result references to LLM nodes. Do not expose raw legacy payloads.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop if required runtime contracts or A2A contracts are unapproved.

## Grounding

- `scripts/artifact-validation/constants.mjs`
- `packages/web/src/analyzer/types.ts`
- `scripts/validate-artifacts.mjs`
- `scripts/adk-source/context.mjs`
