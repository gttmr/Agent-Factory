# verify-feedback 검증 증거와 피드백

## 목적

allowlisted 검증 또는 Verify Stage Runner를 실행하고, 결과·잔존 위험과 Catalog 변경 제안을 canonical evidence로 검토·기록한다.

## Trigger와 진입 조건

- Trigger: Build 후 Verify route 진입, 검증 command 선택, Verify Stage Runner 실행 또는 report/delta 편집
- 진입 조건: route 자체에는 별도 Verify approval boolean이 없다. command 실행은 server가 Build stage `complete`, `stub_ready_for_followup=true`, non-empty `runtime-stub/`을 모두 확인한 뒤에만 시작한다.

## 종료 조건

- command key별 최신 검증 결과가 manifest validation ledger에 누적된다. `validate_artifact_root`와 `validate_generated_runtime`이 모두 통과하고 실패 evidence가 없으면 Verify stage가 `complete`, required evidence가 덜 모이면 `pending`, 실패가 있으면 `blocked`다.
- 필요한 경우 `validation-report.md`가 canonical root에 적용·저장된다. `catalog-delta.yaml`은 필수 evidence 집합을 통과한 최신 Verify run에서만 같은 apply로 승격된다.
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

1. Verify 화면은 artifact validation, generated runtime smoke, web build, analyzer test 중 command key를 선택한다.
2. server는 Build handoff와 실제 Runtime Handoff 파일을 확인한 뒤 Stage Runner 또는 direct Verify primitive로 allowlisted process를 실행하고 command key별 최신 exact command·pass/fail과 aggregate Verify stage status를 갱신한다.
3. runner는 command 결과에서 report와 empty delta template proposal을 만들고 diff/evidence를 저장한다.
4. 사용자가 apply하면 현재 proposal hash·validation과 적용 대상 전체의 canonical ETag를 먼저 확인한다. 필수 evidence 집합이 통과한 최신 run이면 report와 delta를 함께 교체하고, 그 외 run은 report만 교체한 뒤 delta를 제외 이유와 함께 그대로 둔다.
5. review에서는 canonical report와 delta를 직접 편집·저장할 수 있다.
6. Catalog delta가 있으면 Reuse Hub publication stage로 이어진다.

Current Stage Runner Verify의 실행 주체는 server allow-list primitive이며 skill directory를 읽지 않는다. canonical `af-verify-runtime`은 layered verification을 수행하는 direct/manual skill 경로다.

## 분기와 실패/needs-info

- 임의 shell command는 허용하지 않는다. unknown key는 400이다.
- Build handoff가 승인되지 않았거나 Build stage가 complete가 아니거나 `runtime-stub/`이 비어 있으면 process 생성 전에 409다.
- direct Verify API의 command nonzero exit는 422이고 해당 evidence와 aggregate manifest validation은 failed가 된다. Stage Runner는 artifact validation이 별도로 실패하지 않으면 run status를 `completed`로 유지하면서 `validation.ok=false`를 기록한다. 이 run은 실패 증거인 report만 apply할 수 있고 delta는 적용 대상에서 제외된다.
- 현재 proposal hash가 run의 `proposed_etag`와 다르거나 strict validation 또는 canonical ETag 검사가 실패하면 쓰기 전에 apply 전체를 막는다. 앞 파일부터 일부만 교체하는 partial apply를 허용하지 않는다.
- report나 delta 없이도 review 화면으로 이동할 수 있으므로 파일 존재 자체가 완료 gate가 아니다.
- generated-runtime 명령은 생성 Python을 bytecode write 없이 compile하고 generated package test의 계약·ADK import를 실행한다. Python/pytest/ADK가 없거나 test가 없으면 통과로 보정하지 않고 실패·unverified 근거를 남긴다.

## 읽는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.asset-candidates`](../registers.md#cross-stage-registers)
- [`reg.graph-ir`](../registers.md#cross-stage-registers)
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
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
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
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Verify command API

- Path: `packages/web/server/afVerifyRunApi.ts`
- Stable anchor: `VERIFY_COMMANDS`, `handleVerifyRun`, `normalizeVerifyCommandKey`, `verifyCommandArgv`, `runVerifyCommand`
- Role in behavior: 네 command allowlist, Build handoff readiness, argv 구성, process 실행과 manifest Verify evidence 기록을 소유한다.
- Inputs: reqId, command key, optional stream/signal callbacks
- Outputs: command, exit code, stdout/stderr, pass/fail
- State/artifact reads: `reg.artifact-root`, `reg.run-manifest`, `reg.runtime-stub`
- State/artifact writes: `reg.run-manifest` validation과 Verify stage status
- Important callers: `createAfArtifactsMiddleware`, Stage Runner verify primitive
- Important callees: `assertVerifyReady`, `runProcess`, `writeVerifyManifestResult`, `scripts/validate-generated-runtime.mjs`
- External boundaries: Node/npm subprocess, HTTP/SSE
- Failure/edge behavior: readiness 부족은 process 시작 전 409로 거부하고, unknown command를 거부하며, nonzero exit도 결과와 manifest failure·blocked stage로 보존한다.
- Related registers: `reg.run-manifest`, `reg.stage-run-evidence`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Manifest validation recorder

- Path: `packages/web/server/manifestValidation.ts`
- Stable anchor: `writeManifestValidationResult`, `writeVerifyManifestResult`
- Role in behavior: artifact-sync 내부 validation은 validation substate만 교체하고, Verify 실행은 command key별 최신 evidence를 누적해 current stage 및 Verify pending/complete/blocked status를 기록한다.
- Inputs: store, reqId, command key, rendered command, boolean passed
- Outputs: rewritten manifest
- State/artifact reads: `reg.run-manifest`
- State/artifact writes: `reg.run-manifest`
- Important callers: artifact-sync process step, `runVerifyCommand`, Verify Stage Runner
- Important callees: `ArtifactRootStore.readManifest`, `writeManifest`
- External boundaries: local filesystem
- Failure/edge behavior: Verify result write는 canonical write lock 안에서 수행하지만 process crash까지 rollback하는 디스크 transaction은 아니다.
- Related registers: `reg.run-manifest`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Artifact validator orchestration

- Path: `scripts/validate-artifacts.mjs`
- Stable anchor: `validateFile`, `validateAnalysis`, `validateAssetList`, `validateGraph`, `validateGraphReferences`, `validateScaffoldPlan`
- Role in behavior: strict schemas, Asset candidates, Graph IR, analysis, manifest, scaffold와 Catalog/template agreement를 한 command에서 검증한다.
- Inputs: optional artifact root path, repository schema/catalog/template contract surfaces
- Outputs: `Artifact validation OK` 또는 error list와 exit 1
- State/artifact reads: `reg.analysis-result`, `reg.asset-candidates`, `reg.graph-ir`, `reg.run-manifest`, `reg.scaffold-plan`, Catalog/schema/template fixtures
- State/artifact writes: 없음
- Important callers: Verify command API, artifact-sync validation step, CLI user
- Important callees: JSON Schema validator와 local exact-key/reference validation sections
- External boundaries: local filesystem, process exit status
- Failure/edge behavior: `contract_version: "2.0"`과 strict roots/refs를 요구하고, top-level Graph `workflow_ref: null`은 standalone graph로 허용한다. 모든 수집 error를 모아 한 번에 출력하고 하나라도 있으면 exit 1이다.
- Related registers: `reg.run-manifest`, `reg.analysis-result`, `reg.scaffold-plan`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Verify proposal runner and apply

- Path: `packages/web/server/stageRunner.ts`
- Stable anchor: `runStageSkill`, `applyStageRun`, verify entry in `skillRunnerStages`
- Role in behavior: Build handoff readiness를 재검사한 뒤 allowlisted Verify process를 run ledger에 묶고 report/delta proposal과 explicit apply를 제공한다.
- Inputs: reqId, stage `verify`, verify command key
- Outputs: process events, proposed report/delta, diff/summary, canonical apply
- State/artifact reads: `reg.run-manifest`, `reg.runtime-stub`, `reg.validation-report`, `reg.catalog-delta`, `reg.stage-run-evidence`
- State/artifact writes: `reg.run-manifest`, `reg.stage-run-evidence`; 필수 evidence를 모두 통과한 최신 run apply 시 `reg.validation-report`, `reg.catalog-delta`, 그 외 run apply 시 `reg.validation-report`만
- Important callers: `handleStageRunner`; client `VerifyWorkbench`
- Important callees: `assertVerifyReady`, `runVerifyCommand`, `writeVerifyManifestResult`, verify proposal writer, `ArtifactRootStore`
- External boundaries: subprocess, filesystem, SSE callback
- Failure/edge behavior: command failure는 manifest failure와 `validation.ok=false`로 남지만 Stage Runner status는 `completed`일 수 있다. 단일 successful command도 필수 집합이 덜 모였거나 다른 실패가 있으면 aggregate Verify를 complete로 만들지 않는다. 이 경우 apply 응답은 report를 `applied_artifacts`, delta를 이유가 있는 `skipped_artifacts`로 구분한다. 현재 proposal hash·validation과 적용 대상 전체의 canonical ETag를 먼저 확인하므로 변조·invalid proposal·conflict 시 canonical 파일은 하나도 쓰지 않는다.
- Related registers: `reg.stage-run-evidence`, `reg.validation-report`, `reg.catalog-delta`, `reg.run-manifest`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

## 확인되지 않은 사항

- generated contract/import test는 live HTTP MCP server나 live A2A message interoperability를 대신하지 않는다. 해당 pattern은 별도 runtime evidence로 기록한다.
