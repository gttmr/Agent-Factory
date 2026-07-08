# Catalog Delta Proposal

`catalog-delta.yaml` is a proposal, not a catalog write.

## File Location

Use:

```text
<artifact-root>/catalog-delta.yaml
```

Do not write `catalog/*.yaml` from this skill.

## Proposal Content

Allowed proposal themes:

- reusable runtime contract candidates
- deterministic synthetic `runtime_mock` entries
- registry gaps
- reviewer notes for future Reuse Hub registration approval

Avoid detailed schema invention unless the current catalog proposal format already supports it.

## Disallowed Content

- private endpoints
- credentials
- private banking data
- real customer data
- deployment scripts
- production runtime code

## Publish Boundary

Reviewed proposals may later go through Reuse Hub registration approval via `POST /api/catalog/publish`. The skill only prepares evidence and proposal text.

## Grounding

- `docs/workbench/agent-factory-harness.md`
- `packages/web/server/stageRunner.ts`
