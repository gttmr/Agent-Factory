# Artifact Sync Build

Build starts from canonical `analysis-result.json`, not from raw requirements and not from a proposed run folder.

## Primary Workbench Path

Workbench Build calls:

```text
POST /api/af/:reqId/artifact-sync/run
```

Request body fields:

| Field | Meaning |
| --- | --- |
| `outputMode` | optional `smoke` or `runnable` |
| `rebuildRuntimeStub` | defaults to `true` |
| `runValidation` | defaults to `true` |
| `streamProgress` | optional SSE progress |

The endpoint order is:

1. read canonical `analysis-result.json`
2. resolve output mode
3. write derived `normalized-requirement.json`, `module-candidates.json`, `process-flow.json`, and `scaffold-plan.json`
4. optionally run `node scripts/generate-adk-source.mjs <artifact-root> <artifact-root>/runtime-stub`
5. optionally run `node scripts/validate-artifacts.mjs <artifact-root>`

This path does not accept or save a Graph IR payload. Known side effect: when the generator runs (`rebuildRuntimeStub: true`) and `af-run-manifest.json` exists, `scripts/adk-source/run-manifest.mjs` sets `current_stage: "build"`, marks the build stage complete, and sets `approvals.stub_ready_for_followup: true`. That is generator-owned build-completion recording. The skill itself must never hand-edit `manifest.approvals.*` or stage statuses.

## Manual Equivalent

Standalone mode has no sync CLI. Precondition: a derived `scaffold-plan.json` must already exist in the artifact root (produced earlier by Workbench artifact-sync or a saved Design-stage derivation). `scripts/generate-adk-source.mjs` fails without an approved plan. If the plan is missing, use the Workbench path above.

With the plan present, perform:

```bash
node scripts/validate-artifacts.mjs <artifact-root>
node scripts/generate-adk-source.mjs <artifact-root> <artifact-root>/runtime-stub
node scripts/validate-artifacts.mjs <artifact-root>
```

## Stop Conditions

- `analysis-result.json` is missing or invalid.
- `outputMode` is not `smoke` or `runnable`.
- `scaffold-plan.json` is absent after sync.
- Validation reports blockers or drift that the reviewer has not resolved.

## Grounding

- `packages/web/server/artifactSyncRunApi.ts`
- `packages/web/server/artifactSync.ts`
- `scripts/adk-source/run-manifest.mjs`
- `packages/web/server/artifactSyncProcessSteps.ts`
- `packages/web/server/afArtifactsApi.ts`
- `docs/workbench/agent-factory-harness.md`
