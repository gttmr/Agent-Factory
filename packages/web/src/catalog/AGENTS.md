# Web Catalog Helpers

## Scope

This directory parses strict Agent, Workflow, and Tool seed Catalogs into
UI/search/scaffold structures and manages per-root `catalog-delta.yaml`
proposals and publish metadata.

Catalog asset terminology is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md).

## Where To Look

| Task | Files |
| --- | --- |
| Strict Catalog types and parsing | `catalogIndex.ts`, `types.ts` |
| Seed Catalog loading | `seed.ts` |
| Catalog pinning into analysis | `catalogPin.ts` |
| Catalog binding into scaffold plans | `scaffoldCatalog.ts` |
| Proposal shape and delta parsing | `catalogDelta.ts`, `catalogPublishProposal.ts` |
| Versioning and deprecation | `catalogVersioning.ts` |

## Local Rules

- Accept exactly the `agents`, `workflows`, and `tools` buckets.
- Require each row's `asset_type` to match its bucket and reject retired keys.
- Preserve Agent, Workflow, and Tool identity when pinning or binding Catalog entries.
- Represent A2A only through Agent binding or exposure; represent MCP through Tool binding.
- Seed Catalogs are runtime contract inputs; proposal edits start in the active root's `catalog-delta.yaml`.
- Runtime mocks are synthetic smoke test doubles only.
- Publish logic may canonicalize YAML formatting, but it must preserve semantics and target only reviewed proposals.

## Anti-Patterns

- Do not add alternate buckets or accept rows from another asset category.
- Do not write directly to `catalog/*.yaml` outside the approval-gated publish path or human seed PR work.
- Do not mix Mock Lab spec editing responsibility into Catalog helpers.
- Do not treat Catalog reuse as asset approval; review gates stay in the artifact root.

## Verification

```bash
cd packages/web
npm run test:analyzer
```

Also run `node scripts/validate-artifacts.mjs` when Catalog shape affects templates.
