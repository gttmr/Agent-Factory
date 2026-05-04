# Workflow Decision Guide

이 문서는 requirement에서 어떤 workflow를 그려야 하는지 판단하는 기준이다.
ADK 2.0 (Beta)이 기본 baseline이며, graph workflow, dynamic workflow, 첫 번째 등급의 human-input 노드, trace/token observability를 default mental model로 둔다.
1.14 환경을 타겟으로 하는 legacy compat 케이스에서는 stable workflow agent 패턴인 `SequentialAgent`, `ParallelAgent`, `LoopAgent`로 매핑된다.

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
- ADK 2.0 구현 관점에서는 graph workflow의 직선 경로로 표현한다 (legacy 1.14 compat: `SequentialAgent`).

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
- ADK 2.0 구현 관점에서는 graph workflow의 fan-out 노드 + 내장 merge로 표현한다 (legacy 1.14 compat: `ParallelAgent` + 후속 merge agent).

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
- ADK 2.0 구현 관점에서는 graph workflow의 loop 엣지 또는 dynamic workflow 안의 반복 제어로 표현하며 종료 조건을 명시한다 (legacy 1.14 compat: `LoopAgent` + max iteration).

Process Flow:

- 반복되는 module 사이에 `loop:` prefix가 있는 edge data를 둔다.
- 종료 조건, 최대 반복, 실패 시 escalation이 없으면 `needs_info`를 남긴다.
- 고객 영향이나 거래 쓰기가 있으면 사람 검토 gate와 함께 검토한다.

## human_review

`workflow_kind: human_review`는 사람이 승인, 반려, 보완 요청, 정책 판단을 해야 할 때 사용한다.
ADK 2.0에서는 first-class human-input 노드로 매핑되어 일시정지/재개가 일급 추상화로 지원된다 (legacy 1.14 compat: 워크벤치 검토 gate 개념으로만 표현하고 runtime은 별도 구현).
워크벤치 관점에서는 두 경우 모두 동일하게 검토 gate로 분류한다.

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
명시적인 노드/엣지 그래프로 표현하는 것이 더 정확하면 `orchestration`이 아니라 `graph`를 사용한다.

Process Flow:

- 상위 workflow node를 두고 내부 branch, merge, loop, review gate를 edge data로 설명한다.
- 너무 많은 세부 단계를 한 node에 숨기지 않는다.
- 구현 세부가 불명확하면 `unknown`이 아니라 missing information을 남긴다.

## graph

`workflow_kind: graph`는 ADK 2.0 graph workflow처럼 노드와 엣지가 명시적으로 연결되어 결정적 라우팅, 병렬 fan-out, 내장 merge가 한 그래프 안에서 함께 동작할 때 사용한다.

흐름 신호:

- 라우팅 분기, 재시도, 병렬·머지, human-input gate가 한 흐름 안에서 모두 필요하다.
- 분기마다 경로가 다르고, 결과가 다시 한 노드로 모인다.
- 단순한 `sequential`/`parallel`/`loop` 단일 패턴으로 흐름이 설명되지 않는다.
- ADK 2.0 구현 관점에서는 graph workflow agent가 자연스럽게 매핑된다 (legacy 1.14 compat: 여러 stable agent를 외부에서 조립하거나 `orchestration`으로 우회 표현).

Process Flow:

- 그래프 토폴로지를 process flow node와 edge에 그대로 반영한다.
- 분기는 `branch:`, 병렬은 `parallel:`, 반복 경로는 `loop:` prefix를 edge data에 적는다.
- human-input gate는 별도 `human_review` candidate로 표현하고 edge로 연결한다.

## dynamic

`workflow_kind: dynamic`은 ADK 2.0 dynamic workflow처럼 코드(파이썬 조건/루프/커스텀 로직)가 제어 흐름을 직접 결정해야 할 때 사용한다.

흐름 신호:

- 외부 데이터 값이나 런타임 상태에 따라 매 호출마다 분기가 달라진다.
- 루프 횟수, 후속 단계 선택이 모델 응답이나 계산 결과에 의존한다.
- 선언적 graph로 표현하기에는 분기 가짓수가 너무 많거나, 조건이 정의될 시점이 런타임이다.
- ADK 2.0 구현 관점에서는 dynamic workflow가 자연스럽게 매핑된다. 그래프 일부에 dynamic 블록을 끼워 쓰는 경우라도, 동적 차원이 분류의 주된 이유라면 `dynamic`을 우선 선택한다 (legacy 1.14 compat: agent 내부 자체 제어 코드로 우회).

Process Flow:

- 동적 분기 자체가 핵심이면 단일 workflow node로 두고 rationale에 "런타임 조건에 따라 branch"라고 적는다.
- 그래도 외부에서 관찰 가능한 분기 패턴(branch, loop, parallel, human_review)이 있으면 process flow에 노출한다.
- 종료 조건과 안전망(max iteration, fallback, escalation)이 명시되지 않으면 `needs_info`를 남긴다.

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
| 고정 순서로 여러 단계를 실행해야 한다 | 2.0 graph workflow 직선 경로 (legacy 1.14: `SequentialAgent`) | `workflow_kind: sequential` | 앞 단계 산출물이 뒤 단계 입력인가? |
| 독립 작업을 동시에 실행하고 결과를 모아야 한다 | 2.0 graph workflow fan-out + 내장 merge (legacy 1.14: `ParallelAgent`) | `workflow_kind: parallel` | branch 사이 의존성이 없는가? merge 단계는 무엇인가? |
| 품질 충족, 재시도, 보완 요청까지 반복해야 한다 | 2.0 graph workflow loop 엣지 또는 dynamic workflow 반복 (legacy 1.14: `LoopAgent`) | `workflow_kind: loop` | 종료 조건, 최대 반복, 실패 escalation은 무엇인가? |
| 사람 승인이나 보완 요청이 필요하다 | 2.0 first-class human-input 노드 (legacy 1.14: workbench review gate 개념) | `workflow_kind: human_review` | 누가 승인하고, 승인/반려 결과가 어디로 흐르는가? |
| 라우팅 분기 + 병렬·머지 + human-input이 한 흐름 안에서 결정적으로 묶여야 한다 | 2.0 graph workflow agent | `workflow_kind: graph` | 그래프 노드와 엣지가 명시되었는가? 결정 지점과 종료 조건이 분명한가? |
| 런타임 조건/외부 값에 따라 매번 다른 경로를 코드가 직접 결정해야 한다 | 2.0 dynamic workflow | `workflow_kind: dynamic` | 동적 분기 조건은 무엇인가? 종료 조건과 fallback이 있는가? |
| trace, token 사용량, 모델 호출 흐름을 운영에서 관찰해야 한다 | 2.0 trace/token observability (1.14: 자체 logging) | category 변경 없음 — `artifacts_events` 또는 `callbacks` adk_hint로 기록 | 보존 범위, 열람 권한, 보존기간은? |
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
ADK 2.0 (Beta) 섹션(graph workflow, dynamic workflow, human-input 노드, trace/token observability)을 우선 조회하고, 1.14 stable agent 페이지는 legacy compat 질문일 때만 참조한다.

MCP가 최신 ADK 문서를 반환하더라도 active workbench 판단 기준은 이 문서다.
2.0 신규 기능과 API 이름은 구현 시 참고 자료일 뿐이며, 위에 명시된 `workflow_kind`/`module_category` 분류 외에 새 카테고리를 만드는 근거가 아니다.
