# Artifact Schemas

## Scope

`schemas` contains the strict Target Contract v2 JSON Schemas used by the
validator, analyzer, templates, and workbench UI. Current readers require
`contract_version: "2.0"` and reject retired shapes instead of migrating,
coercing, or backfilling them.

Asset and Graph meanings are canonical in [Taxonomy](../docs/workbench/taxonomy.md)
and [Graph IR](../docs/workbench/graph-ir.md).

## Structure

- `analysis-result.schema.json`: canonical aggregate analysis artifact.
- `analysis-draft.schema.json`: strict analysis draft reference to the aggregate contract.
- `normalized-requirement.schema.json`: normalized request shape.
- `asset-candidate.schema.json`: Agent, Workflow, and Tool candidate contract.
- `graph.schema.json`: Graph IR nodes, edges, and regions.
- `af-run-manifest.schema.json`: complete lifecycle stage, approval, and validation state.
- `classification.schema.json`: supporting Asset classification output.
- `scaffold-plan.schema.json`: approved Runtime Handoff input.
- `a2a-contract.schema.json`: A2A protocol contract for an Agent boundary.

The derived analysis split is `asset-candidates.json` plus `graph-ir.json`.
`analysis-result.json` remains the canonical aggregate source.
Retired `module-candidates.json`, `process-flow.json`, and
`commonization-notes.json` have no active schema; rejection tests prevent their
return as supported artifact surfaces.

## Local Rules

- Keep `asset_type` limited to `agent`, `workflow`, and `tool`.
- Keep Graph nodes limited to `input`, `agent`, `tool`, `function`, `human_input`, `subworkflow`, `join`, and `output`.
- Graph edges separate `control` from the optional `channel`; regions are only `parallel` or `loop`.
- Allow `graph.workflow_ref: null` for a standalone Agent or Tool solution.
- Model A2A through Agent binding or exposure and its contract reference, never as an asset category.
- Keep schemas aligned with `packages/web/src/analyzer/types.ts`, `targetContract.ts`, templates, and validator tests.
- Tighten contracts only with matching source, fixture, and regression updates.
- Preserve `raw_requirement_to_code=false` and approved-artifact posture in scaffold-plan contracts.

## Anti-Patterns

- Do not broaden strict read boundaries to accept retired artifact shapes or enum values.
- Do not add schema fields for scenario-specific hard-coded workarounds.
- Do not loosen `additionalProperties` without a reviewed contract change.
- Do not model MCP or A2A as another top-level asset type.

## Verification

```bash
node scripts/validate-artifacts.mjs
cd packages/web && npm run test:analyzer
cd packages/web && npm run build
```

Update templates and root validator tests when schema behavior changes.
