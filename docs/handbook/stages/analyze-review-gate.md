# analyze-review-gate 분석 제안·검토·승인

## 목적

raw requirement와 Catalog 근거에서 source-backed 분석 proposal을 만들고, canonical 적용·missing information 수용·명시적 분석 승인까지 연결한다.

## Trigger와 진입 조건

- Trigger: artifact root의 Analyze route 진입, 새 분석 실행, 재실행 또는 analysis import
- 진입 조건: root가 존재한다. Stage Runner 실행에는 비어 있지 않은 requirement text가 필요하다.

## 종료 조건

- canonical `analysis-result.json`이 존재한다.
- requirement-level missing information이 모두 `accepted_missing_information`에 반영된다.
- 사용자가 `analysis_reviewed`를 true로 설정하면 Analyze stage status가 complete로 projection된다.

## 주요 입력

- raw requirement text와 domain hint
- 현재 canonical analysis와 ETag
- 현재 Agent·Workflow·Tool Catalog index
- 이전 Analyze run evidence

## 주요 출력

- proposed/canonical strict Target v2 `analysis-result.json`
- `runs/analyze/<run-id>/` evidence
- `analysis_reviewed`와 Analyze status projection

## Main Flow

1. 화면은 raw text와 Catalog snapshot으로 Analyze Stage Runner request를 만든다.
2. server runner는 run directory와 request/event ledger를 만들고 Codex SDK 또는 test-only fake runner를 실행한다.
3. 성공 결과는 `contract_version: "2.0"`, `assetCandidates`, `graph`를 가진 `proposed-artifacts/analysis-result.json` 및 diff summary로 남으며 canonical은 그대로다.
4. 사용자가 apply하면 base ETag와 현재 canonical ETag를 비교하고 검증 후 파일을 교체한다.
5. review에서 requirement-level missing information의 수용 상태를 canonical analysis에 저장한다.
6. 모든 항목이 수용되면 사용자가 `analysis_reviewed`를 수동으로 토글한다.

## 분기와 실패/needs-info

- 비어 있는 raw text는 run을 막는다.
- 같은 reqId에서는 다른 stage를 포함해 Stage Runner run을 동시에 시작할 수 없다.
- cancel은 reqId별 `AbortController`에 전달된다.
- Codex 실패·취소·invalid proposal은 diagnostics와 failed/canceled summary를 남긴다.
- apply 시 base ETag가 바뀌었으면 409 conflict로 canonical 교체를 막는다.
- Asset-level `status: needs_info`는 이 approval의 직접 soft gate가 아니며 Design/Build에서 별도로 해소해야 한다.

## 읽는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.asset-candidates`](../registers.md#cross-stage-registers)
- [`reg.graph-ir`](../registers.md#cross-stage-registers)
- [`reg.runtime-contracts`](../registers.md#cross-stage-registers)
- [`reg.a2a-contracts`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.stage-status`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: [request-intake-artifact-root](request-intake-artifact-root.md)
- 다음: [design-boundary-contract](design-boundary-contract.md)

## 외부 경계

- browser Workbench와 `/api/af/:reqId/**`
- Codex SDK execution with workspace-write, approval never, network disabled
- local artifact root와 Stage Runner ledger

## L3 Source Map

### Analyze workbench

- Path: `packages/web/src/routes/AnalyzeWorkbench.tsx`
- Stable anchor: default `AnalyzeWorkbench`
- Role in behavior: run → review → approve 흐름, missing information 수용과 `analysis_reviewed` toggle을 조정한다.
- Inputs: manifest, canonical analysis, Catalog index, requirement draft
- Outputs: Stage Runner props, analysis PUT, approval PATCH, Design navigation
- State/artifact reads: `reg.run-manifest`, `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: `reg.analysis-result`, `reg.approvals`, `reg.stage-status`, `reg.recent-roots`
- Important callers: `AppRouter`
- Important callees: `AnalyzeRunStep`, `AnalyzeReviewWorkspace`, `AnalyzeApprovalStep`, analysis/approval hooks
- External boundaries: React query cache, HTTP, browser file import
- Failure/edge behavior: analysis가 없으면 review를 막고, missing information 수용이 부족하면 approval을 막는다.
- Related registers: `reg.analysis-result`, `reg.approvals`, `reg.stage-status`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Analyze step model

- Path: `packages/web/src/routes/analyze/analyzeStageModel.tsx`
- Stable anchor: `ANALYZE_STEP_IDS`, `buildAnalyzeSteps`, `buildAnalyzeNextAction`, `flattenCatalogForAnalyzer`
- Role in behavior: 세 step의 availability/status, next action과 Catalog의 Agent·Workflow·Tool analyzer input을 계산한다.
- Inputs: analysis 존재, review readiness, approval, Catalog buckets
- Outputs: Stage shell step model, next action, analyzer Catalog array
- State/artifact reads: `reg.analysis-result`, `reg.approvals`, `reg.catalog-entries`
- State/artifact writes: 없음
- Important callers: `AnalyzeWorkbench`
- Important callees: 없음; pure model functions
- External boundaries: 없음
- Failure/edge behavior: analysis 또는 review readiness가 없으면 다음 step action을 disabled로 반환한다.
- Related registers: `reg.analysis-result`, `reg.approvals`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Analyze Stage Runner screen contract

- Path: `packages/web/src/routes/stageRunnerScreenConfig.ts`
- Stable anchor: `buildAnalyzeStageRunnerConfig`
- Role in behavior: canonical `af-discover-assets` stage label, disabled reason, metrics, ETag와 request body를 구성한다.
- Inputs: raw text, domain, Catalog snapshot/count, current analysis ETag
- Outputs: `StageRunnerPanel` config와 runner request body
- State/artifact reads: `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: 직접 쓰지 않음
- Important callers: `AnalyzeRunStep`
- Important callees: `StageRunnerPanel`이 소비할 config object
- External boundaries: Stage Runner HTTP/SSE는 panel과 state hook이 수행한다.
- Failure/edge behavior: raw text가 비어 있으면 disabled reason을 반환한다.
- Related registers: `reg.analysis-result`, `reg.stage-run-evidence`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Analyze proposal runner and apply

- Path: `packages/web/server/stageRunner.ts`
- Stable anchor: `skillRunnerStages`, `runStageSkill`, `applyStageRun`, `SdkCodexStageRunner`
- Role in behavior: Analyze request ledger, Codex/fake execution, proposal validation·diff와 explicit apply를 소유한다.
- Inputs: reqId, stage `analyze`, model, raw text/domain, Catalog snapshot, optional signal
- Outputs: run summary/events/diff, proposed analysis, optional canonical apply
- State/artifact reads: `reg.analysis-result`, `reg.catalog-entries`, `reg.stage-run-evidence`
- State/artifact writes: `reg.stage-run-evidence`, `reg.run-manifest`; apply 시 `reg.analysis-result`
- Important callers: `packages/web/server/afStageRunnerApi.ts` · `handleStageRunner`
- Important callees: `SdkCodexStageRunner`, `ArtifactRootStore`, `parseTargetAnalysisResult`, Catalog loader
- External boundaries: Codex SDK, local filesystem, SSE callback
- Failure/edge behavior: run 동시성은 API reqId lock이, canonical write 동시성은 `ArtifactRootStore`의 process-global artifact-root+reqId lock이 관리한다. invalid proposal·cancel·SDK error와 허용 경계 밖 tracked·untracked·개별 ignored file 또는 active-root mutation은 failed/canceled evidence를 남긴다. Workspace mutation은 자동 rollback하지 않는다. apply는 write lock 안에서 현재 proposal hash·strict schema와 모든 canonical ETag를 첫 write 전에 검사해 conflict 시 파일을 쓰지 않는다. process crash·filesystem failure·직접 파일 writer에 대한 rollback transaction은 아니다.
- Related registers: `reg.analysis-result`, `reg.stage-run-evidence`, `reg.run-manifest`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Strict Target aggregate parser

- Path: `packages/web/src/analyzer/targetAnalysisResult.ts`
- Stable anchor: `parseTargetAnalysisResult`
- Role in behavior: unknown input을 strict Target v2 `AnalysisResult` read boundary에서 검증하고 검증된 동일 객체를 반환한다.
- Inputs: unknown parsed value
- Outputs: `AnalysisResult` 또는 contract error
- State/artifact reads: `reg.analysis-result`
- State/artifact writes: 없음
- Important callers: `useAnalysisArtifact`, `stageRunner.ts`
- Important callees: `assertTargetAnalysisResult`
- External boundaries: 없음
- Failure/edge behavior: migration, coercion, backfill 없이 invalid version, missing/unknown field를 거부한다.
- Related registers: `reg.analysis-result`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Strict Target Contract validation

- Path: `packages/web/src/analyzer/targetContract.ts`
- Stable anchor: `validateTargetAnalysisResult`, `assertTargetAnalysisResult`
- Role in behavior: exact Target v2 root keys, Asset/contract refs, Graph envelope와 `contract_version: "2.0"`을 검증한다.
- Inputs: unknown analysis value
- Outputs: validation errors 또는 asserted `AnalysisResult`
- State/artifact reads: `reg.analysis-result`
- State/artifact writes: 직접 없음
- Important callers: `targetAnalysisResult.ts`, `analysisArtifactImport.ts`, `useGraphIR.ts`
- Important callees: local exact-key/ref validation helpers
- External boundaries: 없음
- Failure/edge behavior: 다른 version과 제거된 root/field를 거부한다. top-level Graph `workflow_ref: null`은 standalone Agent/Tool graph로 허용한다.
- Related registers: `reg.analysis-result`, `reg.asset-candidates`, `reg.graph-ir`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

## 확인되지 않은 사항

- Codex SDK 내부에서 어떤 reasoning/tool sequence로 proposal을 만드는지는 정적 source map 범위 밖이며 `unverified`다.
- Stage Runner 성공 또는 apply가 `analysis_reviewed`를 자동으로 true로 만들지 않는 것은 확인했다.
