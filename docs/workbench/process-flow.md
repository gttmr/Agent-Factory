# Process Flow

Process Flow는 `AnalysisResult.processFlow`에 저장되는 ADK 2.0 Graph IR artifact다.
필드 이름은 migration compatibility 때문에 `processFlow`를 유지하지만, 내부 shape는 legacy stage-flow가 아니다.

## Graph IR Root

필수 root 필드:

- `requirement_id`
- `graph_id`
- `root_workflow_module_id`
- `nodes`
- `edges`
- `containers`
- `lanes`
- `validation`

새 artifact는 legacy `type`, `subtype`, `edge_type`, `data`, `data_channel` 필드를 내보내면 안 된다.
validator는 이 필드가 새 Graph IR에 남아 있으면 실패시킨다.

## ID 규칙

최종 저장/export Graph IR은 canonical ID 형식을 사용한다.

- edge id: `edge-001`, `edge-002`, `edge-003`
- container id: `container-root`, `container-human-review`, `container-parallel-customer-data`

`e-001`, `c-root`, `c-human-review` 같은 축약형은 최종 artifact에서 허용하지 않는다.
Live analyzer draft가 축약형을 반환하더라도 workbench runtime은 저장/검증 전에 canonical 형식으로 보정한다.
`node.container_id`와 `container.parent_container_id`는 보정된 container id를 참조해야 한다.

## Node

허용되는 `node_kind`:

- `input`
- `output`
- `agent`
- `function`
- `tool`
- `adapter`
- `adapter_call`
- `human_input`
- `callback_wait`
- `workflow`
- `workflow_call`
- `remote_a2a`
- `remote_agent_call`
- `join`
- `router`
- `loop_control`

`input`, `output`, `join`, `router`, `loop_control`은 synthetic node이며 `module_id: null`이어야 한다.
Workbench는 Workflow-first Graph Model이다. 새로 작성되는 업무 그래프에서 Workflow가 graph owner이고, Agent는 judgment node, Adapter는 call node, 기존 Workflow 재사용은 subworkflow call node다.
`agent`, `workflow`, `workflow_call`, `adapter`, `adapter_call`, `remote_a2a`, `remote_agent_call`은 module-bound node이며 matching module candidate와 연결한다.
`adapter`와 `workflow` node kind는 legacy/migration 표현을 위해 남아 있지만, 새 호출 노드는 고정 Adapter 호출에 `adapter_call`, 기존 Workflow 또는 target skeleton 호출에 `workflow_call`을 우선 사용한다.
사람 승인이나 보완 요청은 workflow subtype이 아니라 `node_kind: human_input`으로 둔다.
`human_input` node가 ADK `RequestInput`으로 내려갈 때 reviewer가 입력해야 하는 계약은 `human_input_contract`다. `message`는 화면/ADK pause prompt로 쓰이는 reviewed 질문 문구이고, `payload_schema_ref`는 같이 보여줄 payload shape, `response_schema_ref`는 응답 schema ref다. 현재 runnable skeleton은 ADK free-text resume 특성에 맞춰 `null` 또는 `str`만 자동 lower하며, 구조화 응답 변환은 후속 수동 구현 범위다.
외부 callback을 기다렸다가 resume하는 지점은 새 category가 아니라 `node_kind: callback_wait`과 edge `flow_kind: callback|resume`, `call_control: event_callback|resume`로 표현한다.
`position`은 선택 필드이며 `{ x: number, y: number }` 또는 `null`이다. 값이 없으면 UI가 dagre로 자동 배치하고, finite position이 있으면 GraphCanvas가 그 좌표를 그대로 사용해 수동 배치를 보존한다.
`agent_execution_mode`는 `agent` 노드에서만 선택적으로 사용하며 허용값은 `single_turn`, `chat`, `null`이다. 값이 없으면 `single_turn`으로 해석한다. `task`는 static Graph IR node 선택값으로 열지 않고, 별도 workflow reuse나 delegation topology 설계로 다룬다.

## Node execution metadata

`module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 네 값만 유지한다.
MCP, callback, side effect, policy는 category가 아니라 Graph IR 실행 메타데이터다.

- `invoke_binding`: 노드가 어떤 방식으로 호출되는지 나타낸다. 예: `mcp_tool`, `mcp_toolset`, `internal_workflow`, `callback_wait`, `remote_a2a`.
- `decision_owner`: 호출 선택권이 workflow code, LLM, human, remote agent, system 중 어디에 있는지 나타낸다.
- `call_control`: 호출이 workflow에 의해 고정됐는지(`fixed_by_workflow`), LLM이 선택하는지(`selected_by_llm`), callback/resume인지(`event_callback`, `resume`) 나타낸다.
- `mock_binding`: Mock Lab smoke 연결이다. MCP를 category로 바꾸지 않고 `provider: mock_lab` binding만 저장한다.
- `side_effect`, `policy`: graph review용 node-level governance summary다. 실제 auth/timeout/retry/fallback/data policy/callback resume 계약의 source of truth는 `AnalysisResult.runtimeContracts`와 Remote A2A contract artifact다.

고정 MCP Adapter 호출은 `node_kind: adapter_call`, `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`로 표현한다.
LLM이 MCP toolset에서 tool을 고르는 경로는 `node_kind: agent`, `invoke_binding: mcp_toolset`, `decision_owner: llm`, `call_control: selected_by_llm`으로 표현한다.
`input_mapping`과 `output_mapping`은 module-bound node의 runnable 입력/출력 계약이다. key는 대상 node/module의 field 이름이고 value는 upstream payload, named state channel, 또는 workflow context 안에서 찾을 source field 이름이다. ADK source generator는 connected MCP adapter 입력을 해석할 때 이 reviewed mapping을 `agents.config.yaml input_map`보다 먼저 적용한다.
`node_kind: workflow_call`은 공식 subworkflow/existing workflow 호출 노드이며 `workflow_ref`, `input_schema`, `output_schema`, `input_mapping`, `output_mapping`, `adk_skeleton_contract`를 가질 수 있다.

## Container

허용되는 `container_kind`:

- `graph_workflow`
- `dynamic_workflow`
- `parallel_region`
- `loop_region`
- `human_review_region`
- `remote_boundary`

작은 흐름은 container와 edge semantics로 표현한다.
병렬은 `parallel_region`, 반복은 `loop_region`, 사람 검토는 `human_review_region`, 원격 agent 경계는 `remote_boundary`다.
`dynamic_workflow`는 Graph IR container이며 runtime `adk_mapping`을 선언하면 안 된다. Runnable source generation은 reviewed dynamic/loop shape를 감지하면 public `output_mode: "runnable"` 안에서 내부 ADK dynamic workflow builder를 선택할 수 있다.
시각화에서 container는 node를 다시 배치하는 독립 lane이 아니라, 전체 workflow 안에 있는 node bounds에서 파생되는 region overlay다.
따라서 `parallel_region`, `human_review_region`, `remote_boundary`는 workflow 외부 슬롯으로 분리하지 않고 일반 흐름 위에 겹쳐 표시한다.
Design 편집 모드에서 새 local node는 parent 없는 첫 `graph_workflow`/`dynamic_workflow` 컨테이너에 기본 배치된다.
노드의 `container_id`를 폼에서 옮기면 기존 모든 container의 `contains_node_ids`, `entry_node_ids`, `exit_node_ids`에서 해당 node id를 제거한 뒤 새 container의 `contains_node_ids`에만 중복 없이 추가한다.

## Edge

허용되는 `edge_kind`:

- `event_output`
- `event_message`
- `session_state`
- `temp_state`
- `user_state`
- `app_state`
- `artifact`
- `route`
- `control`
- `remote_a2a`

허용되는 `execution_semantics`:

- `normal_transition`
- `fan_out`
- `fan_in`
- `loop_back`
- `loop_exit`
- `conditional`
- `boundary_crossing`

`route` edge에는 `route_condition`이 필요하다. `route`는 branch 선택 신호이며 업무 payload 전달은 router node의 `Event.output` 또는 별도 state/artifact edge가 담당한다.
`route_aliases`는 사용자가 실제로 입력할 수 있는 승인/반려 문구, 숫자, 업무 용어 같은 reviewed alias 목록이다. Generator는 hard-coded 업무 문자열을 넣지 않고 `route_condition`에서 뽑은 route key와 이 alias 목록만 비교한다. 같은 router에서 fallback으로 쓸 branch는 `is_default_route: true`로 하나만 지정할 수 있다. `loop_back`/`loop_exit` control edge도 dynamic loop decision을 위해 `route_condition`, `route_aliases`, `is_default_route`를 쓸 수 있지만 router fallback 집계에는 포함하지 않는다.
`artifact` edge에는 `artifact_key`가 필요하다.
`remote_a2a` edge는 `is_remote_boundary_crossing: true`와 `a2a_contract_id`가 필요하고, local graph 복잡도만으로 만들 수 없다.

## Workflow 표현 규칙

- 고정 순서: `normal_transition`
- 병렬: `parallel_region` + `fan_out` + `join` + `fan_in`
- 반복: `loop_region` + `loop_control` + `loop_back` + `loop_exit`
- 사람 검토: `human_review_region` + `human_input` + 승인/반려 `route`
- 동적 제어: `dynamic_workflow` container와 rationale의 runtime control 설명. Runnable mode는 reviewed dynamic/loop shape에서 내부 ADK dynamic workflow builder를 선택할 수 있으며, `dynamic_workflow` container 자체의 runtime `adk_mapping`은 계속 금지한다.
- callback/resume: `callback_wait` node와 `flow_kind: callback|resume`, `call_control: event_callback|resume`

`workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나만 사용한다.
세부 흐름 이름을 `workflow_kind`로 되살리지 않는다.

## Graph IR marker 규칙

Analyzer는 marker 전용 stage artifact를 만들지 않는다.
marker는 Graph IR의 node, edge, container에서 파생되는 해석이다.

- `parallel`: `parallel_region`, `fan_out`, `fan_in`, `join`이 있을 때
- `human_review`: `human_review_region`, `node_kind: human_input`, 또는 `risk_signals: human_approval_required`가 있을 때
- `loop`: `loop_region`, `loop_control`, `loop_back`, `loop_exit`가 있을 때
- `branch`: `edge_kind: route` 또는 `route_condition`이 있을 때
- callback wait, approval wait, resume requested, manual review, compensation은 새 `workflow_kind`나 `module_category`가 아니라 Graph IR node/edge semantics와 `AnalysisResult.runtimeContracts.graph_ir_annotations`에서 해석한다.

새 marker가 필요하면 먼저 Graph IR에 어떤 node/container/edge semantics로 표현되는지 정의한다.
UI의 glyph, label, 색은 `docs/visualization/design-system.md`에서 별도로 관리한다.

## Stage projection 규칙

Stage는 저장 artifact가 아니라 UI가 Graph IR을 읽어 만든 projection이다.
새 analyzer output은 stage list를 내보내면 안 된다.

모듈이 존재할 때 UI는 다음 순서로 Graph IR node를 묶을 수 있다.

1. 입력 컨텍스트: `input` node
2. Adapter 호출: `node_kind: adapter_call` 또는 legacy `adapter` node
3. Local 검토 / Orchestration: `agent`, `workflow_call`, legacy `workflow`, callback/human nodes
4. Rule Registry 라우팅: `adapter_kind: rule_registry`
5. Remote A2A 경계: `remote_a2a`/`remote_agent_call` node와 `remote_boundary` container
6. 결과 산출: `output` node
7. 추가 모듈: 위 규칙으로 배치되지 않은 잔여 node

같은 stage 내부 edge는 stage가 묶음을 의미하므로 connector로 중복 표시하지 않는다.
stage 사이 edge는 출발/도착 node, `edge_kind`, `execution_semantics`, `data_label`, `route_condition`, `route_aliases`, `is_default_route`, `state_key`, `artifact_key`, `schema_ref`를 보존해야 한다.

## Edge 표시 의미

UI label은 다음 Graph IR 의미를 바꾸면 안 된다.

- `event_output`: machine-readable `Event.output`
- `event_message`: user-facing 또는 human-input prompt `Event.message`
- `session_state`, `temp_state`, `user_state`, `app_state`: ADK State scope
- `artifact`: ADK Artifact
- `route`: explicit route condition
- `control`: retry, cancel, timeout, loop stop, escalation 같은 control signal
- `remote_a2a`: `remote_boundary`를 건너는 A2A protocol edge
- `flow_kind: callback|resume`과 `call_control: event_callback|resume`: callback wait/resume execution semantics
