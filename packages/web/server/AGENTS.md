# Web Server Middleware

## Scope

`packages/web/server` contains Vite middleware for filesystem-backed workbench
APIs. It enforces strict Target Contract v2 at server read and write boundaries
and connects routes to artifact roots, Stage Runner, Catalog publish, runtime
controls, collaboration files, and integrated Mock Lab endpoints.

Asset and Graph meanings are canonical in [Taxonomy](../../../docs/workbench/taxonomy.md)
and [Graph IR](../../../docs/workbench/graph-ir.md).

## Where To Look

| Task | Files |
| --- | --- |
| Artifact root reads, writes, and allowlists | `artifactRootStore.ts`, `afArtifactsApi.ts`, `afArtifactCrudApi.ts` |
| Strict analysis validation | `analysisResultValidation.ts`, `validators.ts` |
| Derived artifact synchronization | `artifactSync.ts`, `artifactSyncRunApi.ts`, `artifactSyncCatalog.ts` |
| Stage Runner and direct analyzer | `stageRunner.ts`, `codexAnalyzer.ts` |
| Catalog index and approval publish | `afCatalogApi.ts`, `catalogPublishTarget.ts`, `catalogPublishValidation.ts` |
| Runtime env, chat, and A2A controls | `runtimeEnv.ts`, `runtimeChat.ts`, `runtimeA2a.ts` |
| Collaboration comments and highlights | `afCollaborationApi.ts` |

## Local Rules

- Validate `analysis-result.json` as exact `contract_version: "2.0"`; do not migrate, coerce, or backfill rejected input.
- Artifact sync derives `asset-candidates.json` and `graph-ir.json` from `analysis-result.json`; it never writes retired split names.
- Preserve proposed-artifact-before-canonical behavior for Analyze and Design runs. Build records canonical `runtime-stub/` side effects, and Verify proposes report and delta artifacts.
- Do not add artifact write paths without updating the allowlist and active docs.
- Catalog reads and publish targets are only `agents.yaml`, `workflows.yaml`, and `tools.yaml`.
- A2A runtime APIs operate on Agent protocol contracts; they do not create another asset category.
- Approval patches must mirror matching `stages.<stage>.status` for external tools.
- Stage Runner invokes Codex with constrained repository behavior; do not change network or approval policy casually.
- Keep process output, diagnostics, and run metadata under the artifact root, not in package source.

## Anti-Patterns

- Do not broaden strict API boundaries to accept retired shapes or enum values.
- Do not store secrets, raw credentials, or private endpoints in runtime env examples or run records.
- Do not let server endpoints directly edit seed `catalog/*.yaml` except the reviewed publish path.
- Do not make Stage Runner success toggle review gates automatically.

## Verification

- Server changes normally require `cd packages/web && npm run build`.
- Run `cd packages/web && npm run test:analyzer` when touching Stage Runner, Catalog API, Runtime, or artifact APIs.
