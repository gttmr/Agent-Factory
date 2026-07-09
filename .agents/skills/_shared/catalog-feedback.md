# Catalog Feedback

Skills may propose catalog feedback; they must not directly edit catalog seed files.

## Boundaries

| Path | Role |
| --- | --- |
| `artifacts/af/<req-id>/catalog-delta.yaml` | proposal file under an ignored artifact root |
| `catalog/*.yaml` | canonical seed catalog files; do not edit from DLC skills |
| `catalog/contracts/` | registry source inputs for rich MCP/A2A contract bodies |

Catalog entries are runtime contracts. Proposals stay reviewable until a human uses the Reuse Hub registration approval path.

## Proposal Scope

`catalog-delta.yaml` may propose:

- reusable runtime contracts
- deterministic synthetic `runtime_mock` payloads for local smoke tests
- contract gaps or follow-up registration notes

It must not include private endpoints, credentials, real customer data, deployment scripts, or production business logic.

## App Write Boundary

The app write path is approval-gated Reuse Hub registration approval through `POST /api/catalog/publish`. Human PRs may still update bulk or seed catalog data.

## Verification

```bash
git diff --name-only -- catalog
```

Stop if the command prints any path after running a DLC skill.

## Grounding

- `docs/workbench/agent-factory-harness.md`
- `packages/web/server/stageRunner.ts`
