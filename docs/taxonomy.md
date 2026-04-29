# Agent Factory 분류 체계

이 문서는 모델이 Agent Factory v1.0 산출물을 분류할 때 따르는 기준이다.
분류 값은 `packages/web/src/analyzer/types.ts`의 enum과 byte-for-byte로 일치해야 한다.
새 값을 추정하거나 유사한 이름으로 바꾸지 않는다.

## 최상위 module_category

허용되는 `module_category` 값은 네 개뿐이다.

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

이 값은 후보 모듈의 1차 책임 경계이며, 불명확하면 새 카테고리를 만들지 말고 근거와 누락 정보를 남긴다.

## agent_kind

`module_category: agent`일 때 사용하는 `agent_kind` 값은 다음과 같다.

- `specialist`
- `shared`

Agent는 판단, 요약, 분류, 추천처럼 추론 책임을 가진 경계다.
`specialist`는 특정 유스케이스나 도메인 책임이 강한 후보에, `shared`는 여러 유스케이스에서 공통 추론 책임으로 재사용될 가능성이 확인된 후보에 쓴다.

## workflow_kind

`module_category: workflow`일 때 사용하는 `workflow_kind` 값은 다음과 같다.

- `sequential`
- `parallel`
- `loop`
- `human_review`
- `orchestration`
- `unknown`

Workflow는 로컬 경계 안의 결정적 또는 준결정적 제어 흐름이다.
순차 처리, 병렬 분기, 반복, 사람 검토, 오케스트레이션을 표현하며, 여러 단계라는 사실만으로 `remote_a2a`가 되지는 않는다.

## adapter_kind

`module_category: adapter`일 때 사용하는 `adapter_kind` 값은 다음과 같다.

- `legacy_api`
- `retrieval`
- `rule_registry`
- `data_query`
- `template`
- `computation`
- `external_service`
- `unknown`

Adapter는 Agent나 Workflow가 호출하는 callable capability이며, 독립 원격 에이전트 계약이 아니다.

## remote_contract_kind

`module_category: remote_a2a`일 때 사용하는 `remote_contract_kind` 값은 다음과 같다.

- `a2a`
- `unknown`

Remote A2A는 독립적으로 소유되고 배포되는 원격 에이전트와의 프로토콜 경계다.
소유자, agent card 또는 discovery 방법, 요청 스키마, 응답 스키마, task lifecycle, auth, timeout, retry, fallback, audit, data policy 근거가 부족하면 `needs_info`, `deferred`, 또는 `rejected` 판단을 우선한다.

## 더 이상 최상위가 아닌 분류

`Knowledge Retrieval`은 최상위 `module_category`가 아니며, 검색이나 근거 조회는 `module_category: adapter`와 `adapter_kind: retrieval`로 표현한다.
`Metadata Registry`도 최상위 `module_category`가 아니며, 관리되는 업무 규칙이나 메타데이터 레지스트리는 `module_category: adapter`와 `adapter_kind: rule_registry`로 표현한다.
`Tool/Adapter`라는 과거 표현도 최상위 분류로 쓰지 않는다.
`legacy_recommended_type`은 마이그레이션 메타데이터일 뿐이며 1차 classifier로 사용하지 않는다.

## Remote A2A가 아닌 것

다음 조건은 단독으로 Remote A2A를 정당화하지 않는다.

- 여러 단계로 구성된 workflow라는 사실
- 여러 adapter를 호출한다는 사실
- 다른 도메인의 API를 호출한다는 사실
- 문서 검색이나 지식 조회를 수행한다는 사실
- 병렬 fan-out 또는 fan-in이 있다는 사실
- 사람이 검토하는 단계가 포함된다는 사실

Remote A2A는 원격 에이전트의 독립 소유, 독립 lifecycle, 프로토콜 계약이 확인될 때만 후보가 되며, 그 외의 흐름은 우선 `workflow`와 `adapter` 조합으로 표현한다.

## 관련 문서

- [ADK A2A Agent Generation](./concepts/adk-a2a-agent-generation.md)
- [Artifact Validation](./validation.md)
