# Taxonomy

이 문서는 Agent Factory 분석 워크벤치의 단일 활성 taxonomy 기준이다.
값은 `packages/web/src/analyzer/types.ts`의 enum과 byte-for-byte로 일치해야 한다.

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
`specialist`는 특정 유스케이스나 도메인 책임이 강할 때, `shared`는 여러 유스케이스에서 같은 추론 책임이 반복될 때 쓴다.

## workflow_kind

`module_category: workflow`일 때만 사용한다.

- `sequential`
- `parallel`
- `loop`
- `human_review`
- `orchestration`
- `graph`
- `dynamic`
- `unknown`

Workflow는 로컬 경계 안의 결정적 또는 준결정적 제어 흐름이다.
상세 판단은 [Workflow decision guide](./workflow-decision-guide.md)를 따른다.

ADK 2.0 (Beta)을 기본 baseline으로 두고 분석한다.
`graph`는 2.0 graph workflow(노드/엣지가 명시된 결정적 라우팅), `dynamic`은 2.0 dynamic workflow(파이썬 코드 기반 제어)에 대응한다.
`sequential`, `parallel`, `loop`는 2.0에서도 유효하며, 1.14 환경에서는 각각 `SequentialAgent`, `ParallelAgent`, `LoopAgent`로 매핑되는 legacy compat 표현이다.
`workflow_kind`는 ADK runtime 버전과 1:1로 묶이지 않는다. 같은 분류 값이 2.0 graph 노드로도 1.14 stable agent로도 구현될 수 있다.

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
이 정보가 부족하면 `approved`로 올리지 말고 `needs_info`, `deferred`, 또는 `rejected`로 둔다.

## 더 이상 최상위가 아닌 것

- `Tool/Adapter`는 top-level category가 아니다.
- `Knowledge Retrieval`은 `module_category: adapter`, `adapter_kind: retrieval`로 표현한다.
- `Metadata Registry`와 관리되는 업무 규칙은 `module_category: adapter`, `adapter_kind: rule_registry`로 표현한다.
- `legacy_recommended_type`은 migration metadata일 뿐 primary classifier가 아니다.

## Remote A2A가 아닌 것

다음 조건만으로는 Remote A2A를 만들지 않는다.

- 여러 단계로 구성된 workflow
- 여러 adapter 호출
- 다른 도메인의 API 호출
- 문서 검색이나 최신 정보 조회
- 병렬 fan-out 또는 fan-in
- local sub-agent 구성
- 사람 검토 단계

이런 흐름은 우선 `workflow`와 `adapter` 조합으로 표현한다.
