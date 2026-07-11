# Validation

Agent Factory review artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드, scaffold export, 실행 logic으로 건너뛰지 않게 하는 것이다.
Skill-led DLC 실행은 `artifacts/af/<req-id>/`를 기본 artifact root로 쓰고 `af-run-manifest.json`으로 단계를 연결한다.
Workbench는 Vite 미들웨어(`/api/af/*`, `/api/af-collab/*`, `/api/catalog`, `/api/mock-lab/*`)를 통해 artifact root 디렉터리와 Mock Lab runtime lab을 다루며, `manifest.approvals.*`를 게이트 UI의 단일 진실로 사용한다.
초기 분석 결과는 Analyze Stage Runner 또는 Landing/단계 import 버튼으로 `analysis-result.json`을 artifact root에 적재한다. Analyze/Design Stage Runner 결과는 먼저 `runs/<stage>/<run-id>/proposed-artifacts/`에 저장되고, 사용자가 diff/preview 후 적용할 때 canonical artifact가 갱신된다. Build Stage Runner는 같은 run ledger에 실행 evidence를 남기지만 canonical `runtime-stub/` 출력을 직접 기록하고, Verify Stage Runner는 `validation-report.md`와 `catalog-delta.yaml` proposal을 남긴다.
현재 manifest는 lightweight contract이며 formal JSON Schema는 없다. Workbench parser는 core fields(`requirement_id`, `artifact_root`, `current_stage`, `stages`, `approvals`, `validation`)와 optional `stage_runs`를 tolerant하게 읽는다.
`scripts/validate-artifacts.mjs`는 `af-run-manifest.json`이 있을 때 core fields, stage/status enum, approval boolean, validation command/result, POSIX-style output path, optional `stage_runs` run id/status/output path를 검증한다. `stage_runs.*.latest_run_id`는 `YYYYMMDDTHHMMSSZ-(analyze|design|build|verify)-<6 hex>` 형식으로, 서버 Stage Runner가 기록하는 네 단계 run id를 모두 허용한다. 더 깊은 artifact 존재 추적은 하지 않으며, 최종 artifact 검증은 여전히 `analysis-result.json`, split artifacts, `scaffold-plan.json` schema와 validator 명령을 기준으로 한다. Analyzer/schema/validator enum alignment는 `scripts/validate-artifacts.test.mjs`가 검사하며 `cd packages/web && npm run test:analyzer`에 포함된다.

## module-candidates.json

- `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- `workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나다.
- `agent`는 `agent_kind`, `adapter`는 `adapter_kind`, `remote_a2a`는 `remote_contract_kind`를 포함한다.
- `catalog_entry_id`가 있으면 이 후보는 catalog-bound runtime contract에서 온 항목이다. DesignWorkbench(`/af/:reqId/design`)의 모듈 검토 패널은 원본 catalog entry를 직접 수정하지 않고 현재 분석 artifact의 입력/출력 override와 Graph 연결만 저장한다.
- `status`는 `approved`, `deferred`, `rejected`, `needs_info` 중 하나다.
- `missing_information`은 후보별로 승인 전 필요한 정보를 담는 문자열 배열이다.
- `legacy_recommended_type`은 migration metadata로만 사용한다.

## process-flow.json

`process-flow.json`과 `analysis-result.json:processFlow`는 native Graph IR이어야 한다.

- root에는 `requirement_id`, `graph_id`, `root_workflow_module_id`, `nodes`, `edges`, `containers`, `lanes`, `validation`이 있어야 한다.
- node는 `node_kind`를 사용한다. legacy `type`과 `subtype`은 새 artifact에서 금지된다.
- Workbench는 Workflow-first Graph Model이다. `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 네 값만 유지하고, Graph IR node는 judgment/call/wait/subworkflow semantics를 별도 축으로 저장한다.
- `agent_execution_mode`는 `agent` node에서만 `single_turn` 또는 `chat`을 허용한다. 누락되면 `single_turn`으로 해석하며, `task` 값은 static Graph IR와 runnable source generation에서 거부한다. ADK 2.3 static Workflow가 non-START predecessor 뒤의 chat-mode `LlmAgent`를 거부하므로, runnable generator는 그런 node를 `single_turn`으로 lower하고 reviewed session-state/history 입력으로 대화 맥락을 재구성하라는 projection note를 source와 handoff에 남긴다.
- 고정 MCP Adapter 호출은 `node_kind: adapter_call`, `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`로 검토한다. LLM-selected toolset 경로는 `node_kind: agent`, `invoke_binding: mcp_toolset`, `decision_owner: llm`, `call_control: selected_by_llm`로 검토한다.
- 이 호출 축 구분은 검증으로 강제된다. `node_kind`가 `agent`가 아닌데 `invoke_binding: mcp_toolset` 또는 `call_control: selected_by_llm`를 가지면 export validator와 soft validation 모두 `llm_toolset_requires_agent_node` 오류를 낸다. `selected_by_llm`은 agent 노드 소유 메타데이터이므로 edge의 `call_control: selected_by_llm`도 같은 오류로 거부한다. 즉 `adapter_call`은 LLM-선택 toolset 의미를 가질 수 없고 고정 호출(`mcp_tool` + `fixed_by_workflow`)만 허용하며, toolset 선택은 agent 판단 노드에 둔다.
- `workflow_call`은 공식 subworkflow/existing workflow 호출 노드다. `workflow_ref`가 없으면 skeleton generation은 수동 target resolution warning을 남긴다.
- `callback_wait`와 resume은 category가 아니라 graph execution semantics다. `callback_wait` node는 `flow_kind: callback|resume` 또는 `call_control: event_callback|resume` metadata를 가져야 한다.
- `side_effect`와 `policy`는 node-level governance summary다. 실제 auth/timeout/retry/fallback/data policy/callback resume 계약의 source of truth는 `AnalysisResult.runtimeContracts`와 A2A contract artifact다.
- edge는 `edge_kind`, `execution_semantics`, `data_label`을 사용한다. legacy `edge_type`, `data`, `data_channel`은 새 artifact에서 금지된다.
- node의 `position`은 optional이며 `{ x, y }` numeric object 또는 `null`만 허용한다. 누락된 기존 artifact는 유효하고, 저장된 finite position은 Graph IR canvas의 수동 배치 좌표로 해석한다.
- `parallel_region`은 두 개 이상의 entry node와 join 경로가 있어야 한다.
- `loop_region`은 `loop_back`과 `loop_exit` edge가 있어야 한다.
- `human_input` node는 downstream edge가 있어야 한다.
- `human_input_contract`가 있는 `human_input` node는 reviewed `message`를 가져야 한다. Runnable skeleton은 ADK `RequestInput` 응답 schema로 `null` 또는 `str`만 지원하므로 다른 `response_schema_ref`는 soft validation과 export validator에서 거부한다.
- `route_aliases`와 `is_default_route`는 `edge_kind: route` 또는 `edge_kind: control` + `execution_semantics: loop_back|loop_exit` 결정 edge에서만 허용된다. `route_aliases` 항목은 비어 있으면 안 된다. 같은 router node의 route edge 중 `is_default_route: true`는 최대 하나만 허용하며, loop edge의 기본 exit/back 결정은 dynamic builder 내부 판단에만 쓰고 router fallback 집계에는 포함하지 않는다.
- `dynamic_workflow` container는 Graph IR container다. Runtime `adk_mapping`을 선언하면 `dynamic_workflow_design_only` error가 되지만, `output_mode: runnable`은 reviewed dynamic/loop shape를 감지하면 내부 ADK dynamic workflow builder로 source를 생성할 수 있다.
- runnable scaffold-plan 검증은 generator의 runnable 거부와 일치한다. `output_mode: runnable`에서 `loop_control`은 outgoing `loop_back`과 `loop_exit`을 모두 가져야 하며, 각 loop decision edge는 reviewed `route_condition` 또는 `route_aliases`를 가져야 한다(`loop_exit`은 `is_default_route: true`만으로 기본 exit를 표현할 수 있다). Missing loop decisions are blockers; `workflow_kind: dynamic`과 `dynamic_workflow` container 자체는 더 이상 blanket blocker가 아니다.
- soft validation error `node_missing_module_id`는 export validator의 node kind 규칙을 미리 반영한다. `agent`, `workflow`, `workflow_call`, `adapter`, `adapter_call`, `remote_a2a`, `remote_agent_call` node는 `module_id`가 필요하다. `human_input`과 `callback_wait`는 module-bound component가 아니라 Graph IR execution semantics이므로 `module_id`가 있으면 `node_kind_must_not_bind_module` 오류가 된다.
- soft validation warning `remote_link_incoherent`는 `remote_a2a` edge가 `node_kind === "remote_a2a"` endpoint를 갖지 않거나, 그 remote endpoint node에 `module_id`가 없을 때 표시된다. 경고만 추가하며 기존 export error count를 대신하지 않는다.
- module-bound node는 incoming edge와 outgoing edge를 각각 최소 1개 가져야 한다. 화면에 노드가 렌더링되더라도 고립 후보는 scaffold source가 될 수 없다.
- `remote_a2a` edge는 remote boundary crossing과 A2A contract id를 요구한다.
- export validator는 `remote_a2a` edge의 `a2a_contract_id`가 실제 A2A contract를 가리키는지 확인한 뒤, remote endpoint node가 있으면 `contract.remote_module_id === node.module_id`와 `candidate.a2a_contract_id === edge.a2a_contract_id`도 검사한다. 이 검증은 linkage 정합성만 다루며 runtime codegen을 허용하지 않는다.
- 최종 Graph IR id는 canonical 형식이어야 한다. edge는 `edge-001` 같은 `edge-[0-9]+`, container는 `container-root` 같은 `container-[a-z0-9-]+`를 사용한다.
- DesignWorkbench의 모듈 검토 저장 후 재생성된 Graph IR은 analyzer 재실행 결과가 아니라 사용자가 검토한 module candidate와 입력/출력 연결을 기준으로 만든 artifact다. 기존 Graph IR에 일부 edge만 남아 있으면 유효한 edge metadata는 보존하되, 누락된 후보 연결은 모듈 검토 순서의 fallback edge로 보강해 고립 노드를 만들지 않는다.

## Live analyzer draft schema

`schemas/analysis-draft.schema.json`은 Codex TypeScript SDK 기반 direct analyzer의 내부 반환 계약이다.
이 schema는 저장/export artifact가 아니며, SDK 응답량을 줄이기 위한 compact transport shape다.
워크벤치 UI의 기본 Analyze 경로는 Stage Runner API(`/api/af/:reqId/stages/analyze/run`)다. Stage Runner가 내부적으로 `@openai/codex-sdk`를 통해 proposed `analysis-result.json`을 만든 뒤, apply 시점에 `validateAnalysisResult`가 최종 artifact 형태를 검증한다. `/api/analyze-requirement` SSE compact-draft endpoint도 SDK 기반 direct analyzer primitive로 유지되며, 외부 `af-analyze-requirement` producer가 만든 결과를 Landing/단계 import 버튼으로 적재하는 경로도 유지한다.

- Draft는 `normalizedRequirement`, `evidence`, `moduleCandidates`, `processFlow`의 결정 정보를 담는다.
- Catalog reuse 후보는 반복되는 inputs/outputs/runtime metadata 대신 `catalog_entry_id`와 필요한 override만 담을 수 있다.
- Draft Graph IR은 node/edge 중심의 compact shape를 허용하고, 서버가 containers, lanes, nullable/default fields를 hydrate한다.
- Draft prompt와 schema는 canonical edge/container id 예시를 제공한다. 그래도 runtime은 `e-001`, `c-root` 같은 축약 id를 final artifact 저장/검증 전에 보정하는 방어선을 둔다.
- Graph IR soft validation은 load/migration/client backstop에서 반복 실행될 수 있으므로 structural error를 누적 append하지 않고 현재 정규화 결과 기준으로 다시 계산한다. 이 목록에는 `node_missing_module_id` error와 `remote_link_incoherent` warning도 포함된다.
- Codex TypeScript SDK `outputSchema` structured response 제약 때문에 draft schema의 모든 object는 `properties`의 모든 key를 `required`에 포함하고, 값이 없을 수 있는 필드는 nullable로 표현한다.
- Hydrated 결과는 기존 `AnalysisResult` shape와 validator 기준을 통과해야 한다.
- Draft schema 변경은 analyzer/server contract 변경이므로 `cd packages/web && npm run build` 검증 대상이다.

## Scaffold-plan and ADK Runtime Handoff

`scaffold-plan.json` schema와 template은 현재 ADK Runtime Handoff의 검토 게이트 계약이다.
이 파일은 raw requirement를 실행 가능한 business logic으로 바꾸라는 지시가 아니라, 승인된 module candidate만 source handoff에 포함되는지 검증하는 계약이다.

- source는 `approved_workbench_artifact`여야 한다.
- `approved` candidate만 포함한다.
- raw requirement는 직접 코드 생성 입력이 될 수 없다.
- Catalog-bound Agent, Workflow, Adapter, Remote A2A 항목은 runtime contract로 해석하되, 실제 runtime wiring과 configuration은 reviewed TODO boundary로 남긴다.
- Catalog 항목에 `runtime_mock`이 있으면 ADK Runtime Handoff는 해당 synthetic payload를 generated source의 deterministic stub output으로 포함할 수 있다.
- `runtime_mock`은 local smoke용 test double이며 synthetic data만 허용한다. private endpoint, credential, 실제 고객/은행 데이터, 운영 배포 logic을 담지 않는다.
- generated `agents.config.yaml`, default agent instruction, README, handoff는 한국인 reviewer가 바로 이해할 수 있도록 한글 우선 문구를 사용한다. `Agent`, `Workflow`, `Adapter`, `MCP`, `Graph IR`, field name, enum 같은 기술 식별자는 그대로 유지한다.
- Generated source is an ADK Web smoke skeleton handoff, not production code. `output_mode: runnable` may produce reviewed synthetic ADK Workflow wiring, including an internal ADK dynamic workflow builder for reviewed loop/dynamic Graph IR, for local ADK Web review. It still leaves real API/EAI clients, credentials, deployment, production dynamic business logic, and production prompts as developer TODO boundaries.
- runnable MCP adapter는 tool result의 `structuredContent`를 `structured_content` 아래에 중첩 보존하고, MCP text content `result`와 실제 호출 `arguments`, `input_resolution` 감사 요약도 generated payload에 보존한다. `structured_content` 내부 키는 payload top-level로 다시 복사하지 않는다. 입력 해석은 reviewed Graph IR `input_mapping`, explicit `agents.config.yaml input_map`, state/channel payload, workflow `node_input`, upstream output, semantic user text(`objective_text` 등), reviewed `smoke_spec.synthetic_inputs` 순서로 진행한다. named state/channel payload가 Agent가 출력한 JSON object 문자열이면 이를 파싱해 field를 찾는다. synthetic fallback은 raw requirement가 아니라 승인된 artifact seed에서만 온다. 실행 중 MCP 서버를 통해 파악한 데이터는 payload와 `workflow_manifest.json`에 `runtime_mcp_label: "런타임 MCP"` 및 설명 note로 표시한다.
- `runtime_contracts`는 MCP/EAI/Legacy Adapter, Context Manager, Callback Broker, ADK callback, async resume 계약의 reviewed handoff다. 필수 Runtime 계약이 `approved`가 아니거나 `needs_info` 정책을 남기면 source generation blocker가 된다.
- `a2aContracts`는 Remote A2A 후보의 reviewed handoff다. DesignWorkbench의 `Remote A2A` 탭에서 새 계약 placeholder를 생성하고 계약 본문을 저장할 수 있다. 같은 탭의 local provider import는 `stub_ready_for_followup`인 다른 artifact의 `/runtime-a2a/agent-card`를 읽어 draft Remote A2A 후보/계약/Graph node를 추가한다. 단순 placeholder graph(`input -> output` edge 하나)만 `input -> remote -> output`으로 자동 재배선하며, 후보 승인과 `contract_status: approved`는 자동화하지 않는다. 모든 Remote A2A 후보가 매칭 계약을 갖고 `contract_status: approved`이며 `adk_runtime_policy`까지 readiness issue가 없어야 `runtime_contracts_approved` 게이트를 새로 켤 수 있다.
- `A2AContract.adk_runtime_policy`는 ADK runtime으로 lower할 수 있는 정책과 handoff-only 정책을 분리한다. `timeout_seconds`는 `RemoteA2aAgent(timeout=...)`로, `auth.mode: bearer_env|metadata_env`는 `AF_A2A_*` env var를 읽는 `A2aRemoteAgentConfig` request interceptor로 lower된다. ADK 2.3 계약에 맞춰 interceptor는 `(ctx, a2a_request, params)`를 받고, `params.request_metadata`에 auth metadata를 주입한 뒤 `(a2a_request, params)`를 반환한다. env var가 없으면 `Event(error_message=...)`와 `params`를 tuple로 반환한다. `retry_handoff`와 `fallback_handoff`는 `workflow_manifest.json`, README, `implementation-handoff.md`에 기록하며 generated retry/fallback runtime wrapper는 만들지 않는다.
- `output_mode`는 `smoke`(기본, 부재 시 smoke로 간주) 또는 `runnable`이다. validator는 `smoke`에서 모든 module이 `no_runnable_business_logic: true`와 category별 shell/stub `scaffold_output`을 갖도록, `runnable`에서는 `no_runnable_business_logic: false`와 `scaffold_output: "runnable"`을 갖도록 강제한다.
- `package_name`은 optional Python package override다. 값이 있으면 `^[A-Za-z_][A-Za-z0-9_]*$` 패턴을 통과해야 하며, 없으면 기존처럼 `req_*_adk` 이름을 생성한다.
- `source: approved_workbench_artifact`와 `raw_requirement_to_code: false`는 두 mode 모두에서 불변이다. runnable mode도 raw requirement가 아니라 승인된 artifact에서만 source를 생성한다.
- runnable lowering 지원 범위(ADK 2.x `Workflow`): input/output, module-bound `agent` judgment node, fixed `adapter_call` node, `workflow_call` stub node, 병렬 fan-out + 명시/자동 `JoinNode` fan-in.
- 같은 `module_id`를 여러 Graph IR node가 참조할 수 있다. Generated Python node/function symbol과 ADK node name은 module이 재사용될 때 Graph IR `node.id`로 disambiguate하지만, fallback state channel(`{module_id}_output`)과 reviewed `state_key` semantics는 module/edge 계약 그대로 유지한다. 모듈 재사용은 별도 state channel을 자동 생성하지 않는다.
- `human_input`은 ADK `RequestInput`으로 lower한다. 런타임에서 long-running `adk_request_input`으로 pause 되고 동일 id의 `functionResponse`(`{response: ...}`)로 resume 된다. Generated HITL node는 `human_input_contract.message`를 prompt로 쓰고, `response_schema_ref: "str"`이면 `RequestInput(..., response_schema=str)`를 넣는다. downstream output에는 `{previous, response}`를 함께 담아 확인 응답이 이전 분류/context를 덮어쓰지 않게 한다.
- Remote A2A provider readiness는 Agent Card health와 semantic `message/send` readiness를 분리한다. Agent Card `HTTP 200`은 provider/card endpoint health만 의미하고, chat-ready는 explicit semantic probe가 `completed`처럼 non-interactive success를 반환할 때만 주장한다. Passive `GET /runtime-a2a/status` polling은 `message/send`를 호출하지 않고 마지막 explicit probe 결과만 표시한다. Missing local Mock Lab prerequisite(예: `wf-page-recommendation-mock`)는 `server.status: running` 뒤에 숨기지 않고 blocked/prerequisite 상태와 start action으로 보여준다. A2A task `input-required` 또는 `auth-required`는 reachable-but-interactive state이며 최종 답변이 아니다. Current live provider에서 Mock Lab start 후의 `working` state도 input-required proof가 아니므로 ready로 overclaim하지 않는다. Plain ADK Web text chat은 아직 같은 remote task에 `functionResponse`를 보내는 검증된 HITL resume bridge가 아니며, full multi-turn remote HITL resume은 별도 follow-up이다.
- Reviewed `router` node는 `edge_kind: route` + `execution_semantics: conditional` edge를 ADK `Event(route=..., output=node_input)` 함수와 Workflow route map으로 lower한다. Route 비교 alias는 `route_condition`에서 파생한 route key와 reviewed `route_aliases`만 사용하고, fallback은 같은 router의 `is_default_route: true` edge가 있으면 그 branch를 우선한다. Agent node가 downstream router로 이어지는 경우 generated instruction은 canonical lower-case `route_decision.route_type` 값과 accepted alias를 노출하지만, runtime matching source는 계속 structured route fields와 reviewed aliases다. `route`는 branch 선택 신호이고 payload 전달은 `Event.output`이 담당하므로 route branch의 다음 노드는 router의 `output`을 `node_input`으로 받는다. 이 route support는 user-confirmation gate처럼 static branch key가 명시된 graph에 한정하며, route branch가 같은 downstream node로 합류해도 명시적 `fan_in` edge가 아니면 자동 `JoinNode`를 만들지 않는다.
- 엣지의 데이터 전달 방식 중 `session_state`/`temp_state`/`user_state`/`app_state` 채널은 `state_key`로 lower된다. `state_key`의 정본 형식은 **bare 키**이고 스코프는 `edge_kind`가 결정한다. generator가 스코프 prefix를 적용하며, validator는 bare 키를 허용하고 `edge_kind`와 불일치하는 prefix만 거부한다. producer가 그 키에 기록(agent 단일 채널이면 `output_key`, function 노드는 `ctx.state[키]` 미러)하고, **agent consumer는 instruction에 reviewed state key를 받으며 connected MCP adapter consumer는** `_collect_tool_inputs`의 명명 채널에서 자동으로 읽는다. 비-connected state consumer는 runnable generation blocker로 처리한다. 채널 미지정 엣지는 기존 `{id}_output` 컨벤션으로 fallback해 동작이 불변이다. agent의 상이한 다중 out-state 키, 그리고 동일 `state_key`를 둘 이상의 producer가 쓰는 경우는 거부한다(같은 `ctx.state` 슬롯으로 collapse되어 데이터 유실).
- `artifact` 채널도 lower된다. function 노드가 payload를 JSON `types.Part`로 `save_artifact`하고 connected consumer가 `load_artifact`로 읽는다(import는 artifact 사용 시에만 추가). agent가 만든 artifact 출력, agent/non-connected artifact consumer는 거부한다.
- `remote_a2a`와 `remote_agent_call` 노드도 lower된다. module-bound remote 노드가 승인된 A2A 계약의 `agent_card.agent_card_url`과 `adk_runtime_policy`에서 `RemoteA2aAgent`를 생성한다. `timeout_seconds`는 `timeout=...`으로 들어가고, `bearer_env`/`metadata_env` auth는 ADK 2.3 `before_request(ctx, a2a_request, params)` interceptor가 `AF_A2A_*` env var를 읽어 `params.request_metadata`에 주입하고 `(a2a_request, params)`를 반환한다. env var가 없으면 `Event(error_message=...)`를 `params`와 함께 반환해 remote call을 중단한다. `remote_a2a` 엣지는 둘 중 하나의 remote endpoint에 연결될 때만 `boundary_crossing`/`is_remote_boundary_crossing`을 가질 수 있다(비-remote 엣지는 계속 거부). 계약, `agent_card.agent_card_url`, `adk_runtime_policy`가 없으면 거부하며, `[a2a]` extra와 import는 remote 노드가 있을 때만 추가된다. `retry_handoff`/`fallback_handoff`는 manifest/README/handoff metadata에 남기고 runtime retry/fallback wrapper로 lower하지 않는다.
- Local smoke 검증용 workflow는 reviewed Agent Card URL을 구체 값으로 저장할 수 있다. 예: `req-adk-a2a-chat-ui-workflow`는 `http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk/.well-known/agent-card.json`을 사용한다. 이는 private endpoint나 credential이 아니며, production endpoint/auth는 계속 runtime env/config override로 둔다.
- Reviewed loop/dynamic shape가 있으면 public `output_mode: "runnable"`은 내부 ADK dynamic workflow builder를 선택한다. Generated source는 `@node(name="dynamic_workflow", rerun_on_resume=True)` + `ctx.run_node(...)` + Python `while`로 loop body를 실행하고, `loop_control`의 reviewed `loop_back`/`loop_exit` aliases/default를 `_dynamic_should_continue(...)`에 사용한다. 반복 상태는 `ctx.state["af_dynamic_loop:<loop-control-id>"]`에 남기며, generated skeleton은 안전 상한 `_MAX_DYNAMIC_LOOP_ITERATIONS = 3`을 둔다. 이 lowering은 wiring smoke용이며 production retry/fallback/business-loop logic은 여전히 developer TODO boundary다.
- `callback_wait`는 runnable production behavior로 lower하지 않는다.
- reviewed agent-owned MCP toolset은 `node_kind: agent` + `invoke_binding: mcp_toolset` + `decision_owner: llm` + `call_control: selected_by_llm`일 때 ADK 2.3.0 `LlmAgent(..., tools=[McpToolset(...)])`로 lower한다. ADK constructor에는 `toolsets`가 아니라 `tools` 인자를 사용한다.
- fixed MCP Adapter call은 `node_kind: adapter_call` + complete `invoke_binding: mcp_tool` + `call_control: fixed_by_workflow` + linked `mock_binding`이 있어야 ADK Web smoke wiring이 가능하다. `adapter_call + selected_by_llm`은 invalid/out of scope이며 LLM-selected MCP toolset을 deterministic adapter_call로 변환하지 않는다. BuildWorkbench runnable mode에서는 `/api/mock-lab/mcp-discovery`로 확인한 running tool을 reviewer가 명시적으로 선택해 Mock Lab binding을 저장한다.
- `af-build-runtime-stub` output은 기본적으로 ignored local artifact인 `artifacts/af/<req-id>/runtime-stub/`에 생성한다. smoke는 synthetic TODO handoff를, runnable은 reviewed synthetic wiring(`LlmAgent` + Mock Lab MCP)을 emit하되 두 mode 모두 private endpoint, credential, 실데이터를 담지 않는다. Runnable `LlmAgent`는 `.agent-factory/runtime.env` 기준으로 LLM을 고른다: `AF_VLLM_API_BASE` 또는 `AF_VLLM_MODEL`이 있으면 vLLM/OpenAI-compatible `LiteLlm`, 없으면 `GOOGLE_API_KEY` 기반 Gemini fallback이다. `AF_LLM_PROVIDER=vllm|gemini`로 강제할 수 있고 기본은 `auto`다.

현재 ADK Runtime Handoff의 기본 Workbench 경로는 server-owned compound action이다.

- `/af/:reqId/build` (BuildWorkbench)의 primary action은 `계약 동기화 + runtime-stub 재생성`이다. 이 action은 `POST /api/af/:reqId/artifact-sync/run`을 호출해 한 번의 관찰 가능한 흐름으로 derived artifact sync, `scaffold-plan.json` 작성, `runtime-stub/` 재생성, artifact validation을 수행한다. Body는 `outputMode: "smoke" | "runnable"`, `rebuildRuntimeStub`, `runValidation`, `streamProgress`를 받을 수 있고, SSE 모드에서는 `start` → `sync` → generation stdout/stderr → validation stdout/stderr → `done` 순서로 진행 상태를 보낸다.
- 정확한 artifact 순서는 다음과 같다. 1. Design에서 검토된 Graph IR을 저장하면 `analysis-result.json.processFlow`만 갱신한다. 2. Build의 artifact sync가 `analysis-result.json`에서 split derived artifacts(`normalized-requirement.json`, `module-candidates.json`, `process-flow.json`)를 다시 쓴다. 3. 같은 서버 흐름이 `analysis-result.json`과 hydrated catalog index에서 `scaffold-plan.json`을 도출해 쓴다. 4. `scripts/generate-adk-source.mjs artifacts/af/<req-id> artifacts/af/<req-id>/runtime-stub`로 `runtime-stub/`을 재생성한다. 5. `node scripts/validate-artifacts.mjs artifacts/af/<req-id>`를 실행하고 결과를 `manifest.validation`에 기록한다. 6. `analysis_reviewed`, `boundaries_approved`, `runtime_contracts_approved`, `stub_ready_for_followup` approval gate는 reviewer가 별도로 판단해 토글한다.
- `artifact-sync/run` 성공 또는 실패는 approval gate를 자동으로 켜거나 끄지 않는다. Graph IR 저장, split sync, scaffold-plan 작성, runtime-stub 생성, validation 실행은 산출물 정합성 작업이고, 승인 상태는 `manifest.approvals.*`의 reviewer decision으로만 바뀐다.
- 기존 manual Build controls는 별도/advanced 경로로 유지된다. `POST /api/af/:id/runtime-stub/build`는 저장된 `scaffold-plan.json` 기준으로 generator만 실행한다. Verify는 실행 표면이 하나다: Verify Stage Runner panel이 커맨드 선택을 소유하고 `POST /api/af/:id/verify/run` allow-list primitive를 감싸 run history를 남긴다(별도 직접 실행 레인 없음). Build/Verify Stage Runner panels는 compound action의 server contract와 다른 artifact 순서를 만들면 안 된다.
- `runnable`에서는 Mock Lab MCP 바인딩 패널이 running tool discovery를 보여주고, reviewer가 선택한 adapter 바인딩을 저장한다. 실행에 필요한 `AF_VLLM_*`, `GOOGLE_API_KEY` 같은 공유 secret은 repo root의 `.agent-factory/runtime.env` 또는 `AF_RUNTIME_ENV_FILE`이 가리키는 파일에 둔다. 생성된 파일 목록과 텍스트 미리보기(< 500KB)를 노출하고 `implementation-handoff.md`를 inline 편집한다. BuildWorkbench는 `StageShell`로 1실행(sync·stub 생성·validation)·2검토(stub 파일·handoff)·3승인(`stub_ready_for_followup`)으로 나뉜다. ADK 런타임 연결은 BuildWorkbench가 아니라 게이트 없는 `실행` 화면에 있다(아래 `/af/:reqId/run` 참고).
- `/af/:reqId/run` (RunSandbox, 승인 게이트 없음)은 `runtime-stub/`이 존재하면 공유 ADK venv(`.agent-factory/runtime/.venv`, 또는 `AF_ADK_VENV_DIR`)의 `adk`로 로컬 `adk api_server --with_ui`를 별도 포트(`8765`)에서 시작/중지하며 상태를 폴링하고, ADK 공식 dev UI(`web_url`)를 새 탭으로 연다. 같은 화면의 ADK A2A provider 패널은 Remote A2A 후보의 `owner: local artifact:<reqId>`를 우선 해석해 현재 consumer artifact가 호출할 local provider artifact를 대상으로 status/start/stop을 수행한다. 매칭되는 local provider가 없으면 현재 artifact의 generated `af_adk_a2a_server.py`를 공유 Python으로 실행해 8001에서 Agent Card/RPC endpoint를 노출한다. 이 provider start는 프로세스 생존만으로 성공하지 않고 Agent Card URL이 유효한 card JSON을 반환해야 `running`으로 인정하지만, Agent Card health만으로 chat-ready를 뜻하지는 않는다. Passive status polling은 process/Agent Card/Mock Lab prerequisite만 확인하고 `message/send`를 호출하지 않는다. Explicit start/probe 결과로 얻은 semantic `message/send` readiness, local Mock Lab prerequisite state, `input-required` interactive state는 별도 표시해야 한다. `input-required` 이벤트가 task id, context id, interrupt id, function name을 모두 제공하면 Workbench는 `POST /api/af/:reqId/runtime-a2a/resume`로 provider RPC endpoint에 A2A JSON-RPC `message/send`를 보내며, payload는 `metadata.adk_type = "function_response"`인 DataPart와 `{ id, name, response: { result } }` 구조를 사용한다. 이 resume bridge는 ADK Web 텍스트 채팅과 별도이며, task/context/interrupt id는 runtime state로만 보관하고 catalog, Graph IR, `analysis-result.json`, `scaffold-plan.json`, generated source에 persist하지 않는다. 웹은 Python dependency를 설치하지 않는다. 수동 준비 기준은 repo root의 `requirements/adk-runtime.txt`이며, 시작된 PID와 시작 시점 runtime-stub fingerprint는 `runtime-stub/.adk/`의 로컬 runtime registry에 기록하므로 Workbench 재시작 후에도 같은 런타임을 재인식하고 중지할 수 있다. 현재 fingerprint가 달라지면 RunSandbox는 stale 경고와 명시적 재시작 버튼을 표시하며 자동 재시작하지 않는다. AF 자체 간이 챗은 제거했다(ADK가 `--with_ui`로 완성도 높은 chat/trace UI를 이미 제공). RunSandbox는 중앙 runtime env를 child process env로 주입하므로 키가 spawn argv에 노출되지 않으며, generated `agent.py`도 직접 실행 fallback으로 같은 중앙 env 파일을 로드한다. Windows + LiteLLM 호환을 위해 child process env에는 `PYTHONUTF8=1`도 기본 주입한다.
- `/af/:reqId/verify` (VerifyWorkbench)는 Verify Stage Runner panel 하나로 실행한다: panel의 controls에서 고정 allow-list(`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) 세 명령 중 하나를 선택해 실행하면 서버 primitive가 child_process로 실행하고 stdout/stderr를 캡처해 `manifest.validation.{commands,last_result}`에 기록하며, run history와 `validation-report.md`/`catalog-delta.yaml` proposal template을 남긴다. `validation-report.md`와 `catalog-delta.yaml`은 inline 편집할 수 있다.
- Stage Runner panel은 process stdout/stderr를 `실행 로그`로 표시한다 — 실행 중에는 실시간으로, 과거 run을 선택하면 그 run의 `process_event` 이벤트에서 동일하게 렌더한다. exit 결과는 실패 시 run 이벤트 메시지(exit code 포함)와 run별 proposed `validation-report.md`(`exit_code`·stdout·stderr 기록)로 확인한다.

Generated Workbench artifacts under `artifacts/` are local-only and ignored by Git. Canonical seed catalog files under `catalog/` remain versioned because the workbench and Mock Lab load them as source inputs; generated catalog changes are first recorded as per-run `catalog-delta.yaml` proposals inside ignored artifact roots. Reviewed proposals may then be published through the Reuse Hub `등록 승인` `POST /api/catalog/publish` path, the single app write path for catalog YAML. Publish re-serializes the target YAML canonically, preserving semantics while allowing formatting churn that must be reviewed in the eventual human PR diff. Workflow A2A conversion uses the same proposal and approval path: `A2A 가능하게 변경` appends a workflow proposal with `component_source: remote_a2a`, `runtime_binding: remote_a2a`, `a2a_provider_req_id`, and contract status, and publish must validate that provider artifact root plus already-present Agent Card data before writing a versioned workflow row. The publish validator is read-only for provider runtime artifacts and must not create or refresh `runtime-stub/**/agent.json`. Default workflow reuse remains a local `workflow_call` unless this explicit conversion has been approved.

PR6 마이그레이션 전에 제공하던 `Smoke 일괄 실행` 매크로와 in-iframe `adk web` 임베딩은 워크벤치에 다시 추가하지 않는다. 현재는 게이트 없는 `실행` 화면(`/af/:reqId/run`)이 ADK 런타임 연결을 관리하고 ADK 공식 dev UI로 **링크**만 한다(iframe 임베드 아님, AF 자체 챗 아님). smoke 번들은 승인된 handoff의 synthetic `runtime_mock` payload와 TODO boundary만 노출하고, runnable 번들은 reviewed synthetic ADK `Workflow` wiring(runtime-env-selected `LlmAgent` + 연결된 Mock Lab MCP adapter)을 실행한다. 두 mode 모두 private endpoint, credential, 실제 고객/은행 데이터, 운영 배포 logic을 포함하지 않는다. VerifyWorkbench allow-list는 그대로 유지된다.

## Missing-information 2계층 게이트

분석 후 발생하는 누락 정보는 요구사항 수준과 후보 수준에서 다르게 다룬다.

- **Requirement-level (`evidence.missing_information`) — soft gate.** `/af/:reqId/analyze` (AnalyzeWorkbench)에서 항목별 "수용" 토글이 제공된다. 토글은 `analysis-result.json`의 `evidence.accepted_missing_information`(optional string array)에 즉시 저장되어 리로드 후에도 유지되며, reviewer attestation으로만 사용하고 scaffold-plan 생성은 차단하지 않는다. `analysis_reviewed` 게이트는 모든 항목이 수용된 뒤에야 활성화된다.
- **Candidate-level (`ModuleCandidate.missing_information`, unresolved `status === "needs_info"`) — hard gate.** 누락 항목이 남아 있거나 Resolution Draft가 적용되지 않은 후보는 `approved`로 전환할 수 없다. Resolution Draft 적용은 Design Stage Runner(`af-design-boundaries`) 또는 동일 형태를 emit하는 외부 producer가 먼저 `runs/design/<run-id>/proposed-artifacts/`에 제안하고, reviewer가 diff/preview 후 apply할 때 canonical `analysis-result.json`에 반영한다.
- **Resolved review state.** 채워진 후보 record는 기존 누락 항목을 `resolved_missing_information`에 보존하고 `missing_information`을 비운다. 카탈로그 계약 후보도 동일 review state만 수정하며 카탈로그 원본 contract는 잠긴 상태로 유지된다.
- **Scaffold-plan blocker.** `missing_information.length > 0`이거나 `status === "needs_info"`인 후보가 남아 있으면 `scaffoldPlan.collectBlockers`는 "정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요." blocker와 동일 개수의 "정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요" warning을 emit한다. BuildWorkbench는 이 blocker가 남아 있으면 `runtime-stub/build` POST를 차단한다.

## Artifact root 저장소

PR6 마이그레이션 이후 워크벤치는 in-browser save record(`SavedAnalysisRecord`)를 운용하지 않는다. `artifacts/af/<req-id>/`가 단일 저장소이며 다음 파일을 보관한다.

- `af-run-manifest.json` — stage status, approval gate, 마지막 validation 결과.
- `runs/<stage>/<run-id>/` — Stage Runner request, event stream, result summary, diff summary, proposed artifacts, diagnostics.
- `analysis-result.json` 및 분할 산출물(`commonization-notes.json`, `boundary-design.md`). Remote A2A 계약은 `analysis-result.json.a2aContracts`가 정본이다 — 구 아티팩트 루트의 분리 `a2a-contracts.json`은 레거시 잔재로, artifact-sync가 파생하지 않고 검증기/생성기도 읽지 않는다.
- `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`.
- `validation-report.md`, `catalog-delta.yaml`.
- `collaboration/{comments,highlights}.json`.

워크벤치는 위 경로를 `/api/af/*`, `/api/af-collab/*`로 직접 읽고 쓴다. `localStorage`는 최근 artifact root 캐시(`agent-factory:recent-artifact-roots`)와 댓글 composer 작성자 식별(`agent-factory:author-{name,role}`)만 보관한다.
`analysis-result.json`이 canonical source이고 split JSON files는 derived convenience artifact다. Graph IR 편집 저장은 `analysis-result.json.processFlow`만 바꾸며, Build의 `POST /api/af/:reqId/artifact-sync/run`이 그 canonical artifact에서 split files를 동기화한 뒤 `scaffold-plan.json`, `runtime-stub/`, validation까지 이어간다. 이 저장소 정합화는 approval 상태를 뜻하지 않으므로 `manifest.approvals.*`는 reviewer가 별도로 토글한다.

### Saved-analysis fixture

`templates/saved-analysis-fixtures/`는 더 이상 UI 주입용이 아니다. 현재는 `scripts/validate-artifacts.mjs`가 `SavedAnalysisRecord` shape를 regression smoke로 검증하기 위한 fixture로만 쓴다.

- `catalog-needs-info.json`: 요구사항 수준 누락은 reviewer attestation으로 수용 가능하지만, 후보 수준 `ModuleCandidate.missing_information`은 승인과 source generation을 막는지 검증한다.
- `catalog-scaffold-ready.json`: 승인된 catalog-bound 후보가 `scaffoldReady=true`로 저장돼 source 생성 게이트를 통과하는지 검증한다.

fixture는 `moduleCandidates`를 top-level record와 `analysis.moduleCandidates` 양쪽에 같은 id/order로 저장해야 한다. validator는 두 위치를 함께 검증한다.

## Catalog contract registry

`catalog/contracts/`는 catalog entry를 mock 목록으로 바꾸지 않고, test double을 만들 수 있는 runtime contract 본문을 보관한다.

- `catalog/contracts/mcp/*.json`: `mcp_schema_ref`가 가리키는 MCP tool contract다. 각 파일은 `inputSchema`, `outputSchema`, `success_examples`, `error_examples`, `mock_response.structuredContent`를 포함한다.
- `catalog/contracts/a2a/*.json`: `runtime_binding: remote_a2a` 또는 Remote A2A 검토에 쓰는 A2A contract 본문이다. Agent Card, interface, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy와 synthetic task examples를 포함한다.
- A2A-capable workflow catalog rows are not stored here; they stay in `catalog/workflows.yaml` as `module_category: workflow` rows with remote runtime metadata and provider pointer.

MCP/A2A fixture data는 synthetic sample만 사용한다. private endpoint, credential, deployment script, 실제 고객/은행 데이터는 catalog contract registry에 넣지 않는다.

## 검증 명령

```bash
node scripts/validate-artifacts.mjs templates
node scripts/validate-artifacts.mjs templates/regression-scenarios
node scripts/validate-artifacts.mjs templates/saved-analysis-fixtures
node scripts/validate-artifacts.mjs catalog/contracts
node scripts/validate-artifacts.mjs artifacts/af/<req-id>
node scripts/generate-adk-source.mjs artifacts/af/<req-id> artifacts/af/<req-id>/runtime-stub
cd artifacts/af/<req-id>/runtime-stub && python3 -B -m pytest -q -p no:cacheprovider
cd packages/web && npm run test:analyzer
cd packages/web && npm run build
```

문서만 변경한 경우에는 build 대신 구조와 링크 검증을 우선한다.
TypeScript, React, analyzer, schema, validator logic을 변경한 경우에는 `cd packages/web && npm run test:analyzer`와 `cd packages/web && npm run build`를 실행한다. `npm run test:analyzer`는 web analyzer/server tests뿐 아니라 root `scripts/validate-artifacts.test.mjs` enum-alignment test와 `scripts/generate-adk-source.test.mjs` regression도 실행한다.
scaffold-plan 또는 ADK source generator를 직접 변경한 경우에는 `node scripts/generate-adk-source.mjs ...`, `python3 -m compileall ...`, generated stub `pytest` smoke를 추가한다. Runtime chat bridge를 검증할 때는 generated stub directory에서 `adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .`를 실행한 뒤 `runtime-chat-smoke.json`을 `/run`에 전송한다.

## ADK 공식 문서 확인

ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다.
이번 taxonomy 기준은 `https://adk.dev/llms.txt`에서 출발해 `2.0`, `graphs`, `workflows`, `dynamic`, `human-input`, `a2a` 문서를 확인한 결과에 맞춘다.
공식 문서 다운로드본과 MCP 결과가 다르거나 모호하면 사용자에게 질문한다.
