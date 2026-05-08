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
시각화에서 container는 node를 다시 배치하는 독립 lane이 아니라, 전체 workflow 안에 있는 node bounds에서 파생되는 region overlay다.
따라서 `parallel_region`, `human_review_region`, `remote_boundary`는 workflow 외부 슬롯으로 분리하지 않고 일반 흐름 위에 겹쳐 표시한다.

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

## Graph IR marker 규칙

Analyzer는 marker 전용 stage artifact를 만들지 않는다.
marker는 Graph IR의 node, edge, container에서 파생되는 해석이다.

- `parallel`: `parallel_region`, `fan_out`, `fan_in`, `join`이 있을 때
- `human_review`: `human_review_region`, `node_kind: human_input`, 또는 `risk_signals: human_approval_required`가 있을 때
- `loop`: `loop_region`, `loop_control`, `loop_back`, `loop_exit`가 있을 때
- `branch`: `edge_kind: route` 또는 `route_condition`이 있을 때

새 marker가 필요하면 먼저 Graph IR에 어떤 node/container/edge semantics로 표현되는지 정의한다.
UI의 glyph, label, 색은 `docs/visualization/design-system.md`에서 별도로 관리한다.

## Stage projection 규칙

Stage는 저장 artifact가 아니라 UI가 Graph IR을 읽어 만든 projection이다.
새 analyzer output은 stage list를 내보내면 안 된다.

모듈이 존재할 때 UI는 다음 순서로 Graph IR node를 묶을 수 있다.

1. 입력 컨텍스트: `input` node
2. Adapter 호출: `adapter_kind: legacy_api` 또는 `adapter_kind: retrieval`
3. Local 검토 / Orchestration: `workflow`, `agent`, 그 외 local `adapter`
4. Rule Registry 라우팅: `adapter_kind: rule_registry`
5. Remote A2A 경계: `remote_a2a` node와 `remote_boundary` container
6. 결과 산출: `output` node
7. 추가 모듈: 위 규칙으로 배치되지 않은 잔여 node

같은 stage 내부 edge는 stage가 묶음을 의미하므로 connector로 중복 표시하지 않는다.
stage 사이 edge는 출발/도착 node, `edge_kind`, `execution_semantics`, `data_label`, `route_condition`, `state_key`, `artifact_key`, `schema_ref`를 보존해야 한다.

## Edge 표시 의미

UI label은 다음 Graph IR 의미를 바꾸면 안 된다.

- `event_output`: machine-readable `Event.output`
- `event_message`: user-facing 또는 human-input prompt `Event.message`
- `session_state`, `temp_state`, `user_state`, `app_state`: ADK State scope
- `artifact`: ADK Artifact
- `route`: explicit route condition
- `control`: retry, cancel, timeout, loop stop, escalation 같은 control signal
- `remote_a2a`: `remote_boundary`를 건너는 A2A protocol edge
