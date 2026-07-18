# Web Workbench Package

## Scope

`packages/web` is the React/Vite workbench for artifact roots, Stage Runner,
Graph IR review, catalog governance, Runtime Handoff, Verify, Run, and integrated
Mock Lab.

Target asset terminology is owned by [Taxonomy](../../docs/workbench/taxonomy.md), and Workflow execution terminology by [Graph IR](../../docs/workbench/graph-ir.md); package identifiers such as `adapter` and `remote_a2a` describe Current Implementation (`legacy`).

## Structure

- `src/routes`: route workbenches and router shell.
- `src/layout`: workbench shell, stage shell, approval chips, root switcher.
- `src/state`: TanStack Query hooks and API client.
- `src/analyzer`: artifact/domain models, gate logic, Graph IR migration, scaffold-plan derivation.
- `src/components` and `src/design`: shared review and Graph IR surfaces.
- `src/catalog`: catalog index, delta, versioning, scaffold binding helpers.
- `src/styles`: design tokens, primitives, feature, and route CSS layers.
- `server`: Vite middleware for artifact roots, Stage Runner, catalog, runtime, collaboration, and Mock Lab APIs.

## Local Rules

- Artifact root files under `artifacts/af/<req-id>/` are the canonical store; do not persist stage state to `localStorage`.
- `manifest.approvals.*` is the gate source of truth. Do not recompute approval gates from candidate status in UI components.
- Analyze/Design Stage Runner output is proposed-first; canonical artifacts change only after explicit apply.
- `catalog/*.yaml` is not edited from ad hoc UI paths. Reuse Hub publish is the app write path for reviewed deltas.
- UI copy is mostly Korean. Current screens still use the `legacy` labels `Adapter` and `Remote A2A`; Target-facing copy uses `Agent`, `Workflow`, `Tool`, `Graph IR`, and `Runtime Handoff` as defined by the canonical docs.

## When Editing

- Read `docs/visualization/design-system.md` before visual changes.
- Route-level writes must go through existing state hooks or server APIs; do not bypass `artifactRootStore.ts` write whitelists.
- Keep helper logic near its domain: analyzer invariants in `src/analyzer`, catalog semantics in `src/catalog`, API persistence in `server`.
- If enum or artifact shape changes, update schemas, validator, analyzer types, UI labels/badges, templates, and docs together.

## Verification

```bash
cd packages/web
npm run build
npm run test:analyzer
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

UI changes also require fixed-port browser verification on `http://127.0.0.1:5173/`.
