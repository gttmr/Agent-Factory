# Web Server Middleware

## Scope

`packages/web/server` contains Vite middleware for filesystem-backed workbench
APIs. It bridges routes to local artifact roots, Stage Runner, catalog publish,
runtime controls, collaboration files, and integrated Mock Lab endpoints.

## Where To Look

| Task | Files |
| --- | --- |
| Artifact root reads/writes and whitelist | `artifactRootStore.ts`, `afArtifactsApi.ts` |
| Analyze/Design Stage Runner | `stageRunner.ts`, `codexAnalyzer.ts` |
| Catalog index and approval publish | `afCatalogApi.ts` |
| Runtime env and ADK server controls | `runtimeEnv.ts`, `runtimeChat.ts` |
| Collaboration comments/highlights | `afCollaborationApi.ts` |

## Local Rules

- Preserve proposed-artifact-before-canonical behavior for Stage Runner runs.
- Do not add new artifact write paths without updating the whitelist and active docs.
- Approval patches must mirror matching `stages.<stage>.status` for external tools.
- Stage Runner invokes Codex with constrained repository behavior; do not make network or approval policy changes casually.
- Keep process output, diagnostics, and run metadata under the artifact root, not in package source.

## Anti-Patterns

- Do not store secrets, raw credentials, or private endpoints in runtime env examples or run records.
- Do not let server endpoints directly edit seed `catalog/*.yaml` except the reviewed publish path.
- Do not make Stage Runner success toggle review gates automatically.

## Verification

- Server changes normally require `cd packages/web && npm run build`.
- Run targeted tests through `npm run test:analyzer` when touching Stage Runner, catalog API, runtime env/chat, or artifact APIs.
