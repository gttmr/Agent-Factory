# Design Review Surfaces

## Scope

This directory contains Design Workbench support panels and pure helpers for
asset review, path search, review notes, runtime contracts, A2A Agent protocol
contracts, and reusable Workflow insertion.

Asset and protocol-boundary meanings are canonical in
[Taxonomy](../../../../docs/workbench/taxonomy.md) and
[Graph IR](../../../../docs/workbench/graph-ir.md).

## Where To Look

| Task | Files |
| --- | --- |
| Runtime contract readiness UI | `RuntimeContractPanel.tsx`, `RuntimeContractEditor.tsx` |
| A2A Agent contract UI and validation | `A2AContractPanel.tsx`, `A2AContractSidebar.tsx`, `A2AContractInspector.tsx`, `A2AContractEditor.tsx`, `A2AContractPanelModel.ts`, `a2aContractValidator.ts` |
| Local A2A Agent provider import | `LocalA2AProviderImport.tsx` |
| Review notes and comments | `ReviewNotesPanel.tsx`, `reviewNotesModel.ts`, `CommentThread.tsx` |
| Path highlighting and search | `PathTracePanel.tsx`, `pathSearch.ts` |
| Bottom tab rules | `designWorkbenchTabs.ts` |
| Reusable Workflow insertion | `CatalogWorkflowPicker.tsx` |

`A2AContractPanel.tsx` is the stable re-export facade for A2A review components.

## Local Rules

- Design bottom tabs are `assets`, `runtime`, `a2a`, and `reviewNotes`.
- The A2A tab lists Agent assets whose binding or exposure references an A2A contract.
- Creating or importing an A2A provider must create or update an Agent asset and a coherent A2A contract reference.
- A2A is a real protocol boundary, never an asset category or Tool binding.
- Reusable Workflow insertion adds a Workflow asset and a `subworkflow` node with `workflow_ref`.
- Active contract editing stays in bottom panels; the right Inspector remains read-only.
- Comments are Graph-item anchored and persisted through collaboration APIs.

## Anti-Patterns

- Do not make Stage Runner output auto-approve boundaries or runtime contracts.
- Do not introduce A2A candidate categories or accept A2A contracts for non-Agent assets.
- Do not reintroduce the old three-pane inspector as an incidental dependency.
- Do not approve assets with unresolved candidate-level missing information.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Design UI changes require browser verification at the Design route.
