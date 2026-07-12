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

This path does not accept or save a Graph IR payload. The generator CLI is pure file generation and never touches `af-run-manifest.json`. After a successful server-side generation (`rebuildRuntimeStub: true` or the Build primitive), the calling server layer records orchestration metadata only — `current_stage: "build"` and the generated file list in `stages.build.outputs`. Stage statuses and `manifest.approvals.*` (including `stub_ready_for_followup`) change only through the reviewer-driven approvals PATCH; neither generation nor this skill may set them.

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
- `packages/web/server/runManifestBuild.ts`
- `packages/web/server/artifactSyncProcessSteps.ts`
- `packages/web/server/afArtifactsApi.ts`
- `docs/workbench/agent-factory-harness.md`
