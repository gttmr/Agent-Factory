# Artifact Sync and Generation

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

Approved canonical artifact를 sync하고 deterministic generator를 실행하는 순서를 고정한다.

## When to read

Workbench artifact-sync 또는 standalone generator 실행 직전에 읽는다.

## Decision criteria

Primary Workbench path:

```text
POST /api/af/:reqId/artifact-sync/run
```

Current request fields:

| Field | Contract |
| --- | --- |
| `outputMode` | `smoke` 또는 `runnable` |
| `rebuildRuntimeStub` | 기본 `true` |
| `runValidation` | 기본 `true` |
| `streamProgress` | optional SSE |

Server order는 다음이다.

1. canonical `analysis-result.json` 읽기와 validation
2. current output mode 결정
3. `normalized-requirement.json` write
4. `module-candidates.json` write
5. `process-flow.json` write
6. `scaffold-plan.json` write
7. optional deterministic generation
8. optional artifact validation

Standalone direct generation은 approved `scaffold-plan.json`이 이미 있을 때만 허용한다.

## Required evidence

- valid canonical analysis
- approved candidates와 contracts
- scaffold plan `source`와 `raw_requirement_to_code=false`
- exact output mode와 root
- no blockers or unresolved candidate information
- current generator support for selected Graph/pattern

## Artifact implications

Artifact sync는 derived artifact를 server-owned flow로 갱신한다.

Generator는 approval boolean을 쓰지 않는다.

Stage Runner Build primitive는 proposal을 만들지 않고 canonical `runtime-stub/`을 쓴다.

## Scaffold implications

Generator가 supported lowering을 소유한다.

Skill이 requirement prose에서 runtime behavior를 hand-author하지 않는다.

Generator와 approved design이 다르면 generation을 중단하고 drift를 보고한다.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
node scripts/generate-adk-source.mjs <artifact-root> <output-root>
node scripts/validate-artifacts.mjs <artifact-root>
```

## Stop conditions

- analysis 또는 scaffold plan이 없음
- invalid current output mode
- sync drift/error가 해소되지 않음
- source candidate/contract가 unapproved
- unsupported lowering이 있음
- generation 또는 validation 실패

## Official sources checked

- `packages/web/server/artifactSyncRunApi.ts`
- `packages/web/server/artifactSync.ts`
- `packages/web/server/artifactSyncProcessSteps.ts`
- `scripts/generate-adk-source.mjs`
- `packages/web/server/stageRunner.ts`

## Checked date

- Checked date: 2026-07-18
- Current Product modes: `smoke`, `runnable` only.
