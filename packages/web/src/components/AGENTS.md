# Shared Workbench Components

## Scope

Shared React components for strict Target v2 artifact review, Graph IR
visualization and editing, asset and protocol badges, and Stage Runner controls.

Asset and node meanings come from [Taxonomy](../../../../docs/workbench/taxonomy.md)
and [Graph IR](../../../../docs/workbench/graph-ir.md).

## Structure

- `AnalysisResult.tsx`: aggregate analysis summary and review evidence.
- `CategoryBadge.tsx`: Agent, Workflow, and Tool category badges plus MCP/A2A protocol badges.
- `GraphCanvas.tsx`: ReactFlow canvas and explicit edit-mode shell.
- `graph/*`: layout, node, edge, region-overlay, and validation rendering.
- `GraphInspector.tsx`: read-only node and edge detail.
- `GraphElementEditor.tsx` and `graphElementEditorModel.ts`: field-level Graph IR edits.
- `StageRunnerPanel.tsx`: shared Analyze, Design, Build, and Verify run surface.

## Local Rules

- Use `CategoryBadge` for the three asset categories and `ProtocolBadge` for MCP or A2A; do not merge those concepts.
- Render all eight Graph node kinds and keep asset references specific to Agent, Tool, and Subworkflow nodes.
- Render edge `control` separately from optional `channel`, and render `parallel` and `loop` as regions.
- Keep `GraphCanvas` read-only by default; edit controls appear only through explicit editable props.
- Node positions are presentation state and are not serialized into strict Graph IR.
- Saving Graph edit mode updates `analysis-result.json.graph`; artifact sync derives `graph-ir.json`.
- A root Graph may use `workflow_ref: null` for a standalone Agent or Tool.

## Anti-Patterns

- Do not render A2A as an asset category; it is a protocol badge on an Agent boundary.
- Do not add retired node, edge, or category aliases to the renderer.
- Do not let region overlays obscure node or edge readability.
- Do not make structural nodes bind to asset candidates.
- Do not add Graph semantics only in the renderer; update contract validation and tests too.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Visual component changes require screenshot and browser verification.
