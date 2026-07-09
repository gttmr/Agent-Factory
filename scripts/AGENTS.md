# Root Scripts

## Scope

`scripts` contains dependency-light root validators and source generators used by
Agent Factory artifacts and web package tests.

## Files

- `validate-artifacts.mjs`: validates templates, exported artifact roots, taxonomy, Graph IR, Remote A2A, runtime contract, and scaffold guards.
- `validate-artifacts.test.mjs`: node:test coverage for validator invariants, including analyzer/schema/validator enum alignment.
- `generate-adk-source.mjs`: builds smoke or reviewed runnable ADK handoff bundles from approved artifact roots.
- `generate-adk-source.test.mjs`: regression coverage for generated output and guardrails.

## Local Rules

- Keep scripts runnable from repo root without importing web package build output.
- Generator input must be an approved scaffold plan with `source: approved_workbench_artifact` and `raw_requirement_to_code: false`.
- Generator defaults must be framework/runtime-neutral; scenario labels, route aliases, adapter hints, and business terms belong in reviewed artifacts or catalog/mock specs.
- Validator constants duplicated from web analyzer types must be updated together with schemas, templates, docs, and tests; the enum alignment test must stay green.
- Generated output belongs under ignored artifact/runtime directories, not source.

## Anti-Patterns

- Do not hard-code workflow-specific literals to make one scenario pass.
- Do not generate private endpoints, credentials, deployment scripts, real customer data, or production business logic.
- Do not weaken validator errors without adding a reviewed compatibility reason and regression.

## Verification

```bash
node scripts/validate-artifacts.test.mjs
node scripts/generate-adk-source.test.mjs
node scripts/validate-artifacts.mjs
```

For web-facing generator or validator changes, also run `cd packages/web && npm run build`.
