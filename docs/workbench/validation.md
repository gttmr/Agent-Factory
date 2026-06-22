# Validation

Agent Factory review artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드, scaffold export, 실행 logic으로 건너뛰지 않게 하는 것이다.
Skill-led DLC 실행은 `artifacts/af/<req-id>/`를 기본 artifact root로 쓰고 `af-run-manifest.json`으로 단계를 연결한다.
Workbench는 Vite 미들웨어(`/api/af/*`, `/api/af-collab/*`, `/api/catalog`, `/api/mock-lab/*`)를 통해 artifact root 디렉터리와 Mock Lab runtime lab을 다루며, `manifest.approvals.*`를 게이트 UI의 단일 진실로 사용한다.
초기 분석 결과는 Analyze Stage Runner 또는 Landing/단계 import 버튼으로 `analysis-result.json`을 artifact root에 적재한다. Stage Runner 결과는 먼저 `runs/<stage>/<run-id>/proposed-artifacts/`에 저장되고, 사용자가 diff/preview 후 적용할 때 canonical artifact가 갱신된다.
현재 manifest는 lightweight contract이며 formal JSON Schema는 없다. Workbench parser는 core fields(`requirement_id`, `artifact_root`, `current_stage`, `stages`, `approvals`, `validation`)와 optional `stage_runs`를 tolerant하게 읽는다.
`scripts/validate-artifacts.mjs`는 `af-run-manifest.json`이 있을 때 core fields, stage/status enum, approval boolean, validation command/result, POSIX-style output path, optional `stage_runs` run id/status/output path를 검증한다. 더 깊은 artifact 존재 추적은 하지 않으며, 최종 artifact 검증은 여전히 `analysis-result.json`, split artifacts, `scaffold-plan.json` schema와 validator 명령을 기준으로 한다.

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
- `agent_execution_mode`는 `agent` node에서만 `single_turn` 또는 `chat`을 허용한다. 누락되면 `single_turn`으로 해석하며, `task` 값은 static Graph IR와 runnable source generation에서 거부한다.
- 고정 MCP Adapter 호출은 `node_kind: adapter_call`, `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`로 검토한다. LLM-selected toolset 경로는 `node_kind: agent`, `invoke_binding: mcp_toolset`, `decision_owner: llm`, `call_control: selected_by_llm`로 검토한다.
- `workflow_call`은 공식 subworkflow/existing workflow 호출 노드다. `workflow_ref`가 없으면 skeleton generation은 수동 target resolution warning을 남긴다.
- `callback_wait`와 resume은 category가 아니라 graph execution semantics다. `callback_wait` node는 `flow_kind: callback|resume` 또는 `call_control: event_callback|resume` metadata를 가져야 한다.
- `side_effect`와 `policy`는 node-level governance summary다. 실제 auth/timeout/retry/fallback/data policy/callback resume 계약의 source of truth는 `AnalysisResult.runtimeContracts`와 A2A contract artifact다.
- edge는 `edge_kind`, `execution_semantics`, `data_label`을 사용한다. legacy `edge_type`, `data`, `data_channel`은 새 artifact에서 금지된다.
- node의 `position`은 optional이며 `{ x, y }` numeric object 또는 `null`만 허용한다. 누락된 기존 artifact는 유효하고, 저장된 finite position은 Graph IR canvas의 수동 배치 좌표로 해석한다.
- `parallel_region`은 두 개 이상의 entry node와 join 경로가 있어야 한다.
- `loop_region`은 `loop_back`과 `loop_exit` edge가 있어야 한다.
- `human_input` node는 downstream edge가 있어야 한다.
- `dynamic_workflow` container는 design/contract container다. Runtime `adk_mapping`을 선언하면 `dynamic_workflow_design_only` error가 되며 runnable dynamic codegen은 생성하지 않는다.
- soft validation error `node_missing_module_id`는 export validator의 node kind 규칙을 미리 반영한다. `agent`, `workflow`, `workflow_call`, `adapter`, `adapter_call`, `remote_a2a`, `remote_agent_call` node는 `module_id`가 필요하다. `human_input`과 `callback_wait`는 module-bound component가 아니라 Graph IR execution semantics이므로 `module_id`가 있으면 `node_kind_must_not_bind_module` 오류가 된다.
- soft validation warning `remote_link_incoherent`는 `remote_a2a` edge가 `node_kind === "remote_a2a"` endpoint를 갖지 않거나, 그 remote endpoint node에 `module_id`가 없을 때 표시된다. 경고만 추가하며 기존 export error count를 대신하지 않는다.
- module-bound node는 incoming edge와 outgoing edge를 각각 최소 1개 가져야 한다. 화면에 노드가 렌더링되더라도 고립 후보는 scaffold source가 될 수 없다.
- `remote_a2a` edge는 remote boundary crossing과 A2A contract id를 요구한다.
- export validator는 `remote_a2a` edge의 `a2a_contract_id`가 실제 A2A contract를 가리키는지 확인한 뒤, remote endpoint node가 있으면 `contract.remote_module_id === node.module_id`와 `candidate.a2a_contract_id === edge.a2a_contract_id`도 검사한다. 이 검증은 linkage 정합성만 다루며 runtime codegen을 허용하지 않는다.
- 최종 Graph IR id는 canonical 형식이어야 한다. edge는 `edge-001` 같은 `edge-[0-9]+`, container는 `container-root` 같은 `container-[a-z0-9-]+`를 사용한다.
- DesignWorkbench의 모듈 검토 저장 후 재생성된 Graph IR은 analyzer 재실행 결과가 아니라 사용자가 검토한 module candidate와 입력/출력 연결을 기준으로 만든 artifact다. 기존 Graph IR에 일부 edge만 남아 있으면 유효한 edge metadata는 보존하되, 누락된 후보 연결은 모듈 검토 순서의 fallback edge로 보강해 고립 노드를 만들지 않는다.

## Live analyzer draft schema

`schemas/analysis-draft.schema.json`은 live Codex CLI의 내부 반환 계약이다.
이 schema는 저장/export artifact가 아니며, CLI 출력량을 줄이기 위한 compact transport shape다.
워크벤치 UI의 기본 Analyze 경로는 Stage Runner API(`/api/af/:reqId/stages/analyze/run`)다. Stage Runner가 내부적으로 Codex CLI 또는 skill 실행을 수행하고 proposed `analysis-result.json`을 만든 뒤, apply 시점에 `validateAnalysisResult`가 최종 artifact 형태를 검증한다. `/api/analyze-requirement` SSE compact-draft endpoint는 direct analyzer primitive로 유지되며, 외부 `af-analyze-requirement` producer가 만든 결과를 Landing/단계 import 버튼으로 적재하는 경로도 유지한다.

- Draft는 `normalizedRequirement`, `evidence`, `moduleCandidates`, `processFlow`의 결정 정보를 담는다.
- Catalog reuse 후보는 반복되는 inputs/outputs/runtime metadata 대신 `catalog_entry_id`와 필요한 override만 담을 수 있다.
- Draft Graph IR은 node/edge 중심의 compact shape를 허용하고, 서버가 containers, lanes, nullable/default fields를 hydrate한다.
- Draft prompt와 schema는 canonical edge/container id 예시를 제공한다. 그래도 runtime은 `e-001`, `c-root` 같은 축약 id를 final artifact 저장/검증 전에 보정하는 방어선을 둔다.
- Graph IR soft validation은 load/migration/client backstop에서 반복 실행될 수 있으므로 structural error를 누적 append하지 않고 현재 정규화 결과 기준으로 다시 계산한다. 이 목록에는 `node_missing_module_id` error와 `remote_link_incoherent` warning도 포함된다.
- Codex `--output-schema` response format 제약 때문에 draft schema의 모든 object는 `properties`의 모든 key를 `required`에 포함하고, 값이 없을 수 있는 필드는 nullable로 표현한다.
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
- Generated source is an ADK Web smoke skeleton handoff, not production code. `output_mode: runnable` may produce reviewed synthetic ADK Workflow wiring for local ADK Web review, but it still leaves real API/EAI clients, credentials, deployment, dynamic runtime logic, and production prompts as developer TODO boundaries.
- runnable MCP adapter는 tool result의 `structuredContent`를 generated payload에 보존하고, 다음 adapter 입력이 upstream output/session state에 없을 때만 reviewed `smoke_spec.synthetic_inputs`를 synthetic fallback으로 사용한다. 이 fallback도 raw requirement가 아니라 승인된 artifact seed에서만 온다. 실행 중 MCP 서버를 통해 파악한 데이터는 payload와 `workflow_manifest.json`에 `runtime_mcp_label: "런타임 MCP"` 및 설명 note로 표시한다.
- `runtime_contracts`는 MCP/EAI/Legacy Adapter, Context Manager, Callback Broker, ADK callback, async resume 계약의 reviewed handoff다. 필수 Runtime 계약이 `approved`가 아니거나 `needs_info` 정책을 남기면 source generation blocker가 된다.
- `a2aContracts`는 Remote A2A 후보의 reviewed handoff다. DesignWorkbench의 `Remote A2A` 탭에서 새 계약 placeholder를 생성하고 계약 본문을 저장할 수 있다. 모든 Remote A2A 후보가 매칭 계약을 갖고 `contract_status: approved`이며 readiness issue가 없어야 `runtime_contracts_approved` 게이트를 새로 켤 수 있다.
- `output_mode`는 `smoke`(기본, 부재 시 smoke로 간주) 또는 `runnable`이다. validator는 `smoke`에서 모든 module이 `no_runnable_business_logic: true`와 category별 shell/stub `scaffold_output`을 갖도록, `runnable`에서는 `no_runnable_business_logic: false`와 `scaffold_output: "runnable"`을 갖도록 강제한다.
- `package_name`은 optional Python package override다. 값이 있으면 `^[A-Za-z_][A-Za-z0-9_]*$` 패턴을 통과해야 하며, 없으면 기존처럼 `req_*_adk` 이름을 생성한다.
- `source: approved_workbench_artifact`와 `raw_requirement_to_code: false`는 두 mode 모두에서 불변이다. runnable mode도 raw requirement가 아니라 승인된 artifact에서만 source를 생성한다.
- runnable lowering 지원 범위(ADK 2.x 그래프 `Workflow`): input/output, module-bound `agent` judgment node, fixed `adapter_call` node, `workflow_call` stub node, 병렬 fan-out + 명시/자동 `JoinNode` fan-in, 그리고 `human_input` 노드(`RequestInput`). `human_input`은 런타임에서 long-running `adk_request_input` 으로 pause 되고 동일 id의 `functionResponse`(`{response: ...}`)로 resume 된다. Reviewed `router` node는 `edge_kind: route` + `execution_semantics: conditional` edge를 ADK `Event(route=...)` 함수와 Workflow route map으로 lower한다. 이 route support는 user-confirmation gate처럼 static branch key가 명시된 graph에 한정하며, route branch가 같은 downstream node로 합류해도 명시적 `fan_in` edge가 아니면 자동 `JoinNode`를 만들지 않는다. 엣지의 데이터 전달 방식 중 `session_state`/`temp_state`/`user_state`/`app_state` 채널은 `state_key`로 lower된다. `state_key`의 정본 형식은 **bare 키**이고 스코프는 `edge_kind`가 결정한다 — generator가 스코프 prefix를 적용하며, validator는 bare 키를 허용하고 `edge_kind`와 불일치하는 prefix만 거부한다. producer가 그 키에 기록(agent 단일 채널이면 `output_key`, function 노드는 `ctx.state[키]` 미러)하고 **connected MCP adapter consumer만** `_collect_tool_inputs`의 명명 채널에서 자동으로 읽는다(다른 소비 노드는 producer 기록까지만 — agent-consumer 명명 읽기는 후속). 채널 미지정 엣지는 기존 `{id}_output` 컨벤션으로 fallback해 동작이 불변이다. agent의 상이한 다중 out-state 키, 그리고 동일 `state_key`를 둘 이상의 producer가 쓰는 경우는 거부한다(같은 `ctx.state` 슬롯으로 collapse되어 데이터 유실). `artifact` 채널도 lower된다 — function 노드가 payload를 JSON `types.Part`로 `save_artifact`하고 connected consumer가 `load_artifact`로 읽는다(import는 artifact 사용 시에만 추가). agent가 만든 artifact 출력은 거부한다. agent-consumer 명명 읽기는 후속이다. `remote_a2a`와 `remote_agent_call` 노드도 lower된다 — module-bound remote 노드가 `RemoteA2aAgent(agent_card=<승인된 A2A 계약의 agent_card_url>, use_legacy=False)`로 생성되고, `remote_a2a` 엣지는 둘 중 하나의 remote endpoint에 연결될 때만 `boundary_crossing`/`is_remote_boundary_crossing`을 가질 수 있다(비-remote 엣지는 계속 거부). 계약이 없거나 `agent_card.agent_card_url`이 없으면 거부하며, `[a2a]` extra와 import는 remote 노드가 있을 때만 추가된다. `loop_control`/`loop_back`/`loop_exit`, `callback_wait`, `selected_by_llm` toolset selection, `dynamic_workflow`는 runnable production behavior로 lower하지 않는다. ADK 2.x 기준 반복 루프는 dynamic workflow 영역이며, 이 skeleton scope에서는 design/contract로만 남긴다.
- fixed MCP Adapter call은 complete `invoke_binding: mcp_tool` + `call_control: fixed_by_workflow` + linked `mock_binding`이 있어야 ADK Web smoke wiring이 가능하다. LLM-selected MCP toolset은 `invoke_binding: mcp_toolset` + `call_control: selected_by_llm`로 별도 검토하며 deterministic adapter_call로 변환하지 않는다. BuildWorkbench runnable mode에서는 `/api/mock-lab/mcp-discovery`로 확인한 running tool을 reviewer가 명시적으로 선택해 Mock Lab binding을 저장한다.
- `af-build-runtime-stub` output은 기본적으로 ignored local artifact인 `artifacts/af/<req-id>/runtime-stub/`에 생성한다. smoke는 synthetic TODO handoff를, runnable은 reviewed synthetic wiring(`LlmAgent` + Mock Lab MCP)을 emit하되 두 mode 모두 private endpoint, credential, 실데이터를 담지 않는다.

현재 ADK Runtime Handoff는 두 단계로 나뉘어 있다.

- `/af/:reqId/build` (BuildWorkbench)는 분석 + `/api/catalog` hydrated catalog index를 입력으로 client-side에서 `scaffold-plan.json`을 도출해 artifact root에 PUT하고, `POST /api/af/:id/runtime-stub/build`로 `scripts/generate-adk-source.mjs`를 spawn해 `runtime-stub/`을 채운다. Scaffold plan 패널의 `smoke` / `runnable` 토글이 `output_mode`를 결정한다. `runnable`에서는 Mock Lab MCP 바인딩 패널이 running tool discovery를 보여주고, reviewer가 선택한 adapter 바인딩을 저장한다. 실행에 필요한 `GOOGLE_API_KEY` 같은 공유 secret은 repo root의 `.agent-factory/runtime.env` 또는 `AF_RUNTIME_ENV_FILE`이 가리키는 파일에 둔다. 생성된 파일 목록과 텍스트 미리보기(< 500KB)를 노출하고 `implementation-handoff.md`를 inline 편집한다. BuildWorkbench는 `StageShell`로 1실행(scaffold·stub 생성)·2검토(stub 파일·handoff)·3승인(`stub_ready_for_followup`)으로 나뉜다. ADK 런타임 연결은 BuildWorkbench가 아니라 게이트 없는 `실행` 화면에 있다(아래 `/af/:reqId/run` 참고).
- `/af/:reqId/run` (RunSandbox, 승인 게이트 없음)은 `runtime-stub/`이 존재하면 `runtime-stub/.venv`에 ADK dependency를 설치하고, 로컬 `adk api_server --with_ui`를 별도 포트(`8765`)로 시작/중지하며 상태를 폴링하고, ADK 공식 dev UI(`web_url`)를 새 탭으로 연다. 시작된 PID는 `runtime-stub/.adk/`의 로컬 runtime registry에 기록하므로 Workbench 재시작 후에도 같은 런타임을 재인식하고 중지할 수 있으며, 같은 포트를 막는 다른 ADK `api_server`는 포트 소유 PID로 표시하고 중지할 수 있다. AF 자체 간이 챗은 제거했다(ADK가 `--with_ui`로 완성도 높은 chat/trace UI를 이미 제공). RunSandbox는 중앙 runtime env를 child process env로 주입하므로 키가 spawn argv에 노출되지 않으며, generated `agent.py`도 직접 실행 fallback으로 같은 중앙 env 파일을 로드한다.
- `/af/:reqId/verify` (VerifyWorkbench)는 고정 allow-list(`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) 세 명령만 child_process로 실행하고 stdout/stderr를 캡처해 `manifest.validation.{commands,last_result}`에 기록한다. `validation-report.md`와 `catalog-delta.yaml`을 inline 편집한다.

Generated Workbench artifacts under `artifacts/` are local-only and ignored by Git. Canonical seed catalog files under `catalog/` remain versioned because the workbench and Mock Lab load them as source inputs; generated catalog changes are first recorded as per-run `catalog-delta.yaml` proposals inside ignored artifact roots. Reviewed proposals may then be published through the Reuse Hub `등록 승인` `POST /api/catalog/publish` path, the single app write path for catalog YAML. Publish re-serializes the target YAML canonically, preserving semantics while allowing formatting churn that must be reviewed in the eventual human PR diff.

PR6 마이그레이션 전에 제공하던 `Smoke 일괄 실행` 매크로와 in-iframe `adk web` 임베딩은 워크벤치에 다시 추가하지 않는다. 현재는 게이트 없는 `실행` 화면(`/af/:reqId/run`)이 ADK 런타임 연결을 관리하고 ADK 공식 dev UI로 **링크**만 한다(iframe 임베드 아님, AF 자체 챗 아님). smoke 번들은 승인된 handoff의 synthetic `runtime_mock` payload와 TODO boundary만 노출하고, runnable 번들은 reviewed synthetic ADK `Workflow` wiring(Gemini `LlmAgent` + 연결된 Mock Lab MCP adapter)을 실행한다. 두 mode 모두 private endpoint, credential, 실제 고객/은행 데이터, 운영 배포 logic을 포함하지 않는다. VerifyWorkbench allow-list는 그대로 유지된다.

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
- `analysis-result.json` 및 분할 산출물(`commonization-notes.json`, `boundary-design.md`, `a2a-contracts.json`).
- `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`.
- `validation-report.md`, `catalog-delta.yaml`.
- `collaboration/{comments,highlights}.json`.

워크벤치는 위 경로를 `/api/af/*`, `/api/af-collab/*`로 직접 읽고 쓴다. `localStorage`는 최근 artifact root 캐시(`agent-factory:recent-artifact-roots`)와 댓글 composer 작성자 식별(`agent-factory:author-{name,role}`)만 보관한다.

### Saved-analysis fixture

`templates/saved-analysis-fixtures/`는 더 이상 UI 주입용이 아니다. 현재는 `scripts/validate-artifacts.mjs`가 `SavedAnalysisRecord` shape를 regression smoke로 검증하기 위한 fixture로만 쓴다.

- `catalog-needs-info.json`: 요구사항 수준 누락은 reviewer attestation으로 수용 가능하지만, 후보 수준 `ModuleCandidate.missing_information`은 승인과 source generation을 막는지 검증한다.
- `catalog-scaffold-ready.json`: 승인된 catalog-bound 후보가 `scaffoldReady=true`로 저장돼 source 생성 게이트를 통과하는지 검증한다.

fixture는 `moduleCandidates`를 top-level record와 `analysis.moduleCandidates` 양쪽에 같은 id/order로 저장해야 한다. validator는 두 위치를 함께 검증한다.

## Catalog contract registry

`catalog/contracts/`는 catalog entry를 mock 목록으로 바꾸지 않고, test double을 만들 수 있는 runtime contract 본문을 보관한다.

- `catalog/contracts/mcp/*.json`: `mcp_schema_ref`가 가리키는 MCP tool contract다. 각 파일은 `inputSchema`, `outputSchema`, `success_examples`, `error_examples`, `mock_response.structuredContent`를 포함한다.
- `catalog/contracts/a2a/*.json`: `runtime_binding: remote_a2a` 또는 Remote A2A 검토에 쓰는 A2A contract 본문이다. Agent Card, interface, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy와 synthetic task examples를 포함한다.

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
TypeScript, React, analyzer, schema, validator logic을 변경한 경우에는 `cd packages/web && npm run test:analyzer`와 `cd packages/web && npm run build`를 실행한다.
scaffold-plan 또는 ADK source generator를 직접 변경한 경우에는 `node scripts/generate-adk-source.mjs ...`, `python3 -m compileall ...`, generated stub `pytest` smoke를 추가한다. Runtime chat bridge를 검증할 때는 generated stub directory에서 `adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .`를 실행한 뒤 `runtime-chat-smoke.json`을 `/run`에 전송한다.

## ADK 공식 문서 확인

ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다.
이번 taxonomy 기준은 `https://adk.dev/llms.txt`에서 출발해 `2.0`, `graphs`, `workflows`, `dynamic`, `human-input`, `a2a` 문서를 확인한 결과에 맞춘다.
공식 문서 다운로드본과 MCP 결과가 다르거나 모호하면 사용자에게 질문한다.
