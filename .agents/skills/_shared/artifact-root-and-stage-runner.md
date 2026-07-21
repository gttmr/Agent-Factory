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
- `asset-candidates.json`
- `graph-ir.json`
- `analysis-summary.md`
- `boundary-design.md`
- `scaffold-plan.json`
- `runtime-stub/`
- `implementation-handoff.md`
- `validation-report.md`
- `catalog-delta.yaml`

A2A consumption and exposure contracts remain on their Agent candidate binding or exposure; do not invent an A2A asset file.

## Required evidence

For Stage Runner mode, require:

- `request.json` identifying requirement, stage, run, skill label, and requested outputs;
- `events.jsonl` for execution history;
- `result-summary.json` and `diff-summary.json` when the run completes;
- `proposed-artifacts/` for diff-capable stages;
- `diagnostics.md` when a failure produced diagnostics;
- matching `af-run-manifest.json.stage_runs` metadata.

Treat `stage_runs` as execution metadata only. It does not replace `manifest.approvals.*`.

`af-run-manifest.json`은 required root/stage/approval/validation field를 모두 가져야 한다. Current parser와 generator는 누락·잘못된 enum을 기본값으로 보정하지 않는다.

## Artifact implications

Use this exact proposal contract:

| Current stage | Execution owner | Required proposal files | Canonical behavior |
| --- | --- | --- | --- |
| Analyze | Codex-backed Stage Runner | `analysis-result.json` | explicit preview/apply |
| Design | Codex-backed Stage Runner | `analysis-result.json`, `boundary-design.md` | explicit preview/apply |
| Build | server primitive | none | writes canonical `runtime-stub/`; apply unavailable |
| Verify | server allow-list primitive | `validation-report.md`, `catalog-delta.yaml` | explicit preview/apply |

Design must produce both registered files. The current diff builder fails the run and records diagnostics when either file is missing.

Analyze and Design `analysis-result.json` proposals must parse and pass `validateAnalysisResult`. Verify templates currently have no semantic Markdown/YAML validator. A completed Verify run may still contain `validation.ok=false`; do not report it as passing.

Apply behavior:

- accept only a completed or already-applied run;
- reject a listed invalid proposal;
- enforce ETag conflict checks before writing canonical files;
- apply only registered files;
- update run metadata; Analyze/Design의 changed analysis apply는 stale downstream approval과 validation을 무효화하지만 approval을 true로 만들지 않는다.

The current diff builder does not discover arbitrary extra files, and the SDK sandbox is broader than `proposed-artifacts/`. The skill's narrow write statement is therefore a safety control.

## Scaffold implications

- Build is a server-owned primitive in current Stage Runner execution; its historical skill path is not read by the server.
- The canonical artifact-sync flow reads an already-saved `analysis-result.json`, synchronizes split artifacts, derives `scaffold-plan.json`, optionally regenerates `runtime-stub/`, and may run artifact validation.
- Every server Build entrypoint requires Analyze approval and both Design approvals. Approval PATCH cannot skip the Analyze → boundary → runtime-contract → handoff order; revoking an upstream gate clears downstream gates, and handoff approval requires a non-empty `runtime-stub/`. Verify additionally requires that handoff gate and Build `complete`.
- Generation does not set approval booleans or complete stage gates.
- Use [target-contract-v2.md](target-contract-v2.md) whenever a Stage Runner proposal writes strict Target v2 JSON.

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

- Checked date: 2026-07-20
- Official sources: Agent Factory Operating Model and current Stage Runner source
- Installed package version: `google-adk 2.3.0`
- Current behavior: Design enforcement requires both registered files and fails incomplete proposals before apply.
