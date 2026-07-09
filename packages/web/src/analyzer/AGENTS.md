# Analyzer Domain Layer

## Scope

This directory owns client-side artifact semantics: taxonomy, graph migration,
review gates, scaffold-plan derivation, runtime-contract modeling, import/export,
and tests for those contracts.

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

- Keep top-level categories to `agent`, `workflow`, `adapter`, `remote_a2a`.
- Keep Graph IR execution details out of taxonomy values; sequence, route, join, loop, human input, and fan-out live in Graph IR.
- `legacy_recommended_type` is migration metadata only.
- Candidate-level missing information is a hard scaffold blocker; requirement-level missing information is reviewer-attested.
- Analyzer enums must stay aligned with `schemas/*.schema.json`, `scripts/validate-artifacts.mjs`, `scripts/generate-adk-source.mjs`, and badges.

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
