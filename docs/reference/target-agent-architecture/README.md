# Target Agent Architecture

이 참조는 분석 결과가 어떤 구현 경계로 이어질 수 있는지 설명한다.
활성 taxonomy 값은 [Taxonomy](../../workbench/taxonomy.md)를 따른다.

## 설계 관점

- Agent는 reasoning owner다. 판단, 요약, 분류, 추천, triage를 맡는다.
- Workflow는 local control flow다. 순서, 병렬성, 반복, 사람 검토, 조율을 설명한다.
- Adapter는 callable capability다. API, retrieval, rule registry, data query, template, computation, external service를 감싼다.
- Remote A2A는 독립 원격 agent와의 protocol boundary다.
- 기존 업무 Workflow 재사용은 parent Workflow 안의 `workflow_call` 노드로 표현한다.
- Mock Lab은 Adapter의 local MCP test double이다. Catalog runtime contract를 mock으로 바꾸지 않고 `mock_binding`으로만 연결한다.

## 기본 우선순위

1. 요구사항의 reasoning 책임을 Agent 후보로 분리한다.
2. 실행 순서와 반복, 병렬성은 Workflow 후보로 표현한다.
3. 시스템 호출과 지식 조회는 Adapter 후보로 둔다.
4. 독립 owner, lifecycle, protocol contract가 증명될 때만 Remote A2A 후보로 올린다.

Local orchestration, fan-out/fan-in, human review만으로는 Remote A2A가 아니다.

## Skeleton handoff

ADK Runtime Handoff가 만드는 코드는 production generator가 아니다.
승인된 Graph IR 또는 Scaffold Plan에서 ADK Web smoke가 가능한 skeleton, Mock Lab wiring, sample input, developer TODO를 만든다.
전문 개발자는 이후 실제 API/EAI client, 업무 검증, 예외 처리, dynamic control logic을 수동 보강한다.

Dynamic Workflow는 이번 skeleton 생성 범위에서 자동 생성하지 않는다.
복잡한 동적 흐름은 하위 Workflow로 분리하고 상위 설계에서는 `workflow_call`로 조립한다.
