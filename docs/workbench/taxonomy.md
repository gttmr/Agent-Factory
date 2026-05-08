# Taxonomy

이 문서는 Agent Factory 분석 워크벤치의 단일 활성 taxonomy 기준이다.
값은 `packages/web/src/analyzer/types.ts`, `schemas/`, `scripts/validate-artifacts.mjs`와 맞아야 한다.

## ADK 확인 기준

2026-05-08 기준으로 `adk-docs-mcp`에서 `list_doc_sources -> https://adk.dev/llms.txt -> fetch_docs` 순서로 다음 문서를 확인했다.
같은 URL을 `/tmp/adk-official-docs`에 `curl -L`로 내려받아 MCP 반환 내용과 비교했고, taxonomy 판단을 바꿀 차이는 없었다.

- `https://adk.dev/workflows/index.md`: ADKPython v2.0.0Beta graph-based workflows는 node와 edge로 agent logic을 정의한다.
- `https://adk.dev/workflows/graph-routes/index.md`: route, fan-out, `JoinNode`, nested workflow를 graph edge 구조로 표현한다.
- `https://adk.dev/workflows/dynamic/index.md`: dynamic workflow는 코드의 loop, conditional, recursion, `ctx.run_node`가 제어 흐름을 직접 결정할 때 쓴다.
- `https://adk.dev/workflows/human-input/index.md`: human input은 graph workflow 안의 `RequestInput` node로 표현한다.
- `https://adk.dev/a2a/index.md`: ADK A2A는 local sub-agent와 구분되는 remote A2A agent 통신을 다룬다.

ADK 2.0은 Beta다. 이 워크벤치는 ADK 2.0 Graph IR을 기본 표현으로 쓰되, private deployment code나 credentials를 생성하지 않는다.

## module_category

허용되는 `module_category` 값은 네 개뿐이다.

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

불명확하면 새 category를 만들지 말고 evidence, missing information, assumption을 남긴다.

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
- `graph`: ADK 2.0 graph workflow처럼 node와 edge, route, join, loop, human input이 명시적인 설계 산출물일 때.
- `dynamic`: Python 조건문, loop, recursion, `ctx.run_node` 같은 코드가 런타임 경로를 직접 결정할 때.
- `unknown`: 요구사항 증거가 부족해 workflow subtype을 확정할 수 없을 때.

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
