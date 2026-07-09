# Missing-Information Gates

Use this reference whenever a requirement or module candidate is incomplete.

## Two-Layer Rule

| Location | Field | Gate |
| --- | --- | --- |
| requirement evidence | `evidence.missing_information` | soft gate; may proceed with explicit assumptions or reviewer acceptance |
| module candidate | `ModuleCandidate.missing_information` | hard gate; blocks approval and scaffold generation |
| module candidate | `status: "needs_info"` | hard gate until resolved and applied |

Candidate-level missing information must not be hidden inside assumptions.

## Resolution Fields

Use existing candidate fields when a reviewer closes missing information:

- `missing_information_resolution`
- `resolved_missing_information`
- `resolution_draft`
- `resolution_applied_at`
- `schema_review_state`
- `smoke_spec`

Do not mark a candidate approved while `missing_information` is non-empty.

## Build Blocker

`buildScaffoldPlan` and `scripts/adk-source/context.mjs` block unresolved candidate missing information before Runtime Handoff generation.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Stop if an approved candidate still has unresolved `missing_information` or if `status: "needs_info"` is included in a scaffold plan.

## Grounding

- `docs/workbench/agent-factory-harness.md`
- `packages/web/src/analyzer/types.ts`
- `packages/web/src/analyzer/scaffoldPlan.ts`
- `scripts/adk-source/context.mjs`
