# Analyzer Domain Layer

## Scope

This directory owns client-side artifact semantics: taxonomy, graph migration,
review gates, scaffold-plan derivation, runtime-contract modeling, import normalization,
and tests for those contracts.

The analyzer's machine-aligned `module_category` and subtype enums are Current Implementation (`legacy`); Target taxonomy is [Taxonomy](../../../../docs/workbench/taxonomy.md), Graph semantics are [Graph IR](../../../../docs/workbench/graph-ir.md), and the gap is tracked in `docs/migration/taxonomy-vnext-status.md`.

## Where To Look

| Task | Files |
| --- | --- |
| Artifact and Graph IR types | `types.ts` |
| Classification labels and taxonomy UI text | `classificationRules.ts` |
| Scaffold-plan blockers and warnings | `scaffoldPlan.ts` |
| Graph IR migrations and soft validation | `graphMigration.ts` |
| Module review status and Graph IR sync | `moduleReview.ts`, `moduleReviewGraph.ts` |
| Runtime support contracts | `runtimeContracts.ts` |
| Import normalization | `analysisArtifactImport.ts` |

## Local Rules

- Keep the Current Implementation `legacy` top-level categories aligned as `agent`, `workflow`, `adapter`, and `remote_a2a`; do not present that serialized set as the Target asset taxonomy.
- Keep Graph IR execution details out of taxonomy values; sequence, route, join, loop, human input, and fan-out live in Graph IR.
- `legacy_recommended_type` is migration metadata only.
- Candidate-level missing information is a hard scaffold blocker; requirement-level missing information is reviewer-attested.
- Analyzer enums must stay aligned with `schemas/*.schema.json`, `scripts/artifact-validation/constants.mjs`, `scripts/generate-adk-source.mjs`, and badges; `scripts/validate-artifacts.test.mjs` machine-enforces analyzer/schema/validator enum alignment through `npm run test:analyzer`.

## Anti-Patterns

- Do not infer Remote A2A from local multi-step complexity.
- Do not bypass `raw_requirement_to_code=false` or approved-artifact guards in derived scaffold plans.
- Do not hide UI-only compatibility aliases in schemas without validator coverage.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```
