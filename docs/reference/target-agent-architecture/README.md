# Target Agent Architecture

이 참조는 분석 결과가 어떤 구현 경계로 이어질 수 있는지 설명한다.
활성 taxonomy 값은 [Taxonomy](../../workbench/taxonomy.md)를 따른다.

## 설계 관점

- Workbench는 Workflow-first Graph Model이다. Workflow가 graph owner이며 순서, 병렬성, 반복 intent, 사람 검토, callback wait/resume, subworkflow 호출을 조율한다.
- Agent는 judgment node다. 판단, 요약, 분류, 추천, triage, 또는 승인된 MCP toolset 선택을 맡는다.
- Adapter는 call node다. API, retrieval, rule registry, data query, template, computation, external service를 감싼다.
- Remote A2A는 독립 원격 agent와의 protocol boundary다.
- 기존 업무 Workflow 재사용은 parent Workflow 안의 공식 subworkflow/existing workflow node인 `workflow_call`로 표현한다.
- MCP는 category가 아니라 invocation binding이다. Workflow가 고정한 단일 MCP tool은 `adapter_call` + `invoke_binding: mcp_tool` + `call_control: fixed_by_workflow`로, LLM-selected toolset은 `agent` + `invoke_binding: mcp_toolset` + `call_control: selected_by_llm`로 표현한다.
- Mock Lab은 Adapter의 local MCP test double이다. Catalog runtime contract를 mock으로 바꾸지 않고 `mock_binding`으로만 연결한다.
- `side_effect`와 `policy`는 node-level governance summary이며, 실제 runtime governance source of truth는 `AnalysisResult.runtimeContracts`와 A2A contract artifact다.

## 기본 우선순위

1. 요구사항의 전체 실행 흐름을 Workflow Graph IR로 먼저 잡는다.
2. 판단, 요약, 분류, 추천, triage는 Agent judgment node로 분리한다.
3. 시스템 호출과 지식 조회는 Adapter 후보와 `adapter_call` node로 둔다.
4. 독립 owner, lifecycle, protocol contract가 증명될 때만 Remote A2A 후보로 올린다.

Local orchestration, fan-out/fan-in, human review만으로는 Remote A2A가 아니다.

## Skeleton handoff

ADK Runtime Handoff가 만드는 코드는 production generator가 아니다.
승인된 Graph IR 또는 Scaffold Plan에서 ADK Web smoke가 가능한 skeleton, Mock Lab wiring, sample input, developer TODO를 만든다.
전문 개발자는 이후 실제 API/EAI client, 업무 검증, 예외 처리, dynamic control logic, production prompt와 배포 설정을 수동 보강한다.

Dynamic Workflow는 이번 skeleton 생성 범위에서 design/contract container일 뿐이며 runnable dynamic codegen으로 자동 생성하지 않는다.
복잡한 동적 흐름은 하위 Workflow로 분리하고 상위 설계에서는 `workflow_call`로 조립한다.
