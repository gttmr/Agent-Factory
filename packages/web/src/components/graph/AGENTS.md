# Graph Render Layer

## Scope

This directory renders Graph IR inside `GraphCanvas`. It owns layout, node
appearance, edge appearance, container overlays, and validation banners. Pure
Graph IR helpers live outside this tree under `src/graph`.

## Where To Look

| Task | Files |
| --- | --- |
| Layout and persisted positions | `layout.ts` |
| Node category/marker rendering | `nodeTypes.tsx` |
| Edge style and semantics | `edgeTypes.tsx` |
| Workflow/region overlays | `containerOverlay.tsx` |
| Soft/hard validation display | `validationBanner.tsx` |

## Local Rules

- Graph meaning comes from active `docs/workbench/process-flow.md` and analyzer/schema contracts, not renderer convenience.
- Edit mode must preserve finite `node.position` values and avoid moving unrelated saved nodes.
- Container overlays are visual regions only; they must not rewrite graph membership.
- New marker semantics require docs, validator/analyzer, rendering, CSS, and regression coverage together.
- Keep Remote A2A boundary styling visually distinct from local workflow/adapters.

## Anti-Patterns

- Do not make layout changes that silently drop saved reviewer positions.
- Do not let edge labels or overlays obscure the graph.
- Do not implement behavior-only validation in this render layer.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Graph visual changes require a screenshot of the affected Design route.
