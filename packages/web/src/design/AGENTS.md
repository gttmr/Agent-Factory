# Design Review Surfaces

## Scope

This directory contains DesignWorkbench support panels and pure helpers for path
search, review notes, bottom tabs, runtime contracts, and Remote A2A editing.

Target asset and protocol-boundary meanings are canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md) and [Graph IR](../../../../docs/workbench/graph-ir.md); `Remote A2A` candidate, tab, and contract names below describe Current Implementation (`legacy`) UI surfaces.

## Where To Look

| Task | Files |
| --- | --- |
| Runtime contract readiness UI | `RuntimeContractPanel.tsx` |
| Remote A2A contract UI/validation | `A2AContractPanel.tsx` (re-export façade — keep importing from it), `A2AContractSidebar.tsx`, `A2AContractInspector.tsx`, `A2AContractEditor.tsx` (+ `A2AContractEditorFields.tsx`, `A2AContractCoreSections.tsx`, `A2AContractCapabilitySections.tsx`), `A2AContractPanelModel.ts`, `a2aContractValidator.ts` |
| Review notes/comments model | `ReviewNotesPanel.tsx`, `reviewNotesModel.ts` |
| Path highlighting/search | `PathTracePanel.tsx`, `pathSearch.ts` |
| Bottom tab rules | `designWorkbenchTabs.ts` |
| Reusable workflow insertion | `CatalogWorkflowPicker.tsx` |

## Local Rules

- Design bottom tabs are `modules`, `runtime contracts`, `Remote A2A`, and `review notes`; path highlights live inside review notes.
- Right Inspector contract editing is parked; active contract editing is in bottom panels.
- Remote A2A placeholders may be created only for selected remote candidates and must link candidate plus contract coherently.
- Comments are graph item anchored and persisted through collaboration APIs.

## Anti-Patterns

- Do not make Stage Runner output auto-approve boundaries or runtime contracts.
- Do not reintroduce the old three-pane inspector as an incidental dependency.
- Do not approve candidates with unresolved candidate-level missing information.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Design UI changes require browser verification at the Design route.
