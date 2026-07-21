# Root Scripts

## Scope

`scripts` contains dependency-light root validators and source generators used by
Agent Factory artifacts and web package tests.

Validators and generators consume only strict Target Contract v2 artifacts. Retired
keys, selector values, and filenames are rejected, and lowering dispatches directly
on Target fields. Target meanings are canonical in
[Taxonomy](../docs/workbench/taxonomy.md) and [Graph IR](../docs/workbench/graph-ir.md).

## Files

- `validate-artifacts.mjs`: validates templates, exported artifact roots, taxonomy, Graph IR, Remote A2A, runtime contract, and scaffold guards.
- `validate-artifacts.test.mjs`: node:test coverage for validator invariants, including analyzer/schema/validator enum alignment.
- `generate-adk-source.mjs`: builds smoke or reviewed runnable ADK handoff bundles from approved artifact roots.
- `generate-adk-source.test.mjs`: regression coverage for generated output and guardrails.

## Local Rules

- Keep scripts runnable from repo root without importing web package build output.
- Generator input must be an approved scaffold plan with `source: approved_workbench_artifact` and `raw_requirement_to_code: false`.
- Generator defaults must be framework/runtime-neutral; scenario labels, route aliases, Tool binding hints, and business terms belong in reviewed artifacts or catalog/mock specs.
- Target validator enums and required keys must stay aligned with schemas, templates, web analyzer types, docs, and tests; the agreement test must stay green.
- Generated output belongs under ignored artifact/runtime directories, not source.

## Anti-Patterns

- Do not hard-code workflow-specific literals to make one scenario pass.
- Do not generate private endpoints, credentials, deployment scripts, real customer data, or production business logic.
- Do not weaken validator errors or admit partial or retired shapes; contract changes require canonical schema and regression updates.

## Verification

```bash
node scripts/validate-artifacts.test.mjs
node scripts/generate-adk-source.test.mjs
node scripts/validate-artifacts.mjs
```

For web-facing generator or validator changes, also run `cd packages/web && npm run build`.
