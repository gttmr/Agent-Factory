# Artifact Schemas

## Scope

`schemas` contains JSON Schema contracts for Agent Factory artifacts. These are
source-of-truth contracts for validator, analyzer, templates, and workbench UI.

## Structure

- `analysis-result.schema.json`: canonical combined analysis artifact.
- `analysis-draft.schema.json`: live analyzer compact draft schema.
- `normalized-requirement.schema.json`: normalized request shape.
- `module-candidate.schema.json`: candidate taxonomy and review fields.
- `process-flow.schema.json`: Graph IR nodes, containers, lanes, and edges.
- `classification.schema.json` and `commonization-notes.schema.json`: supporting analysis outputs.
- `scaffold-plan.schema.json`: approved Runtime Handoff input.
- `a2a-contract.schema.json`: Remote A2A contract artifact.

## Local Rules

- Keep schema enums aligned with `packages/web/src/analyzer/types.ts`, `classificationRules.ts`, UI badges, templates, validator constants, and source generator assumptions. `scripts/validate-artifacts.test.mjs` machine-enforces analyzer/schema/validator enum alignment.
- Tighten contracts only with matching migration/normalization and regression fixture updates.
- `analysis-draft` can differ from final `analysis-result`, but server hydration must bridge them explicitly.
- Preserve `raw_requirement_to_code=false` and approved-artifact posture in scaffold-plan contracts.

## Anti-Patterns

- Do not add schema fields only because one scenario needs a hard-coded workaround.
- Do not loosen `additionalProperties` without a concrete compatibility reason.
- Do not add Remote A2A shortcuts that bypass required contract details.

## Verification

```bash
node scripts/validate-artifacts.mjs
cd packages/web && npm run test:analyzer
cd packages/web && npm run build
```

Update templates and root validator tests when schema behavior changes.
