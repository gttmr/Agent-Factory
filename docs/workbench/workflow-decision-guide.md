# Workflow Decision Guide

이 문서는 requirement에서 Workflow Agent 경계를 어떻게 판단하고 Graph IR로 어떻게 내리는지 설명한다.
ADK 2.0 Graph Workflow, Dynamic Workflow, Human Input 문서를 기준으로 한다. ADK Python 2.0은 2026년 5월 19일 GA로 문서화되어 있다.

## 기본 원칙

- `workflow_kind` 허용 값은 `orchestration`, `graph`, `dynamic`, `unknown`뿐이다.
- sequence, parallel, loop, human review는 taxonomy 값이 아니라 Graph IR 내부 표현이다.
- Workbench는 Workflow-first Graph Model이다. Workflow는 graph owner이고 Agent/Adapter/Workflow call/Remote A2A call을 언제 실행할지 조율한다.
- Agent는 judgment node다. reasoning owner이며, 필요하면 승인된 MCP toolset 중 어떤 tool을 쓸지 LLM이 선택한다.
- Adapter는 call node다. Workflow가 고정한 API/MCP/retrieval/registry 호출은 `adapter_call`로 표현한다.
- MCP는 category가 아니다. MCP는 `invoke_binding`과 `mock_binding`으로 표현하는 호출 방식이다.
- Adapter 호출이 여러 개라는 사실만으로 Workflow가 필요한 것은 아니다. 실행 순서, 라우팅, 병렬성, 반복, 승인 gate가 설계상 의미 있을 때 Workflow를 둔다.
- Remote A2A는 workflow pattern이 아니다. 독립 원격 agent 계약이 확인될 때만 사용한다.
- Catalog에 등록된 공통 Workflow는 `module_category: workflow`를 유지하면서 `runtime_binding: remote_a2a`로 호출될 수 있다. 이것은 실행 binding이며, 독립 원격 Agent 후보인 `module_category: remote_a2a`와 구분한다.
- ADK Web smoke skeleton 생성 범위에서는 Dynamic Workflow runnable codegen을 생성하지 않는다. `dynamic_workflow`는 design/contract container일 뿐이며, 동적 로직은 하위 Workflow로 분리하고 parent graph에서는 `workflow_call` 노드로 조립한다.

## orchestration

`workflow_kind: orchestration`은 상위 조율 책임이 있지만 explicit graph topology가 아직 핵심 계약으로 확정되지 않았을 때 사용한다.

사용 신호:

- 여러 Agent/Adapter를 묶어 하나의 업무 흐름으로 설명해야 한다.
- 순서와 책임은 보이지만 route key, join, loop control 같은 Graph IR 세부가 아직 부족하다.
- 구현 handoff에서 추가 설계가 필요하다.

Graph IR에는 관찰 가능한 흐름을 최소한으로 드러낸다. 불명확한 branch나 종료 조건은 `needs_info`로 남긴다.

## graph

`workflow_kind: graph`는 ADK 2.0 graph-based workflow처럼 node와 edge가 명시적인 설계 산출물일 때 사용한다.

사용 신호:

- 결정적 route, branch, fan-out, fan-in, join이 보인다.
- 반복 경로와 종료 조건을 edge로 표현할 수 있다.
- human input이 graph 안의 일시정지/재개 node로 들어간다.
- nested workflow node가 parent graph의 일부로 동작한다.

Graph IR 표현:

- 고정 순서는 `normal_transition` edge로 연결한다.
- 병렬은 `parallel_region`, `fan_out`, `join`, `fan_in`으로 표현한다.
- 반복은 `loop_region`, `loop_control`, `loop_back`, `loop_exit`로 표현한다.
- 승인/보완 요청은 `human_review_region`과 `node_kind: human_input`으로 표현한다.
- route는 명시적인 `router` node와 `edge_kind: route`, `route_condition`으로 표현한다.

## existing workflow calls

기존 Workflow 추가/선택 기능은 Graph IR에서 `node_kind: workflow_call`로 저장한다.
`workflow_call`은 공식 subworkflow/existing workflow 호출 노드이며, category를 새로 만들지 않는다.

필수 계약:

- `workflow_ref.id`, `workflow_ref.version`, `workflow_ref.source`, `workflow_ref.display_name`
- `input_schema`, `output_schema` 또는 입출력 port의 schema ref
- `input_mapping`, `output_mapping`
- `adk_skeleton_contract.scaffold_level`

처리 정책:

- target workflow가 존재하면 `workflow_ref`로 연결하고 skeleton 생성 시 workflow call stub을 만든다.
- target workflow skeleton이 아직 없으면 placeholder workflow call stub을 만들고 README와 TODO에 수동 연결 필요를 남긴다.
- target workflow ref가 깨졌거나 입출력 schema가 없으면 `manual_required` 또는 validation warning으로 처리한다.
- dynamic workflow 요청은 "기존 Workflow로 분리한 뒤 workflow_call node로 추가"하도록 안내한다.

## dynamic classification

`workflow_kind: dynamic`은 코드가 런타임 경로를 직접 결정해야 할 때 사용한다.

사용 신호:

- Python 조건문, loop, recursion, async orchestration이 중심이다.
- 호출마다 branch 수나 실행 순서가 달라진다.
- static graph로 표현하면 지나치게 복잡하거나 runtime 값이 있어야만 다음 경로를 알 수 있다.
- ADK dynamic workflow의 `ctx.run_node` 기반 composition, checkpointing, resume semantics가 핵심이다.

`workflow_kind: dynamic`은 분석 분류로는 남아 있지만 이번 skeleton 생성 범위에서는 runnable lowering 대상이 아니다.
Graph IR의 `dynamic_workflow` container는 design/contract container로만 사용하며 runtime `adk_mapping`이나 `dynamic_*` codegen을 만들지 않는다.
관찰 가능한 주요 호출은 별도 `workflow`로 분리하고 parent graph는 `workflow_call`로 조립한다.
종료 조건, max iteration, fallback, escalation은 target Workflow 내부의 수동 구현 TODO로 남긴다.

## ADK Component Routing

| 요구사항 신호 | Agent Factory 판단 | Graph IR 표현 |
|---|---|---|
| 고정 순서 실행 | `workflow_kind: graph` 또는 상위 조율이면 `orchestration` | `normal_transition` edge |
| 독립 작업 병렬 실행 후 병합 | `workflow_kind: graph` | `parallel_region`, `fan_out`, `join`, `fan_in` |
| 품질 충족이나 재시도 반복 | static이면 `graph`, 코드 중심이면 `dynamic` | `loop_region`, `loop_control`, `loop_back`, `loop_exit` |
| 사람 승인 또는 보완 요청 | `workflow_kind: graph` 안의 human input | `human_review_region`, `human_input`, `route` |
| 매 호출마다 코드가 경로 결정 | 하위 Workflow로 분리 후 parent에서는 `workflow_call` | target Workflow 내부 수동 구현 TODO |
| 외부 event를 기다렸다가 재개 | Graph execution semantics | `callback_wait`, `flow_kind: callback/resume`, `call_control: event_callback/resume` |
| 독립 remote agent 호출 | 충분한 계약 증거가 있을 때만 `remote_a2a` | `remote_boundary`, `remote_a2a` edge |

## Mock Lab and skeleton handoff

Adapter 호출 노드는 `node_kind: adapter_call`, `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`, `mock_binding.provider: mock_lab`로 Mock Lab tool을 참조할 수 있다.
이것은 Workflow가 단일 MCP tool을 고정 호출하는 경로다.
Agent가 runtime에 tool을 고르는 경로는 `node_kind: agent`, `invoke_binding: mcp_toolset`, `call_control: selected_by_llm`으로 분리한다.
Mock Lab은 repo 내부 `packages/mock-lab`의 local test double 기능이며, 별도 mock server framework를 만들지 않는다.
생성 bundle의 목표는 production code가 아니라 ADK Web에서 흐름을 확인하는 smoke skeleton handoff다.

생성 bundle은 TODO, `mock_config.yaml`, `sample_inputs.yaml`, `workflow.py`, `nodes/*`, README를 포함한다.
실제 API/EAI endpoint, credential, 운영 배포 설정, 고객 데이터, 확정된 production prompt는 생성하지 않는다.

## User-confirmation gates

사용자가 “추가 분석 실행/건너뛰기”처럼 다음 경로를 직접 선택하는 단계는 Agent 판단이나 rule registry가 아니라 Graph IR gate로 표현한다.

표현 방식:

- 질문 자체는 `node_kind: human_input`, `decision_owner: human`, `call_control: selected_by_human`으로 둔다.
- 사용자의 응답을 branch key로 바꾸는 노드는 `node_kind: router`, `decision_owner: workflow_code`, `call_control: fixed_by_workflow`로 둔다.
- 각 분기는 `edge_kind: route`, `execution_semantics: conditional`, `route_condition`으로 명시한다.
- route 이후 분석을 수행하는 경로는 Adapter/Agent node로 이어지고, 건너뛰기 경로는 다음 human confirmation 또는 handoff node로 직접 이어질 수 있다.

Runnable skeleton generator는 이 static user-confirmation route를 ADK `Event(route=...)`와 Workflow route map으로 lower한다. 반복, runtime-computed dynamic dispatch, Python loop는 여전히 `dynamic_workflow` 후속 범위다.

## ADK MCP 사용 주의

ADK 공식 문서는 repo에 복제하지 않는다.
구현 전에는 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 관련 페이지를 확인한다.
확인한 주요 페이지는 `2.0`, `graphs`, `workflows`, `dynamic`, `human-input`, `ADK with A2A`다.

MCP와 직접 다운로드한 공식 문서가 다르거나 ADK 문서가 현재 taxonomy와 충돌하면 구현을 멈추고 사용자에게 질문한다.
