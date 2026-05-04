# Process Flow

Process Flow는 정규화된 requirement가 어떤 module 조합으로 처리되는지 보여주는 설계 artifact다.
목표는 taxonomy 나열이 아니라 실행 순서, local boundary, Remote A2A boundary, 검토 gate를 설명하는 것이다.

## Node type

`FlowNodeType` 값은 다음 여섯 개뿐이다.

- `input`
- `output`
- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

`agent`, `workflow`, `adapter`, `remote_a2a` node는 같은 candidate의 `module_category`와 맞아야 한다.
`subtype`은 `agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind` 중 해당 category의 값을 넣는다.

## Edge type

`edge_type` 값은 두 개뿐이다.

- `local`
- `remote_a2a`

`local`은 같은 workbench 설계 경계 안의 연결이다.
`remote_a2a`는 독립 원격 agent 계약을 통과하는 연결이며, `remote_a2a` node가 관련될 때만 사용한다.

## 그리는 순서

1. `input` node에 raw requirement와 핵심 context를 둔다.
2. Evidence에서 확인된 Agent, Workflow, Adapter, Remote A2A 후보를 node로 둔다.
3. 사용자 요구가 암시한 순서, 병렬성, 반복, 사람 검토를 edge로 표현한다.
4. 최종 산출물, 보존 artifact, handoff 문서를 `output` node로 둔다.
5. 불확실한 경계는 edge를 억지로 확정하지 말고 `needs_info` 근거를 남긴다.

## Workflow Pattern

- `sequential`: `input -> step A -> step B -> output`처럼 고정 순서로 연결한다.
- `parallel`: 공통 input에서 독립 branch로 fan-out하고 merge/review module로 fan-in한다.
- `loop`: 반복되는 edge data에 `loop:` prefix를 붙이고 종료 조건을 rationale에 남긴다.
- `human_review`: 사람 승인 또는 보완 요청 gate를 workflow node로 둔다 (ADK 2.0에서는 first-class human-input 노드, 1.14에서는 워크벤치 gate 개념).
- `orchestration`: 여러 pattern을 조합하는 상위 workflow node로 표현한다.
- `graph`: ADK 2.0 graph workflow처럼 분기/병렬/머지/loop가 한 그래프 안에 명시적으로 묶일 때 사용한다. 워크벤치의 process flow 자체가 노드/엣지 그래프이므로, `graph` 후보는 이 토폴로지를 agent 단위에서 명시적으로 소유한다고 표시한다.
- `dynamic`: ADK 2.0 dynamic workflow처럼 코드가 런타임 분기를 결정할 때 사용한다. 외부에서 관찰 가능한 분기는 process flow에 노출하고, 동적 차원이 핵심이면 단일 workflow node + rationale로 표현한다.

세부 판단은 [Workflow decision guide](./workflow-decision-guide.md)를 따른다.

## Adapter 배치

Adapter는 Agent나 Workflow가 호출하는 capability다.
retrieval, rule registry, data query, external service, MCP tool은 별도 reasoning owner가 아니라면 Adapter node로 둔다.
Adapter result가 여러 downstream 판단에 쓰이면 flow에서 명시적으로 fan-in 지점을 둔다.

## Remote A2A 배치

Remote A2A는 local workflow의 branch가 아니다.
원격 owner, lifecycle, agent card 또는 discovery, request/response schema, auth, timeout, retry, fallback, audit, data policy가 확인될 때만 `remote_a2a` node와 `remote_a2a` edge를 둔다.
정보가 부족하면 Remote A2A 후보는 `needs_info` 또는 `deferred`로 둔다.

## 검토 기준

- 모든 candidate node가 Module Review Board의 status와 일치해야 한다.
- `approved`가 아닌 후보는 downstream export에서 구현 전제로 사용하지 않는다.
- customer-impacting, transaction-write, credit-decision-support 흐름은 사람 검토와 audit edge가 보이는지 확인한다.
- `scaffold-plan.json`은 승인 후보를 담는 export artifact이며, process flow 자체가 runnable logic을 의미하지 않는다.
