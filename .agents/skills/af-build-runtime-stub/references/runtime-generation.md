# Runtime Generation

Runtime generation is a handoff step, not production implementation.

## Required Inputs

- `analysis-result.json`
- `normalized-requirement.json` or `analysis-result.json.normalizedRequirement`
- `process-flow.json` or `analysis-result.json.processFlow`
- `module-candidates.json` or `analysis-result.json.moduleCandidates`
- `scaffold-plan.json`
- optional `af-run-manifest.json`

`scaffold-plan.json` must have `source: "approved_workbench_artifact"` and `raw_requirement_to_code: false`.

## Command

Manual command:

```bash
node scripts/generate-adk-source.mjs <artifact-root> <artifact-root>/runtime-stub
```

The Workbench compound path builds the same command from the artifact root.

## Generator Preconditions

Generation stops when:

- `scaffold-plan.json` has blockers
- no approved modules exist
- manifest approvals are missing when `af-run-manifest.json` is present
- design stage is not complete when a manifest is present
- Graph IR validation errors exist
- `runtimeContracts` or embedded `a2aContracts` are unapproved
- scaffold modules are not approved in source analysis artifacts

## Expected Output Shape

`runtime-stub/` includes generated Python package files, `scaffold-plan.json`, `workflow_manifest.json`, `agent.json`, tests, and `implementation-handoff.md`.

## Grounding

- `scripts/generate-adk-source.mjs`
- `scripts/adk-source/context.mjs`
- `scripts/adk-source/file-builder.mjs`
- `scripts/adk-source/agent.mjs`
