# Analysis Guide

이 문서는 사용자 요구사항을 Agent Factory 분석 워크벤치 산출물로 바꾸는 기본 절차다.
첫 사용자는 개발 리더이며, v1.0의 임시 은행 도메인은 `고객`, `수신`, `여신`, `카드`, `리스크`다.

## 분석 순서

1. Raw requirement와 requester context를 캡처한다.
2. 목표, 입력, 출력, 언급된 시스템, 위험 신호, 누락 정보, 모순, 가정을 정규화한다.
3. Evidence summary를 만든다. 추정은 추정으로, 확인된 사실은 확인된 사실로 분리한다.
4. 후보 모듈을 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나로 분류한다.
5. 선택한 category에 맞는 subtype을 채운다.
6. [Workflow decision guide](./workflow-decision-guide.md)에 따라 process flow를 그린다.
7. 개발 리더가 Module Review Board에서 `approved`, `deferred`, `rejected`, `needs_info` 중 하나로 결정한다.
8. 최종 단계에서 검토된 분석 결과를 ADK 2.0 graph workflow 소스로 생성한다.

## 산출물 의미

- `normalized-requirement.json`: 요구사항을 구조화한 원본 분석 결과.
- `evidence-summary.json`: 분류 근거, 위험, 누락 정보, 가정.
- `module-candidates.json`: 검토 대상 모듈 후보.
- `process-flow.json`: 후보 모듈 사이의 local 또는 Remote A2A 흐름.
- `classification.json`: 선택한 category와 subtype의 근거.
- `commonization-notes.json`: shared agent, adapter catalog, workflow reuse 후보.
- `implementation-handoff.md`: 구현자가 알아야 할 결정, 미해결 질문, ADK component hint.
- `scaffold-plan.json`: 승인 후보만 담는 export artifact. 실행 가능한 business logic을 만들라는 지시가 아니다.
- `*_adk/agent.py`: Graph IR 검증을 통과한 뒤 생성되는 `Workflow(edges=[...])` 기반 ADK 2.0 graph workflow source. 분석된 topology와 data channel을 실행 가능한 runtime skeleton으로 보존한다.
- `*_adk/workflow_manifest.json`: 생성 source가 raw requirement를 business logic으로 직접 변환하지 않았음을 확인하는 runtime guardrail manifest.

## 분석 원칙

- 새 taxonomy 값을 만들지 않는다. 값은 [Taxonomy](./taxonomy.md)를 따른다.
- 여러 단계가 있다는 이유만으로 `remote_a2a`를 만들지 않는다.
- MCP tool, retrieval, grounding, external service는 우선 `adapter` 후보로 본다.
- ADK component는 category가 아니다. 필요하면 `implementation-handoff.md`의 ADK component hint로 남긴다.
- 고객 영향, 금융정보, 거래 쓰기, 신용 판단 지원은 위험 신호로 남기고 사람 검토를 요구한다.
- Raw requirement는 직접 business logic 코드 생성으로 이어지지 않는다. ADK source 생성은 검토된 process flow와 candidate metadata를 Graph IR로 정규화한 뒤 실행 가능한 runtime topology로 옮기는 단계다.

## ADK 문서 사용

ADK 공식 문서는 repo에 모두 복제하지 않는다.
필요한 최신 내용은 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 가져온다. 2.0 (Beta) 섹션(graph workflow, dynamic workflow, human-input 노드, trace/token observability)을 우선 조회한다.
이 저장소의 활성 문서는 ADK 2.0 (Beta)을 기본 baseline으로 작성한다.
1.14 환경 대상 legacy compat에서는 stable workflow agent 패턴인 `SequentialAgent`, `ParallelAgent`, `LoopAgent`로 매핑된다.
