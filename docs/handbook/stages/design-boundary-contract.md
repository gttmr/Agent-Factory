# design-boundary-contract 경계·Graph·계약 설계

## 목적

승인된 분석을 기준으로 자산 후보 책임, Graph IR, runtime/A2A 계약과 협업 근거를 검토하고 두 Design gate를 명시적으로 결정한다.

## Trigger와 진입 조건

- Trigger: Analyze 승인 뒤 Design route 진입 또는 Design Stage Runner 실행
- 진입 조건: canonical analysis가 있어야 한다. Design Stage Runner는 legacy `analysis_reviewed=true`일 때만 실행된다.

## 종료 조건

- 모든 module candidate가 approved이고 Graph IR error가 0인 상태에서 legacy `boundaries_approved`가 true다.
- 필요한 runtime/A2A 계약이 ready인 상태에서 legacy `runtime_contracts_approved`가 true다.
- 두 gate가 모두 true면 Design stage가 complete로 projection되고 Build 진입 조건이 열린다.

## 주요 입력

- 승인된 analysis aggregate와 ETag
- module candidate, legacy `processFlow`, runtime/A2A 계약
- Catalog와 collaboration comments/highlights
- Design run proposal/evidence

## 주요 출력

- 갱신된 canonical `analysis-result.json`
- optional `boundary-design.md`
- collaboration JSON
- Design Stage Runner evidence
- 두 Design approval과 stage status projection

## Main Flow

1. Design runner는 reviewed analysis에서 candidate·Graph·contract 변경 proposal을 만든다.
2. explicit apply가 proposal의 base ETag와 canonical ETag를 비교한 뒤 analysis와 `boundary-design.md`를 교체한다.
3. review 화면은 Graph를 normalize/soft-validate하고 candidate, Graph, runtime contract, A2A contract를 편집한다.
4. candidate와 contract save는 legacy `analysis-result.json` aggregate를 다시 저장한다.
5. comment와 highlight는 별도 collaboration artifact에 저장한다.
6. candidate approval과 Graph error 조건을 만족하면 boundaries gate를, 이어 계약 readiness를 만족하면 runtime-contracts gate를 사람이 토글한다.

## 분기와 실패/needs-info

- analysis가 없거나 legacy `analysis_reviewed=false`면 runner를 시작할 수 없다.
- normalization exception은 Graph를 null로 만들고 error count 1과 message를 노출한다.
- candidate save는 ID 기준 교체하며 optional status sync가 연결 Graph node review status에 반영된다.
- Graph save는 detached Catalog Workflow candidate를 정리하고 scaffold/runtime query를 invalidate하지만 파일을 즉시 삭제하지 않는다.
- legacy `contract_id`가 없는 A2A contract는 append된다.
- artifact 변경이 이미 true인 downstream approval을 자동 reset하는 규칙은 확인되지 않았다.

## 읽는 Register

- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
- [`reg.runtime-contracts`](../registers.md#cross-stage-registers)
- [`reg.a2a-contracts`](../registers.md#cross-stage-registers)
- [`reg.collaboration`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.process-flow`](../registers.md#cross-stage-registers)
- [`reg.runtime-contracts`](../registers.md#cross-stage-registers)
- [`reg.a2a-contracts`](../registers.md#cross-stage-registers)
- [`reg.collaboration`](../registers.md#cross-stage-registers)
- [`reg.stage-run-evidence`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.stage-status`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: [analyze-review-gate](analyze-review-gate.md)
- 다음: [runtime-handoff-build](runtime-handoff-build.md)
- 보조: Catalog Workflow/remote provider 선택, collaboration review

## 외부 경계

- Codex SDK Design proposal
- `/api/af/:reqId/**`, `/api/af-collab/:reqId/**`, `/api/catalog`
- browser Graph editing state와 local author identity
- local artifact filesystem

## L3 Source Map

### Design workbench

- Path: `packages/web/src/routes/DesignWorkbench.tsx`
- Stable anchor: default `DesignWorkbench`
- Role in behavior: run → review → approve 구성, Graph/candidate/contract readiness와 두 Design gate를 조정한다.
- Inputs: manifest, analysis, collaboration, author, Graph selection/edit state
- Outputs: stage props, review actions, approval toggles, Build navigation
- State/artifact reads: `reg.run-manifest`, `reg.analysis-result`, `reg.collaboration`, `reg.catalog-entries`
- State/artifact writes: `reg.analysis-result`, `reg.collaboration`, `reg.approvals`, `reg.stage-status`, `reg.recent-roots`
- Important callers: `AppRouter`
- Important callees: `createDesignWorkbenchActions`, `useGraphIR`, `DesignRunStep`, `DesignReviewStep`, `DesignApprovalStep`
- External boundaries: React query, HTTP, browser-local author state
- Failure/edge behavior: analysis 없음, Graph normalization error, unapproved candidates 또는 contract readiness 부족을 각각 gate blocker로 노출한다.
- Related registers: `reg.analysis-result`, `reg.process-flow`, `reg.runtime-contracts`, `reg.a2a-contracts`, `reg.approvals`
- Verified at commit: `7deea45`
- Locator status: `active`

### Design mutation actions

- Path: `packages/web/src/routes/design/designWorkbenchActions.ts`
- Stable anchor: `createDesignWorkbenchActions`
- Role in behavior: candidate, Graph, runtime/A2A contract와 Catalog Workflow 삽입을 analysis aggregate replacement로 변환한다.
- Inputs: current analysis, selected IDs, edited candidate/Graph/contract, optional Catalog entry
- Outputs: next analysis object, query invalidation, action message
- State/artifact reads: `reg.analysis-result`, `reg.catalog-entries`, provider `reg.runtime-stub` Agent Card
- State/artifact writes: `reg.analysis-result`, `reg.module-candidates`, `reg.process-flow`, `reg.runtime-contracts`, `reg.a2a-contracts`
- Important callers: `DesignWorkbench`
- Important callees: analysis save mutation, `pruneDetachedCatalogWorkflowCandidates`, `applyNodeReviewStatus`, local A2A import helpers
- External boundaries: provider Agent Card HTTP fetch, React query cache
- Failure/edge behavior: legacy `processFlow`가 없으면 Workflow node 삽입을 중단하고, provider/card shape가 맞지 않으면 A2A import를 거부한다.
- Related registers: `reg.analysis-result`, `reg.module-candidates`, `reg.process-flow`, `reg.runtime-contracts`, `reg.a2a-contracts`
- Verified at commit: `7deea45`
- Locator status: `active`

### Design approval UI

- Path: `packages/web/src/routes/design/DesignApprovalStep.tsx`
- Stable anchor: `DesignApprovalStep`
- Role in behavior: boundaries와 runtime/A2A gate의 blocker, readiness summary와 toggle enablement를 표시한다.
- Inputs: manifest approvals, analysis, candidate/Graph/contract readiness, collaboration counts
- Outputs: 두 approval toggle callback
- State/artifact reads: `reg.approvals`, `reg.module-candidates`, `reg.process-flow`, `reg.runtime-contracts`, `reg.a2a-contracts`, `reg.collaboration`
- State/artifact writes: callback을 통해 `reg.approvals`, `reg.stage-status`
- Important callers: `DesignWorkbench`
- Important callees: shared Button/Panel primitives
- External boundaries: 없음; persistence는 parent mutation이 수행한다.
- Failure/edge behavior: false→true 전환만 readiness에 의해 disabled되고 이미 true인 gate는 취소할 수 있다.
- Related registers: `reg.approvals`, `reg.stage-status`, `reg.runtime-contracts`, `reg.a2a-contracts`
- Verified at commit: `7deea45`
- Locator status: `active`

### Graph derivation and soft validation

- Path: `packages/web/src/state/useGraphIR.ts`
- Stable anchor: `deriveGraphIRForAnalysis`, `useGraphIR`
- Role in behavior: embedded legacy `processFlow`를 runtime shape로 normalize하고 soft validation을 합친 read-only Graph view를 만든다.
- Inputs: nullable `AnalysisResult`
- Outputs: Graph IR, error/warning count, optional normalization error
- State/artifact reads: `reg.process-flow`
- State/artifact writes: 없음
- Important callers: `DesignWorkbench`
- Important callees: `normalizeGraphIRForRuntime`, `validateGraphIRSoft`, `mergeGraphIRValidation`
- External boundaries: 없음
- Failure/edge behavior: exception을 throw하지 않고 Graph null, error count 1과 message로 반환한다.
- Related registers: `reg.process-flow`
- Verified at commit: `7deea45`
- Locator status: `active`

### Collaboration persistence

- Path: `packages/web/server/afCollaborationApi.ts`
- Stable anchor: `createAfCollaborationMiddleware`
- Role in behavior: comments/highlights collection과 item mutation을 requirement-scoped JSON에 지속한다.
- Inputs: reqId, HTTP method/path, comment/highlight body
- Outputs: collection/item response 또는 204
- State/artifact reads: `reg.collaboration`
- State/artifact writes: `reg.collaboration`
- Important callers: Vite middleware mount; client `useCollaboration` hooks
- Important callees: `ArtifactRootStore.readArtifact`, `ArtifactRootStore.writeArtifact`
- External boundaries: HTTP, local filesystem
- Failure/edge behavior: file 미존재는 empty document로 읽고 mutation은 ETag 없이 전체 파일을 교체한다.
- Related registers: `reg.collaboration`, `reg.artifact-root`
- Verified at commit: `7deea45`
- Locator status: `active`

### Design skill compatibility path

- Path: `.agents/skills/af-design-boundaries/SKILL.md`
- Stable anchor: `Legacy Compatibility Shim`
- Role in behavior: direct/manual legacy 호출 전용 호환 경로로, 첫 실행 지시에서 canonical `.agents/skills/af-compose-solution/SKILL.md`를 읽게 한다. (2026-07-18 코드 단계 이후 Stage Runner는 canonical `skillPath`를 직접 읽는다.)
- Inputs: reviewed canonical analysis, legacy `analysis_reviewed=true`, Design run folder와 `request.json`
- Outputs: canonical composition 절차에 따른 proposed `analysis-result.json`과 `boundary-design.md`
- State/artifact reads: `reg.approvals`, `reg.analysis-result`, `reg.stage-run-evidence`; canonical skill과 선택된 references
- State/artifact writes: `reg.stage-run-evidence`의 Design proposal 두 파일만 허용
- Important callers: 사용자·자동화의 explicit legacy invocation (Stage Runner는 canonical skill을 직접 호출)
- Important callees: `.agents/skills/af-compose-solution/SKILL.md`
- External boundaries: Codex SDK의 repository file read와 workspace-write sandbox
- Failure/edge behavior: (2026-07-18 이후) diff builder가 등록된 필수 proposed artifact 누락 시 run을 `failed` 처리하므로 두 파일 계약이 코드로도 강제된다.
- Related registers: `reg.approvals`, `reg.analysis-result`, `reg.stage-run-evidence`
- Verified in worktree: `2026-07-18 uncommitted`
- Locator status: `active`

### Design proposal runner and apply

- Path: `packages/web/server/stageRunner.ts`
- Stable anchor: `runStageSkill`, `applyStageRun`, `SdkCodexStageRunner`
- Role in behavior: legacy `analysis_reviewed` gate 뒤 Design proposal과 diff/evidence를 만들고 explicit apply를 수행한다.
- Inputs: reqId, stage `design`, reviewed canonical analysis, model, optional Catalog snapshot
- Outputs: proposed `analysis-result.json`, `boundary-design.md`, run summary와 canonical apply
- State/artifact reads: `reg.approvals`, `reg.analysis-result`, `reg.catalog-entries`, `reg.stage-run-evidence`
- State/artifact writes: `reg.stage-run-evidence`, `reg.run-manifest`; apply 시 `reg.analysis-result`
- Important callers: `handleStageRunner`; client `DesignRunStep` + `buildDesignStageRunnerConfig`
- Important callees: `assertDesignReady`, Codex SDK runner, proposal validator, `ArtifactRootStore`
- External boundaries: Codex SDK, local filesystem, SSE callback
- Failure/edge behavior: 선행 approval 부족, invalid proposal, ETag drift, cancel을 각각 차단·evidence로 기록한다.
- Related registers: `reg.approvals`, `reg.analysis-result`, `reg.stage-run-evidence`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- Graph 또는 contract 변경 뒤 이미 true인 downstream approval을 자동 false로 만드는 server rule은 확인되지 않았다.
- Codex SDK가 Design proposal을 구성하는 내부 reasoning sequence는 `unverified`다.
