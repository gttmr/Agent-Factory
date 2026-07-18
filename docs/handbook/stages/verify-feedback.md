# verify-feedback 검증 증거와 피드백

## 목적

allowlisted 검증 또는 Verify Stage Runner를 실행하고, 결과·잔존 위험과 Catalog 변경 제안을 canonical evidence로 검토·기록한다.

## Trigger와 진입 조건

- Trigger: Build 후 Verify route 진입, 검증 command 선택, Verify Stage Runner 실행 또는 report/delta 편집
- 진입 조건: route 자체에는 별도 Verify approval gate가 없다. navigation은 앞 단계 legacy `stub_ready_for_followup`에 의해 안내되지만 server verify handler는 이를 검사하지 않는다.

## 종료 조건

- 선택한 검증 결과가 manifest validation에 기록된다.
- 필요한 경우 `validation-report.md`와 `catalog-delta.yaml`이 canonical root에 적용·저장된다.
- 남은 실패와 위험이 report에 드러나며 Catalog 제안은 후속 publication에서 다시 검증된다.

## 주요 입력

- artifact root와 Runtime Handoff
- allowlisted command key
- 기존 manifest validation과 Verify run evidence
- 기존 report/delta text와 ETag

## 주요 출력

- command stdout/stderr/exit result와 manifest validation
- Verify run ledger 및 proposed `validation-report.md`, `catalog-delta.yaml`
- canonical report와 Catalog delta

## Main Flow

1. Verify 화면은 artifact validation, web build, analyzer test 중 command key를 선택한다.
2. Stage Runner는 server verify primitive로 allowlisted process를 실행하고 manifest validation을 갱신한다.
3. runner는 command 결과에서 report와 empty delta template proposal을 만들고 diff/evidence를 저장한다.
4. 사용자가 apply하면 ETag 확인 뒤 두 proposal을 canonical artifact로 교체한다.
5. review에서는 canonical report와 delta를 직접 편집·저장할 수 있다.
6. Catalog delta가 있으면 Reuse Hub publication stage로 이어진다.

Current Stage Runner Verify의 실행 주체는 server allow-list primitive이며 skill directory를 읽지 않는다. canonical `af-verify-runtime`은 layered verification을 수행하는 direct/manual skill 경로다.

## 분기와 실패/needs-info

- 임의 shell command는 허용하지 않는다. unknown key는 400이다.
- direct Verify API의 command nonzero exit는 422이고 manifest validation은 failed가 된다. Stage Runner는 artifact validation이 별도로 실패하지 않으면 run status를 `completed`로 유지하면서 `validation.ok=false`를 기록하며, current apply gate는 이 값을 검사하지 않는다.
- report/delta proposal validation 또는 ETag drift는 apply를 막는다.
- report나 delta 없이도 review 화면으로 이동할 수 있으므로 파일 존재 자체가 완료 gate가 아니다.
- validation recorder는 `commands`를 누적하지 않고 최신 한 command 배열로 교체한다.

## 읽는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
- [`reg.scaffold-plan`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)
- [`reg.validation-report`](../registers.md#cross-stage-registers)
- [`reg.catalog-delta`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.validation-report`](../registers.md#cross-stage-registers)
- [`reg.catalog-delta`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: [runtime-handoff-build](runtime-handoff-build.md)
- 다음: [catalog-publication](catalog-publication.md)
- 별도 증명: [runtime-execution](runtime-execution.md)

## 외부 경계

- browser Workbench와 HTTP/SSE
- allowlisted Node/npm subprocess
- local artifact filesystem

## L3 Source Map

### Verify workbench

- Path: `packages/web/src/routes/VerifyWorkbench.tsx`
- Stable anchor: default `VerifyWorkbench`
- Role in behavior: run/review step, Verify Stage Runner config와 report/delta editor state를 조정한다.
- Inputs: manifest validation/latest run, selected command, existing report/delta
- Outputs: runner request, report/delta save, Reuse Hub navigation
- State/artifact reads: `reg.run-manifest`, `reg.validation-report`, `reg.catalog-delta`, `reg.stage-run-evidence`
- State/artifact writes: `reg.validation-report`, `reg.catalog-delta`, `reg.recent-roots`
- Important callers: `AppRouter`
- Important callees: `StageRunnerPanel`, `buildVerifyStageRunnerConfig`, `summarizeVerifyRunState`, `VerifyReviewStep`
- External boundaries: React query, HTTP/SSE
- Failure/edge behavior: run 이력이 없어도 review 이동은 허용하며 stale manifest cache의 초기 landing을 별도로 보정한다.
- Related registers: `reg.run-manifest`, `reg.validation-report`, `reg.catalog-delta`, `reg.stage-run-evidence`
- Verified at commit: `7deea45`
- Locator status: `active`

### Verify artifact editors

- Path: `packages/web/src/routes/verify/VerifyReviewStep.tsx`
- Stable anchor: `VerifyReviewStep`
- Role in behavior: validation report와 Catalog delta의 dirty/save surface를 제공한다.
- Inputs: drafts, exists/dirty/saving state, callbacks
- Outputs: text changes와 save callback
- State/artifact reads: parent를 통해 `reg.validation-report`, `reg.catalog-delta`
- State/artifact writes: parent callback을 통해 같은 registers
- Important callers: `VerifyWorkbench`
- Important callees: shared UI primitives
- External boundaries: 없음; persistence는 parent hook이 수행한다.
- Failure/edge behavior: dirty하지 않거나 save 중이면 버튼을 disabled한다.
- Related registers: `reg.validation-report`, `reg.catalog-delta`
- Verified at commit: `7deea45`
- Locator status: `active`

### Verify command API

- Path: `packages/web/server/afVerifyRunApi.ts`
- Stable anchor: `VERIFY_COMMANDS`, `handleVerifyRun`, `normalizeVerifyCommandKey`, `verifyCommandArgv`, `runVerifyCommand`
- Role in behavior: 세 command allowlist, argv 구성, process 실행과 manifest validation 기록을 소유한다.
- Inputs: reqId, command key, optional stream/signal callbacks
- Outputs: command, exit code, stdout/stderr, pass/fail
- State/artifact reads: `reg.artifact-root`
- State/artifact writes: `reg.run-manifest` validation
- Important callers: `createAfArtifactsMiddleware`, Stage Runner verify primitive
- Important callees: `runProcess`, `writeManifestValidationResult`
- External boundaries: Node/npm subprocess, HTTP/SSE
- Failure/edge behavior: unknown command를 거부하고 nonzero exit도 결과와 manifest failure로 보존한다.
- Related registers: `reg.run-manifest`, `reg.stage-run-evidence`
- Verified at commit: `7deea45`
- Locator status: `active`

### Manifest validation recorder

- Path: `packages/web/server/manifestValidation.ts`
- Stable anchor: `writeManifestValidationResult`
- Role in behavior: latest command와 pass/fail을 manifest validation substate로 교체한다.
- Inputs: store, reqId, rendered command, boolean passed
- Outputs: rewritten manifest
- State/artifact reads: `reg.run-manifest`
- State/artifact writes: `reg.run-manifest`
- Important callers: `runVerifyCommand`
- Important callees: `ArtifactRootStore.readManifest`, `writeManifest`
- External boundaries: local filesystem
- Failure/edge behavior: ETag 없이 whole-manifest write를 사용하므로 동시 writer conflict를 별도로 감지하지 않는다.
- Related registers: `reg.run-manifest`
- Verified at commit: `7deea45`
- Locator status: `active`

### Artifact validator orchestration

- Path: `scripts/validate-artifacts.mjs`
- Stable anchor: CLI top-level section `collectTargets` → per-target validation loop → error exit
- Role in behavior: schema, candidates, Graph IR, analysis, manifest, scaffold와 registry agreement를 한 command에서 검증한다.
- Inputs: optional artifact root path, repository schema/catalog/template contract surfaces
- Outputs: `Artifact validation OK` 또는 error list와 exit 1
- State/artifact reads: `reg.analysis-result`, `reg.module-candidates`, `reg.process-flow`, `reg.run-manifest`, `reg.scaffold-plan`, Catalog/schema/template fixtures
- State/artifact writes: 없음
- Important callers: Verify command API, artifact-sync validation step, CLI user
- Important callees: `collectTargets`, `validateAfRunManifest`, `validateModuleCandidates`, `validateContractRegistry`, local validation sections
- External boundaries: local filesystem, process exit status
- Failure/edge behavior: 모든 수집 error를 모아 한 번에 출력하고 하나라도 있으면 exit 1이다.
- Related registers: `reg.run-manifest`, `reg.analysis-result`, `reg.scaffold-plan`
- Verified at commit: `7deea45`
- Locator status: `active`

### Verify proposal runner and apply

- Path: `packages/web/server/stageRunner.ts`
- Stable anchor: `runStageSkill`, `applyStageRun`, verify entry in `skillRunnerStages`
- Role in behavior: allowlisted Verify process를 run ledger에 묶고 report/delta proposal과 explicit apply를 제공한다.
- Inputs: reqId, stage `verify`, verify command key
- Outputs: process events, proposed report/delta, diff/summary, canonical apply
- State/artifact reads: `reg.run-manifest`, `reg.validation-report`, `reg.catalog-delta`, `reg.stage-run-evidence`
- State/artifact writes: `reg.run-manifest`, `reg.stage-run-evidence`; apply 시 `reg.validation-report`, `reg.catalog-delta`
- Important callers: `handleStageRunner`; client `VerifyWorkbench`
- Important callees: `runVerifyCommand`, verify proposal writer, `ArtifactRootStore`
- External boundaries: subprocess, filesystem, SSE callback
- Failure/edge behavior: command failure는 manifest failure와 `validation.ok=false`로 남지만 Stage Runner status는 `completed`일 수 있다. invalid proposal·ETag drift는 apply를 막지만 current apply gate는 `validation.ok`를 검사하지 않는다.
- Related registers: `reg.stage-run-evidence`, `reg.validation-report`, `reg.catalog-delta`, `reg.run-manifest`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- Verify 화면에는 별도 approval boolean이 없으며 어떤 evidence 조합을 전역 완료로 볼지 단일 source field는 확인되지 않았다.
- 각 subprocess가 내부적으로 생성하는 command-specific 파일은 공통 Verify API 계약에 포함되지 않는다.
