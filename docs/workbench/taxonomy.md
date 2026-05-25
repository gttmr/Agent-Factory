# Taxonomy

이 문서는 Agent Factory 분석 워크벤치의 단일 활성 taxonomy 기준이다.
값은 `packages/web/src/analyzer/types.ts`, `schemas/`, `scripts/validate-artifacts.mjs`와 맞아야 한다.

## ADK 확인 기준

2026-05-22 기준으로 `adk-docs-mcp`에서 `list_doc_sources -> https://adk.dev/llms.txt -> fetch_docs` 순서로 다음 문서를 확인했다.
ADK 2.0 문서가 GA 기준을 제공하므로 active taxonomy는 ADK 2.0을 기본 baseline으로 둔다.

- `https://adk.dev/2.0/index.md`: ADK Python 2.0 GA는 2026년 5월 19일 release로 문서화되어 있고, graph-based workflows, dynamic workflows, collaborative workflows를 핵심 기능으로 둔다.
- `https://adk.dev/graphs/index.md`: graph-based workflows는 Agents, Tools, Functions를 node로 두고 edge로 routing, branching, state management를 정의한다.
- `https://adk.dev/workflows/index.md`: ADK workflows는 graph-based, dynamic, collaborative, template workflow를 구분한다.
- `https://adk.dev/a2a/index.md`: ADK A2A는 remote A2A agent와의 통신을 다루며 local sub-agent, adapter, MCP tool 호출과 구분한다.

이 워크벤치는 ADK 2.0 Graph IR을 기본 표현으로 쓰되, private deployment code나 credentials를 생성하지 않는다.

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

`module_category`는 책임의 종류를 나타내고, `runtime_binding`은 실행/연결 방식을 나타낸다.

- `runtime_binding: mcp`: MCP server/tool 계약으로 호출한다.
- `runtime_binding: remote_a2a`: Remote A2A 방식으로 호출되는 runtime contract다.
- `runtime_binding: unresolved`: Python import, local package, remote call 등 실행 방식이 아직 확정되지 않았다.

공통 Workflow는 여러 도메인에서 원격 실행 경계로 호출될 수 있으므로 catalog에서는 `module_category: workflow`와 `runtime_binding: remote_a2a`를 함께 사용할 수 있다.
이 경우에도 독립 원격 Agent 자체를 새로 설계한다는 증거가 없으면 `module_category: remote_a2a` 후보를 새로 만들지 않는다.

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
- `graph`: ADK 2.0 graph-based workflow처럼 node와 edge, route, join, loop, human input이 명시적인 설계 산출물일 때.
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
