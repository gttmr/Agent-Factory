# runtime-handoff-build 동기화와 Runtime Handoff

## 목적

승인된 analysis·Graph·계약에서 split artifact와 scaffold plan을 동기화하고, 검토 가능한 ADK Runtime Handoff bundle과 handoff note를 생성·검토·승인한다.

## Trigger와 진입 조건

- Trigger: 두 Design gate 승인 뒤 Build route 진입, plan save, artifact-sync 또는 runtime-stub build
- 진입 조건: `analysis_reviewed=true`, `boundaries_approved=true`, `runtime_contracts_approved=true`; generator에는 strict Target v2 analysis, non-empty approved Assets, approved typed Graph projection, required Runtime Contract coverage와 error-free Graph가 필요하다.

## 종료 조건

- `scaffold-plan.json.validation.can_generate_source=true`
- `runtime-stub/`에 review 가능한 파일이 하나 이상 존재한다.
- root-level `implementation-handoff.md`를 필요에 따라 검토·저장한다.
- 사용자가 `stub_ready_for_followup`을 true로 설정하면 Build stage가 complete로 projection된다.

## 주요 입력

- approved `analysis-result.json`과 Design approvals
- Asset candidates, Graph IR, runtime/A2A contracts, Agent·Workflow·Tool Catalog. Catalog 연결의 실행 권위는 Asset `binding`/`connection`과 `inputs`/`outputs`다.
- output mode(`smoke` 또는 `runnable`)와 optional Mock Lab binding
- 기존 scaffold plan과 runtime-stub

## 주요 출력

- `normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json`, `scaffold-plan.json`
- `runtime-stub/**`와 manifest build outputs
- root-level `implementation-handoff.md`
- optional validation result와 Stage Runner evidence
- `stub_ready_for_followup`

## Main Flow

1. Build UI는 analysis·Catalog·output mode에서 scaffold plan을 파생하고 선택적으로 Mock Lab MCP binding을 반영해 저장한다. Server는 두 Design approval, strict schema, requirement identity와 canonical Asset·Graph·runtime contract·Catalog projection을 다시 검증한다.
2. artifact-sync는 canonical analysis에서 네 split/derived JSON을 재파생·교체한다.
3. 기본 sync 옵션은 Runtime Handoff 재생성과 artifact validation을 이어서 실행한다.
4. direct build 또는 Build Stage Runner는 `generate-adk-source.mjs`를 실행해 canonical `runtime-stub/`에 bundle을 쓴다. Build runner에는 apply proposal이 없다.
5. generator는 approved source invariant와 contract/Graph readiness를 확인하고 output file map을 조립해 디스크에 쓴다.
6. review 화면은 generated 파일을 안전하게 읽고 root-level handoff note를 편집한다.
7. runtime-stub이 비어 있지 않으면 사용자가 후속 인계 gate를 토글한다.

`normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json`은 direct PUT으로 수정하지 않는다. `scaffold-plan.json` PUT은 canonical design에서 계산한 값만 받으며, approved Tool의 명시적 Mock Lab MCP binding만 허용된 projection 차이다. plan save, compound artifact-sync, direct runtime-stub build, Build Stage Runner는 모두 Analyze와 두 Design approval을 server에서 확인한다.

Current Stage Runner Build의 실행 주체는 server primitive이며 skill directory를 읽지 않는다. canonical `af-scaffold-runtime`은 approved design을 받는 direct/manual skill 경로다.

## 분기와 실패/needs-info

- Analyze 또는 Design approvals가 부족하면 plan/sync/build action을 막는다.
- scaffold plan이 strict schema를 어기거나 canonical requirement·Asset·Graph·contract·Catalog projection과 다르면 write 전에 422다.
- analysis invalid, unresolved candidate, Graph error, unapproved runtime/A2A contract 또는 scaffold blocker는 sync/generator 실패가 된다.
- runnable은 구현된 의미만 생성한다. stdio/unknown MCP, callback·retry·fallback·error·명시적 resume·cancel·timeout control Edge, bound/exhaustion 계약 없는 loop, 명시적 default가 없는 condition route는 fail-closed한다. 승인된 structured `async_resume` Runtime Contract가 exact Human Input/Tool annotation을 가진 경로는 stable ID·expiry·replay·session-state at-most-once guard로 생성한다. `representation: graph`의 cycle을 dynamic으로 암묵 전환하지 않는다.
- Workflow-owned MCP Tool Node는 reviewed `tool_name`을 직접 호출하고 Agent-owned MCP capability는 같은 exact name을 `McpToolset.tool_filter`로 제한한다.
- no-A2A와 A2A consuming-only bundle은 provider launcher·Agent Card·provider docs/tests를 만들지 않는다. approved A2A exposure가 있을 때만 provider surface를 생성한다. Generated consumer는 remote error/failed/canceled/rejected, unsupported input-required/auth-required, empty/long-running-only result를 typed failure로 중단하며 reviewed follow-up/fallback handoff를 자동 실행하지 않는다.
- generator는 complete `af-run-manifest.json`을 필수 입력으로 읽고 누락된 stage/approval/validation 값을 보정하지 않는다.
- artifact-sync는 sync 성공 뒤 generation/validation이 실패할 수 있으므로 일부 derived artifact가 이미 교체된 상태일 수 있다.
- generated file preview는 path traversal, `.adk` 등 local execution output, 500KB 초과 파일을 거부한다.
- writer는 output directory를 선삭제하지 않는다. 새 file map에 없는 이전 파일은 자동 제거되지 않는다.
- build 성공은 manifest outputs를 갱신하지만 approval을 자동 true로 만들지 않는다.

## 읽는 Register

- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.asset-candidates`](../registers.md#cross-stage-registers)
- [`reg.graph-ir`](../registers.md#cross-stage-registers)
- [`reg.runtime-contracts`](../registers.md#cross-stage-registers)
- [`reg.a2a-contracts`](../registers.md#cross-stage-registers)
- [`reg.scaffold-plan`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)
- [`reg.implementation-handoff`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)
- [`reg.mock-lab-lifecycle`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.asset-candidates`](../registers.md#cross-stage-registers)
- [`reg.graph-ir`](../registers.md#cross-stage-registers)
- [`reg.scaffold-plan`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)
- [`reg.implementation-handoff`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.stage-status`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)
- artifact-sync validation 시 manifest의 validation substate

## 이전·다음 Stage

- 이전: [design-boundary-contract](design-boundary-contract.md)
- 다음: [verify-feedback](verify-feedback.md)
- 보조: runnable mode에서 [mock-tool-integration](mock-tool-integration.md), 생성 후 [runtime-execution](runtime-execution.md)

## 외부 경계

- browser Workbench, Stage Runner HTTP/SSE
- local filesystem과 Node subprocess
- ADK source generator
- Mock Lab MCP discovery

## L3 Source Map

### Build stage state and navigation

- Path: `packages/web/src/routes/build/BuildStageState.tsx`
- Stable anchor: `useBuildStageState`, `BuildStageSummary`
- Role in behavior: Design gate, scaffold readiness, stub file count와 후속 approval에서 run/review/approve 상태를 파생한다.
- Inputs: manifest, scaffold plan, runtime-stub listing
- Outputs: step model, summary, next action
- State/artifact reads: `reg.approvals`, `reg.scaffold-plan`, `reg.runtime-stub`
- State/artifact writes: 없음
- Important callers: `BuildWorkbench`
- Important callees: artifact/scaffold hooks, `useStageStep`
- External boundaries: React query cache
- Failure/edge behavior: stub이 없으면 review·approve를 열지 않고 Design gate가 없으면 run을 blocked로 표시한다.
- Related registers: `reg.approvals`, `reg.scaffold-plan`, `reg.runtime-stub`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Build run orchestration

- Path: `packages/web/src/routes/build/BuildRunStep.tsx`
- Stable anchor: `BuildRunStep`
- Role in behavior: scaffold derivation/save, output mode, Mock Lab binding, artifact-sync, direct build와 Build Stage Runner surface를 조정한다.
- Inputs: approvals, analysis, Catalog, saved plan/stub, Mock Lab discovery
- Outputs: scaffold PUT, artifact-sync/build requests, Stage Runner request
- State/artifact reads: `reg.analysis-result`, `reg.approvals`, `reg.scaffold-plan`, `reg.runtime-stub`, `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- State/artifact writes: `reg.scaffold-plan`, `reg.runtime-stub`, `reg.run-manifest`, `reg.stage-run-evidence`
- Important callers: `BuildWorkbench`
- Important callees: `buildScaffoldPlan`, `applyMockLabBinding`, `ManualBuildControls`의 `toolConnections`, build/sync/scaffold hooks, `StageRunnerPanel`
- External boundaries: HTTP/SSE, Mock Lab discovery
- Failure/edge behavior: output mode가 저장 plan과 다르거나 plan blocker가 있으면 build를 막는다. Server plan PUT은 Design approval 부족을 409, invalid/drifted plan을 422로 거부한다.
- Related registers: `reg.scaffold-plan`, `reg.runtime-stub`, `reg.mock-lab-lifecycle`, `reg.stage-run-evidence`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Runtime Handoff review

- Path: `packages/web/src/routes/build/BuildReviewStep.tsx`
- Stable anchor: `BuildReviewStep`
- Role in behavior: generated file inventory와 safe preview를 제공하고 root-level handoff note를 편집한다.
- Inputs: runtime-stub listing, selected relative path, existing handoff text/ETag
- Outputs: file preview request, handoff text PUT
- State/artifact reads: `reg.runtime-stub`, `reg.implementation-handoff`
- State/artifact writes: `reg.implementation-handoff`
- Important callers: `BuildWorkbench`
- Important callees: `fetchRuntimeStubFile`, runtime/text artifact hooks
- External boundaries: HTTP, browser editor state
- Failure/edge behavior: stub이 없으면 empty state를 표시하고, dirty하지 않은 handoff save는 disabled다.
- Related registers: `reg.runtime-stub`, `reg.implementation-handoff`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Build approval UI

- Path: `packages/web/src/routes/build/BuildApprovalStep.tsx`
- Stable anchor: `BuildApprovalStep`
- Role in behavior: non-empty runtime-stub을 근거로 `stub_ready_for_followup` toggle을 제공한다.
- Inputs: manifest, scaffold plan, runtime-stub listing
- Outputs: approval PATCH
- State/artifact reads: `reg.run-manifest`, `reg.approvals`, `reg.scaffold-plan`, `reg.runtime-stub`
- State/artifact writes: `reg.approvals`, `reg.stage-status`
- Important callers: `BuildWorkbench`
- Important callees: `useApprovalGate`
- External boundaries: HTTP
- Failure/edge behavior: false→true는 stub file count가 0이면 disabled지만 이미 true인 gate는 해제할 수 있다.
- Related registers: `reg.approvals`, `reg.stage-status`, `reg.runtime-stub`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Derived artifact synchronization

- Path: `packages/web/server/artifactSync.ts`
- Stable anchor: `DERIVED_JSON_PATHS`, `syncArtifactRoot`
- Role in behavior: canonical analysis에서 네 derived JSON과 scaffold plan을 계산해 전체 교체한다.
- Inputs: repo root, reqId, optional output mode/Catalog entries
- Outputs: drift before/after와 written artifact list
- State/artifact reads: `reg.analysis-result`, 기존 `reg.scaffold-plan`, `reg.catalog-entries`
- State/artifact writes: `reg.asset-candidates`, `reg.graph-ir`, `reg.scaffold-plan`와 normalized requirement derived artifact
- Important callers: `handleArtifactSyncRun`
- Important callees: `buildScaffoldPlan`, `loadServerScaffoldCatalog`, `ArtifactRootStore`
- External boundaries: local filesystem
- Failure/edge behavior: invalid/missing canonical analysis는 422이며 요청 output mode가 없으면 saved mode, 그다음 `smoke`를 사용한다. `catalog_bound_assets`에는 Asset/Catalog ID와 name 네 필드만 기록한다.
- Related registers: `reg.analysis-result`, `reg.asset-candidates`, `reg.graph-ir`, `reg.scaffold-plan`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Scaffold-plan write validation

- Path: `packages/web/server/scaffoldPlanValidation.ts`, `scripts/artifact-validation/scaffold-asset-projection.mjs`
- Stable anchor: `validateScaffoldPlanWrite`, `scaffoldAssetProjectionErrors`
- Role in behavior: Build UI가 저장하는 plan을 strict schema와 canonical analysis·Catalog projection에 대조하고 Mock Lab MCP Tool binding의 유일한 허용 차이를 공유 정의한다.
- Inputs: repo root, reqId, proposed scaffold plan, canonical analysis와 current Catalog
- Outputs: validation error list 또는 write 허용
- State/artifact reads: `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: 없음
- Important callers: `handlePutJson`, root artifact validator, generator input validator
- Important callees: JSON Schema validator, `buildScaffoldPlan`, `loadServerScaffoldCatalog`
- External boundaries: local filesystem Catalog read
- Failure/edge behavior: schema 오류, requirement mismatch, Asset 누락·임의 drift, Graph/runtime contract drift, 조작된 readiness·Catalog manifest를 422로 만든다.
- Related registers: `reg.analysis-result`, `reg.scaffold-plan`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-20 worktree
- Locator status: `active`

### Artifact-sync compound run

- Path: `packages/web/server/artifactSyncRunApi.ts`
- Stable anchor: `handleArtifactSyncRun`
- Role in behavior: sync → optional generation → optional validation 순서를 HTTP 또는 SSE로 실행한다.
- Inputs: output mode, rebuild/validation booleans, stream preference
- Outputs: sync/generation/validation summaries와 progress events
- State/artifact reads: `reg.analysis-result`, `reg.scaffold-plan`
- State/artifact writes: `reg.asset-candidates`, `reg.graph-ir`, `reg.scaffold-plan`, `reg.runtime-stub`, `reg.run-manifest`
- Important callers: `createAfArtifactsMiddleware`; client `useArtifactSync`
- Important callees: `syncArtifactRoot`, generation/validation process steps, `recordRuntimeStubBuild`
- External boundaries: HTTP/SSE, Node subprocess, filesystem
- Failure/edge behavior: Design approval 부족은 process 시작 전 409다. 각 후속 step 실패는 422 또는 SSE error를 반환하며 이미 완료한 앞 step write를 rollback하지 않는다.
- Related registers: `reg.scaffold-plan`, `reg.runtime-stub`, `reg.run-manifest`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Runtime-stub API and subprocess

- Path: `packages/web/server/afRuntimeStubApi.ts`
- Stable anchor: `handleListRuntimeStub`, `handleReadRuntimeStubFile`, `handleBuildRuntimeStub`, `runRuntimeStubBuild`
- Role in behavior: generated file list/read와 generator subprocess 실행, manifest output recording을 소유한다.
- Inputs: reqId, optional stream request, relative preview path
- Outputs: file inventory/content 또는 build process result
- State/artifact reads: `reg.scaffold-plan`, `reg.analysis-result`, `reg.runtime-stub`
- State/artifact writes: `reg.runtime-stub`, `reg.run-manifest`
- Important callers: `createAfArtifactsMiddleware`, Stage Runner build primitive
- Important callees: `scripts/generate-adk-source.mjs`, `collectRuntimeStubFiles`, `recordRuntimeStubBuild`
- External boundaries: Node subprocess, HTTP/SSE, filesystem
- Failure/edge behavior: Design approval 부족은 generator 시작 전 409다. nonzero exit는 422/result failure이며 unsafe·ignored·oversized preview path를 거부한다.
- Related registers: `reg.runtime-stub`, `reg.run-manifest`, `reg.scaffold-plan`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Generator input contract

- Path: `scripts/adk-source/context.mjs`
- Stable anchor: `loadArtifactContext`
- Role in behavior: approved artifact root의 strict Target v2 aggregate와 scaffold plan을 직접 읽고 generator invariant와 Asset/Graph/contract readiness를 검증한다.
- Inputs: artifact root path
- Outputs: validated generator context, output mode와 package name
- State/artifact reads: `reg.analysis-result`, `reg.asset-candidates`, `reg.graph-ir`, `reg.run-manifest`, `reg.scaffold-plan`
- State/artifact writes: 없음
- Important callers: `scripts/generate-adk-source.mjs`
- Important callees: filesystem JSON reader, strict exact-key/reference/input validators, `assertAsyncResumeSupported`, Remote A2A policy validation
- External boundaries: local filesystem
- Failure/edge behavior: `contract_version`이 `2.0`이 아니거나 제거된 root/split filename이 존재하면 거부한다. complete manifest가 없거나 raw-to-code invariant 위반, missing approved Assets/gates, typed Graph ref/ownership 오류, required Runtime Contract 누락·중복·미승인, unsupported runtime control도 throw한다. Structured async-resume의 stable ID/Node/Tool/input/route ownership 불일치도 생성 전에 거부한다. Asset는 canonical approved candidate와 같아야 하며 명시적 Mock Lab MCP Tool binding만 같은 공유 규칙으로 허용한다.
- Related registers: `reg.analysis-result`, `reg.scaffold-plan`, `reg.approvals`
- Verified at: baseline `0cdcb82` + 2026-07-21 worktree
- Locator status: `active`

### Generator file assembly

- Path: `scripts/adk-source/file-builder.mjs`
- Stable anchor: `buildFiles`
- Role in behavior: package source, config/schema/mock sample, manifest, handoff와 tests의 output map을 조립한다. async-resume coordinator와 guarded synthetic Tool, exact MCP allow-list, fail-closed Remote A2A consumer를 runtime source에 포함하고 approved A2A exposure가 있을 때만 provider launcher·Agent Card surface를 추가한다.
- Inputs: verified artifact context와 output root
- Outputs: relative path → content map
- State/artifact reads: in-memory `reg.scaffold-plan`, `reg.graph-ir`, `reg.runtime-contracts`
- State/artifact writes: 직접 없음; 반환 map이 `reg.runtime-stub`이 된다.
- Important callers: `scripts/generate-adk-source.mjs`
- Important callees: graph coverage/indexes, `resume-contracts.mjs`, Human Input/function/Agent emitters, `remote-a2a.mjs`, support emitters
- External boundaries: 없음; pure file assembly에 가깝다.
- Failure/edge behavior: Graph coverage 또는 emitter invariant가 맞지 않으면 file map 완성 전에 throw한다. Remote A2A non-success·unsupported interactive state는 generated typed exception으로 success terminal 전파를 끊고, reviewed input/auth follow-up과 fallback handoff metadata만 failure context에 남긴다.
- Related registers: `reg.runtime-stub`, `reg.scaffold-plan`, `reg.graph-ir`
- Verified at: baseline `0cdcb82` + 2026-07-21 worktree
- Locator status: `active`

### Generator bundle writer

- Path: `scripts/adk-source/bundle-writer.mjs`
- Stable anchor: `writeBundleFiles`
- Role in behavior: assembled output map을 지정 output root에 쓴다.
- Inputs: output root, relative path → content map
- Outputs: filesystem bundle
- State/artifact reads: 없음
- State/artifact writes: `reg.runtime-stub`
- Important callers: `scripts/generate-adk-source.mjs`
- Important callees: `mkdirSync`, `writeFileSync`
- External boundaries: local filesystem
- Failure/edge behavior: parent directory를 만들고 대상 파일만 덮어쓴다. output tree 삭제·stale file 제거는 수행하지 않는다.
- Related registers: `reg.runtime-stub`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

## 확인되지 않은 사항

- generator가 출력하지 않게 된 이전 파일을 자동 제거하는 별도 cleanup 호출은 direct build와 artifact-sync 경로에서 확인되지 않았다.
- generated ADK bundle의 실제 framework 동작은 [runtime-execution](runtime-execution.md)에서 별도 local proof가 필요하다.
