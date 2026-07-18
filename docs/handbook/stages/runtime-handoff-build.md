# runtime-handoff-build 동기화와 Runtime Handoff

## 목적

승인된 analysis·Graph·계약에서 split artifact와 scaffold plan을 동기화하고, 검토 가능한 ADK Runtime Handoff bundle과 handoff note를 생성·검토·승인한다.

## Trigger와 진입 조건

- Trigger: 두 Design gate 승인 뒤 Build route 진입, plan save, artifact-sync 또는 runtime-stub build
- 진입 조건: legacy `boundaries_approved=true`와 legacy `runtime_contracts_approved=true`; generator에는 approved scaffold source, non-empty approved modules와 error-free Graph가 필요하다.

## 종료 조건

- `scaffold-plan.json.validation.can_generate_source=true`
- `runtime-stub/`에 review 가능한 파일이 하나 이상 존재한다.
- root-level `implementation-handoff.md`를 필요에 따라 검토·저장한다.
- 사용자가 legacy `stub_ready_for_followup`을 true로 설정하면 Build stage가 complete로 projection된다.

## 주요 입력

- approved `analysis-result.json`과 Design approvals
- module candidates, Graph IR, runtime/A2A contracts, Catalog projection
- output mode(`smoke` 또는 `runnable`)와 optional Mock Lab binding
- 기존 scaffold plan과 runtime-stub

## 주요 출력

- `normalized-requirement.json`, `module-candidates.json`, `process-flow.json`, `scaffold-plan.json`
- `runtime-stub/**`와 manifest build outputs
- root-level `implementation-handoff.md`
- optional validation result와 Stage Runner evidence
- legacy `stub_ready_for_followup`

## Main Flow

1. Build UI는 analysis·Catalog·output mode에서 scaffold plan을 파생하고 선택적으로 Mock Lab MCP binding을 반영해 저장한다.
2. artifact-sync는 canonical analysis에서 네 split/derived JSON을 재파생·교체한다.
3. 기본 sync 옵션은 Runtime Handoff 재생성과 artifact validation을 이어서 실행한다.
4. direct build 또는 Build Stage Runner는 `generate-adk-source.mjs`를 실행해 canonical `runtime-stub/`에 bundle을 쓴다. Build runner에는 apply proposal이 없다.
5. generator는 approved source invariant와 contract/Graph readiness를 확인하고 output file map을 조립해 디스크에 쓴다.
6. review 화면은 generated 파일을 안전하게 읽고 root-level handoff note를 편집한다.
7. runtime-stub이 비어 있지 않으면 사용자가 후속 인계 gate를 토글한다.

Current Stage Runner Build의 실행 주체는 server primitive이며 skill directory를 읽지 않는다. canonical `af-scaffold-runtime`은 approved design을 받는 direct/manual skill 경로다.

## 분기와 실패/needs-info

- Design approvals가 부족하면 plan/sync/build action을 막는다.
- analysis invalid, unresolved candidate, Graph error, unapproved runtime/A2A contract 또는 scaffold blocker는 sync/generator 실패가 된다.
- artifact-sync는 sync 성공 뒤 generation/validation이 실패할 수 있으므로 일부 derived artifact가 이미 교체된 상태일 수 있다.
- generated file preview는 path traversal, `.adk` 등 local execution output, 500KB 초과 파일을 거부한다.
- writer는 output directory를 선삭제하지 않는다. 새 file map에 없는 이전 파일은 자동 제거되지 않는다.
- build 성공은 manifest outputs를 갱신하지만 approval을 자동 true로 만들지 않는다.

## 읽는 Register

- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
- [`reg.runtime-contracts`](../registers.md#cross-stage-registers)
- [`reg.a2a-contracts`](../registers.md#cross-stage-registers)
- [`reg.scaffold-plan`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)
- [`reg.implementation-handoff`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)
- [`reg.mock-lab-lifecycle`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
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
- Verified at commit: `7deea45`
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
- Important callees: `buildScaffoldPlan`, `applyMockLabBinding`, build/sync/scaffold hooks, `StageRunnerPanel`
- External boundaries: HTTP/SSE, Mock Lab discovery
- Failure/edge behavior: output mode가 저장 plan과 다르거나 plan blocker가 있으면 build를 막는다.
- Related registers: `reg.scaffold-plan`, `reg.runtime-stub`, `reg.mock-lab-lifecycle`, `reg.stage-run-evidence`
- Verified at commit: `7deea45`
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
- Verified at commit: `7deea45`
- Locator status: `active`

### Build approval UI

- Path: `packages/web/src/routes/build/BuildApprovalStep.tsx`
- Stable anchor: `BuildApprovalStep`
- Role in behavior: non-empty runtime-stub을 근거로 legacy `stub_ready_for_followup` toggle을 제공한다.
- Inputs: manifest, scaffold plan, runtime-stub listing
- Outputs: approval PATCH
- State/artifact reads: `reg.run-manifest`, `reg.approvals`, `reg.scaffold-plan`, `reg.runtime-stub`
- State/artifact writes: `reg.approvals`, `reg.stage-status`
- Important callers: `BuildWorkbench`
- Important callees: `useApprovalGate`
- External boundaries: HTTP
- Failure/edge behavior: false→true는 stub file count가 0이면 disabled지만 이미 true인 gate는 해제할 수 있다.
- Related registers: `reg.approvals`, `reg.stage-status`, `reg.runtime-stub`
- Verified at commit: `7deea45`
- Locator status: `active`

### Derived artifact synchronization

- Path: `packages/web/server/artifactSync.ts`
- Stable anchor: `syncArtifactRoot`
- Role in behavior: canonical analysis에서 네 derived JSON과 scaffold plan을 계산해 전체 교체한다.
- Inputs: repo root, reqId, optional output mode/Catalog entries
- Outputs: drift before/after와 written artifact list
- State/artifact reads: `reg.analysis-result`, 기존 `reg.scaffold-plan`, `reg.catalog-entries`
- State/artifact writes: `reg.module-candidates`, `reg.process-flow`, `reg.scaffold-plan`와 normalized requirement projection
- Important callers: `handleArtifactSyncRun`
- Important callees: `buildScaffoldPlan`, `loadServerScaffoldCatalog`, `ArtifactRootStore`
- External boundaries: local filesystem
- Failure/edge behavior: invalid/missing canonical analysis는 422이며 요청 output mode가 없으면 saved mode, 그다음 `smoke`를 사용한다.
- Related registers: `reg.analysis-result`, `reg.module-candidates`, `reg.process-flow`, `reg.scaffold-plan`
- Verified at commit: `7deea45`
- Locator status: `active`

### Artifact-sync compound run

- Path: `packages/web/server/artifactSyncRunApi.ts`
- Stable anchor: `handleArtifactSyncRun`
- Role in behavior: sync → optional generation → optional validation 순서를 HTTP 또는 SSE로 실행한다.
- Inputs: output mode, rebuild/validation booleans, stream preference
- Outputs: sync/generation/validation summaries와 progress events
- State/artifact reads: `reg.analysis-result`, `reg.scaffold-plan`
- State/artifact writes: `reg.module-candidates`, `reg.process-flow`, `reg.scaffold-plan`, `reg.runtime-stub`, `reg.run-manifest`
- Important callers: `createAfArtifactsMiddleware`; client `useArtifactSync`
- Important callees: `syncArtifactRoot`, generation/validation process steps, `recordRuntimeStubBuild`
- External boundaries: HTTP/SSE, Node subprocess, filesystem
- Failure/edge behavior: 각 step 실패에서 422 또는 SSE error를 반환하며 이미 완료한 앞 step write를 rollback하지 않는다.
- Related registers: `reg.scaffold-plan`, `reg.runtime-stub`, `reg.run-manifest`
- Verified at commit: `7deea45`
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
- Failure/edge behavior: nonzero exit는 422/result failure이며 unsafe·ignored·oversized preview path를 거부한다.
- Related registers: `reg.runtime-stub`, `reg.run-manifest`, `reg.scaffold-plan`
- Verified at commit: `7deea45`
- Locator status: `active`

### Generator input contract

- Path: `scripts/adk-source/context.mjs`
- Stable anchor: `loadArtifactContext`
- Role in behavior: approved artifact root를 읽고 generator invariant와 module/Graph/contract readiness를 검증한다.
- Inputs: artifact root path
- Outputs: normalized generator context, output mode와 package name
- State/artifact reads: `reg.analysis-result`, `reg.module-candidates`, `reg.process-flow`, `reg.run-manifest`, `reg.scaffold-plan`
- State/artifact writes: 없음
- Important callers: `scripts/generate-adk-source.mjs`
- Important callees: filesystem JSON reader, registry compatibility checks, input validators
- External boundaries: local filesystem
- Failure/edge behavior: raw-to-code invariant 위반, missing approved modules/gates, Graph/contract blocker를 throw한다.
- Related registers: `reg.analysis-result`, `reg.scaffold-plan`, `reg.approvals`
- Verified at commit: `7deea45`
- Locator status: `active`

### Generator file assembly

- Path: `scripts/adk-source/file-builder.mjs`
- Stable anchor: `buildFiles`
- Role in behavior: package source, config/schema/mock sample, manifest, handoff, A2A launcher와 tests의 output map을 조립한다.
- Inputs: verified artifact context와 output root
- Outputs: relative path → content map
- State/artifact reads: in-memory `reg.scaffold-plan`, `reg.process-flow`, `reg.runtime-contracts`
- State/artifact writes: 직접 없음; 반환 map이 `reg.runtime-stub`이 된다.
- Important callers: `scripts/generate-adk-source.mjs`
- Important callees: graph coverage/indexes, agent/support emitters
- External boundaries: 없음; pure file assembly에 가깝다.
- Failure/edge behavior: Graph coverage 또는 emitter invariant가 맞지 않으면 file map 완성 전에 throw한다.
- Related registers: `reg.runtime-stub`, `reg.scaffold-plan`, `reg.process-flow`
- Verified at commit: `7deea45`
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
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- generator가 출력하지 않게 된 이전 파일을 자동 제거하는 별도 cleanup 호출은 direct build와 artifact-sync 경로에서 확인되지 않았다.
- generated ADK bundle의 실제 framework 동작은 [runtime-execution](runtime-execution.md)에서 별도 local proof가 필요하다.
