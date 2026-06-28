# Web State Hooks

## Scope

State hooks wrap filesystem-backed APIs with TanStack Query. They are the route
layer's access point for artifact roots, manifest approvals, analysis artifacts,
catalog data, text artifacts, verification, Stage Runner, Runtime, and Mock Lab
discovery.

## Where To Look

| Task | Files |
| --- | --- |
| HTTP wrapper | `apiClient.ts` |
| Query client setup | `queryClient.ts` |
| Artifact root and recent roots | `useArtifactRoot.ts`, `useRecentRoots.ts` |
| Analysis artifact lifecycle | `useAnalysisArtifact.ts`, `useAnalyze.ts` |
| Manifest approval gates | `useApprovalGate.ts` |
| Stage Runner | `useStageRunner.ts`, `useStreamingProcess.ts` |
| Catalog and publish | `useCatalog.ts`, `useCatalogDelta.ts`, `useCatalogPublish.ts` |
| Runtime and Mock Lab | `useRuntimeChat.ts`, `useMockLabDiscovery.ts` |

## Local Rules

- The artifact root is canonical; hooks should invalidate/refetch after writes rather than mirror hidden copies.
- `localStorage` is only for recent roots and comment author identity.
- Gate toggles must go through `useApprovalGate`; route components should not patch manifest files directly.
- Keep URL/query concerns in routes; hooks own data access and mutation shape.

## Anti-Patterns

- Do not persist analysis-result, scaffold-plan, manifest, or step state in browser storage.
- Do not recompute gate truth from candidate status in hooks.
- Do not add broad cache keys that conflate artifact roots.

## Verification

```bash
cd packages/web
npm run test:analyzer
npm run build
```
