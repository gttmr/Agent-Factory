# Graph Render Layer

## Scope

This directory renders strict Target Graph IR inside `GraphCanvas`. It owns
layout, node appearance, edge appearance, region overlays, and validation
banners. Pure Graph IR helpers live under `src/graph`.

Node, edge, region, and asset-reference meanings are canonical in
[Graph IR](../../../../../docs/workbench/graph-ir.md) and
[Taxonomy](../../../../../docs/workbench/taxonomy.md).

## Where To Look

| Task | Files |
| --- | --- |
| Layout and presentation positions | `layout.ts` |
| Node-kind and protocol rendering | `nodeTypes.tsx` |
| Edge control and channel rendering | `edgeTypes.tsx` |
| Parallel and loop region overlays | `containerOverlay.tsx` |
| Graph element tabs | `GraphElementTabs.tsx` |
| Validation display | `validationBanner.tsx` |

## Local Rules

- Render exactly `input`, `agent`, `tool`, `function`, `human_input`, `subworkflow`, `join`, and `output` nodes.
- Edge labels and styles must derive from `control` and optional `channel` without collapsing the two axes.
- Region overlays represent only `parallel` and `loop`; they must not rewrite region membership.
- Layout coordinates are presentation-only because strict Graph nodes do not serialize `position`.
- Keep A2A visually distinct as a protocol boundary on an Agent node, not as another node or asset category.
- New Graph semantics require docs, schema/analyzer validation, rendering, CSS, and regression coverage together.

## Anti-Patterns

- Do not add retired node, edge, region, or category identifiers.
- Do not let edge labels or overlays obscure the Graph.
- Do not implement behavior validation only in this render layer.
- Do not persist layout-only coordinates into Graph IR.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Graph visual changes require a screenshot of the affected Design route.
