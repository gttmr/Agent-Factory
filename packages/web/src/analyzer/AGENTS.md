# Analyzer Domain Layer

## Scope

This directory owns strict Target Contract v2 client semantics: asset taxonomy,
Graph IR validation, review gates, scaffold-plan derivation, runtime contracts,
A2A Agent boundaries, and artifact import validation.

Target taxonomy is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md),
and Graph semantics in [Graph IR](../../../../docs/workbench/graph-ir.md).

## Where To Look

| Task | Files |
| --- | --- |
| Artifact and Graph IR types | `types.ts` |
| Exact Target v2 validation | `targetContract.ts` |
| Strict analysis import/read boundary | `analysisArtifactImport.ts`, `targetAnalysisResult.ts` (`parseTargetAnalysisResult`) |
| Classification labels and taxonomy UI text | `classificationRules.ts` |
| Graph IR validation | `graphValidation.ts` (`validateGraphIR`) |
| Asset review status and Graph IR sync | `assetReview.ts` |
| Scaffold-plan blockers and warnings | `scaffoldPlan.ts` |
| Runtime support contracts | `runtimeContracts.ts` |
| A2A Agent contracts and local provider import | `a2aContracts.ts`, `localA2aProvider.ts` |

## Local Rules

- Require `contract_version: "2.0"` and exact top-level fields at every analysis read boundary.
- Keep `asset_type` limited to `agent`, `workflow`, and `tool`.
- Keep Graph nodes limited to `input`, `agent`, `tool`, `function`, `human_input`, `subworkflow`, `join`, and `output`.
- Keep edge execution in `control`, data transfer in optional `channel`, and regions limited to `parallel` or `loop`.
- Preserve `workflow_ref: null` for standalone Agent or Tool solutions.
- Tool nodes use `tool_ref`; Agent nodes use `agent_ref` and optional `available_tools`; Subworkflow nodes use `workflow_ref`.
- A2A is valid only as an Agent binding or exposure linked to an A2A contract.
- Read-boundary functions validate and return strict input unchanged; they must not repair, migrate, coerce, or backfill it.
- Candidate-level missing information is a hard scaffold blocker; requirement-level missing information is reviewer-attested.
- Keep enums aligned with schemas, validators, generator inputs, badges, templates, and analyzer tests.

## Anti-Patterns

- Do not broaden strict types or read boundaries to accept retired fields or enum values.
- Do not infer A2A from local multi-step complexity.
- Do not bypass `raw_requirement_to_code=false` or approved-artifact guards in derived scaffold plans.
- Do not serialize derived Graph validation state into Graph IR.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```
