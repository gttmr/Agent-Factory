# Taxonomy

이 문서는 Agent Factory 분석 워크벤치의 단일 활성 taxonomy 기준이다.
값은 `packages/web/src/analyzer/types.ts`, `schemas/`, `scripts/validate-artifacts.mjs`와 맞아야 한다.

## ADK 확인 기준

2026-05-22 기준으로 `adk-docs-mcp`에서 `list_doc_sources -> https://adk.dev/llms.txt -> fetch_docs` 순서로 다음 문서를 확인했다.
2026-07-03 기준 active taxonomy와 Runtime Handoff target은 ADK 2.3이다. ADK Python 2.0 GA는 Graph/Dynamic/A2A 분류의 역사적 기준이고, 현재 설치·검증 target은 `google-adk` 2.3.0이다.

- `https://adk.dev/2.0/index.md`: ADK Python 2.0 GA는 2026년 5월 19일 release로 문서화되어 있고, graph-based workflows, dynamic workflows, collaborative workflows를 핵심 기능으로 둔다.
- `https://adk.dev/graphs/index.md`: graph-based workflows는 Agents, Tools, Functions를 node로 두고 edge로 routing, branching, state management를 정의한다.
- `https://adk.dev/workflows/index.md`: ADK workflows는 graph-based, dynamic, collaborative, template workflow를 구분한다.
- `https://adk.dev/a2a/index.md`: ADK A2A는 remote A2A agent와의 통신을 다루며 local sub-agent, adapter, MCP tool 호출과 구분한다.
- 릴리스 기준: ADK Python 2.0 GA(2026-05-19) 이후 2.1(2026-05-23), 2.2(2026-06-04), 2.3(2026-06-18)을 거쳐 현재 target을 2.3으로 둔다. 2.1 -> 2.3 사이에 generated code에 영향을 주는 API rename은 확인되지 않았다.

이 워크벤치는 ADK 2.3 Graph IR을 기본 표현으로 쓰되, private deployment code나 credentials를 생성하지 않는다.

## Workbench Graph Model

Agent Factory Workbench는 Workflow-first Graph Model이다.
`module_category`는 재사용·검토 책임의 축이고, Graph IR의 `node_kind`/`invoke_binding`/`call_control`/`mock_binding`은 실행 그래프 안에서 그 책임을 어떻게 호출하거나 대기할지 나타내는 축이다.

- Workflow가 graph owner다. 순서, branch, join, loop intent, callback wait/resume, subworkflow call은 Workflow Graph IR 안에서 표현한다.
- Agent는 judgment node다. 판단, 요약, 분류, 추천, triage, LLM toolset 선택처럼 추론 책임을 가진다.
- Adapter는 call node다. API, retrieval, registry, computation, external service 호출은 `adapter_call`로 표현한다.
- MCP는 category가 아니다. MCP는 `invoke_binding`, `mock_binding`, catalog/runtime contract로 표현하는 호출 방식이다.
- Remote A2A는 독립 원격 agent protocol boundary일 때만 사용한다.

## module_category

허용되는 `module_category` 값은 네 개뿐이다.

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

불명확하면 새 category를 만들지 말고 evidence, missing information, assumption을 남긴다.

## catalog runtime binding

Catalog에 등록된 개체는 재사용 가능한 runtime contract다.
현재 local MVP에서는 ADK smoke를 완성된 입출력 shape로 실행하기 위해 seed catalog가 deterministic synthetic `runtime_mock`을 함께 가질 수 있다.
`runtime_mock`은 test double이며, 실제 고객/은행 데이터, private endpoint, credential, deployment script, 운영 business logic을 담지 않는다.
Skill-led 실행은 검토 artifact를 `artifacts/af/<req-id>/` 아래에 둘 수 있다. 이 파일들도 동일한 schema와 catalog runtime-binding 규칙을 따라야 한다.

`module_category`는 책임의 종류를 나타내고, `runtime_binding`은 module candidate 또는 catalog entry의 실행/연결 방식을 나타낸다.
Graph IR 노드별 실제 호출 방식은 `invoke_binding`과 `call_control`을 우선 읽는다.

- `runtime_binding: direct_api`: 실제 API/EAI client로 보강될 호출 경계다. 생성 skeleton에는 endpoint나 credential을 넣지 않는다.
- `runtime_binding: mcp_tool`: MCP server/tool 계약으로 호출한다. 로컬 skeleton smoke에서는 Mock Lab binding을 통해 synthetic tool을 호출할 수 있다.
- `runtime_binding: local_function`: 로컬 함수 placeholder 또는 개발자 보강 경계다.
- `runtime_binding: workflow_call`: 기존 Workflow 또는 생성 예정 Workflow skeleton을 호출하는 parent graph node다.
- `runtime_binding: remote_a2a`: Remote A2A 방식으로 호출되는 runtime contract다.
- `runtime_binding: ui_input`: 사람 입력/승인 지점이다.
- `runtime_binding: unresolved`: 실행 방식이 아직 확정되지 않았다.

공통 Workflow는 여러 도메인에서 원격 실행 경계로 호출될 수 있으므로 catalog에서는 `module_category: workflow`와 `runtime_binding: remote_a2a`를 함께 사용할 수 있다.
이 경우에도 독립 원격 Agent 자체를 새로 설계한다는 증거가 없으면 `module_category: remote_a2a` 후보를 새로 만들지 않는다.

### Graph invoke binding

Graph IR의 호출 축은 category가 아니라 node-level binding이다.

- `invoke_binding: mcp_tool` + `call_control: fixed_by_workflow`: Workflow가 정한 단일 MCP tool을 `adapter_call` 노드가 호출한다. Mock Lab smoke 연결은 `mock_binding.provider: mock_lab`로만 저장한다.
- `invoke_binding: mcp_toolset` + `call_control: selected_by_llm`: Agent가 승인된 MCP toolset 중에서 런타임에 tool을 선택한다. 이 경우 호출 선택권은 `decision_owner: llm`인 agent/toolset path에 있고, deterministic `adapter_call`로 모델링하지 않는다.
- `invoke_binding: internal_workflow`: 기존 Workflow 또는 생성 예정 Workflow skeleton을 `workflow_call` 노드로 호출한다.
- `invoke_binding: callback_wait`: callback 대기와 resume을 Graph IR execution semantics로 표시한다. 별도 module category가 아니다.

### versioned catalog entry

Reuse Hub `등록 승인`이 `POST /api/catalog/publish`로 추가하는 entry는 버전 메타데이터를 함께 가진다.

- `id`: `<category>-<name>` 형태의 안정 식별자.
- `version`: 같은 `(category, name)`에 대해 publish마다 1씩 증가하는 정수.
- `status`: `published` 또는 `deprecated`. 새 버전을 publish하면 같은 이름의 이전 항목이 `deprecated`로 표시된다.
- `provenance: catalog_published`와 출처 추적용 `published_at`, `published_from`(source req-id), 선택적 `source_candidate_id`.
- Workflow entry가 `component_source: remote_a2a` 및 `runtime_binding: remote_a2a`로 노출되면 `a2a_provider_req_id`로 제공자 artifact root를 가리킨다. `published_from`은 publish provenance로만 사용하며 provider id로 대체하지 않는다.

Catalog hydration(`useCatalog`)은 이름 기준으로 중복을 제거하면서 `deprecated`를 제외하고 최고 `version`만 Reuse Hub에 노출한다. 이 필드들은 additive이며, seed 항목(버전 메타데이터 없음)도 그대로 유효하다.

## runtimeContracts

`AnalysisResult.runtimeContracts`는 callback과 runtime support 경계를 검토하는 별도 artifact다. 다음 항목은 top-level `module_category`를 새로 만들지 않아도 Runtime 계약으로 검토할 수 있다.

- MCP/EAI/Legacy Adapter contract
- Context Manager contract
- Callback Broker contract
- ADK callback responsibilities
- async resume contract

필수 Runtime 계약은 `contract_status: approved`가 되기 전까지 scaffold-plan의 blocker로 남는다. 실제 endpoint, credential, private customer payload, deployment script는 이 artifact에 넣지 않는다.

## agent_kind

`module_category: agent`일 때만 사용한다.

- `specialist`
- `shared`

Agent는 판단, 요약, 분류, 추천, triage처럼 추론 책임을 가진 경계다.

## workflow_kind

`module_category: workflow`일 때만 사용한다.

- `orchestration`
- `graph`
- `dynamic`
- `unknown`

Workflow는 큰 의미의 Workflow Agent 경계다.
순차 실행, 병렬 fan-out/fan-in, 반복, 사람 승인 gate는 더 이상 `workflow_kind` 값이 아니다.
그 작은 흐름은 `processFlow` Graph IR의 `node_kind`, `container_kind`, `edge_kind`, `execution_semantics`로 표현한다.

- `orchestration`: 여러 Agent/Adapter/Workflow를 상위에서 조율하지만 아직 명시적 graph topology가 핵심 산출물이 아닐 때.
- `graph`: ADK 2.3 graph-based workflow처럼 node와 edge, route, join, loop, human input이 명시적인 설계 산출물일 때.
- `dynamic`: Python 조건문, loop, recursion, `ctx.run_node` 같은 코드가 런타임 경로를 직접 결정할 때.
- `unknown`: 요구사항 증거가 부족해 workflow subtype을 확정할 수 없을 때.

`workflow_kind: dynamic`과 `container_kind: dynamic_workflow`는 Graph IR에서 runtime 경로가 코드로 결정되는 흐름을 보존한다.
`dynamic_workflow` container는 runtime `adk_mapping`을 선언하지 않는다. Runnable generation은 reviewed dynamic/loop shape를 감지하면 public `output_mode: "runnable"` 안에서 내부 ADK dynamic workflow builder를 선택할 수 있다.
Generator가 만드는 dynamic Python은 `@node` + `ctx.run_node(...)` wiring skeleton과 reviewed loop decision handling까지이며, 실제 production business loop/fallback/escalation logic은 생성 bundle의 TODO 경계 안에서 전문 개발자가 보강한다.

## Graph IR call nodes

Workbench Graph IR는 책임 분류와 실행 노드를 분리한다.

- `node_kind: agent`: Workflow 안의 판단/추론 노드다. LLM이 toolset을 고르는 경우 `invoke_binding: mcp_toolset`, `decision_owner: llm`, `call_control: selected_by_llm`으로 표현한다.
- `node_kind: adapter_call`: Workflow가 고정 호출하는 Adapter capability 노드다. 단일 MCP tool 호출은 `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`로 표현하고 Mock Lab 연계는 `mock_binding`에 저장한다.
- `node_kind: router`: 조건 분기 노드다.
- `node_kind: human_input`: 사람 입력/승인 노드다.
- `node_kind: callback_wait`: callback wait/resume 지점이다. `flow_kind: callback|resume` 또는 `call_control: event_callback|resume` edge semantics와 함께 검토한다.
- `node_kind: workflow_call`: 공식 subworkflow/existing workflow 호출 노드다. 기존 Workflow, catalog Workflow, artifact Workflow, 또는 target skeleton을 parent graph에 조립한다.
- `node_kind: remote_agent_call`: Remote A2A 계약을 가진 외부 Agent 호출 노드다.

legacy node kind `adapter`, `workflow`, `remote_a2a`, `tool`, `function`은 legacy/migration 호환을 위해서만 유효하며, 새로 작성하는 노드는 call-node kind `adapter_call`, `workflow_call`, `remote_agent_call`을 우선 사용한다.

`workflow_call`은 `workflow_ref`, `input_schema`, `output_schema`, `input_mapping`, `output_mapping`, `adk_skeleton_contract`를 가질 수 있다.
target workflow가 아직 없으면 placeholder skeleton을 만들고 README/TODO에 수동 연결 필요를 남긴다.

`adapter_call`은 `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`와 함께 `mock_binding.provider: mock_lab`를 가질 수 있다.
Mock Lab은 `packages/mock-lab`의 local test double이며 catalog runtime contract를 mock으로 바꾸지 않는다.
최소 binding은 `provider`, `package_path`, `mock_server_id`, `tool_name`, `input_schema`, `output_schema`, `sample_response_ref`, `status`다.
`status: linked`일 때만 ADK Web smoke용 mock wiring을 생성한다.

`side_effect`와 `policy`는 node-level governance summary다.
이 필드는 그래프 검토와 UI 배지에 필요한 요약만 담고, auth/timeout/retry/fallback/data policy/callback resume 같은 source of truth는 `AnalysisResult.runtimeContracts`와 Remote A2A contract artifact에 둔다.

## adapter_kind

`module_category: adapter`일 때만 사용한다.

- `legacy_api`
- `retrieval`
- `rule_registry`
- `data_query`
- `template`
- `computation`
- `external_service`
- `unknown`

Adapter는 Agent나 Workflow가 호출하는 callable capability다.
MCP tool, 외부 tool server, retrieval, grounding, rule registry는 독립 원격 agent 계약이 확인되지 않는 한 Adapter 쪽에서 먼저 검토한다.
Catalog의 Adapter는 기본적으로 실제 MCP 계약을 가진 runtime binding으로 등록한다.

## remote_contract_kind

`module_category: remote_a2a`일 때만 사용한다.

- `a2a`
- `unknown`

Remote A2A는 독립 소유, 독립 배포, agent card 또는 discovery, 요청/응답 schema, task lifecycle, auth, timeout, retry, fallback, audit, data policy가 확인되는 원격 agent 프로토콜 경계다.
local graph가 복잡하거나 branch, join, loop, human input을 포함한다는 이유만으로 `remote_a2a`를 만들지 않는다.

현재 repo의 A2A artifact 계약은 기존 A2A 1.0/latest vocabulary를 유지한다. ADK 공식 A2A 페이지는 experimental로 표기되어 있으므로, 프로토콜 버전 변경은 별도 작업에서 검토한다.

## 더 이상 최상위가 아닌 것

- `Tool/Adapter`는 top-level category가 아니다.
- `Knowledge Retrieval`은 `module_category: adapter`, `adapter_kind: retrieval`로 표현한다.
- `Metadata Registry`와 관리되는 업무 규칙은 `module_category: adapter`, `adapter_kind: rule_registry`로 표현한다.
- `legacy_recommended_type`은 migration metadata일 뿐 primary classifier가 아니다.
