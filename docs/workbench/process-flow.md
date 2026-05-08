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

## Node

허용되는 `node_kind`:

- `input`
- `output`
- `agent`
- `function`
- `tool`
- `adapter`
- `human_input`
- `workflow`
- `remote_a2a`
- `join`
- `router`
- `loop_control`

`input`, `output`, `join`, `router`, `loop_control`은 synthetic node이며 `module_id: null`이어야 한다.
`agent`, `workflow`, `adapter`, `remote_a2a`는 matching module candidate와 연결한다.
사람 승인이나 보완 요청은 workflow subtype이 아니라 `node_kind: human_input`으로 둔다.

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

`route` edge에는 `route_condition`이 필요하다.
`artifact` edge에는 `artifact_key`가 필요하다.
`remote_a2a` edge는 `is_remote_boundary_crossing: true`와 `a2a_contract_id`가 필요하고, local graph 복잡도만으로 만들 수 없다.

## Workflow 표현 규칙

- 고정 순서: `normal_transition`
- 병렬: `parallel_region` + `fan_out` + `join` + `fan_in`
- 반복: `loop_region` + `loop_control` + `loop_back` + `loop_exit`
- 사람 검토: `human_review_region` + `human_input` + 승인/반려 `route`
- 동적 제어: `dynamic_workflow` container와 rationale의 runtime control 설명

`workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나만 사용한다.
세부 흐름 이름을 `workflow_kind`로 되살리지 않는다.
