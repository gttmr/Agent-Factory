# Artifact Root And Stage Runner

Use this reference when deciding where a DLC stage may write.

## Canonical Artifact Root

Default root:

```text
artifacts/af/<req-id>/
```

Standard canonical files:

- `af-run-manifest.json`
- `analysis-result.json`
- `normalized-requirement.json`
- `module-candidates.json`
- `process-flow.json`
- `commonization-notes.json`
- `analysis-summary.md`
- `boundary-design.md`
- `scaffold-plan.json`
- `runtime-stub/`
- `implementation-handoff.md`
- `validation-report.md`
- `catalog-delta.yaml`

`analysis-result.json.a2aContracts` is canonical for Remote A2A contracts. Do not list `a2a-contracts.json` as a standard artifact.

## Stage Runner Ledger

Stage Runner writes under:

```text
artifacts/af/<req-id>/runs/<stage>/<run-id>/
```

Expected run files:

- `request.json`
- `events.jsonl`
- `result-summary.json`
- `diff-summary.json`
- `proposed-artifacts/`

`af-run-manifest.json.stage_runs` is execution metadata. It never replaces `manifest.approvals.*`.

## Allowed Proposed Files

| Stage | Proposed files |
| --- | --- |
| analyze | `analysis-result.json` |
| design | `analysis-result.json`, `boundary-design.md` |
| build | none; build writes canonical `runtime-stub/` through server primitives |
| verify | `validation-report.md`, `catalog-delta.yaml` |

Analyze/design canonical files change only after diff/preview apply. Build uses UI `applyMode="none"`. Verify proposes report/delta files.

## Stage Runner API

Routes exist under `/api/af/:reqId/stages/:stage/*`:

| Action | Method | Purpose |
| --- | --- | --- |
| `run` | `POST` | start a stage run |
| `cancel` | `POST` | request cancellation |
| `runs` | `GET` | list recent runs |
| `runs/:runId` | `GET` | read run detail |
| `runs/:runId/apply` | `POST` | apply valid proposed files |

## Verification

```bash
test -f <artifact-root>/af-run-manifest.json
test -d <run-dir>/proposed-artifacts
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

Stop if Stage Runner mode lacks a run folder or if proposed files are outside the stage allow-list.

## Grounding

- `packages/web/server/afStageRunnerApi.ts`
- `packages/web/server/stageRunner.ts`
- `packages/web/src/components/StageRunnerPanel.tsx`
- `packages/web/src/analyzer/afRunManifest.ts`
- `docs/workbench/agent-factory-harness.md`
