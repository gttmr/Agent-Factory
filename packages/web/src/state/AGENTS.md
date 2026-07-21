# Web State Hooks

## Scope

State hooks wrap strict Target v2 filesystem-backed APIs with TanStack Query.
They are the route layer's access point for artifact roots, manifest approvals,
analysis, Graph IR, Catalog data, text artifacts, Stage Runner, verification,
Runtime, and Mock Lab discovery.

Asset terminology is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md).

## Where To Look

| Task | Files |
| --- | --- |
| HTTP wrapper | `apiClient.ts` |
| Query client setup | `queryClient.ts` |
| Artifact root and recent roots | `useArtifactRoot.ts`, `useRecentRoots.ts` |
| Canonical analysis lifecycle | `useAnalysisArtifact.ts` |
| Strict Graph IR derivation | `useGraphIR.ts` |
| Derived artifact synchronization | `useArtifactSync.ts` |
| Manifest approval gates | `useApprovalGate.ts` |
| Stage Runner | `useStageRunner.ts`, `useStreamingProcess.ts` |
| Catalog and publish | `useCatalog.ts`, `useCatalogDelta.ts`, `useCatalogPublish.ts` |
| Runtime and Mock Lab | `useRuntimeChat.ts`, `useRuntimeA2a.ts`, `useMockLabDiscovery.ts` |

## Local Rules

- `useAnalysisArtifact` reads and writes canonical `analysis-result.json`; the payload must satisfy exact `contract_version: "2.0"` validation.
- `useGraphIR` validates and returns `analysis.graph` unchanged; it does not normalize or repair rejected Graphs.
- Artifact sync derives `asset-candidates.json` and `graph-ir.json` from the canonical analysis aggregate.
- `useCatalog` accepts only `agents`, `workflows`, and `tools` buckets.
- A2A hooks operate on Agent protocol contracts and runtime tasks, not a separate asset category.
- Invalidate and refetch after writes instead of mirroring hidden artifact copies.
- `localStorage` is only for recent roots and comment author identity.
- Gate toggles must go through `useApprovalGate`; route components should not patch manifest files directly.
- Keep URL and query concerns in routes; hooks own data access and mutation shape.

## Anti-Patterns

- Do not broaden payload readers or repair rejected artifact shapes in hooks.
- Do not persist analysis, scaffold plan, manifest, Graph IR, or step state in browser storage.
- Do not recompute gate truth from asset status in hooks.
- Do not add broad cache keys that conflate artifact roots.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```
