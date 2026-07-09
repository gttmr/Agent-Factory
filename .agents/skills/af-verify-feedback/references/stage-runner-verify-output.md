# Stage Runner Verify Output

Verify Stage Runner wraps server-side primitives and proposes review artifacts.

## Proposed Files

Verify Stage Runner writes:

```text
<run-dir>/proposed-artifacts/validation-report.md
<run-dir>/proposed-artifacts/catalog-delta.yaml
```

These are proposals. Canonical files change only through explicit apply.

## Run Ledger Files

Expected run files:

- `request.json`
- `events.jsonl`
- `result-summary.json`
- `diff-summary.json`
- `proposed-artifacts/validation-report.md`
- `proposed-artifacts/catalog-delta.yaml`

## Manifest Validation

The allow-list verify run API writes `manifest.validation.commands` and `manifest.validation.last_result`. Stage Runner execution metadata under `stage_runs` is separate from approval gates.

## Stop Conditions

- treating a proposed report as canonical before apply
- using Stage Runner metadata as a substitute for fresh command output
- editing `catalog/*.yaml` directly from Verify

## Grounding

- `packages/web/server/stageRunner.ts`
- `packages/web/server/afVerifyRunApi.ts`
- `packages/web/server/manifestValidation.ts`
- `docs/workbench/agent-factory-harness.md`
