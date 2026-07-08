# Analysis Result Shape

`analysis-result.json` is the canonical combined artifact.

## Required Top-Level Fields

```text
normalizedRequirement
evidence
moduleCandidates
a2aContracts
runtimeContracts
processFlow
```

`a2aContracts` and `runtimeContracts` are always arrays, even when empty.

## Candidate Shape

Each candidate needs:

- `id`
- `source_requirement_id`
- `name`
- `module_category`
- matching subtype field where applicable
- `confidence`
- `rationale`
- `inputs`
- `outputs`
- `reuse_candidate`
- `risk_level`
- `risk_signals`
- `status`
- `missing_information`

Remote candidates also need contract evidence and an embedded `a2aContracts[]` entry before they can be approved later.

## Runtime Contracts

Add `runtimeContracts[]` only when support behavior must be reviewed, such as Context Manager, Callback Broker, ADK callback, or async resume.

## Output Discipline

Analyze does not write:

- `scaffold-plan.json`
- `runtime-stub/`
- `catalog/*.yaml`
- approval fields
- production runtime code

## Grounding

- `packages/web/src/analyzer/types.ts`
- `scripts/validate-artifacts.mjs`
- `schemas/analysis-result.schema.json`
