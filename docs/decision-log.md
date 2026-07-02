# Decision Log

코드의 **의사결정이 변경된 시점과 내용**을 기록하는 문서다. 동작 명세는 각 활성 문서(`docs/workbench/*`, `docs/visualization/design-system.md`, `CLAUDE.md`)가 기준이고, 이 파일은 "언제, 왜, 무엇이 바뀌었는지"의 이력만 담는다.

운영 규칙:

- 의사결정이 바뀌는 PR(인터페이스/스키마/게이트/UX 계약 변경)마다 머지 시점에 항목을 추가한다. 단순 버그 수정이나 리팩터링은 기록하지 않는다.
- 최신 항목이 위로 오는 역시간순. 항목 형식: 날짜 · PR/머지 커밋 · 결정 요약 · 배경(왜) · 영향 범위.
- 결정을 되돌리거나 대체하면 과거 항목을 지우지 말고 새 항목에서 `(대체: YYYY-MM-DD 항목)`으로 연결한다.

---

## 2026-07-03 · PR TBD — stage status is a pure projection of approvals including demotion on revoke

- **결정**: `PATCH /api/af/:id/manifest/approvals` treats approval booleans as the source of truth and projects analyze/design/build stage status to `complete` when the gate is true and `pending` when the gate is false.
- **배경**: Previously, a revoked approval preserved the prior `complete` stage status, so external stage-status readers could still treat the stage as complete.
- **영향**: External stage-status readers, including runtime-stub generation gates, now see revoked approvals as non-complete stage state.

## 2026-07-01 · 작업 브랜치 `codex/adk-parameter-extraction-workflow-examples` — agent-owned MCP toolset lowering contract

- **결정**: LLM-selected MCP tool use is represented only as `agent` + `mcp_toolset` + `selected_by_llm`; fixed workflow adapter execution remains `adapter_call` + `mcp_tool` + `fixed_by_workflow`; `adapter_call` + `selected_by_llm` stays invalid/out of scope. Runnable ADK lowering for reviewed agent-owned MCP toolsets targets ADK 2.3.0 `LlmAgent(..., tools=[McpToolset(...)])`, using `tools` rather than a `toolsets` constructor argument.
- **배경**: Parameter-extraction demos need a generic chat-agent path where the agent owns selectable MCP tools, without broadening fixed adapter-call semantics or reviving contradictory edge/node ownership shapes.
- **영향**: `docs/workbench/process-flow.md`, `docs/workbench/agent-factory-harness.md`, runnable generator review expectations, and future artifact authoring for agent-owned MCP toolsets.

## 2026-06-30 · 로컬 작업 — catalog publish는 provider Agent Card를 read-only로 검증한다

- **결정**: `POST /api/catalog/publish`의 workflow A2A provider validation은 provider artifact root와 이미 존재하는 `runtime-stub/<app>/agent.json`만 read-only로 확인한다. Catalog publish는 provider `agent.json`을 생성하거나 refresh하지 않는다.
- **배경**: catalog approval은 catalog YAML publish 경계 안에 있어야 하며, provider runtime-stub 산출물 생성은 Runtime Handoff/RunSandbox runtime 경계에 속한다. Publish validation이 `RuntimeA2aManager.agentCard()`를 호출하면 검증 중 provider artifact root를 mutate해 승인 결과를 과장할 수 있다.
- **영향**: `catalogPublishValidation.ts`, `runtimeA2aCard.ts`, workflow A2A publish tests, active validation/harness docs.

## 2026-06-30 · 작업 브랜치 `workflow-a2a-capable-conversion` — task 8 docs/final QA

### Workflow A2A는 명시 변환된 catalog runtime binding이다
- **결정**: 일반 workflow catalog reuse는 계속 `workflow_call`로 삽입한다. Reuse Hub의 `A2A 가능하게 변경` proposal과 `등록 승인` publish를 통과한 workflow row만 `component_source: remote_a2a`, `runtime_binding: remote_a2a`, `a2a_provider_req_id`, A2A-ready `contract_status`를 가진다. `a2a_provider_req_id`는 provider artifact root pointer이고, `published_from`은 provenance로만 둔다.
- **배경**: workflow가 복잡하거나 여러 root에서 재사용된다는 이유만으로 Remote A2A를 추론하면 taxonomy 책임 축과 runtime 연결 축이 다시 섞인다. A2A 노출은 provider Agent Card와 reviewer approval이 있는 운영 경계여야 한다.
- **영향**: Reuse Hub conversion drawer/publish path, workflow catalog proposal parsing/publishing, Design catalog workflow insertion, `docs/workbench/agent-factory-harness.md`, `docs/workbench/validation.md`, `docs/workbench/review-board.md`, follow-up status.

### Consumer는 A2A-capable workflow를 Remote A2A facade로 삽입한다
- **결정**: A2A-capable workflow entry를 consumer Design에 추가하면 원본 workflow를 fragment-expand하지 않고 provider Agent Card를 불러와 consumer artifact 안에 `remote_a2a` facade 후보, draft A2A contract, `remote_agent_call` Graph IR node를 만든다. provider root가 없거나 Agent Card route가 실패하면 publish/insert/resume은 실패해야 하며 partial design/catalog artifact를 쓰지 않는다.
- **배경**: catalog workflow row는 reusable responsibility contract이고, consumer graph에는 원격 호출 facade만 필요하다. provider root 검증 실패를 성공처럼 보이면 reviewer가 실행 불가능한 remote boundary를 승인할 수 있다.
- **영향**: Design workflow picker/action model, runtime A2A provider targeting, publish validation, browser/API QA failure matrix.

### Runtime resume state와 design artifact를 분리한다
- **결정**: Workbench resume bridge는 complete input-required metadata가 있을 때만 function_response DataPart를 provider RPC endpoint로 보낸다. `task_id`, `context_id`, `interrupt_id` 같은 runtime ids는 runtime event/API transcript/local registry에만 존재하며 catalog, `analysis-result.json`, Graph IR, scaffold-plan, generated source에는 persist하지 않는다.
- **배경**: runtime resume ids는 task instance state라서 reviewable design/source artifact에 들어가면 stale state가 재생성·catalog publish·PR review와 섞인다.
- **영향**: Runtime event parsing, resume endpoint/UI, validation docs, final QA adversarial checks.

## 2026-06-30 · 작업 브랜치 `workflow-a2a-capable-conversion` — task 7 Run resume UI

### Workbench resume만 Remote A2A task resume을 전송한다
- **결정**: `/af/:reqId/run`은 Remote A2A input-required 이벤트가 `resume_supported`와 task/context/interrupt/function metadata를 모두 제공할 때만 A2A provider 패널 안에 `Workbench resume` 폼을 표시한다. 전송은 `POST /api/af/:reqId/runtime-a2a/resume`만 사용하며, 성공 후 consumer runtime-chat 상태와 provider runtime-a2a 상태를 함께 invalidate한다. 지원되지 않는 이벤트는 기존 경고와 task state만 보여주고 submit control을 렌더하지 않는다.
- **배경**: ADK Web 텍스트 채팅은 Remote A2A task resume bridge 로 검증되지 않았으므로, 사용자가 일반 chat 입력과 Workbench의 function_response resume을 혼동하면 안 된다.
- **영향**: `RunSandbox.tsx`, `RuntimeA2aProviderPanel.tsx`, runtime input-required view model, runtime-a2a client hook, active Run 화면 docs.

## 2026-06-29 · 작업 브랜치 `artifact-root-sync-regeneration-ux` — follow-up 13/14/11/16 runtime handoff 정리

### Build/Verify도 Stage Runner run history로 기록한다
- **결정**: Stage Runner stage surface를 `analyze/design/build/verify`로 확장한다. `build`는 기존 `runtime-stub/build` primitive를 감싸 canonical `runtime-stub/` side effect와 run evidence를 남기고, `verify`는 기존 allowlist verify primitive를 감싸 `validation-report.md`와 `catalog-delta.yaml` proposal template을 생성한다. Verify catalog delta는 자동 추론하지 않는다. `cancel`은 active stage run AbortController에만 적용하며 ADK runtime process 제어와 분리한다.
- **배경**: Analyze/Design은 Stage Runner 기록과 diff/apply 흐름이 있었지만 Build/Verify는 별도 수동 실행만 있어 run evidence와 follow-up artifact 기록 방식이 갈라졌다.
- **영향**: `packages/web/server/stageRunner.ts`, `afStageRunnerApi.ts`, `afRuntimeStubApi.ts`, `afVerifyRunApi.ts`, `BuildRunStep.tsx`, `VerifyWorkbench.tsx`, `StageRunnerPanel.tsx`, `docs/workbench/follow-ups/16-build-verify-stage-runner.md`.

### Runnable skeleton과 data channel의 안전 경계를 명시한다
- **결정**: Runnable scaffold warning은 category/output mode별 smoke TODO skeleton 문구를 낸다. Named state channel은 agent instruction 또는 connected MCP adapter consumer로만 읽고, 비-connected state consumer와 agent/non-connected artifact consumer는 runnable generation blocker로 처리한다. RunSandbox는 started runtime-stub fingerprint와 current fingerprint를 비교해 stale을 표시하고, 자동 재시작 대신 사용자가 누르는 재시작 버튼만 제공한다.
- **배경**: runnable handoff가 완성 구현처럼 보이거나, generator가 실제로 읽지 않는 channel consumer가 조용히 통과하면 reviewer가 ADK Web smoke 결과를 과신할 수 있었다. runtime-stub 재생성 뒤 기존 ADK process가 오래된 bundle을 계속 들고 있는 문제도 화면에 드러나야 했다.
- **영향**: `scaffoldPlan.ts`, `generate-adk-source` channel guard/agent instruction, `runtimeChat.ts`, `RunSandbox.tsx`, Build Mock Lab binding UI, active follow-up status.

## 2026-06-29 · 작업 브랜치 `artifact-root-sync-regeneration-ux` — artifact sync/regeneration 계약

### Build의 기본 산출물 순서를 server-owned compound path로 고정한다
- **결정**: Workbench의 기본 Build 실행 경로를 `POST /api/af/:reqId/artifact-sync/run`으로 정하고, operator-facing action label은 `계약 동기화 + runtime-stub 재생성`으로 둔다. 순서는 1. reviewed Graph IR을 `analysis-result.json.processFlow`에 저장, 2. `analysis-result.json`에서 split artifacts 동기화, 3. `scaffold-plan.json` 도출/쓰기, 4. `runtime-stub/` 재생성, 5. `validate-artifacts.mjs` 실행, 6. reviewer가 approval gate를 별도로 판단하는 흐름이다.
- **배경**: Design에서 Graph IR을 저장한 뒤 split `process-flow.json`, `scaffold-plan.json`, generated `runtime-stub/`이 서로 다른 시점의 artifact를 반영할 수 있었다. client-only Build와 manual Verify를 조합하면 사용자가 어떤 순서가 canonical인지 판단해야 했고, stale state가 reviewer approval과 혼동될 위험이 있었다.
- **영향**: `docs/workbench/validation.md`, `docs/workbench/agent-factory-harness.md`, `docs/visualization/design-system.md`. `artifact-sync/run`은 derived artifact sync, generation, validation을 수행하지만 `analysis_reviewed`, `boundaries_approved`, `runtime_contracts_approved`, `stub_ready_for_followup`은 자동 변경하지 않는다. 기존 `runtime-stub/build`와 Verify controls는 separate/advanced paths로 유지된다.

## 2026-06-23 · 작업 브랜치 `codex/adk-graph-runtime-arguments` — artifact-first generator contract 명문화

### 생성기 하드코딩보다 Graph IR/scaffold-plan 계약을 먼저 확장한다
- **결정**: artifact나 generated ADK 동작 수정 요청을 받으면 `scripts/generate-adk-source.mjs`에 도메인 용어, route alias, 상품명, 시나리오명, workflow-specific literal을 즉시 하드코딩하지 않는다. 먼저 Graph IR / scaffold-plan / schema가 해당 의도를 표현할 수 있는지 검토하고, 부족하면 generic contract field를 schema/types/validator/UI/generator에 추가한 뒤 artifact data가 그 필드를 채우도록 수정한다.
- **배경**: route alias(`분석 실행`, `분석 없이 진행`, `1`, `2`)와 smoke prompt 같은 workflow-specific 값이 generator에 들어가면서 artifact-first 원칙이 깨지고, 사용자가 artifact를 수정해도 생성 동작이 예측과 다르게 고정되는 문제가 생겼다.
- **영향**: `AGENTS.md`, `CLAUDE.md`. 향후 generator 변경은 artifact-authored contract와 regression을 우선해야 한다.

## 2026-06-23 · 작업 브랜치 `main` — ADK route payload와 Graph IR runtime I/O 계약 정합화

### Route는 분기 신호, payload는 Event.output으로 전달한다
- **결정**: generated router FunctionNode는 `Event(route=..., output=node_input)`을 반환한다. `route`는 ADK Workflow route map 선택에만 쓰고, branch node가 받는 업무 payload는 `Event.output`으로 보존한다.
- **배경**: ADK 2.x graph route에서 `Event(route=...)`만 반환하면 branch는 선택되지만 downstream `node_input`이 비어 payload가 끊긴다. 화면 Graph IR의 route edge도 이 의미를 명확히 표현해야 한다.
- **영향**: `scripts/generate-adk-source.mjs`, `scripts/generate-adk-source.test.mjs`, `docs/workbench/validation.md`, `docs/workbench/process-flow.md`.

### Graph IR input/output mapping과 edge data contract를 scaffold-plan에 보존한다
- **결정**: `scaffold-plan.graph.edges`는 `schema_ref`, `route_condition`, `state_key`, `artifact_key`를 보존하고, Design의 node 계약 탭은 module-bound node의 `input_mapping`/`output_mapping`을 편집 가능한 reviewed runtime I/O 계약으로 취급한다. connected MCP adapter 입력 해석은 reviewed `input_mapping`을 `agents.config.yaml input_map`보다 먼저 적용하고, payload에는 `input_resolution` 감사 요약을 남긴다.
- **배경**: Build/generator 단계가 `analysis-result.json.processFlow`를 다시 해석하면서 설계 화면에서 검토한 data channel과 입력 mapping이 scaffold-plan 표면에서 불완전하게 보였다.
- **영향**: `packages/web/src/analyzer/scaffoldPlan.ts`, `packages/web/src/analyzer/types.ts`, `packages/web/src/components/GraphCanvas.tsx`, `packages/web/src/components/GraphElementEditor.tsx`, `schemas/scaffold-plan.schema.json`, regression scaffold-plan fixtures.

## 2026-06-23 · 작업 브랜치 `main` — ADK runnable 입력 전달과 Adapter Arguments Agent

### Adapter 인자는 전용 Agent 출력 channel에서 해석한다
- **결정**: runnable generator는 connected MCP Adapter 입력을 `input_map`, named state/channel, workflow `node_input`, upstream output, semantic user text(`objective_text` 등), reviewed `smoke_spec.synthetic_inputs` 순서로 해석한다. Agent가 named state channel에 JSON object 문자열을 쓰면 generator가 이를 파싱해 adapter input field를 찾는다. MCP 호출 payload에는 실제 `arguments`를 보존하고, tool result의 `structuredContent`는 `structured_content` 아래에 중첩 보존하며 top-level로 다시 펼치지 않는다.
- **배경**: 목적 확인 후 다음 Adapter arguments를 모델이 만들려면 `human_input -> Agent -> Adapter` 경로에서 Agent 출력이 일반 state channel로 전달되어야 한다. 시나리오별 값은 generator에 하드코딩하지 않고 reviewed artifact와 runtime LLM output에서만 온다.
- **영향**: `scripts/generate-adk-source.mjs`, `scripts/generate-adk-source.test.mjs`, `templates/regression-scenarios/wf-page-recommendation-required/*`, `docs/workbench/validation.md`.

### HITL resume은 확인 응답과 이전 context를 함께 전달한다
- **결정**: generated `human_input` FunctionNode는 `rerun_on_resume=True`로 생성하고, resume 후 downstream output을 `{previous, response}` 형태로 내보낸다.
- **배경**: 사용자가 확인 단계에서 "확인"처럼 짧게 입력하면 downstream Agent가 이전 목적 분류 결과와 원 목적 텍스트를 잃을 수 있었다.
- **영향**: `scripts/generate-adk-source.mjs`, `scripts/generate-adk-source.test.mjs`, `docs/workbench/validation.md`.

## 2026-06-23 · 작업 브랜치 `codex/shared-venv-sdk` — 공유 ADK venv + Codex SDK 실행 통일

### ADK 실행은 공유 venv, Codex 호출은 SDK 경로로 통일
- **결정**: RunSandbox는 artifact별 `runtime-stub/.venv`를 만들거나 설치하지 않고, repo-local `.agent-factory/runtime/.venv` 또는 `AF_ADK_VENV_DIR`가 가리키는 공유 ADK venv의 `adk`를 사용한다. Codex Stage Runner, direct analyzer, Mock Lab draft는 외부 `codex exec` 호출 대신 `@openai/codex-sdk` TypeScript SDK 경로를 사용한다.
- **배경**: offline 패키징에서 artifact별 venv가 불필요하게 커지고, Windows/Linux 이동 시 venv 재사용이 불가능했다. Codex CLI 직접 spawn 의존도 줄여 서버 코드의 실행 계약을 SDK 수준으로 맞춘다.
- **영향**: `runtimeChat.ts`, `RunSandbox.tsx`, `stageRunner.ts`, `codexAnalyzer.ts`, `mockDraftRunner.ts`, `requirements/adk-runtime.txt`, active runtime docs.

## 2026-06-21 · 작업 브랜치 `codex/review-followup-taxonomy-graph` — PR #36/#37 리뷰 후속 보완

### 호출 축 불변식 강제: LLM-선택 toolset은 agent 노드에만
- **결정**: `node_kind`가 `agent`가 아닌데 `invoke_binding: mcp_toolset` 또는 `call_control: selected_by_llm`를 가지면 export validator(`validate-artifacts.mjs`)와 soft validation(`graphMigration.ts`) 모두 `llm_toolset_requires_agent_node` 오류를 낸다. `selected_by_llm`은 agent 노드 소유 메타데이터이므로 edge `call_control: selected_by_llm`도 같은 오류로 거부한다(node·scaffold·analysis 그래프 모두). 즉 `adapter_call`은 고정 호출(`mcp_tool` + `fixed_by_workflow`)만 허용하고 LLM-선택 toolset 의미를 가질 수 없다.
- **배경**: taxonomy/workflow-decision-guide/validation 문서는 "Adapter=call node, LLM toolset 선택=agent"를 명문화했으나, 직전 PR(#36/#37)까지 검증은 enum 존재만 확인하고 교차 필드 의미를 강제하지 않았다. scaffold 단계는 잘못된 toolset-adapter를 handoff placeholder로 강등시켜 잘못된 runnable 코드는 막았지만, 모순된 IR이 0-error로 통과해 `boundaries_approved`까지 토글될 수 있었다. 리뷰 회귀 테스트가 그 모순 형태의 "보존"을 단언하고 있어 함께 정정했다.
- **영향**: `scripts/validate-artifacts.mjs`(node + scaffold graph 검증), `packages/web/src/analyzer/graphMigration.ts`(soft validation code + `SOFT_VALIDATION_CODES`), `scaffoldPlan.test.ts`(보존 단언을 valid fixed-call로 교체), `graphMigration.test.ts`·`validate-artifacts.test.mjs`(거부/허용 회귀), `docs/workbench/validation.md`. 기존 템플릿·시나리오는 toolset-adapter를 쓰지 않아 영향 없음.

### Dynamic Workflow runnable 게이트를 scaffold-plan 검증으로 끌어올림
- **결정**: `output_mode: runnable`에서 `module_category: workflow` + `workflow_kind: dynamic` 모듈이나 `dynamic_workflow` container가 있으면 `scaffoldPlan.collectBlockers`가 `can_generate_source: false`로 두고 하위 Workflow 분리 + `workflow_call` 조립을 안내하는 blocker를 남긴다. smoke mode는 design/contract handoff로 통과한다.
- **배경**: generator(`assertRunnableGraphSupported`)는 runnable+dynamic을 throw로 거부했지만, plan-level `can_generate_source`는 이를 모르고 Build 버튼을 활성화해 클릭 후 런타임 에러가 났다. 안전 구멍은 아니나 "dynamic은 workflow_call로 전환 안내" 방향과 어긋나는 UX였다.
- **영향**: `packages/web/src/analyzer/scaffoldPlan.ts`, `scaffoldPlan.test.ts`(runnable 차단 + smoke 통과 회귀), `docs/workbench/validation.md`.

### 제거된 하단 탭 문서 정정 + 회귀 테스트 표준 러너 연결
- **결정**: Design 하단 탭이 `모듈/Runtime 계약/Remote A2A/검토 메모` 4탭(경로는 검토 메모 내부 섹션)임을 권위·온보딩 문서에 반영하고, repo-root node:test 회귀(`validate-artifacts.test.mjs`, `generate-adk-source.test.mjs`)와 신규 `reviewNotesModel.test.ts`를 `npm run test:analyzer`에 연결한다.
- **배경**: 직전 PR이 decision-log에는 탭 변경을 기록했으나 `CLAUDE.md`·`docs/visualization/design-system.md`(권위 UI 스펙, 파일 내부 모순)·`docs/onboarding/06-review-board.html`는 제거된 `Graph IR/경로/Comments` 탭을 현재 기능으로 안내했다. 또한 두 node:test 회귀가 어떤 표준 러너에도 연결돼 있지 않아 조용히 썩을 수 있었다.
- **영향**: `CLAUDE.md`, `docs/visualization/design-system.md`, `docs/onboarding/06-review-board.html`, `docs/workbench/taxonomy.md`(legacy node_kind alias 한 줄), `packages/web/package.json`(test:analyzer), `ReviewNotesPanel.tsx`→`reviewNotesModel.ts`(순수 helper 추출), `DesignWorkbench.tsx`(badge helper 사용).

## 2026-06-21 · 작업 브랜치 `feat/wf-page-recommendation-scenario` (PR #39) — page recommendation 시나리오 + 제너레이터 도메인-중립화

### Static user-confirmation route lowering and explicit package names
- **결정**: Runnable ADK source generator가 reviewed `router` node와 `edge_kind: route`/`execution_semantics: conditional` edge를 ADK `Event(route=...)` 함수와 Workflow route map으로 lower한다. 이 support는 static user-confirmation branch에 한정하며, loop/dynamic workflow codegen은 계속 후속으로 남긴다. `scaffold-plan.json`에는 optional `package_name`을 허용해 승인된 fixture가 생성 package 이름을 명시할 수 있게 한다.
- **배경**: `1-1 페이지 추천(필수)` smoke skeleton은 “추가 분석 실행 여부”를 사용자가 직접 선택한 뒤 분석 fan-out 또는 최종 확인으로 분기해야 한다. 기존 `req_*_adk` 자동 이름은 요구된 `wf_page_recommendation_required` bundle 이름을 만들 수 없었다.
- **영향**: `scripts/generate-adk-source.mjs`, `scripts/validate-artifacts.mjs`, `schemas/scaffold-plan.schema.json`, `packages/web/src/analyzer/types.ts`, `templates/regression-scenarios/wf-page-recommendation-required/`, `docs/workbench/validation.md`, `docs/workbench/workflow-decision-guide.md`.

### 제너레이터 도메인-중립화: 하드코딩된 샘플 출력 제거
- **결정**: ADK source generator의 샘플 출력은 (구조/보일러플레이트) + (승인 아티팩트에서 읽은 값)만 emit한다. 특정 요구사항(은행/페이지 추천) 문자열을 리터럴로 박지 않는다. 죽은 `WORKFLOW_INSTRUCTION` 상수를 제거하고, `sampleConversationMessages()`를 아티팩트 유도형(목적·human-input 노드·종료 노드·미확정 workflow)으로 재작성하며, README mock 슬러그는 mock-spec `mock_id`에서 유도한다. 도메인-중립 fixture에 generator-authored 도메인 리터럴이 새지 않는지 회귀 가드로 강제한다.
- **배경**: page-recommendation 시나리오 추가 작업에서 시나리오 특화 내용이 데이터가 아니라 generator 리터럴로 들어가, 모든 요구사항의 생성물에 누수됐다(`agent.py`, `sample_inputs.yaml`, README). 빈 placeholder보다 위험한 "그럴듯하지만 틀린" 산출물이었다.
- **영향**: `scripts/generate-adk-source.mjs`, `scripts/generate-adk-source.test.mjs`(도메인-중립 회귀 가드).

## 2026-06-20 · 작업 브랜치 `codex/taxonomy-graph-model-correction` — Workflow-first Graph Model 축 정정

### Workflow-first Graph Model과 호출 축 분리
- **결정**: Workbench를 Workflow-first Graph Model로 명문화한다. `module_category`는 계속 `agent`/`workflow`/`adapter`/`remote_a2a` 네 값만 허용하고, Graph IR의 `node_kind`/`invoke_binding`/`call_control`/`mock_binding`이 실행 방식을 표현한다. Agent는 judgment node, Adapter는 call node이며, MCP는 category가 아니라 `invoke_binding`/`mock_binding`으로 표현한다. 고정 MCP 호출은 `adapter_call` + `invoke_binding: mcp_tool` + `call_control: fixed_by_workflow`, LLM-selected toolset은 `agent` + `invoke_binding: mcp_toolset` + `call_control: selected_by_llm`로 분리한다. 기존 Workflow 추가/선택 기능은 공식 subworkflow/existing workflow node인 `node_kind: workflow_call`로 저장한다.
- **배경**: taxonomy 책임 축과 Graph IR 실행 축이 섞이면 MCP, Adapter, Agent toolset, workflow reuse가 새 category처럼 보인다. Dynamic Workflow 자동 생성보다 업무별 Workflow를 분리하고 parent graph에서 `workflow_call`로 조립하는 방향이 더 작고 검토 가능하다. Mock Lab은 이미 `packages/mock-lab`에 있으므로 새 mock server system을 만들지 않고 저장된 MockSpec/MCP discovery를 재사용한다.
- **영향**: `analyzer/types.ts`, `nestedWorkflowInsert.ts`, `scaffoldPlan.ts`, `GraphCanvas.tsx`, `GraphElementEditor.tsx`, `GraphInspector.tsx`, `scripts/generate-adk-source.mjs`, `schemas/*`, `docs/workbench/taxonomy.md`, `docs/workbench/workflow-decision-guide.md`, `docs/workbench/process-flow.md`, `docs/workbench/validation.md`, `docs/reference/target-agent-architecture/README.md`.

### Dynamic, callback/resume, governance, skeleton handoff 범위
- **결정**: `workflow_kind: dynamic`과 `container_kind: dynamic_workflow`는 이번 skeleton scope에서 design/contract container로만 남긴다. Runnable dynamic codegen은 생성하지 않는다. `callback_wait`와 resume은 새 category가 아니라 Graph IR execution semantics다. `side_effect`와 `policy`는 node-level governance summary이며 `AnalysisResult.runtimeContracts`와 A2A contract artifact가 runtime governance source of truth다. ADK source generation은 production generator가 아니라 ADK Web smoke skeleton handoff이며 `workflow.py`, `nodes/*`, `mock_config.yaml`, `sample_inputs.yaml`, README/TODO를 생성한다.
- **배경**: callback, resume, governance policy, side effect, dynamic runtime control을 taxonomy 값으로 승격하면 검토 artifact의 source of truth가 갈라진다. Generated bundle은 reviewer가 ADK Web에서 흐름을 확인하는 smoke skeleton이어야 하고, production API/EAI client, credential, deployment, dynamic Python logic, production prompt는 developer TODO 경계로 남겨야 한다.
- **영향**: `docs/workbench/taxonomy.md`, `docs/workbench/workflow-decision-guide.md`, `docs/workbench/process-flow.md`, `docs/workbench/validation.md`, `docs/reference/target-agent-architecture/README.md`, generated handoff README/TODO wording.

### Graph semantics validation과 Remote A2A endpoint alias 정렬
- **결정**: `human_input`과 `callback_wait`는 module-bound node가 아니라 Graph IR execution semantics로 검증한다. 두 node_kind에 `module_id`가 있으면 soft/hard validation에서 오류로 처리한다. `remote_agent_call`은 Workbench UI의 workflow-first node_kind이며 Remote A2A boundary로서 `remote_a2a` node_kind와 동일하게 edge creation, validation, runnable lowering에서 remote endpoint로 인정한다. `ScaffoldPlan.graph`는 TypeScript type과 custom validator 양쪽에서 node/edge 호출 축 enum을 검증한다.
- **배경**: UI 메뉴가 workflow-first node_kind를 노출한 뒤에도 일부 validator/generator 경로가 오래된 `remote_a2a` 전용 판정과 schema-only scaffold graph 계약에 머물러 있었다.
- **영향**: `graphMigration.ts`, `validate-artifacts.mjs`, `generate-adk-source.mjs`, `GraphCanvas.tsx`, `types.ts`, `validate-artifacts.test.mjs`, `graphMigration.test.ts`, `generate-adk-source.test.mjs`.

## 2026-06-18 · 작업 브랜치 `codex/mock-lab-prompt-spec` — Mock Lab 실행 기준을 saved `MockSpec`으로 전환

### Codex는 Prompt-to-Spec 초안 보조로 한정
- **결정**: Mock Lab의 기본 흐름을 `Draft → Edit → Save → Run → Test`로 재정렬하고, 기존 `Codex Run`/generated project apply 경로를 폐기한다. Codex는 `POST /api/mock-lab/:mockId/drafts`로 자연어 prompt에서 `MockSpec` 초안을 만들 뿐이며, 성공한 초안은 `artifacts/mock-lab/<mock-id>/drafts/<draft-id>/draft-spec.json`에 저장된다. 초안은 검증 통과 후에만 editor로 불러올 수 있고, canonical `mock-spec.json`은 `Save spec`에서만 변경된다.
- **배경**: 기존 UI가 Codex 실행을 mock server 생성의 필수 단계처럼 보이게 해 사용자가 저장된 spec 기반 실행 경로를 이해하기 어려웠다.
- **영향**: `packages/mock-lab` API/React UI/types/tests, `docs/mock-lab/local-mcp-mock-lab.md`, `docs/workbench/agent-factory-harness.md`. `/generate`, `/runs`, `/runs/:id/apply`는 Mock Lab API에서 제거된다.

### 서버 실행은 saved `mock-spec.json` 기반 generic stdio runtime으로 수행
- **결정**: `Run saved spec`은 `generated/package.json` 없이 저장된 `artifacts/mock-lab/<mock-id>/mock-spec.json`만 읽어 package-owned generic MCP stdio runtime을 실행한다. Runtime은 `tools/list`, `tools/call`, input schema validation, `successResponse`, basic `errorScenarios`, latency, audit log를 처리하며 network MCP bridge는 같은 process registry를 재사용한다.
- **배경**: Mock Lab의 본래 목적은 저장된 `MockSpec`으로 synthetic MCP mock server를 빠르게 실행·검증하는 것이며, 별도 server project export는 기본 경로에 불필요한 비용과 혼선을 만들었다.
- **영향**: `MockProcessRegistry`, `mockSpecRuntime.ts`, `mcpNetworkBridge.test.ts`, `mockLabCore.test.ts`. Fresh worktree에서도 ignored `artifacts/mock-lab/*/generated` fixture 없이 테스트 가능하다.

## 2026-06-20 · 작업 브랜치 `codex/agent-execution-mode-ui` — agent execution mode 선택 UI

### `agent_execution_mode`를 `single_turn`/`chat` 전용 Graph IR 필드로 추가
- **결정**: `GraphNode.agent_execution_mode`를 추가하고 Design 편집 UI에서는 `agent` 노드에만 `Single turn`/`Chat` 세그먼트 컨트롤을 노출한다. `task`는 static Graph node 선택지로 열지 않는다. Runnable ADK generator는 값이 `chat`이면 `LlmAgent(mode="chat")`, 없거나 `single_turn`이면 `mode="single_turn"`을 생성한다.
- **배경**: `execution_kind`는 기존 카테고리/기술 라벨 성격으로 이미 쓰이고 있어 ADK LLM context contract 저장소로 재사용하면 충돌한다. `task`는 작은 workflow reuse나 coordinator/sub-agent topology와 구분해야 하므로 일반 노드 mode 선택값에서 제외한다.
- **영향**: `GraphNode`/process-flow schema, `scaffold-plan` module schema, `GraphElementEditor`/`GraphInspector`/GraphCanvas badge, `generate-adk-source.mjs`, `validate-artifacts.mjs`, active docs. 기존 artifact는 필드 누락 시 `single_turn`으로 해석한다.

## 2026-06-19 · 작업 브랜치 `docs/edge-data-passing-followups` — ADK LlmAgent execution mode 정책 문서화

### Graph node 기본은 `single_turn`, `chat`은 stateful node, `task`는 static graph node 금지
- **결정**: ADK `LlmAgent.mode`를 단순 enum이 아니라 runtime topology/context contract로 취급한다. Graph Workflow의 일반 LLM node 기본은 `single_turn`이며, `chat`은 session history를 암묵 입력으로 받는 stateful node로만 명시 허용한다. `task`는 static graph node로 생성하지 않고 coordinator agent + task sub-agent 또는 dynamic `ctx.run_node` dispatch 구조로만 표현한다.
- **배경**: ADK 2.2.0 source inspection과 실제 Gemini 2턴 smoke에서 `single_turn`은 이전 턴을 보지 못하고 `chat`은 이전 턴을 볼 수 있음을 확인했다. ADK 공식 collaboration 문서는 mode를 sub-agent용으로 설명하며, 로컬 ADK 2.2.0 `Workflow`는 static graph node의 `mode='task'`를 validation error로 거부한다.
- **영향**: 신규 문서 `docs/workbench/adk-agent-execution-modes.md`, `docs/README.md`. 향후 Graph IR schema/UI/generator/skill 변경에서 `task`를 node enum으로 단순 추가하지 말고 topology 변경으로 설계해야 한다.

## 2026-06-18 · 작업 브랜치 `worktree-adk-generator-structure` — remote_a2a runnable lowering (PR-B)

### `remote_a2a` 노드를 ADK `RemoteA2aAgent` 그래프 노드로 lower
- **결정**: module-bound `remote_a2a` 노드를 `RemoteA2aAgent(name, description, agent_card=<승인된 A2A 계약의 agent_card.agent_card_url>, use_legacy=False)`로 생성한다(`NODE_LOWERING`에 remote_a2a 핸들러 추가, `moduleLoweringRole`이 remote_a2a 반환). 계약은 `analysisResult.a2aContracts`에서 `remote_module_id`(그다음 `a2a_contract_id`)로 조회한다. `assertRunnableGraphSupported`를 완화해 module-bound remote 노드와 `remote_a2a` 엣지(`boundary_crossing`/`is_remote_boundary_crossing`)를 허용하되, 그 값들은 **remote 엣지에서만** 허용한다(비-remote 엣지는 계속 거부). `assertRemoteA2aSupported`가 계약·`agent_card_url` 없는 remote 노드를 거부하고, 계약 승인은 기존 `validateRunInputs`가 강제한다. `[a2a]` extra와 `RemoteA2aAgent` import는 remote 노드가 있을 때만 추가(없으면 번들 불변).
- **배경**: "엣지가 A2A로 데이터를 주고받을지 화면에서 선택 → 코드 반영"의 원격 절반. spike로 `RemoteA2aAgent`가 그래프 `Workflow` 노드로 직접 동작함을 실측(BaseAgent 하위, Workflow가 노드로 수용 — 래핑 불필요). ADK 문서의 sub_agent 용례만으로는 불확실했던 부분을 해소.
- **영향**: `scripts/generate-adk-source.mjs`(remote lowering + 게이트 완화), `generate-adk-source.test.mjs`(remote 회귀 2건), `templates/regression-scenarios/scenario-i-remote-a2a/`(신규 시나리오 + 로컬 mock A2A 서버 `mock_remote/serve_app.py`), `CLAUDE.md`·`validation.md`. 검증: node:test 11/11, 비-remote 번들 불변, 실 `google-adk[a2a]` 2.2.0에서 생성 번들 import/구성 + **라이브 A2A 라운드트립**(생성된 RemoteA2aAgent → 로컬 mock 서버 → `{"analysis":"MOCK_REMOTE_OK"}` 수신, Gemini 불필요). route/loop/dynamic은 계속 후속.

## 2026-06-17 · 작업 브랜치 `worktree-adk-generator-structure` — 엣지별 데이터 전달 방식 선택 + 제너레이터 구조화

### 제너레이터를 node-kind/output-mode dispatch로 구조화 (동작 불변)
- **결정**: `scripts/generate-adk-source.mjs`의 runnable 노드 emission을 `NODE_LOWERING` 레지스트리(role→{emitFunc,emitDecl})로, agent.py 빌더를 `AGENT_PY_BUILDERS`(output-mode) 맵으로 정리한다. 새 node-kind/output-mode는 핸들러·엔트리 추가로 끝난다(`emitNode`는 미등록 role을 명시적으로 거부).
- **배경**: 곧 dynamic-workflow 제너레이터 대규모 개편이 예정되어 있고, 직후 이 엣지 lowering·remote_a2a 추가가 얹힌다. if/elif 증식 대신 확장점을 먼저 마련한다.
- **영향**: `generate-adk-source.mjs`. 5-fixture 스냅샷 생성물 byte-identical + `node --test scripts/generate-adk-source.test.mjs`로 동작 불변 증명. Codex 리뷰 통과.

### 엣지 `edge_kind`를 "데이터 전달 방식"으로 선택 → 생성 코드에 반영 (내부: state 채널)
- **결정**: Design 편집 모드 EdgeForm의 edge_kind를 그룹형 "데이터 전달 방식" 피커로 노출하고(내부 event/state×4/artifact · 제어 route/control · 원격 A2A, 옵션별 설명·필수필드 인라인), runnable 제너레이터가 **session/temp/user/app state 채널**을 실제로 lower한다. 모델은 "명시 매핑 우선 + 기존 `{id}_output` 컨벤션 fallback": 엣지 `state_key`(+스코프 prefix)를 producer가 기록(agent는 단일 채널이면 `output_key`, function 노드는 `ctx.state[키]`에 미러)하고 connected adapter consumer는 `_collect_tool_inputs`의 명명 채널에서 우선 읽는다. agent의 상이한 다중 out-state 키는 거부한다(LlmAgent output_key 단일 제약).
- **배경**: "각 엣지가 내부 코드에서 데이터를 어떻게 주고받을지 화면에서 선택" 요구. 기존엔 피커·데이터모델은 있으나 제너레이터가 전부 무시해 선택이 장식적이었다. ADK 2.x 문서(state prefix·output_key·`{key}` instruction 템플릿·graphs/data-handling)로 시맨틱을 확인.
- **영향**: `GraphElementEditor.tsx`(피커), `generate-adk-source.mjs`(채널 lowering), `generate-adk-source.test.mjs`(회귀 2건), `docs/workbench/validation.md`·`CLAUDE.md`. 채널을 쓰지 않는 엣지는 런타임 동작 불변(하위호환). `artifact` 채널도 lower된다 — function 노드가 payload를 JSON `types.Part`로 `save_artifact`하고 connected adapter consumer가 `load_artifact`로 읽어 `_collect_tool_inputs`의 `extra_payloads`로 합류시킨다(`json`/`google.genai.types` import는 artifact 사용 시에만 추가해 비-artifact 번들은 byte-identical 유지). agent가 만든 artifact 출력은 거부한다. **후속/미지원**: agent-consumer 명명 읽기(현재 connected adapter consumer만 명명 채널을 읽음), remote_a2a runnable lowering은 다음 작업(PR-B), route/loop는 dynamic 후속으로 계속 거부.

### Codex 리뷰 반영 (계약/가드 변경)
- **결정**: (1) `state_key`의 정본 형식을 **bare key**로 확정한다 — 스코프는 `edge_kind`가 결정하므로 저장 키에 prefix를 요구하지 않는다. `scripts/validate-artifacts.mjs`의 "temp_state는 `temp:`로 시작해야 함" 류 규칙을 완화해 bare 키를 허용하되, `edge_kind`와 **불일치하는** 스코프 prefix(예: temp_state 엣지에 `app:` 키)는 거부한다. UI 힌트도 bare 입력으로 안내. (2) **동일 `state_key`를 둘 이상의 producer가 쓰는** 경우 거부한다(모두 같은 `ctx.state[key]`에 써서 한 슬롯으로 collapse → 데이터 유실). (3) 명명 채널의 **소비측 자동 읽기는 connected MCP adapter consumer에서만** 발생함을 명확히 한다(state·artifact 공통) — 다른 소비 노드는 producer가 state 기록/artifact 저장만 하고 자동으로 읽지 않는다(UI 힌트·문서 명시).
- **배경**: PR-A에 대한 Codex 리뷰 REQUEST-CHANGES 3건 — UI(bare 안내) ↔ validator(prefix 강제) 계약 모순, 다중-producer 같은-키 collision, 비-connected consumer의 채널 무읽기.
- **영향**: `scripts/validate-artifacts.mjs`(state_key prefix 규칙 완화+불일치 거부), `generate-adk-source.mjs`(다중-producer 거부 가드), `generate-adk-source.test.mjs`(회귀 1건), `GraphElementEditor.tsx`(힌트), `validation.md`·`CLAUDE.md`.

## 2026-06-16 · 작업 브랜치 `worktree-adk-human-input` — runnable 제너레이터 human-in-the-loop 지원

### runnable 모드가 human_input + 병렬/join DAG를 ADK 2.x 그래프 Workflow로 lower
- **결정**: `scripts/generate-adk-source.mjs` runnable 모드가 `human_input` 노드(ADK 2.x `from google.adk.events import RequestInput` → `yield RequestInput(message=...)` + FunctionNode), 명시적 `join`(JoinNode), 병렬 fan-out을 lower하도록 확장한다. 가드는 `human_input`/`join` 노드와 `parallel_region`/`human_review_region` 컨테이너(런타임 객체 없는 시각 그룹)를 허용하고, `router`/`loop_control`·`route`/`loop_back`/`loop_exit`/`conditional`·`remote_a2a`·`dynamic_workflow`는 계속 거부한다.
- **배경**: ADK에서 사람 입력을 받는 그래프를 dev UI로 테스트하려는 요구. 사전 실측으로 `RequestInput`이 런타임에서 long-running `adk_request_input` 호출로 pause 되고 동일 id `functionResponse`(`{response: ...}`)로 resume됨을 확인.
- **영향**: `scripts/generate-adk-source.mjs`, `CLAUDE.md`·`agent-factory-harness.md`·`validation.md`. ADK 2.2.0 api_server E2E로 pause/resume 검증.

### 루프는 static graph가 아니라 dynamic workflow 영역 — 별도 후속으로 분리
- **결정**: ADK 2.x 문서(graphs/dynamic) 기준 반복 루프는 static 그래프 `Workflow`가 아니라 dynamic workflow(`@node` + `ctx.run_node` + `while`)로 표현한다. 따라서 scenario-d의 루프(`loop_control`/`loop_region`)는 runnable로 lower하지 않고, dynamic-workflow 코드젠은 별도 후속 작업으로 남긴다.
- **배경**: scenario-d를 그대로 runnable로 만들려면 루프 lower가 필요한데, 핵심 목표(human-input 테스트)와 무관하고 위험이 크다. static-graph 라우터 백엣지 hack은 ADK 2.x 지침에 어긋난다.
- **영향**: 루프 codegen 미구현(가드가 거부). scenario-d는 루프 보존 smoke/시각 픽스처로 유지.

### runnable human-in-the-loop regression 픽스처 신설 (scenario-g)
- **결정**: scenario-d에서 루프만 뺀 `templates/regression-scenarios/scenario-g-human-input-review`(input→병렬 adapter 2개→join→risk agent→human_review_gate stub→human_input→drafter agent→output)를 추가한다. round 1 능력만으로 runnable 생성·ADK 실행 가능.
- **배경**: "루프는 smoke/시각 유지, 나머지(human-input 경로)는 runnable" 요구를 one-graph-one-mode 제약에서 충족하려면 루프 없는 파생 픽스처가 필요. scenario-d 원본은 손대지 않아 루프 검증 커버리지를 보존.
- **영향**: 신규 픽스처(validate-artifacts 자동 포함). ADK dev UI 테스트 경로: 빌드(runnable)→`adk api_server --with_ui`→사람 입력 pause/resume.

## 2026-06-15 · 작업 브랜치 `refactor/graph-render-layer` — Graph 렌더링을 UI 레이어로 분리

### Graph IR 렌더링(ReactFlow)을 `src/components/graph/`로 이동, `src/graph/`는 순수 엔진만 유지
- **결정**: `src/graph/`의 ReactFlow 렌더 컴포넌트와 렌더 결합 layout(`layout.ts`·`nodeTypes.tsx`·`edgeTypes.tsx`·`containerOverlay.tsx`·`validationBanner.tsx`, +`layout.test.ts`)을 `src/components/graph/`로 옮긴다. `src/graph/`에는 순수 graph-IR 헬퍼 `containerMembership.ts`만 남겨 진짜 단방향 엔진으로 만든다. `analyzer/nestedWorkflowInsert`의 `../graph/containerMembership` import는 불변, `GraphCanvas`는 렌더 import만 `./graph/*`로 repoint.
- **배경**: 2026-06-14 항목이 `src/graph`를 순수 엔진으로 명문화했지만 실제로는 ReactFlow 렌더 컴포넌트(UI·React import)를 품고 있어 라벨이 모순이었다(`nodeTypes.tsx`가 `components/CategoryBadge`를 import). 물리적 분리로 모순을 해소해 화면/엔진 경계를 코드 위치로 강제한다.
- **영향**: `src/components/graph/*`(이동), `src/graph/containerMembership.ts`(잔류), `components/GraphCanvas.tsx`(렌더 import repoint), `packages/web/package.json`(layout.test 경로), `CLAUDE.md`·`docs/visualization/design-system.md`(렌더 경로 표기). behavior-preserving 이동이며 동작 변화 없음.

## 2026-06-14 · 작업 브랜치 `feat/workflow-a2a-registration` — UI/엔진 레이어 경계 정리

### 화면 ↔ 내부 엔진 경계를 명확히 하는 모듈 배치 규칙 채택
- **결정**: de-facto 레이어를 명문화하고 그에 맞게 코드를 재배치한다 — UI(`src/routes`·`src/components`·`src/design`·`src/catalog-hub`), 데이터 접근(`src/state` react-query 훅), 순수 엔진(`src/analyzer`·`src/graph`·`src/catalog`), 서버(`server`). 컴포넌트/드로어에 있던 순수 로직을 엔진으로 이동: catalog-delta parse/append → `src/catalog/catalogDelta.ts`, catalog index DTO → `src/catalog/catalogIndex.ts`, catalog→scaffold 변환 → `src/catalog/scaffoldCatalog.ts`, publish proposal shaping → `src/catalog/catalogPublishProposal.ts`, version/deprecation 선택 규칙(client hydration+server 공유) → `src/catalog/catalogVersioning.ts`, A2A 계약 생성 mutation → `src/analyzer/a2aNormalize.ts`. 드로어는 raw fetch 대신 `src/state/useCatalogDelta.ts` 훅을 쓰고, 엔진 모듈은 UI/React/state 를 import 하지 않는다.
- **배경**: 프론트/백엔드가 한 패키지에 있어 경계가 흐려지기 쉬웠다. 컴포넌트 안에 변환/검증/ID 생성 로직이 섞여 있어 새 기능에서 화면과 내부 엔진을 재사용·교체하기 어려웠다.
- **영향**: `src/catalog/*`(신규 엔진 모듈), `src/state/useCatalogDelta.ts`, `routes/BuildWorkbench.tsx`·`routes/DesignWorkbench.tsx`·`catalog-hub/*` 드로어(로직 제거 후 엔진 호출), `components/GraphCanvas.tsx`(engine helper re-export 제거). behavior-preserving 이동이며 동작 변화 없음.

### BuildWorkbench scaffold 입력을 hydrated `/api/catalog` 로 전환
- **결정**: BuildWorkbench 의 scaffold-plan 파생 입력을 정적 seed import(`loadSeedCatalog`)에서 `useCatalog()` 의 hydrated `/api/catalog` index 로 바꾼다. 승인 게이트로 publish 된 versioned catalog entry 가 빌드 단계 scaffold 입력에 즉시 반영된다.
- **배경**: 정적 import 는 publish 결과를 보지 못해, 등록 승인한 항목이 빌드 단계에 나타나지 않았다.
- **영향**: `routes/BuildWorkbench.tsx`, `src/catalog/scaffoldCatalog.ts`, `state/useCatalogPublish.ts`(invalidation 키 정렬).

---

## 2026-06-13 · 작업 브랜치 `feat/workflow-a2a-registration` — Reuse Hub 등록 승인 publish 경로

### 카탈로그 정책을 승인 게이트 publish API 단일 쓰기 경로로 개정
- **결정**: `catalog/*.yaml` 직접 편집 금지를 유지하되, Reuse Hub `등록 승인` drawer 에서 검토자가 `catalog-delta.yaml` 제안을 항목별 승인하면 `POST /api/catalog/publish` 가 matching catalog YAML 에만 append 하는 app 쓰기 경로를 추가한다. publish 는 target YAML 을 `js-yaml` load→dump 로 canonical re-serialization 하므로 semantics 는 보존하지만 formatting 은 바뀔 수 있고, 최종 human PR 에서 git diff 로 검토한다. bulk/seed 변경은 여전히 human PR merge 로 처리한다.
- **배경**: 기존 Reuse Hub 는 `catalog-delta.yaml` 제안만 남기고 app 안에서 catalog 반영을 할 수 없어, 단건 승인 흐름이 manual merge 에 묶여 있었다.
- **영향**: `packages/web/server/afCatalogApi.ts`, Reuse Hub 등록 승인 UI, catalog governance 문서.

### Versioned catalog entry 모델 채택
- **결정**: publish 된 항목은 stable `id`, `version`, `status: published`, `provenance: catalog_published`, `published_at`, `published_from`, 선택적 `source_candidate_id` 를 포함한다. 같은 category/name 의 기존 항목은 `status: deprecated` 로 표시하고, catalog hydration 은 deprecated 를 제외한 최고 version 을 Reuse Hub 에 노출한다.
- **배경**: 기존 readers 는 name 기반으로 동작하므로 append-only publish 와 기존 seed 항목을 함께 유지하려면 명시적 version/status 모델이 필요했다.
- **영향**: catalog YAML entry shape, Reuse Hub index hydration, `CatalogEntry` 타입.

## 2026-06-30 · 작업 계획 `workflow-a2a-capable-conversion` — workflow catalog A2A exposure metadata

### Workflow Remote A2A 노출 메타데이터 분리
- **결정**: `module_category: workflow` catalog entry가 `component_source: remote_a2a` 및 `runtime_binding: remote_a2a`로 노출될 때 제공자 artifact root는 `a2a_provider_req_id`에 저장한다. `published_from`은 publish provenance로만 유지한다.
- **배경**: source req-id provenance와 runtime provider target을 같은 필드에 담으면 publish idempotency와 catalog hydration에서 의미가 섞인다.
- **영향**: catalog-delta proposal shape, publish proposal DTO, `POST /api/catalog/publish` validation, catalog YAML entry shape, scaffold catalog hydration.

### Catalog workflow 중첩 삽입은 단일 노드 방식으로 채택
- **결정**: Design 검토 화면의 `카탈로그 워크플로우 삽입`은 catalog workflow 내부 fragment를 펼치지 않고, 현재 Graph IR에 단일 `workflow` node와 matching `ModuleCandidate`를 추가한다.
- **배경**: catalog workflow의 내부 Graph IR을 다른 root에 확장하면 ownership, edge namespace, approval state가 섞인다. Round B 범위는 재사용 boundary를 명시하는 삽입이다.
- **영향**: `nestedWorkflowInsert` helper, DesignWorkbench picker, Graph IR 컨테이너 편입 규칙.

### Catalog workflow 삽입은 편집 드래프트 밖 즉시 저장 경로로 결정
- **결정**: 삽입 액션은 GraphCanvas 편집 모드의 `processFlow` draft 저장 버튼을 기다리지 않고 `analysis-result.json` 전체를 즉시 PUT 한다.
- **배경**: 삽입은 module candidate와 Graph node를 동시에 추가하므로 `processFlow`만 저장하는 편집 드래프트와 섞으면 후보/노드 linkage가 깨질 수 있다.
- **영향**: DesignWorkbench 저장 mutation, 모듈 탭 approval flow.

### Remote A2A 편집기는 하단 탭에서 부활
- **결정**: 우측 Inspector는 `INSPECTOR_ENABLED=false`로 계속 파킹하고, `Remote A2A` 하단 탭에 `A2AContractInspector`를 목록 아래에 배치한다. 매칭 계약이 없을 때는 `새 계약 생성`이 placeholder 계약과 후보 `a2a_contract_id`를 한 번에 저장한다.
- **배경**: 그래프 폭을 유지하면서도 Remote A2A readiness를 Stage Runner 재실행이나 외부 편집 없이 해소할 필요가 있었다.
- **영향**: DesignWorkbench bottom tab, A2A readiness gate.

### Remote A2A linkage 검증 범위 확정
- **결정**: export validator는 `remote_a2a` edge의 contract id가 실제 A2A contract를 가리키는지뿐 아니라 remote endpoint node `module_id`, `contract.remote_module_id`, `candidate.a2a_contract_id`의 상호 링크를 검증한다. soft validator는 remote endpoint가 없거나 module link가 없을 때 warning만 표시한다.
- **배경**: Remote A2A는 아직 runtime codegen 경로가 아니지만, artifact handoff 전에 candidate/node/contract 링크 불일치를 잡아야 한다.
- **영향**: `scripts/validate-artifacts.mjs`, `validateGraphIRSoft`, `docs/workbench/validation.md`. Runtime codegen 범위는 변경하지 않는다.

## 2026-06-12 · PR [#26](https://github.com/gttmr/Agent-Factory/pull/26) (merge `ea78ced`) — Design 검토 Graph IR 편집 + 모듈 승인 흐름

### Graph IR을 검토 화면에서 직접 편집할 수 있게 결정
- **결정**: 설계 검토의 GraphCanvas에 명시적 `편집 모드`를 추가. 노드/엣지 추가·삭제, 핸들 드래그·순차 클릭 두 경로의 엣지 생성, 노드 드래그 이동을 지원한다. 편집은 로컬 draft에서만 일어나고 `저장` 시 `analysis-result.json.processFlow`만 PUT 하며, `manifest.approvals.*` 게이트는 절대 자동 변경하지 않는다.
- **배경**: 기존 캔버스는 읽기 전용(`nodesDraggable=false`)이라 Stage Runner 재실행 외에는 Graph IR을 다듬을 방법이 없었다.
- **영향**: `GraphCanvas.tsx`, `layout.ts`, `docs/visualization/design-system.md` 편집 모드 절.

### 노드 수동 배치를 `node.position`으로 영속화
- **결정**: `GraphNode`에 선택적 `position {x,y}` 필드를 추가. finite position이 있는 노드는 dagre 자동 배치에서 제외하고 좌표를 그대로 쓴다. 저장 시 전체 노드 좌표를 기록한다.
- **배경**: dagre가 매 렌더마다 재배치해 사용자가 옮긴 위치가 유지되지 않았다.
- **영향**: `analyzer/types.ts`, `schemas/process-flow.schema.json`·`analysis-result.schema.json`, `scripts/validate-artifacts.mjs`, `docs/workbench/process-flow.md`.

### 속성 편집은 좌측 인스펙터 패널 전환 방식 채택
- **결정**: 편집 모드에서 노드/엣지를 선택하면 좌측 정보 패널이 읽기 전용 `GraphInspector`에서 편집형 `GraphElementEditor`로 전환된다(모달/팝오버 대안 기각 — 사용자 선택). 모듈 연결은 **기존 후보 연결만** 지원하고(새 후보 생성 없음), `candidate.module_category === node.node_kind` 필터를 강제한다. `node_kind` 자체는 v1에서 편집 불가(삭제 후 재추가).
- **배경**: 추가된 노드가 속성 없는 껍데기로 남아 검토를 진행할 수 없었다.
- **영향**: `GraphElementEditor.tsx`(신규), `DesignWorkbench.tsx`, `docs/visualization/design-system.md`.

### 새 로컬 노드는 루트 workflow 컨테이너에 기본 편입
- **결정**: 편집 모드에서 추가한 노드(remote_a2a 제외)는 parent 없는 첫 `graph_workflow`/`dynamic_workflow` 컨테이너에 `container_id` + `contains_node_ids` 동시 기록으로 편입한다.
- **배경**: 컨테이너 미편입 노드는 주황 경계 오버레이가 추적하지 못했다(삭제만 컨테이너를 정리하는 비대칭).
- **영향**: `GraphCanvas.tsx`, `docs/workbench/process-flow.md`.

### 화면 소프트 검증과 내보내기 검증의 정합 — `node_missing_module_id`
- **결정**: `validateGraphIRSoft`에 module-kind(agent/workflow/adapter/remote_a2a) 노드의 `module_id` 누락을 ERROR로 추가해, 화면 검토 게이트가 `validate-artifacts.mjs`의 export 규칙과 같은 기준으로 차단하게 한다.
- **배경**: 껍데기 노드가 화면 게이트는 통과하지만 내보내기 검증에서 실패하는 어긋남이 있었다.
- **영향**: `analyzer/graphMigration.ts`, `docs/workbench/validation.md`.

### 모듈 후보 승인은 워크벤치 모듈 탭에서 수행 (Legacy 워크벤치 경로 폐기 확정)
- **결정**: 하단 `모듈` 탭에 검토 상세 패널을 추가 — `missing_information` 항목별 해소(선택 메모) 후에만 `승인` 활성화, `보류`/`반려` 지원. 승인은 서버 `resolveCandidateForDesign`과 동일한 필드 세트(`resolved_missing_information`, `resolution_applied_at`, `schema_review_state: applied`, `smoke_spec`)를 기록해 빌드 단계 blocker도 함께 해소한다. 후보 status는 같은 `module_id` 노드의 `review_status`로 미러된다.
- **배경**: 후보 status를 바꾸는 UI가 없고 게이트 안내문이 제거된 "Legacy 워크벤치"를 가리켜 설계 검토가 막다른 길이었다. needs_info 재오픈과 Runtime/A2A 인라인 계약 편집기 부활은 범위에서 제외(계약 수정은 Stage Runner 재실행/외부 편집으로 안내).
- **영향**: `analyzer/moduleReview.ts`(신규), `DesignWorkbench.tsx`, `docs/workbench/review-board.md`·`agent-factory-harness.md`.

### 게이트 안내 문구는 미충족 조건만 열거
- **결정**: "다음에 할 일" 힌트가 고정 문구 대신 미충족 조건만 나열한다(예: "미승인 모듈 N개 — 하단 모듈 탭에서 승인"). 계약이 0개면 자동 통과임을 명시한다.
- **배경**: 수행할 수 없는 행동을 일괄 안내해 사용자가 무엇을 해야 하는지 알 수 없었다.
- **영향**: `DesignWorkbench.tsx` `buildDesignNextAction`.

### 분석 검토 '수용' 상태를 아티팩트에 영속화
- **결정**: 누락 정보 "수용" 토글을 컴포넌트 메모리가 아니라 `evidence.accepted_missing_information`(optional string array)에 토글 즉시 저장한다. 아티팩트 루트가 canonical store라는 원칙의 일관 적용.
- **배경**: 수용 상태가 리로드 시 초기화되는 버그.
- **영향**: `AnalyzeWorkbench.tsx`, `analyzer/types.ts`, `schemas/analysis-result.schema.json`, `docs/workbench/validation.md`·`agent-factory-harness.md`.

### Graph 편집 속성 패널은 6탭과 파생값 잠금을 기본으로 한다
- **결정**: 좌측 Graph 속성 패널은 `기본 / 계약 / 실행 / 정책 / Mock / ADK` 6탭으로 정리하고, `node_kind`, `module_category`, `lane_id`, `container_id`, runtime control 같은 파생/고정값은 직접 편집하지 않는다. 모듈 연결은 신규·미연결·계약 없음 노드에서만 허용한다.
- **배경**: Workbench Graph 편집 화면에서 taxonomy, runtime binding, policy, layout 값이 같은 수준의 편집 가능 필드처럼 보여 사용자가 Graph IR의 책임 축을 잘못 변경할 수 있었다.
- **영향**: `GraphInspector.tsx`, `GraphElementEditor.tsx`, `styles/features/graph.css`, `styles/router/design.css`.

### Design 하단 탭은 사용자 검토 흐름만 남긴다
- **결정**: Design 검토 하단 탭을 `모듈 / Runtime 계약 / Remote A2A / 검토 메모`로 축소한다. 기존 `Graph IR` 노드·엣지 목록 탭은 제거하고, `경로` 하이라이트 기능은 `검토 메모` 안의 섹션으로 통합한다.
- **배경**: `Graph IR` 목록은 캔버스 선택을 보조하는 내부 인덱스에 가까워 업무 사용자의 검토 흐름을 분산시켰고, `경로`는 코멘트와 같은 협업 산출물 성격이어서 독립 탭보다 검토 메모 안에서 보는 편이 명확하다.
- **영향**: `DesignWorkbench.tsx`, `ReviewNotesPanel.tsx`, `designWorkbenchTabs.ts`, `styles/router/design.css`, `styles/router/comments.css`.

## 2026-06-23 · 작업 브랜치 `codex/adk-vllm-runtime-env` — ADK runnable LLM provider를 runtime env에서 선택

- **결정**: runnable runtime-stub의 `LlmAgent`는 Gemini 고정이 아니라 `.agent-factory/runtime.env`를 기준으로 provider를 선택한다. 기본 `AF_LLM_PROVIDER=auto`는 `AF_VLLM_API_BASE` 또는 `AF_VLLM_MODEL`이 있으면 vLLM/OpenAI-compatible `LiteLlm`을 쓰고, 없으면 기존 Gemini fallback을 사용한다.
- **배경**: 오프라인 외부 환경에서는 vLLM으로 OpenAI-compatible 내부 LLM을 서빙하며, artifact마다 provider 설정을 복사하지 않고 중앙 runtime env 하나로 전환해야 한다.
- **영향**: `generate-adk-source.mjs`, `requirements/adk-runtime.txt`, `runtimeEnv.ts`, Build 화면 안내 문구, `validation.md`·`agent-factory-harness.md`.

## 2026-06-29 · 작업 브랜치 `codex/adk-generator-sdk-refactor` — ADK graph lowering 계약을 reviewed Graph IR 필드로 분리

- **결정**: `human_input` node에 `human_input_contract`를 추가해 ADK `RequestInput` message/payload/response schema를 reviewer가 확정하고, `route` edge에 `route_aliases`와 `is_default_route`를 추가해 route matching alias와 fallback branch를 artifact로 저장한다. Generator는 업무별 route 문자열을 하드코딩하지 않고 reviewed Graph IR/scaffold-plan 필드만 사용한다.
- **배경**: 기존 user-confirmation route lowering은 generator 내부의 시나리오별 문자열 fallback에 기대어, 사용자가 설계 화면에서 어떤 승인/반려 입력값을 확정해야 하는지 드러나지 않았다.
- **영향**: Graph IR/process-flow/scaffold-plan schema, soft/export validator, Design GraphElementEditor/Inspector, Build readiness summary, runnable ADK generator와 sample inputs, active docs.

## 2026-06-29 · 작업 브랜치 `stage-shell-hierarchy-redesign` — StageShell compact hierarchy와 desktop QA 기준

- **결정**: `StageShell`의 내부 `실행/검토/승인` navigation을 220px 좌측 레일에서 compact header stepper로 옮긴다. Stage header 아래에는 summary strip과 "다음에 할 일" guidance strip을 두고, Analyze/Design/Build/Verify 각 route가 stage-specific work surface를 소유한다.
- **배경**: 기존 좌측 레일은 stage navigation, approval chip, Graph canvas, Build/Verify 도구면과 폭을 경쟁해 desktop workbench에서도 실제 검토/실행 surface를 좁혔다. 사용 환경은 desktop으로 확정되어 mobile/tablet QA를 acceptance 기준으로 유지할 필요가 없다.
- **영향**: `StageShell`, Analyze/Design/Build/Verify route composition, `stage-shell.css`, route-specific CSS, `docs/visualization/design-system.md`. Approval gate source of truth, schema, analyzer, catalog, server API, generator 계약은 변경하지 않는다.

## 2026-06-30 · 로컬 작업 — Graph IR 선택 패널 정보구조 개선

### Graph Inspector/Editor는 고정 탭 대신 맥락별 그룹을 쓴다
- **결정**: Design Graph IR 선택 패널의 `기본/계약/실행/정책/Mock/ADK` 고정 탭을 `요약`, `입출력`, `흐름`, `호출·런타임`, `검토·리스크`, 조건부 `ADK Skeleton`, `원본` 그룹으로 바꾼다. 선택된 노드/엣지에 실제 데이터가 있는 그룹만 표시한다. Schema ref는 `/api/catalog.contracts`의 contract body를 찾아 인라인 확장 카드로 보여 주고, body가 없으면 연결된 module candidate의 input/output field spec을 fallback schema로 펼친다. `Mock Lab` binding은 Adapter 호출의 런타임 정보로 접고, ADK Skeleton은 `workflow`/`workflow_call` 선택에 관련 contract가 있을 때만 보인다.
- **배경**: 기존 고정 탭은 대부분의 선택에서 빈 `Mock`/`ADK` 탭을 보여 주고, schema ref 이름만 노출해 reviewer가 입출력 구조를 확인할 수 없었다. `input_mapping`/`output_mapping`도 raw JSON으로만 보였고 대상 필드와 source field 방향이 불분명했다.
- **영향**: Design Graph IR `GraphInspector`/`GraphElementEditor`, `/api/catalog` contract index, active visualization design-system docs. Graph IR artifact schema와 approval gate semantics는 바꾸지 않는다.

## 2026-06-29 · 로컬 작업 — catalog-first runtime gap 보정

### A2A readiness와 `input-required`는 chat-ready/final answer가 아니다
- **결정**: Local A2A provider status는 Agent Card health와 semantic `message/send` readiness를 분리한다. Agent Card `HTTP 200`은 chat-ready가 아니며, passive status polling은 `message/send`를 호출하거나 A2A task를 생성하지 않는다. Semantic readiness는 explicit start/probe action의 cached result로만 표시한다. Missing Mock Lab prerequisite(예: `wf-page-recommendation-mock`)은 blocked/prerequisite 상태와 start action으로 노출한다. A2A `input-required`는 final answer가 아니라 interactive task state다. Plain ADK Web text chat은 아직 verified remote HITL resume bridge가 아니므로 full multi-turn remote HITL resume은 별도 후속으로 둔다.
- **배경**: Todo 1-3 확인 결과, Mock Lab start 전 failure는 provider running 상태 뒤에 숨기면 안 되고, Mock Lab start 후 current live provider의 `working` state도 input-required proof나 chat readiness proof가 아니다.
- **영향**: RunSandbox/provider status 문구, runtime validation docs, follow-up status. No private endpoints, credentials, deployment scripts, production persistence, or real customer data.

### Local ADK A2A provider는 Agent Card health까지 검증한다
- **결정**: generated runtime-stub에 `agent.json`과 `af_adk_a2a_server.py`를 포함한다. RunSandbox는 `python af_adk_a2a_server.py --host 127.0.0.1 --port 8001 ... --with_ui .`로 provider를 시작하고, 프로세스 생존이 아니라 Agent Card URL의 valid JSON 응답을 성공 조건으로 삼는다. Design `Remote A2A` 탭의 local provider import는 `stub_ready_for_followup` artifact의 `/runtime-a2a/agent-card`를 읽어 draft 후보/계약/Graph node를 만들며 승인은 자동화하지 않는다.
- **배경**: ADK 2.2/2.3 `api_server --a2a` 경로가 `fast_api.py` 내부 `json` local-scope 버그로 `agent.json` route 등록 전에 실패하는 것을 로컬 source와 HTTP 404로 확인했다. Generated launcher는 ADK FastAPI/Web runner와 A2A executor를 그대로 쓰되, 해당 버그가 있는 source에서만 in-memory patch를 적용한다. 화면 smoke 중 단순 `input -> output` consumer artifact에 provider를 import하면 remote node가 고립되던 문제도 확인되어, 단순 placeholder graph만 `input -> remote -> output`으로 재배선한다.
- **영향**: ADK source generator, RunSandbox A2A provider API/UI, Design Remote A2A local import UI, `req-page-recommendation-a2a-consumer` artifact, active runtime/review docs. 검증: ADK 2.3.0 shared venv에서 provider start `ok:true`, Agent Card `HTTP 200`, status `agent_card_ready:true`.

### Remote A2A runtime policy는 ADK-supported timeout/auth만 생성한다
- **결정**: `A2AContract.adk_runtime_policy`를 추가하고, runnable generator는 `timeout_seconds`를 `RemoteA2aAgent(timeout=...)`로, `bearer_env`/`metadata_env` auth를 `A2aRemoteAgentConfig(request_interceptors=[...])`로만 lower한다. Auth 값은 `AF_A2A_*` env var 이름만 artifact/source에 저장한다. `retry_handoff`와 `fallback_handoff`는 `workflow_manifest.json`, README, `implementation-handoff.md`에 handoff policy로 기록하고 generated retry/fallback runtime wrapper는 만들지 않는다.
- **배경**: ADK current source/docs에서 timeout과 request interceptor는 안정적인 생성 대상이지만, Remote A2A retry/fallback wrapper는 문서화된 runtime contract가 아니었다. 과거 prose `auth/timeout/retry/fallback` 문자열을 파싱하면 reviewer가 승인하지 않은 동작을 생성할 위험이 있다.
- **영향**: A2A schema/types/normalizer, Remote A2A edit surface/readiness gate, artifact validator, runnable generator imports/source, manifest/env/README/handoff output, `scenario-i`/`scenario-e` fixtures, active validation docs.

- **결정**: `RequestInput -> router` lowering은 human-input output dict 전체가 아니라 `response` / `choice` / `value`를 우선 route decision으로 읽는다. 숫자 alias가 있는 route-choice `RequestInput`은 ADK Web의 numeric 입력을 허용하도록 `response_schema=str`를 생략하고 router에서 문자열로 정규화한다. Workbench router node/inspector는 route value, aliases, default, target을 표시한다. Stage Runner는 caller가 catalog payload를 생략하면 active server catalog를 hydrate하고 source/count/diagnostics를 기록한다.
- **배경**: `req-page-recommendation-required` catalog-first ADK Web QA에서 `skip_analysis` 입력이 prompt 전체 문자열의 `run_analysis`에 먼저 매칭되어 분석 branch가 실행됐고, route map과 catalog/runtime contract provenance가 UI와 artifact contract에 충분히 드러나지 않았다.
- **영향**: ADK generator router/human-input emitters, Graph IR schemas and editor/inspector UI, runtime contract normalization/hydration, scaffold catalog binding, Stage Runner request snapshot and summary UI, validation/generator regressions.

### Dynamic/loop Graph IR은 public runnable mode 안의 내부 ADK dynamic builder로 lower한다
- **결정**: `output_mode: "runnable"`을 유지하고, generator가 reviewed dynamic/loop Graph IR shape를 감지하면 내부 ADK dynamic workflow builder를 선택한다. `loop_control`은 reviewed `loop_back`/`loop_exit` decision edge의 `route_condition`/`route_aliases`/default metadata만 사용하며, `dynamic_workflow` container는 runtime `adk_mapping`을 계속 선언하지 않는다.
- **배경**: ADK dynamic workflow는 `@node`와 `ctx.run_node(...)`로 Python control flow를 표현한다. 별도 output mode를 추가하면 기존 Build UI와 scaffold contract가 불필요하게 갈라지고, loop decision을 prose에서 추론하면 reviewer가 승인하지 않은 runtime behavior가 생성될 수 있다.
- **영향**: ADK generator dynamic builder/guards, scaffold-plan blockers, Graph IR soft/export validators, scenario-d loop fixture, active validation/process-flow/workflow docs.

### RunSandbox A2A provider 패널은 consumer가 참조하는 local provider artifact를 대상으로 한다
- **결정**: `/af/:reqId/run`의 A2A provider 패널은 현재 route artifact의 A2A status를 무조건 보지 않는다. Remote A2A 후보가 `owner: local artifact:<providerReqId>`로 승인된 local provider를 가리키면 그 provider artifact의 status/start/stop을 대상으로 하고, 매칭 provider가 없을 때만 현재 artifact provider로 fallback한다.
- **배경**: `req-page-recommendation-a2a-consumer` Run 화면은 실제 provider `req-page-recommendation-required`가 8001에서 실행 중인데도 consumer artifact 자신의 A2A status를 조회해 `A2A provider 가 실행 중이 아닙니다`라고 표시했다. Start 버튼도 consumer reqId로 POST해 실제 호출 대상 provider를 제어하지 못했다.
- **영향**: RunSandbox A2A target resolution, provider panel status/start/stop UX, active runtime validation/design-system docs.

---

## 2026-06-09 이전 (backfill 요약)

- **2026-06-09 · PR #25 (`ada1d7d`)** — generator의 MCP adapter 입력 fallback을 `State.to_dict().items()` 기반으로 수정(worktree-rag-state-fix).
- **2026-06-09 · PR #24 (`352ea8f`)** — Design 검토 화면을 top/bottom split(`af-design-split`)로 재구성: 상단 `[선택 정보 패널 | 캔버스]`, 하단 전폭 탭 패널(`af-design-bottom`). 우측 인라인 Inspector는 `INSPECTOR_ENABLED=false`로 파킹.

> 이전 이력은 git 머지 히스토리(`git log --merges`)를 기준으로 필요 시 추가 backfill 한다.
