# Handbook Coverage

## 포함 영역

이 snapshot은 다음 현재 구현 영역을 행동·Register·L3 locator 관점에서 조사했다.

- `packages/web/src/routes/**`: Landing, Analyze, Design, Build, Verify, Catalog, Run과 Mock Lab route surface
- `packages/web/src/state/**`: HTTP/SSE transport, query mutation, browser-local state와 in-memory Graph projection
- `packages/web/src/analyzer/**`, `packages/web/src/catalog/**`: manifest·analysis·Catalog delta의 current data shape와 parser
- `packages/web/server/**`: artifact root, Stage Runner, collaboration, sync/generation, validation, Catalog publish, Runtime chat/A2A middleware
- `packages/mock-lab/src/**`, `packages/mock-lab/server/**`: MockSpec authoring, draft, persistence, child process, smoke와 MCP bridge
- `scripts/**`: artifact validator와 ADK Runtime Handoff generator의 orchestration·input/output 경계
- `schemas/**`, `catalog/**`, `templates/**`: runtime code가 소비하는 contract surface. content 전부를 L3 leaf로 복사하지 않고 consumer와 stable root section을 확인했다.
- `.agents/skills/**`: Analyze·Design의 Stage Runner exact legacy shim과 canonical skill handoff locator. Build·Verify는 server primitive 경계와 direct/manual canonical skill 관계만 확인했다. 전체 skill authoring 절차와 shared reference 내용은 [Skills vNext Migration Status](../migration/skill-vnext-status.md)가 추적한다.

## Stage별 L3 coverage

| Stage | active | needs-review | frozen | 합계 |
| --- | ---: | ---: | ---: | ---: |
| [request-intake-artifact-root](stages/request-intake-artifact-root.md) | 4 | 0 | 0 | 4 |
| [analyze-review-gate](stages/analyze-review-gate.md) | 5 | 0 | 0 | 5 |
| [design-boundary-contract](stages/design-boundary-contract.md) | 7 | 0 | 0 | 7 |
| [runtime-handoff-build](stages/runtime-handoff-build.md) | 10 | 0 | 0 | 10 |
| [verify-feedback](stages/verify-feedback.md) | 6 | 0 | 0 | 6 |
| [catalog-publication](stages/catalog-publication.md) | 6 | 0 | 0 | 6 |
| [runtime-execution](stages/runtime-execution.md) | 7 | 0 | 0 | 7 |
| [mock-tool-integration](stages/mock-tool-integration.md) | 8 | 0 | 0 | 8 |
| **합계** | **53** | **0** | **0** | **53** |

## 제외 영역과 이유

- `.agents/skills` 내부 구현 대부분: Analyze·Design의 stage-facing shim→canonical locator 두 개만 L3에 포함했다. canonical skill 본문, direct/manual Build·Verify 절차와 `_shared` 20파일의 상세 authoring 계약은 별도 소유권 경계다.
- `generated/**`: generated output은 snapshot마다 달라지는 산출물이다. generator의 입력·조립·write behavior만 current source에서 추적했다.
- `artifacts/**`: 사용자·실행별 mutable evidence이며 repository source snapshot이 아니다. persistence 경로와 교체 규칙만 Register에 기록했다.
- `docs/archive/**`: historical snapshot으로 현재 구현 권위가 아니다.
- `docs/handoff/**`: 특정 시점 인계 자료로 active Handbook의 current locator authority가 아니다.
- production deployment, private endpoint·credential·실고객 데이터: repository의 공개 local workbench 경계 밖이다.

## 독립 Stage L3 unit으로 배치하지 않은 조사 파일

아래 파일은 조사 범위에서 직접 확인했지만, 독립 행동 leaf보다 상위 route/API의 transport·조립·type·helper 역할이 커서 별도 L3 카드로 중복하지 않았다. 관련 Stage 카드의 callers/callees 또는 Register schema/source locator에서 탐색할 수 있다.

- Web shell·transport: `packages/web/vite.config.ts`, `packages/web/server/afArtifactsApi.ts`, `packages/web/server/afStageRunnerApi.ts`, `packages/web/src/state/apiClient.ts`, `packages/web/src/state/queryClient.ts`, `packages/web/src/state/useStreamingProcess.ts`
- Workbench shell·client hooks: `packages/web/src/routes/BuildWorkbench.tsx`, `packages/web/src/routes/analyze/AnalyzeRunStep.tsx`, `packages/web/src/routes/design/DesignRunStep.tsx`, `packages/web/src/state/useArtifactRoot.ts`, `packages/web/src/state/useAnalysisArtifact.ts`, `packages/web/src/state/useApprovalGate.ts`, `packages/web/src/state/useArtifactSync.ts`, `packages/web/src/state/useStageRunner.ts`, `packages/web/src/state/useTextArtifact.ts`, `packages/web/src/state/useCatalog.ts`, `packages/web/src/state/useCatalogDelta.ts`, `packages/web/src/state/useCollaboration.ts`, `packages/web/src/state/useMockLabDiscovery.ts`, `packages/web/src/state/useRecentRoots.ts`, `packages/web/src/state/useRuntimeChat.ts`, `packages/web/src/state/useRuntimeA2a.ts`, `packages/web/src/state/runtimeA2aResume.ts`, `packages/web/src/state/useScaffoldPlan.ts`, `packages/web/src/state/useVerify.ts`, `packages/web/src/state/useAuthor.ts`
- Shared data contracts: `packages/web/src/analyzer/afRunManifest.ts`, `packages/web/src/analyzer/types.ts`, `packages/mock-lab/src/types/mockSpec.ts`, `packages/mock-lab/src/api/mockLabClient.ts`
- Build support: `packages/web/server/artifactSyncProcessSteps.ts`, `packages/web/server/runManifestBuild.ts`, `packages/web/server/runtimeStubFiles.ts`, `scripts/generate-adk-source.mjs`, `scripts/adk-source/agent.mjs`, `scripts/adk-source/dispatch/index.mjs`, `scripts/adk-source/dispatch/node-kinds.mjs`, `scripts/adk-source/dispatch/edge-kinds.mjs`, `scripts/adk-source/dispatch/modes.mjs`
- Validation support: `scripts/artifact-validation/af-run-manifest.mjs`, `scripts/artifact-validation/constants.mjs`, `scripts/artifact-validation/contract-registry.mjs`, `scripts/artifact-validation/files.mjs`, `scripts/artifact-validation/implementation-template-agreement.mjs`, `scripts/artifact-validation/module-candidates.mjs`, `scripts/artifact-validation/registry-projection-compatibility.mjs`, `scripts/artifact-validation/saved-analysis.mjs`
- Mock runtime leaf: `packages/mock-lab/server/mockSpecRuntime.ts`; lifecycle owner인 `MockProcessRegistry`에서 child entry point로 연결했다.
- Contract collections: `schemas/**`, `catalog/*.yaml`, `templates/**`; 개별 seed row보다 parser·validator·publisher·generator consumer를 L3 leaf로 삼았다.

## 동적 호출로 확인하지 못한 관계

- Stage Runner가 호출하는 Codex SDK 내부 scheduling, model reasoning과 tool execution 순서는 repository source만으로 확정하지 않았다.
- MockSpec draft의 Codex SDK 내부 response 생성 behavior는 외부 SDK 경계다.
- generated ADK package가 실제 model/tool/A2A response를 만드는 내부 호출 그래프는 artifact와 설치된 ADK version에 따라 달라진다.
- ADK session event, Agent Card, JSON-RPC task state와 function-response resume의 실제 remote 응답은 runtime 동적 결과다.
- OS별 port owner 탐지와 child termination 성공 여부는 host process·권한 상태에 의존한다.
- Catalog publish의 process-local queue는 단일 process 안에서만 직렬화한다. 여러 server process 사이의 동시 write 조정은 확인되지 않았다.

이 항목들은 locator 자체의 path/anchor가 미확인이라는 뜻이 아니다. 관련 locator는 source에서 재검증했지만 외부·동적 실행 결과까지 정적으로 보장하지 않는다.

## legacy 이름 해석 주의

- Current Implementation은 legacy `module_category`와 값 legacy `agent`, legacy `workflow`, legacy `adapter`, legacy `remote_a2a`를 직렬화한다. Target의 top-level asset type은 Agent·Workflow·Tool뿐이므로 legacy `adapter`를 새 top-level type으로 읽지 않는다.
- legacy `adapter_kind`, legacy `agent_kind`, legacy `workflow_kind`, legacy `selected_by_llm`, legacy `decision_owner`가 source와 Catalog에 남아 있다.
- legacy `processFlow`와 현재 node/edge enum은 Target Graph IR 문서와 완전히 같은 schema라고 가정하지 않는다.
- legacy `remote_a2a`는 Current Implementation의 module/Catalog vocabulary다. A2A protocol role과 Target asset taxonomy를 구분한다.
- 상세 대응은 [Taxonomy](../workbench/taxonomy.md), [Graph IR](../workbench/graph-ir.md), [Taxonomy migration status](../migration/taxonomy-vnext-status.md), [Skills vNext migration status](../migration/skill-vnext-status.md)를 함께 읽는다.

## `needs-review` locator 전체 목록

없음. 기존 51개 L3 locator는 path와 stable anchor를 commit `7deea45` source에서 직접 재검증했고, Skills vNext 뒤 추가한 Analyze·Design skill locator 2개는 `2026-07-18 uncommitted` worktree에서 직접 확인했다. 따라서 "skills vNext 이후 stage 문서 재검증 필요" 항목을 `needs-review`로 남기지 않았으며, 새 commit 확정 뒤 snapshot 표기만 다시 갱신한다. 동적 관계의 한계는 위 절과 각 Stage의 확인되지 않은 사항에 분리했다.

## `frozen` locator 전체 목록

없음. 현재 repository에서 재검증하지 못한 path/anchor를 active locator로 기재하지 않았다.
