# Artifact Root and Stage Runner

## Contents

- [Purpose](#purpose)
- [When to read](#when-to-read)
- [Decision criteria](#decision-criteria)
- [Required evidence](#required-evidence)
- [Artifact implications](#artifact-implications)
- [Scaffold implications](#scaffold-implications)
- [Verification](#verification)
- [Stop conditions](#stop-conditions)
- [Official sources checked](#official-sources-checked)
- [Checked date](#checked-date)

## Purpose

Define the Current Implementation write boundary for one Agent Factory artifact root and its Stage Runner run ledger. This reference governs paths and apply behavior; it does not grant approval.

## When to read

Read before any skill reads or writes `artifacts/af/<req-id>/`, before creating Stage Runner proposals, before applying a run, and before deciding whether Build or Verify is agent-authored.

## Decision criteria

Choose exactly one mode:

- Stage Runner mode when `runs/<stage>/<run-id>/` and its request snapshot identify the current run.
- Standalone canonical mode only when the user supplies a non-Stage Runner artifact root or fixture.

Prefer Stage Runner proposed-first when both appear possible. Do not infer a root or use the newest run by guesswork.

The default canonical root is:

```text
artifacts/af/<req-id>/
```

The standard canonical inventory is:

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

Remote A2A contracts remain embedded in `analysis-result.json.a2aContracts[]`; do not invent a standard split `a2a-contracts.json`.

## Required evidence

For Stage Runner mode, require:

- `request.json` identifying requirement, stage, run, skill label, and requested outputs;
- `events.jsonl` for execution history;
- `result-summary.json` and `diff-summary.json` when the run completes;
- `proposed-artifacts/` for diff-capable stages;
- `diagnostics.md` when a failure produced diagnostics;
- matching `af-run-manifest.json.stage_runs` metadata.

Treat `stage_runs` as execution metadata only. It does not replace `manifest.approvals.*`.

## Artifact implications

Use this exact proposal contract:

| Current stage | Execution owner | Required proposal files | Canonical behavior |
| --- | --- | --- | --- |
| Analyze | Codex-backed Stage Runner | `analysis-result.json` | explicit preview/apply |
| Design | Codex-backed Stage Runner | `analysis-result.json`, `boundary-design.md` | explicit preview/apply |
| Build | server primitive | none | writes canonical `runtime-stub/`; apply unavailable |
| Verify | server allow-list primitive | `validation-report.md`, `catalog-delta.yaml` | explicit preview/apply |

Design must produce both registered files even though the current diff builder accepts a run when only one registered file exists. Preserve the stronger contract in skills and compatibility shims.

Analyze and Design `analysis-result.json` proposals must parse and pass `validateAnalysisResult`. Verify templates currently have no semantic Markdown/YAML validator. A completed Verify run may still contain `validation.ok=false`; do not report it as passing.

Apply behavior:

- accept only a completed or already-applied run;
- reject a listed invalid proposal;
- enforce ETag conflict checks before writing canonical files;
- apply only registered files;
- update run metadata, not approvals or stage gates.

The current diff builder does not discover arbitrary extra files, and the SDK sandbox is broader than `proposed-artifacts/`. The skill's narrow write statement is therefore a safety control.

## Scaffold implications

- Build is a server-owned primitive in current Stage Runner execution; its historical skill path is not read by the server.
- The canonical artifact-sync flow reads an already-saved `analysis-result.json`, synchronizes split artifacts, derives `scaffold-plan.json`, optionally regenerates `runtime-stub/`, and may run artifact validation.
- Generation does not set approval booleans or complete stage gates.
- Use [compatibility-current-schema.md](compatibility-current-schema.md) whenever a Stage Runner proposal writes current canonical JSON.

## Verification

Inspect the run without broad writes:

```bash
test -f <artifact-root>/af-run-manifest.json
test -f <run-dir>/request.json
test -d <run-dir>/proposed-artifacts
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Confirm the proposed-file inventory exactly matches the stage allow-list. Preserve command output and apply conflict evidence.

## Stop conditions

Stop when:

- root, stage, run ID, or operating mode is ambiguous;
- a Stage Runner run folder or request snapshot is missing;
- a proposal lies outside the allow-list;
- Design produces only one of its two required files;
- `analysis-result.json` fails parse or validation;
- apply sees an ETag conflict or invalid diff;
- an action would toggle approvals, write catalog seeds, or treat run completion as stage approval.

## Official sources checked

- [Operating Model](../../../docs/workbench/operating-model.md)
- Current source evidence: [r1-stagerunner-contract.md](../../../tests/skills/evidence/research/r1-stagerunner-contract.md)
- Current implementation anchors: `packages/web/server/stageRunner.ts`, `packages/web/server/afVerifyRunApi.ts`

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory Operating Model and current Stage Runner source
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Current Design enforcement accepts either registered file even though the contract requires both; skills must enforce both until product code is corrected.
