# Mock Lab Package

## Scope

`packages/mock-lab` is the standalone development package for Mock Lab. The
default user-facing surface is the integrated workbench route
`http://127.0.0.1:5173/mock-lab`; this package also runs independently on 5176.

## Structure

- `src`: standalone React app for editing, saving, running, and smoke testing `MockSpec`.
- `server`: saved-spec runtime, draft generation, API handlers, MCP bridge, and persistence helpers.
- `schemas`: `MockSpec` schema.
- `scripts`: package-local TS loader and validator helpers.
- `public`: static assets for the standalone app.

## Local Rules

- `catalog/adapters.yaml` is read-only prefill input.
- Canonical specs live under ignored `artifacts/mock-lab/<mock-id>/mock-spec.json`.
- Codex draft specs stay under `drafts/<draft-id>/draft-spec.json` until explicitly loaded.
- Server start uses the saved `mock-spec.json`; it should not require generated project files.
- Mock responses must stay synthetic and local-only.

## Anti-Patterns

- Do not store credentials, private endpoints, deployment scripts, or production business logic in mock specs.
- Do not make Mock Lab edit seed catalog YAML.
- Do not treat `packages/mock-lab/DESIGN.md` as active implementation policy; prefer README, package scripts, server/source, and active docs.

## Verification

```bash
cd packages/mock-lab
npm run test
npm run build
```

Standalone dev uses fixed port 5176. Integrated workbench testing uses 5173.
