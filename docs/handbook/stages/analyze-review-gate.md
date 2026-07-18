# analyze-review-gate 분석 제안·검토·승인

## 목적

raw requirement와 Catalog 근거에서 source-backed 분석 proposal을 만들고, canonical 적용·missing information 수용·명시적 분석 승인까지 연결한다.

## Trigger와 진입 조건

- Trigger: artifact root의 Analyze route 진입, 새 분석 실행, 재실행 또는 analysis import
- 진입 조건: root가 존재한다. Stage Runner 실행에는 비어 있지 않은 requirement text가 필요하다.

## 종료 조건

- canonical `analysis-result.json`이 존재한다.
- requirement-level missing information이 모두 legacy `accepted_missing_information`에 반영된다.
- 사용자가 legacy `analysis_reviewed`를 true로 설정하면 Analyze stage status가 complete로 projection된다.

## 주요 입력

- raw requirement text와 domain hint
- 현재 canonical analysis와 ETag
- 현재 Catalog projection
- 이전 Analyze run evidence

## 주요 출력

- proposed/canonical `analysis-result.json`
- `runs/analyze/<run-id>/` evidence
- legacy `analysis_reviewed`와 Analyze status projection

## Main Flow

1. 화면은 raw text와 Catalog snapshot으로 Analyze Stage Runner request를 만든다.
2. server runner는 run directory와 request/event ledger를 만들고 Codex SDK 또는 test-only fake runner를 실행한다.
3. 성공 결과는 `proposed-artifacts/analysis-result.json`과 diff summary로 남으며 canonical은 그대로다.
4. 사용자가 apply하면 base ETag와 현재 canonical ETag를 비교하고 검증 후 파일을 교체한다.
5. review에서 requirement-level missing information의 수용 상태를 canonical analysis에 저장한다.
6. 모든 항목이 수용되면 사용자가 legacy `analysis_reviewed`를 수동으로 토글한다.

## 분기와 실패/needs-info

- 비어 있는 raw text는 run을 막는다.
- 같은 reqId에서는 다른 stage를 포함해 Stage Runner run을 동시에 시작할 수 없다.
- cancel은 reqId별 `AbortController`에 전달된다.
- Codex 실패·취소·invalid proposal은 diagnostics와 failed/canceled summary를 남긴다.
- apply 시 base ETag가 바뀌었으면 409 conflict로 canonical 교체를 막는다.
- candidate-level legacy `status: needs_info`는 이 approval의 직접 soft gate가 아니며 Design/Build에서 별도로 해소해야 한다.

## 읽는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
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
- Role in behavior: run → review → approve 흐름, missing information 수용과 legacy `analysis_reviewed` toggle을 조정한다.
- Inputs: manifest, canonical analysis, Catalog index, requirement draft
- Outputs: Stage Runner props, analysis PUT, approval PATCH, Design navigation
- State/artifact reads: `reg.run-manifest`, `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: `reg.analysis-result`, `reg.approvals`, `reg.stage-status`, `reg.recent-roots`
- Important callers: `AppRouter`
- Important callees: `AnalyzeRunStep`, `AnalyzeReviewWorkspace`, `AnalyzeApprovalStep`, analysis/approval hooks
- External boundaries: React query cache, HTTP, browser file import
- Failure/edge behavior: analysis가 없으면 review를 막고, missing information 수용이 부족하면 approval을 막는다.
- Related registers: `reg.analysis-result`, `reg.approvals`, `reg.stage-status`, `reg.catalog-entries`
- Verified at commit: `7deea45`
- Locator status: `active`

### Analyze step model

- Path: `packages/web/src/routes/analyze/analyzeStageModel.tsx`
- Stable anchor: `ANALYZE_STEP_IDS`, `buildAnalyzeSteps`, `buildAnalyzeNextAction`, `flattenCatalogForAnalyzer`
- Role in behavior: 세 step의 availability/status, next action과 current Catalog의 legacy category projection을 계산한다.
- Inputs: analysis 존재, review readiness, approval, Catalog buckets
- Outputs: Stage shell step model, next action, analyzer Catalog array
- State/artifact reads: `reg.analysis-result`, `reg.approvals`, `reg.catalog-entries`
- State/artifact writes: 없음
- Important callers: `AnalyzeWorkbench`
- Important callees: 없음; pure model functions
- External boundaries: 없음
- Failure/edge behavior: analysis 또는 review readiness가 없으면 다음 step action을 disabled로 반환한다.
- Related registers: `reg.analysis-result`, `reg.approvals`, `reg.catalog-entries`
- Verified at commit: `7deea45`
- Locator status: `active`

### Analyze Stage Runner screen contract

- Path: `packages/web/src/routes/stageRunnerScreenConfig.ts`
- Stable anchor: `buildAnalyzeStageRunnerConfig`
- Role in behavior: legacy `af-analyze-requirement` stage label, disabled reason, metrics, ETag와 request body를 구성한다.
- Inputs: raw text, domain, Catalog snapshot/count, current analysis ETag
- Outputs: `StageRunnerPanel` config와 runner request body
- State/artifact reads: `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: 직접 쓰지 않음
- Important callers: `AnalyzeRunStep`
- Important callees: `StageRunnerPanel`이 소비할 config object
- External boundaries: Stage Runner HTTP/SSE는 panel과 state hook이 수행한다.
- Failure/edge behavior: raw text가 비어 있으면 disabled reason을 반환한다.
- Related registers: `reg.analysis-result`, `reg.stage-run-evidence`, `reg.catalog-entries`
- Verified at commit: `7deea45`
- Locator status: `active`

### Analyze skill compatibility path

- Path: `.agents/skills/af-analyze-requirement/SKILL.md`
- Stable anchor: `Legacy Compatibility Shim`
- Role in behavior: direct/manual legacy 호출 전용 호환 경로다. 첫 실행 지시에서 canonical `.agents/skills/af-discover-assets/SKILL.md`를 읽게 한다. (2026-07-18 코드 단계 이후 Stage Runner `STAGE_DEFINITIONS`는 canonical `skillPath`를 직접 가리키며 이 shim을 더 이상 읽지 않는다.)
- Inputs: explicit legacy invocation context (필요 시 artifact root, run folder와 `request.json`)
- Outputs: canonical discovery 절차에 따른 `proposed-artifacts/analysis-result.json` 한 파일
- State/artifact reads: `reg.analysis-result`, `reg.stage-run-evidence`; canonical skill과 선택된 references
- State/artifact writes: `reg.stage-run-evidence`의 Analyze proposal만 허용
- Important callers: 사용자·자동화의 explicit legacy invocation (Stage Runner는 canonical skill을 직접 호출)
- Important callees: `.agents/skills/af-discover-assets/SKILL.md`
- External boundaries: Codex SDK의 repository file read와 workspace-write sandbox
- Failure/edge behavior: canonical handoff가 끊기거나 proposal 밖 write가 필요하면 호환 계약이 깨진다. 제거 조건은 skill-vnext-status §8을 따른다.
- Related registers: `reg.analysis-result`, `reg.stage-run-evidence`
- Verified in worktree: `2026-07-18 uncommitted`
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
- Important callees: `SdkCodexStageRunner`, `ArtifactRootStore`, `validateAnalysisResult`, Catalog loader
- External boundaries: Codex SDK, local filesystem, SSE callback
- Failure/edge behavior: reqId lock은 API layer가 관리한다. invalid proposal·cancel·SDK error는 failed/canceled evidence를 남기고, ETag drift는 apply를 거부한다.
- Related registers: `reg.analysis-result`, `reg.stage-run-evidence`, `reg.run-manifest`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- Codex SDK 내부에서 어떤 reasoning/tool sequence로 proposal을 만드는지는 정적 source map 범위 밖이며 `unverified`다.
- Stage Runner 성공 또는 apply가 legacy `analysis_reviewed`를 자동으로 true로 만들지 않는 것은 확인했다.
