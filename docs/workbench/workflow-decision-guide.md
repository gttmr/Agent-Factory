# Workflow Decision Guide

이 문서는 requirement에서 Workflow Agent 경계를 어떻게 판단하고 Graph IR로 어떻게 내리는지 설명한다.
ADK 2.0 Graph Workflow, Dynamic Workflow, Human Input 문서를 기준으로 한다.

## 기본 원칙

- `workflow_kind` 허용 값은 `orchestration`, `graph`, `dynamic`, `unknown`뿐이다.
- sequence, parallel, loop, human review는 taxonomy 값이 아니라 Graph IR 내부 표현이다.
- Agent는 reasoning owner이고, Workflow는 Agent와 Adapter를 언제 실행할지 조율한다.
- Adapter 호출이 여러 개라는 사실만으로 Workflow가 필요한 것은 아니다. 실행 순서, 라우팅, 병렬성, 반복, 승인 gate가 설계상 의미 있을 때 Workflow를 둔다.
- Remote A2A는 workflow pattern이 아니다. 독립 원격 agent 계약이 확인될 때만 사용한다.

## orchestration

`workflow_kind: orchestration`은 상위 조율 책임이 있지만 explicit graph topology가 아직 핵심 계약으로 확정되지 않았을 때 사용한다.

사용 신호:

- 여러 Agent/Adapter를 묶어 하나의 업무 흐름으로 설명해야 한다.
- 순서와 책임은 보이지만 route key, join, loop control 같은 Graph IR 세부가 아직 부족하다.
- 구현 handoff에서 추가 설계가 필요하다.

Graph IR에는 관찰 가능한 흐름을 최소한으로 드러낸다. 불명확한 branch나 종료 조건은 `needs_info`로 남긴다.

## graph

`workflow_kind: graph`는 ADK 2.0 graph workflow처럼 node와 edge가 명시적인 설계 산출물일 때 사용한다.

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

## dynamic

`workflow_kind: dynamic`은 코드가 런타임 경로를 직접 결정해야 할 때 사용한다.

사용 신호:

- Python 조건문, loop, recursion, async orchestration이 중심이다.
- 호출마다 branch 수나 실행 순서가 달라진다.
- static graph로 표현하면 지나치게 복잡하거나 runtime 값이 있어야만 다음 경로를 알 수 있다.
- ADK dynamic workflow의 `ctx.run_node` 기반 composition, checkpointing, resume semantics가 핵심이다.

Graph IR에는 `dynamic_workflow` container를 두고, 외부에서 관찰 가능한 input/output, human input, remote boundary, 주요 adapter call만 노출한다.
종료 조건, max iteration, fallback, escalation이 없으면 `needs_info`로 남긴다.

## ADK Component Routing

| 요구사항 신호 | Agent Factory 판단 | Graph IR 표현 |
|---|---|---|
| 고정 순서 실행 | `workflow_kind: graph` 또는 상위 조율이면 `orchestration` | `normal_transition` edge |
| 독립 작업 병렬 실행 후 병합 | `workflow_kind: graph` | `parallel_region`, `fan_out`, `join`, `fan_in` |
| 품질 충족이나 재시도 반복 | static이면 `graph`, 코드 중심이면 `dynamic` | `loop_region`, `loop_control`, `loop_back`, `loop_exit` |
| 사람 승인 또는 보완 요청 | `workflow_kind: graph` 안의 human input | `human_review_region`, `human_input`, `route` |
| 매 호출마다 코드가 경로 결정 | `workflow_kind: dynamic` | `dynamic_workflow` container |
| 독립 remote agent 호출 | 충분한 계약 증거가 있을 때만 `remote_a2a` | `remote_boundary`, `remote_a2a` edge |

## ADK MCP 사용 주의

ADK 공식 문서는 repo에 복제하지 않는다.
구현 전에는 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 관련 페이지를 확인한다.
확인한 주요 페이지는 `workflows`, `graph-routes`, `dynamic`, `human-input`, `ADK with A2A`다.

MCP와 직접 다운로드한 공식 문서가 다르거나 ADK 문서가 현재 taxonomy와 충돌하면 구현을 멈추고 사용자에게 질문한다.
