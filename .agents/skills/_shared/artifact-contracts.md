# Artifact Contracts

Use existing repository schemas before adding new contracts.

## Default Directory

```text
artifacts/af/<req-id>/
```

`<req-id>` should be stable ASCII and match the requirement id when available.

## Common Files

- `af-run-manifest.json`: lightweight stage manifest.
- `analysis-result.json`: canonical combined analysis artifact.
- `normalized-requirement.json`: split convenience artifact.
- `module-candidates.json`: split convenience artifact.
- `process-flow.json`: split convenience artifact.
- `commonization-notes.json`: reuse notes validated against `schemas/commonization-notes.schema.json` when possible.
- `analysis-summary.md`: concise human review notes for the analysis stage.
- `a2a-contracts.json`: Remote A2A contracts when present.
- `boundary-design.md`: human-readable design review.
- `scaffold-plan.json`: approved Runtime Handoff contract.
- `implementation-handoff.md`: TODO/runtime wiring and production non-goals.
- `runtime-stub/`: generated Runtime Handoff bundle; smoke mode is TODO/runtime wiring, runnable mode is reviewed synthetic ADK Workflow wiring.
- `validation-report.md`: command evidence.
- `catalog-delta.yaml`: proposed catalog feedback only.

## Lightweight Manifest Shape

Use this lightweight manifest shape:

```json
{
  "requirement_id": "req-example",
  "artifact_root": "artifacts/af/req-example",
  "current_stage": "analyze|design|build|verify",
  "stages": {
    "analyze": { "status": "pending|complete|blocked", "outputs": [] },
    "design": { "status": "pending|complete|blocked", "outputs": [] },
    "build": { "status": "pending|complete|blocked", "outputs": [] },
    "verify": { "status": "pending|complete|blocked", "outputs": [] }
  },
  "approvals": {
    "analysis_reviewed": false,
    "boundaries_approved": false,
    "runtime_contracts_approved": false,
    "stub_ready_for_followup": false
  },
  "validation": {
    "commands": [],
    "last_result": "not_run|passed|failed"
  }
}
```

`scripts/validate-artifacts.mjs` validates this core shape when `af-run-manifest.json` is present:

- `requirement_id` and `artifact_root` are non-empty strings.
- `current_stage` is one of `analyze`, `design`, `build`, `verify`.
- every stage has `status: pending|complete|blocked` and `outputs: string[]`.
- approval fields are booleans.
- validation commands are strings and `last_result` is `not_run|passed|failed`.
- `artifact_root` and stage outputs use POSIX-style `/` separators.

## Schema Preference

Use:

- `schemas/analysis-result.schema.json`
- `schemas/normalized-requirement.schema.json`
- `schemas/module-candidate.schema.json`
- `schemas/process-flow.schema.json`
- `schemas/a2a-contract.schema.json`
- `schemas/commonization-notes.schema.json`
- `schemas/scaffold-plan.schema.json`

Do not invent a new field shape when an existing schema can carry the decision.
