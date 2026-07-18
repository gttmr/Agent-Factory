> 이 문서는 Target Contract다. 현재 구현과의 차이는 [docs/migration/taxonomy-vnext-status.md](../migration/taxonomy-vnext-status.md)가 기록한다.

# Agent Factory 자산 택소노미(Taxonomy)

이 문서는 Agent Factory가 재사용·검토하는 자산과 그 자산에 부여하는 업무·소유·재사용 속성의 단일 기준이다. 그래프에서 자산을 실행하는 방법은 [Graph IR](graph-ir.md), 작업 단계와 승인 흐름은 [Operating Model](operating-model.md), 현재 구현과의 차이는 [Migration Status](../migration/taxonomy-vnext-status.md)가 맡는다.

## 계층 분리

분류를 시작할 때 먼저 어떤 질문에 답하려는지 정한다. 아래 계층은 서로 보완하지만 하나의 enum이나 상속 트리에 섞지 않는다.

| 계층 | 답하는 질문 |
| --- | --- |
| 자산 택소노미(Asset Taxonomy) | 재사용·검토할 자산은 무엇인가? |
| 그래프 중간 표현(Graph IR) | 이번 Workflow에서 무엇을 실행하는가? |
| 호출 결정권(Invocation Control) | Tool 사용 여부를 누가 결정하는가? |
| 바인딩(Binding) | 자산을 어떤 방식으로 연결하는가? |
| 전송(Transport) | 실제 통신·실행 경로는 무엇인가? |
| 업무 맥락(Business Context) | 어떤 업무 의미와 적용 범위를 갖는가? |
| 소유권(Ownership) | 변경·운영·품질 책임은 누구에게 있는가? |
| 재사용 거버넌스(Reuse Governance) | 기존 자산을 재사용하거나 Catalog 후보로 검토할 상태인가? |
| 운영 모델(Operating Model) | 분석·설계·검토·Handoff·검증을 어떤 단계로 수행하는가? |
| Handbook | 특정 행동은 저장소의 어디에서 구현되는가? |
| Migration Status | Target Contract와 Current Implementation의 차이는 무엇인가? |

## 최상위 자산

최상위 자산은 에이전트(Agent), 워크플로(Workflow), 도구(Tool) 세 가지뿐이다. 역할명, 업무 범위, 연결 프로토콜, 재사용 상태로 새 자산 유형을 만들지 않는다.

| 자산 | 정의 | 본질 |
| --- | --- | --- |
| Agent | 입력을 해석하고 판단·선택·분류·요약·추천·생성 등 추론 책임을 갖는 실행 자산이다. 상황에 따른 Tool 사용 여부와 다른 Agent로의 위임 여부를 판단할 수 있다. | 독립적인 판단 책임 |
| Workflow | 둘 이상의 실행 단위를 연결해 순서·분기·병렬·반복·사용자 입력·중단과 재개·종료 조건을 소유하는 실행 자산이다. | 흐름과 실행 제어 책임 |
| Tool | 명확한 입력 계약을 받아 특정 기능을 수행하고 명확한 결과 또는 오류를 반환하는 호출 가능 자산이다. | 구조화된 기능 계약 |

### Agent가 아닌 분류

`Domain`, `Common`, `Shared`, `Specialist`, `Root`, `Sub`, `Coordinator`, `Worker`는 Agent의 자산 유형이 아니다. 이 말들은 필요할 때 업무 범위, 재사용 상태, Graph 내 역할, 위임 관계를 설명할 뿐이다. Agent의 분류는 판단 책임이 독립적인지로 결정한다.

### Workflow는 큰 Agent가 아니다

Workflow의 핵심은 흐름 소유다. Agent가 여러 단계를 수행하거나 여러 Tool을 쓴다는 이유만으로 Workflow가 되지 않으며, Workflow 안에 Agent가 포함된다는 이유로 Workflow를 Agent의 크기 변형으로 정의하지 않는다.

### Tool subtype을 만들지 않는다

검색·계산·조회·변환 같은 기능 차이는 필수 subtype이 아니다. 발견성을 높여야 할 때만 선택적 다중 값 `capability_tags`를 사용한다. 태그는 자산 유형이나 실행 계약을 대체하지 않는다.

## 자산이 아닌 것

| 대상 | Target 표현 | 판단 기준 |
| --- | --- | --- |
| DB 테이블·데이터셋 | 데이터 리소스(Data Resource) | 호출 기능이 아니라 읽거나 쓰는 데이터 자체다. |
| 규정집·문서 집합 | 지식 리소스(Knowledge Resource) | 검색·판단 기능이 아니라 지식 내용 자체다. |
| 외부 시스템 | 외부 의존성(External Dependency) | 실행 자산이 접근하는 시스템이다. |
| API endpoint 자체 | 외부 인터페이스/의존성(External Interface/Dependency) | 연결 대상이며 독립 판단이나 기능 계약과 같지 않다. |
| Workflow 내부 helper | 내부 코드 | Graph의 독립 실행·검토 경계가 아니다. |
| Workflow 내부 결정적 단계 | Function Node | 해당 Workflow 안에서만 의미가 있는 실행 단계다. |
| 사람 입력·승인 지점 | Human Input Node | 사용자 입력 계약과 중단·재개 지점이다. |
| 병렬 결과 합류 | Join Node | fan-in과 동기화를 위한 실행 제어다. |
| MCP | Tool 연결 프로토콜 | Tool 자산에 접근하거나 Tool을 노출하는 연결 방식이다. |
| A2A | Agent 노출·호출 프로토콜 | Agent 간 원격 프로토콜 경계다. |

예를 들어 규정집은 Knowledge Resource, 규정 검색 기능은 Tool, 검색 결과를 적용할지 판단하는 책임은 Agent, 검색 후 판단과 승인까지 이어지는 흐름은 Workflow다.

## Invocation Control

호출 결정권(Invocation Control)은 Tool을 실행할지 누가 정하는지를 나타낸다. 자산 유형이나 Binding과 혼합하지 않는다.

| 표시명 | 직렬화 | 의미 |
| --- | --- | --- |
| Workflow | `workflow` | Workflow의 명시적 Graph가 Tool 실행을 결정한다. |
| Agent | `agent` | Agent가 런타임 상황을 판단해 Tool 사용 여부를 결정한다. |

사람 대상 Target 문서에서는 Model이나 LLM을 호출 결정권자로 두지 않는다. 모델은 Agent 내부 구현 요소다. Graph 표현과 예시는 [Graph IR의 Tool Invocation Control](graph-ir.md#tool-invocation-control)을 따른다.

## Binding, Transport, Backend 분리

Binding은 Tool을 연결하는 방식, Transport는 실제 실행 경로, Backend는 Tool이 내부에서 접근하는 의존성이다. 세 축을 결합한 Tool subtype을 만들지 않는다.

| 축 | Target 값 또는 예 | 의미 |
| --- | --- | --- |
| Tool Binding | `function`, `mcp`, `built_in`, `unresolved` | Tool 계약을 실행 환경에 연결하는 방식 |
| Transport | `in_process`, `stdio`, `http`, `unknown` | 호출이 실제로 이동하거나 실행되는 경로 |
| Backend/Dependency | EAI, Legacy API, Database, Document AI, External Service | Tool 구현이 내부에서 접근하는 대상 |

`built_in`은 프레임워크가 공식 Tool 계약으로 제공·관리하는 기능에만 사용한다. ADK 공식 문서는 Agent의 `tools`에 native function, `BaseTool` 구현, `AgentTool`을 둘 수 있고 native function은 `FunctionTool`로 감싼다고 설명한다. 따라서 일반 내부 함수나 단순 라이브러리 호출을 근거 없이 `built_in`으로 분류하지 않는다. 근거는 [ADK LLM agents](https://adk.dev/agents/llm-agents/index.md)와 [Function tools](https://adk.dev/tools-custom/function-tools/index.md)를 따른다.

### “Local Tool”은 유형이 아니다

| 실행 사례 | Binding | Transport | Backend 예 |
| --- | --- | --- | --- |
| 로컬 함수 Tool | `function` | `in_process` | 없음 또는 내부 라이브러리 |
| 로컬 MCP Tool | `mcp` | `stdio` | 로컬 프로세스 |
| 원격 MCP Tool | `mcp` | `http` | 원격 MCP server |
| EAI에 접근하는 Function Tool | `function` | `in_process` | EAI |

로컬과 MCP는 반대 개념이 아니다. 위치는 Transport로, 연결 방식은 Binding으로 각각 표현한다. ADK 공식 문서도 MCP 연결을 local `stdio`와 remote HTTP 계열로 구분한다([MCP tools](https://adk.dev/tools-custom/mcp-tools/index.md)).

## A2A 경계

A2A는 자산 유형이 아니라 Agent를 노출하거나 호출하는 프로토콜이다. 원격 Agent를 호출하는 계약은 `asset_type: agent`와 `binding.kind: a2a`, Agent를 노출하는 계약은 `asset_type: agent`와 `exposure.protocol: a2a`로 표현한다.

```yaml
# 원격 Agent 호출 계약
asset_id: agent.external-document-reviewer
asset_type: agent
binding:
  kind: a2a

---

# Agent 노출 계약
asset_id: agent.document-review-provider
asset_type: agent
exposure:
  protocol: a2a
```

A2A 연결 계약은 독립 Owner, Agent Card, lifecycle, auth, timeout, audit를 관리한다. 원격 호출 여부가 Agent의 판단 책임을 바꾸지 않으며, A2A를 Tool/MCP 호출과 혼합하지 않는다.

2026-07-18에 확인한 ADK 공식 문서는 기존 ADK Agent를 A2A server로 노출하고 `RemoteA2aAgent`로 소비하는 방법을 설명하지만, Workflow를 A2A로 노출한다고 직접 명시한 문장은 확인되지 않았다. Workflow 노출을 일반 규칙으로 확장하지 않는다. 자세한 근거는 [ADK A2A](https://adk.dev/a2a/index.md)와 [A2A exposing](https://adk.dev/a2a/quickstart-exposing/index.md)을 따른다.

## Business Context와 Ownership

업무 맥락(Business Context)은 자산이 적용되는 범위이고, 소유권(Ownership)은 변경·운영·품질 책임이다. 두 축을 분리하며 Owner는 Domain과 같지 않다.

| 필드 | 허용 값 또는 형식 | 의미 |
| --- | --- | --- |
| `domain_scope` | `domain_specific`, `cross_domain`, `domain_neutral` | 하나의 업무, 여러 업무, 업무 중립 중 어디에 해당하는지 표현한다. |
| `business_domains` | 업무 Domain 식별자 목록 | `domain_specific` 또는 `cross_domain`의 실제 업무 범위를 기록한다. |
| `owner` | 책임 조직 식별자 | 변경·운영·품질에 책임지는 팀을 기록한다. |

`공통`은 고객·수신·여신·카드·리스크와 같은 Business Domain 값이 아니다. 여러 업무에서 쓸 수 있다는 사실은 `cross_domain` 또는 `domain_neutral`로, 책임 조직은 `owner`로 표현한다. Tool Node는 참조한 Tool 자산의 Owner를 유지하고 Function Node는 부모 Workflow의 맥락을 상속한다.

### OCR 자산 예시

일반 OCR Tool, 여신 Workflow, 여신 전용 OCR Tool은 서로 다른 업무 범위와 소유 책임을 가질 수 있다.

```yaml
- asset_id: tool.ocr-text-extraction
  asset_type: tool
  name: OCR 텍스트 추출
  domain_scope: domain_neutral
  business_domains: []
  owner: AI공통플랫폼팀

- asset_id: workflow.loan-document-review
  asset_type: workflow
  name: 여신 문서 검토
  domain_scope: domain_specific
  business_domains:
    - loan
  owner: 여신AI팀

- asset_id: tool.loan-application-ocr
  asset_type: tool
  name: 여신 신청서 OCR
  domain_scope: domain_specific
  business_domains:
    - loan
  owner: 여신AI팀
```

일반 OCR Tool이 여러 업무에서 쓰인다는 이유로 Owner가 각 업무 팀으로 바뀌지 않는다. 반대로 여신 전용 입력·오류·감사 계약이 독립적이라면 `tool.loan-application-ocr`을 별도 Tool로 검토할 수 있다.

## Workflow Profile

Workflow의 표현 방식과 조정 방식을 서로 다른 축으로 기록한다.

```yaml
workflow_profile:
  representation: graph | dynamic | unresolved
  coordination: explicit | agent_delegation | mixed
  template_ref: string | null
```

| 축 | 값 | 해석 |
| --- | --- | --- |
| `representation` | `graph` | Node와 Edge가 명시된 Graph로 표현한다. |
| `representation` | `dynamic` | 런타임 코드가 조건·반복·재귀 등 경로를 결정한다. |
| `representation` | `unresolved` | 증거가 부족해 표현 방식을 확정하지 못했다. |
| `coordination` | `explicit` | Workflow의 명시적 흐름이 실행 단위를 조정한다. |
| `coordination` | `agent_delegation` | Agent가 상황에 따라 다른 Agent로 위임한다. |
| `coordination` | `mixed` | 명시적 흐름과 Agent 위임을 함께 사용한다. |
| `template_ref` | 문자열 또는 `null` | 검토된 구현 패턴 참조이며 subtype이 아니다. |

`orchestration`은 Workflow subtype이 아니다. 조정 책임에 대한 설명이나 태그로만 사용할 수 있다. `collaborative`는 coordination 관점의 설명이고, `template`은 구현 패턴 참조다.

정보 부족도 정상 유형으로 만들지 않는다. 아직 결정할 수 없다면 `representation: unresolved`, `status: needs_info`, `missing_information`을 함께 기록한다.

## Reuse Governance

재사용 거버넌스(Reuse Governance)는 자산 종류와 분리된 검토 상태다. 필드명은 모든 Target 문서에서 `reuse_status`를 사용한다.

| `reuse_status` | 의미 |
| --- | --- |
| `not_reviewed` | 재사용 판단을 아직 시작하지 않았다. |
| `reuse_existing` | 검토된 기존 자산을 참조한다. |
| `publish_candidate` | Catalog 등록 후보로 검토한다. |
| `project_only` | 현재 프로젝트 안에서만 사용한다. |
| `excluded` | 재사용·등록 대상에서 제외한다. |

`capability_tags`는 검색과 발견을 위한 선택적 다중 태그다. 다음 사항을 결정해서는 안 된다.

- Agent/Workflow/Tool 자산 유형
- 생성 경로 또는 실행 분기
- 필수 subtype
- 보안·권한 정책
- Owner
- `domain_scope`와 `business_domains`
- `reuse_status`

## 판별 질문

분석자는 아래 순서대로 묻는다. 앞 질문에서 책임 경계가 확인되면 뒤 질문은 그 경계를 보완하는 데 사용한다.

1. 입력을 해석해 독립적으로 판단·선택·분류·요약·추천·생성하는 책임이 있는가? 그렇다면 Agent 후보다.
2. 둘 이상의 실행 단위를 연결하고 순서·분기·병렬·반복·입력 대기·중단과 재개·종료 조건을 소유하는가? 그렇다면 Workflow 후보다.
3. 명확한 입력 계약을 받아 특정 기능을 수행하고 결과 또는 오류를 구조화해 반환하는가? 그렇다면 Tool 후보다.
4. 실행 기능이 아니라 데이터·문서·지식·외부 시스템·endpoint 자체인가? 그렇다면 Resource, Dependency 또는 Interface로 표현한다.
5. 하나의 Workflow 안에서만 의미가 있고 Graph 도달 시 결정적으로 실행되는 private 단계인가? 그렇다면 Function Node 후보이며 Catalog 자산으로 분류하지 않는다.
6. 위 판단에 필요한 정보가 부족한가? 새 유형을 만들지 말고 `status: needs_info`와 `missing_information`을 기록한다.

## 금지되는 분류 패턴

아래 표현은 Target Contract의 활성 기준으로 사용할 수 없다.

| 금지 표현 | 이유와 Target 해석 |
| --- | --- |
| “Adapter는 callable capability다” | Adapter를 최상위 자산으로 유지하지 않는다. 문맥에 따라 Tool, Resource, Dependency를 판별한다. |
| “Remote A2A는 네 번째 module category다” | A2A는 Agent의 Binding 또는 Exposure protocol이다. |
| “Agent는 specialist 또는 shared다” | 역할·재사용 범위는 Agent 유형이 아니다. |
| “공통 Agent” | 업무 범위, Owner, 재사용 상태를 분리한다. |
| “Domain Agent” | Business Context는 Agent 유형이 아니다. |
| “Model이 Invocation Control을 소유한다” | 사람 대상 기준에서는 Agent가 Tool 사용 여부를 판단한다. |
| “LLM-selected 공식 호출 제어” | Target 직렬화는 Invocation Control: Agent인 `agent`를 사용한다. |
| “계산 Tool subtype” | 계산은 필요할 때 `capability_tags`로 찾는다. |
| “Retrieval Adapter subtype” | 검색 기능이면 Tool 후보로, 지식 자체면 Knowledge Resource로 판별한다. |
| “unknown은 정상 종류다” | `unresolved`와 `needs_info`, `missing_information`으로 미결 상태를 드러낸다. |

## Current Implementation 대응(`legacy`)

현재 코드와 스키마는 아래 `legacy` vocabulary를 직렬화한다. 이 표는 현행 값을 Target 관점에서 읽기 위한 대응표이며, 현재 구현이 Target Contract를 지원한다는 뜻이 아니다. 상세 gap은 [Migration Status](../migration/taxonomy-vnext-status.md)가 기록한다.

| `legacy` | Target 해석 | 비고 |
| --- | --- | --- |
| `module_category: agent` | Agent 자산 후보 | 필드명과 주변 enum은 `legacy`다. |
| `module_category: workflow` | Workflow 자산 후보 | Target Workflow Profile은 별도 축이다. |
| `module_category: adapter` | 문맥에 따라 Tool, Resource 또는 Dependency | 일괄 Tool 변환 대상이 아니다. |
| `module_category: remote_a2a` | Agent 자산 + A2A Binding/Exposure | 원격 프로토콜을 자산 유형으로 직렬화하는 `legacy` 값이다. |
| `adapter_kind` (8종: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, `unknown`) | Tool의 선택적 `capability_tags`, Resource/Dependency, 또는 미결 정보로 재판별 | 여덟 subtype을 Target 필수 분류로 사용하지 않는다. |
| `agent_kind` (`specialist`, `shared`) | 업무 맥락·Graph 역할·재사용 상태로 분리 | Agent subtype으로 계승하지 않는다. |
| `workflow_kind: orchestration` | 조정 책임 설명; `workflow_profile`로 별도 판별 | Target subtype이 아니다. |
| `workflow_kind: graph` 및 `workflow_kind: dynamic` | `workflow_profile.representation`의 `graph`/`dynamic` 후보 | coordination과 `template_ref`는 별도 검토한다. |
| `workflow_kind: unknown` | `representation: unresolved` + `status: needs_info` + `missing_information` | 정상 유형으로 계승하지 않는다. |
| `runtime_binding` | Binding, Transport, Backend/Dependency로 분리 | `direct_api`, `mcp`, `mcp_tool`, `local_function`, `remote_a2a`, `workflow_call`, `ui_input`, `unresolved` 등을 한 축에 둔 `legacy` 필드다. |
| `legacy_recommended_type` | migration metadata | primary classifier가 아니다. |

## ADK 확인 기준

ADK 공식 문서 근거는 2026-07-18에 확인했다. 확인 결과는 Target Taxonomy를 프레임워크 용어와 혼동하지 않도록 다음 원칙으로 사용한다.

- ADK는 Agent를 목표를 자율적으로 달성하는 실행 단위로 설명하고, model·instruction·tools를 Agent의 구성요소로 둔다. Tool 선택을 사람 대상 Taxonomy에서 표현할 때는 Agent의 판단으로 기술한다([Agents](https://adk.dev/agents/index.md), [LLM agents](https://adk.dev/agents/llm-agents/index.md)).
- ADK Workflow 문서는 graph-based, dynamic, collaborative, template을 상호 배타적인 단일 subtype보다 여러 구축 방법과 상호 보완적 구성 방식으로 설명한다. Target Contract가 representation과 coordination을 분리하는 근거로 사용한다([Workflows](https://adk.dev/workflows/index.md), [Graphs](https://adk.dev/graphs/index.md)).
- ADK Graph는 Agent, Tool, human input task, code function을 Node로 둘 수 있다고 설명한다. Catalog 자산과 Graph Node를 분리하는 근거다([Graphs](https://adk.dev/graphs/index.md)).
- Native function은 Agent의 tools 목록에서 `FunctionTool`로 감싸지며, Function Tool은 ADK Tool 체계에 속한다([Function tools](https://adk.dev/tools-custom/function-tools/index.md)).
- MCP는 external application, data source, tool과의 연결을 표준화하는 프로토콜이고, A2A는 원격 Agent 간 통신 프로토콜이다([MCP](https://adk.dev/mcp/index.md), [A2A](https://adk.dev/a2a/index.md)).
- A2A 지원은 확인한 공식 문서에서 Experimental로 표시되어 있다. Workflow A2A 노출은 직접 근거가 발견되지 않았으므로 일반화하지 않는다.

ADK 버전 번호는 Taxonomy의 본질이 아니다. 버전은 특정 연결·실행 기능을 검증할 때의 근거 메타데이터이며, Agent/Workflow/Tool의 책임 정의를 바꾸는 자산 분류값으로 사용하지 않는다.
