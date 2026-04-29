# Workflow Decision Guide

이 문서는 requirement에서 어떤 workflow를 그려야 하는지 판단하는 기준이다.
ADK 기준은 안정적인 workflow agent 패턴인 `SequentialAgent`, `ParallelAgent`, `LoopAgent`다.

## 기본 원칙

- Workflow는 LLM이 임의로 추론하는 단계가 아니라 실행 순서와 반복, 병렬성, 검토 gate를 설명하는 control flow다.
- Agent는 reasoning owner이고, Workflow는 그 owner와 Adapter를 언제 실행할지 조율한다.
- Adapter 호출이 여러 개라는 사실만으로 Workflow가 필요한 것은 아니다. 순서, 병렬성, 반복, 승인 gate가 설계상 의미 있을 때 Workflow를 둔다.
- Remote A2A는 workflow pattern이 아니다. 독립 원격 agent 계약이 확인될 때만 사용한다.

## sequential

`workflow_kind: sequential`은 단계 순서가 고정되어 있고 앞 단계 산출물이 뒤 단계 입력이 될 때 사용한다.

흐름 신호:

- A 다음에 B를 반드시 해야 한다.
- 요약 전 원문 수집, 검토 전 초안 생성처럼 선후관계가 명확하다.
- ADK 구현 관점에서는 `SequentialAgent`나 같은 의미의 순차 orchestration으로 표현할 수 있다.

Process Flow:

- `input`에서 첫 module로 연결한다.
- 각 단계 사이 edge data에 전달되는 산출물을 적는다.
- 마지막 module에서 `output`으로 연결한다.

## parallel

`workflow_kind: parallel`은 서로 의존하지 않는 작업을 동시에 수행하고 이후 결과를 모아야 할 때 사용한다.

흐름 신호:

- 여러 source, domain, system을 독립적으로 조회한다.
- 각 branch가 서로의 중간 state에 의존하지 않는다.
- 결과를 합치는 merge, synthesis, review 단계가 필요하다.
- ADK 구현 관점에서는 `ParallelAgent` 뒤에 merge agent 또는 review agent를 순차로 붙이는 형태가 될 수 있다.

Process Flow:

- 공통 `input`에서 독립 branch module로 fan-out한다.
- branch 결과를 merge 또는 review module로 fan-in한다.
- branch가 공유 state를 직접 수정해야 한다면 parallel로 확정하지 말고 `needs_info`를 남긴다.

## loop

`workflow_kind: loop`는 반복 개선, 재시도, 재수집, 조건 충족까지의 반복이 필요할 때 사용한다.

흐름 신호:

- 답변이 들어오면 다시 평가한다.
- 검토 실패 시 보완하고 재검토한다.
- 특정 품질, 승인, completeness 조건을 만족할 때까지 반복한다.
- ADK 구현 관점에서는 `LoopAgent`와 max iteration 또는 종료 신호가 필요하다.

Process Flow:

- 반복되는 module 사이에 `loop:` prefix가 있는 edge data를 둔다.
- 종료 조건, 최대 반복, 실패 시 escalation이 없으면 `needs_info`를 남긴다.
- 고객 영향이나 거래 쓰기가 있으면 사람 검토 gate와 함께 검토한다.

## human_review

`workflow_kind: human_review`는 사람이 승인, 반려, 보완 요청, 정책 판단을 해야 할 때 사용한다.
이 값은 ADK runtime feature 지시가 아니라 Agent Factory 워크벤치의 검토 gate다.

흐름 신호:

- 고객 발송 전 승인.
- 신용 판단 지원, 거래 쓰기, 외부 메시지 같은 위험 행동.
- 모순 또는 누락 정보가 있어 자동 완료가 위험한 경우.

Process Flow:

- 사람 검토 module을 workflow node로 표현한다.
- 승인/반려/추가정보 요청의 downstream 결과를 edge data에 남긴다.
- `human_approval_required`와 `audit_required` risk signal을 검토한다.

## orchestration

`workflow_kind: orchestration`은 sequential, parallel, loop, human_review가 섞인 상위 조율 흐름이다.
단일 패턴으로 충분하면 `orchestration`을 쓰지 않는다.

Process Flow:

- 상위 workflow node를 두고 내부 branch, merge, loop, review gate를 edge data로 설명한다.
- 너무 많은 세부 단계를 한 node에 숨기지 않는다.
- 구현 세부가 불명확하면 `unknown`이 아니라 missing information을 남긴다.

## ADK Component Hint

ADK component는 taxonomy 값이 아니다.
다음 내용은 module candidate category를 바꾸지 말고 `implementation-handoff.md`에 hint로 남긴다.

- `Session`, `State`: multi-turn 진행 상태와 단계 간 값 전달.
- `MemoryService`: 여러 session을 넘는 장기 기억. 내부 문서 검색이면 `adapter_kind: retrieval`도 검토한다.
- `Artifacts`, `Events`: 파일/보고서 저장, audit trail, event retention.
- `Callbacks`, `Plugins`: guardrail, logging, validation, request/response modification.
- `MCP`: 외부 tool server. 보통 `adapter_kind: external_service` 후보.
- `Grounding`: 최신 웹 정보나 내부 문서 기반 응답. 보통 `adapter_kind: retrieval` 후보.

## ADK Component Routing

다음 표는 사용자 요구사항 신호를 Agent Factory taxonomy와 handoff hint로 연결하는 기준이다.
이 표는 category를 늘리기 위한 표가 아니라 기존 taxonomy 안에서 workflow와 adapter를 더 정확히 고르기 위한 표다.

| 요구사항 신호 | 고려할 ADK component | Agent Factory 판단 | 확인 질문 |
|---|---|---|---|
| 고정 순서로 여러 단계를 실행해야 한다 | `SequentialAgent` | `workflow_kind: sequential` | 앞 단계 산출물이 뒤 단계 입력인가? |
| 독립 작업을 동시에 실행하고 결과를 모아야 한다 | `ParallelAgent` | `workflow_kind: parallel` | branch 사이 의존성이 없는가? merge 단계는 무엇인가? |
| 품질 충족, 재시도, 보완 요청까지 반복해야 한다 | `LoopAgent` | `workflow_kind: loop` | 종료 조건, 최대 반복, 실패 escalation은 무엇인가? |
| 사람 승인이나 보완 요청이 필요하다 | workbench review gate | `workflow_kind: human_review` | 누가 승인하고, 승인/반려 결과가 어디로 흐르는가? |
| 한 대화 안에서 단계별 진행상태를 기억해야 한다 | `Session`, `State` | `agent` 또는 `workflow`의 handoff hint | 어떤 값이 몇 턴 동안 유지되어야 하는가? |
| 사용자 선호나 장기 이력을 여러 session에서 기억해야 한다 | `MemoryService` | 장기 검색이면 `adapter_kind: retrieval`도 검토 | 저장 범위, 보존기간, 삭제권한, 개인정보 포함 여부는? |
| 실행 전후에 검증, 차단, 로깅, 정책 적용이 필요하다 | `Callbacks` | category가 아니라 guardrail/hook hint | before/after agent/model/tool 중 어느 지점인가? |
| 모든 agent/tool/model 호출에 공통 정책을 적용해야 한다 | `Plugins` | cross-cutting implementation hint | 단일 agent만인가, Runner 전체인가? |
| 파일, 이미지, PDF, 보고서 등 output을 저장해야 한다 | `Artifacts` | output artifact 또는 storage adapter 후보 | session scope인가 user scope인가? versioning이 필요한가? |
| 감사 로그, 상태 변경, tool call 흐름을 추적해야 한다 | `Events` | audit/observability hint | 어떤 event를 보존하고 누가 열람할 수 있는가? |
| 내부 문서나 최신 웹 정보로 답해야 한다 | Grounding, retrieval tool | `adapter_kind: retrieval` | source ACL, citation, freshness, grounding metadata는? |
| 외부 tool server를 agent가 사용해야 한다 | `MCP` | `adapter_kind: external_service` 우선 검토 | MCP server owner, auth, exposed tools, failure policy는? |
| 독립 서비스 agent와 네트워크로 통신해야 한다 | A2A | 증거가 충분할 때만 `remote_a2a` | owner, agent card, schema, lifecycle, auth, timeout, retry, fallback, audit는? |
| 음성/영상/실시간 양방향 인터랙션이 필요하다 | streaming tools | runtime capability hint, 필요 시 `workflow` | latency, interruption, modality, privacy, recording policy는? |

현재 schema가 `adk_component_hints`를 직접 지원하지 않으면 `implementation-handoff.md`에 먼저 기록하고 schema 확장은 별도 작업으로 다룬다.

## ADK MCP 사용 주의

ADK 공식 문서는 repo에 복제하지 않는다.
구현 전에는 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 관련 페이지를 확인한다.

MCP가 최신 ADK 문서를 반환하더라도 active workbench 판단 기준은 이 문서의 안정 workflow agent 패턴이다.
최신 문서의 신규 workflow/runtime 기능과 API 이름은 구현 전 공식 문서 확인 대상일 뿐이며, 이 repo의 `workflow_kind`나 `module_category`를 바꾸는 근거가 아니다.
