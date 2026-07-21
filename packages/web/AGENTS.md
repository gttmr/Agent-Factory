# Web Workbench Package

## Scope

`packages/web` is the React/Vite workbench for strict Target Contract v2
artifact roots, Stage Runner, Graph IR review, Catalog governance, Runtime
Handoff, Verify, Run, and integrated Mock Lab.

Asset terminology is owned by [Taxonomy](../../docs/workbench/taxonomy.md), and
Workflow execution terminology by [Graph IR](../../docs/workbench/graph-ir.md).

## Structure

- `src/routes`: route workbenches and router shell.
- `src/layout`: workbench shell, stage shell, approval chips, and root switcher.
- `src/state`: TanStack Query hooks and API client.
- `src/analyzer`: strict artifact types, validation, review gates, Graph IR validation, and scaffold-plan derivation.
- `src/components` and `src/design`: shared review, Graph IR, runtime-contract, and A2A protocol surfaces.
- `src/catalog`: strict Catalog index, delta, versioning, pinning, and scaffold helpers.
- `src/styles`: design tokens, primitives, feature, and route CSS layers.
- `server`: Vite middleware for artifact roots, Stage Runner, Catalog, Runtime, collaboration, and Mock Lab APIs.

## Local Rules

- Artifact root files under `artifacts/af/<req-id>/` are the canonical store; do not persist stage state to `localStorage`.
- `analysis-result.json` must have `contract_version: "2.0"`. Artifact sync derives `asset-candidates.json` and `graph-ir.json` from it.
- `asset_type` is only `agent`, `workflow`, or `tool`; visible category labels must match.
- Graph IR uses the eight Target node kinds, edge `control` plus optional `channel`, and `parallel` or `loop` regions.
- A standalone Agent or Tool graph uses `workflow_ref: null`.
- A2A is an Agent binding or exposure with an A2A contract, never an asset category.
- `manifest.approvals.*` is the gate source of truth. Do not recompute approval gates from candidate status in UI components.
- Analyze and Design Stage Runner output is proposed-first; canonical artifacts change only after explicit apply.
- `catalog/*.yaml` is not edited from ad hoc UI paths. Reuse Hub publish is the app write path for reviewed deltas.

## When Editing

- Read `docs/visualization/design-system.md` before visual changes.
- Route-level writes must go through existing state hooks or server APIs; do not bypass `artifactRootStore.ts` write allowlists.
- Keep helper logic near its domain: analyzer invariants in `src/analyzer`, Catalog semantics in `src/catalog`, and API persistence in `server`.
- If an enum or artifact shape changes, update schemas, validators, analyzer types, UI labels, templates, and docs together.
- Do not broaden strict read boundaries to accept retired shapes.

## Verification

```bash
cd packages/web
npm run build
npm run test:analyzer
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

UI changes also require fixed-port browser verification on `http://127.0.0.1:5173/`.
