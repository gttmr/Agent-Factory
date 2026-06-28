# Shared Workbench Components

## Scope

Shared React components for artifact review, Graph IR visualization, category
badges, Stage Runner controls, and graph element editing.

## Structure

- `CategoryBadge.tsx`: category/subtype visual single source of truth.
- `GraphCanvas.tsx`: ReactFlow canvas wrapper and edit-mode shell.
- `graph/*`: render-layer layout, nodes, edges, containers, and validation banner.
- `GraphInspector.tsx`: read-only node/edge detail.
- `GraphElementEditor.tsx` and model test: field-level Graph IR edits.
- `StageRunnerPanel.tsx`: Analyze/Design run surface.

## Local Rules

- Use `CategoryBadge` and `SubtypeBadge` for category display; do not hand-roll raw spans.
- Graph render changes usually require updates across `layout.ts`, `nodeTypes.tsx`, `edgeTypes.tsx`, `containerOverlay.tsx`, CSS, and docs.
- Keep GraphCanvas read-only by default; edit controls appear only through explicit editable props.
- Saving graph edit mode updates `analysis-result.json.processFlow`; it must not toggle manifest approvals.

## Anti-Patterns

- Do not let container overlays obscure node/edge readability.
- Do not make synthetic nodes bind to module candidates unless the analyzer contract allows it.
- Do not add marker semantics only in the renderer; define them in Graph IR docs and validation.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Visual component changes require screenshot/browser verification.
