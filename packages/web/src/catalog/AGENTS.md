# Web Catalog Helpers

## Scope

This directory maps seed catalog YAML into UI/search/scaffold structures and
manages per-root catalog-delta proposals and publish metadata.

Target Catalog asset terminology is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md); current seed categories and fields such as `adapter` and `remote_a2a` are Current Implementation (`legacy`), with gaps tracked in `docs/migration/taxonomy-vnext-status.md`.

## Where To Look

| Task | Files |
| --- | --- |
| Catalog entry types | `types.ts` |
| Seed catalog hydration | `seed.ts`, `catalogIndex.ts` |
| Catalog binding into scaffold plans | `runtimeBinding.ts`, `scaffoldCatalog.ts` |
| Proposal shape and delta parsing | `catalogDelta.ts`, `catalogPublishProposal.ts` |
| Versioning/deprecation logic | `catalogVersioning.ts` |

## Local Rules

- Seed catalogs are runtime contract inputs; proposal edits start in active-root `catalog-delta.yaml`.
- Preserve the Current Implementation (`legacy`) category separation: Agent, Workflow, Adapter, and Remote A2A; Target Catalog assets are Agent, Workflow, and Tool.
- Runtime mocks are synthetic smoke test doubles only.
- Publish logic may canonicalize YAML formatting, but it must preserve semantics and target only reviewed proposals.

## Anti-Patterns

- Do not write directly to `catalog/*.yaml` outside the approval-gated publish path or human seed PR work.
- Do not mix Mock Lab spec editing responsibility into catalog helpers.
- Do not treat catalog reuse as module approval; review gates stay in the artifact root.

## Verification

```bash
cd packages/web
npm run test:analyzer
```

Also run `node scripts/validate-artifacts.mjs` when catalog shape affects templates.
