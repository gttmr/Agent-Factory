# Mock Lab Package

## Scope

`packages/mock-lab` is the standalone development package for local MCP test
doubles. It serves Tool assets only. The default user-facing surface is
`http://127.0.0.1:5173/mock-lab`; this package also runs independently on 5176.

Tool and MCP meanings are canonical in [Taxonomy](../../docs/workbench/taxonomy.md)
and [Graph IR](../../docs/workbench/graph-ir.md).

## Structure

- `src`: standalone React app for editing, saving, running, and smoke testing `MockSpec`.
- `server/catalogPrefillLoader.ts`: strict `catalog/tools.yaml` prefill reader.
- `server`: saved-spec runtime, draft generation, API handlers, MCP bridge, and persistence helpers.
- `schemas`: `MockSpec` schema.
- `scripts`: package-local TS loader and validator helpers.
- `public`: static assets for the standalone app.

## Local Rules

- `catalog/tools.yaml` is the only read-only Catalog prefill input.
- Prefill accepts Tool rows with an MCP binding and stdio transport; it never changes Catalog YAML.
- Canonical specs live under ignored `artifacts/mock-lab/<mock-id>/mock-spec.json`.
- Codex draft specs stay under `drafts/<draft-id>/draft-spec.json` until explicitly loaded.
- Server start uses the saved `mock-spec.json`; it should not require generated project files.
- Mock responses must stay synthetic and local-only.
- A2A belongs to an Agent protocol boundary and is outside Mock Lab's Tool-only scope.

## Anti-Patterns

- Do not add non-Tool asset categories or A2A mock servers.
- Do not add alternate Catalog inputs or accept retired Tool shapes.
- Do not store credentials, private endpoints, deployment scripts, or production business logic in mock specs.
- Do not make Mock Lab edit seed Catalog YAML.
- Do not treat `packages/mock-lab/DESIGN.md` as active implementation policy; prefer README, package scripts, server/source, and active docs.

## Verification

```bash
cd packages/mock-lab
npm run test
npm run build
```

Standalone dev uses fixed port 5176. Integrated workbench testing uses 5173.
