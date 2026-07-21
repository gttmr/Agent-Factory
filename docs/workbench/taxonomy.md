# Agent Factory 자산 택소노미(Taxonomy)

> 이 문서는 strict Target Contract v2의 자산 분류 단일 기준이다. 현재 Product 구현도 이 계약만 읽고 쓴다. 과거 결정과 제거된 입력은 [Taxonomy Migration Status](../migration/taxonomy-vnext-status.md)에서 확인한다.

Agent Factory가 재사용·검토·Catalog publish하는 최상위 자산은 Agent, Workflow, Tool뿐이다. Workflow 내부 실행 구조는 [Graph IR](graph-ir.md), 단계·승인·artifact 흐름은 [Operating Model](operating-model.md)이 소유한다.

## 계층 분리

아래 계층은 서로 보완하지만 하나의 enum이나 상속 트리로 합치지 않는다.

| 계층 | 답하는 질문 |
| --- | --- |
| 자산 택소노미 | 재사용·검토·publish할 자산은 무엇인가? |
| Graph IR | 이번 실행 구조에서 무엇을 어떤 순서로 실행하는가? |
| Invocation Control | Tool 사용 여부를 Workflow와 Agent 중 누가 결정하는가? |
| Binding | 자산을 어떤 방식으로 연결하는가? |
| Transport | 호출이 어떤 실행·통신 경로를 사용하는가? |
| Business Context | 어느 업무 범위에 적용되는가? |
| Ownership | 변경·운영·품질 책임은 누구에게 있는가? |
| Reuse Governance | 기존 자산 재사용 또는 Catalog publish 상태는 무엇인가? |

## 최상위 자산

직렬화 값은 `agent`, `workflow`, `tool` 세 가지뿐이다.

| 자산 | 정의 | 본질 |
| --- | --- | --- |
| Agent | 입력을 해석하고 판단·선택·분류·요약·추천·생성 등 추론 책임을 갖는 실행 자산 | 독립적인 판단 책임 |
| Workflow | 둘 이상의 실행 단위를 연결해 순서·분기·병렬·반복·사용자 입력·중단과 재개·종료 조건을 소유하는 실행 자산 | 흐름과 실행 제어 책임 |
| Tool | 명확한 입력 계약을 받아 특정 기능을 수행하고 구조화된 결과 또는 오류를 반환하는 호출 가능 자산 | 구조화된 기능 계약 |

### Agent가 아닌 분류

`Domain`, `Common`, `Shared`, `Specialist`, `Root`, `Sub`, `Coordinator`, `Worker`는 Agent 유형이 아니다. 이 말들은 업무 범위, Graph 역할, 위임 관계 또는 재사용 상태를 설명할 수 있지만 `asset_type`을 늘리지 않는다.

### Workflow는 큰 Agent가 아니다

Agent가 여러 단계를 수행하거나 여러 Tool을 쓴다는 이유만으로 Workflow가 되지 않는다. Workflow의 판별 기준은 명시적인 흐름과 실행 제어를 독립 책임으로 소유하는가이다.

### Tool subtype을 만들지 않는다

검색·계산·조회·변환 같은 기능 차이는 필수 subtype이 아니다. 발견성이 필요하면 선택적 다중 값 `capability_tags`를 사용한다. 태그는 `asset_type`, Binding, Owner, 보안 정책 또는 실행 계약을 대체하지 않는다.

## 자산이 아닌 것

| 대상 | 표현 | 판단 기준 |
| --- | --- | --- |
| DB 테이블·데이터셋 | Data Resource | 호출 기능이 아니라 읽거나 쓰는 데이터 자체다. |
| 규정집·문서 집합 | Knowledge Resource | 검색·판단 기능이 아니라 지식 내용 자체다. |
| 외부 시스템·endpoint | External Dependency 또는 Interface | 실행 자산이 접근하는 대상이다. |
| Workflow 내부 helper | 내부 코드 | 독립 실행·검토 경계가 아니다. |
| Workflow 내부 결정적 단계 | Function Node | 해당 Workflow 안에서만 의미가 있는 실행 단계다. |
| 사람 입력·승인 지점 | Human Input Node | 입력 계약과 중단·재개 지점이다. |
| 병렬 결과 합류 | Join Node | fan-in과 동기화를 위한 Graph 제어다. |
| MCP | Tool 연결 프로토콜 | Tool의 Binding으로 표현한다. |
| A2A | Agent 호출·노출 프로토콜 | Agent의 Binding 또는 Exposure로 표현한다. |

예를 들어 규정집은 Knowledge Resource, 규정 검색 기능은 Tool, 검색 결과를 적용할지 판단하는 책임은 Agent, 검색부터 승인까지의 실행 흐름은 Workflow다.

## Invocation Control

호출 결정권은 Tool을 실행할지 누가 정하는지를 나타낸다. 직렬화 값은 다음 둘뿐이다.

| 표시명 | `invocation_control` | 의미 |
| --- | --- | --- |
| Workflow | `workflow` | Workflow의 명시적 Graph가 Tool 실행을 결정한다. |
| Agent | `agent` | Agent가 런타임 상황을 판단해 사용 가능한 Tool의 호출 여부를 결정한다. |

Model 또는 LLM은 호출 결정권 소유자가 아니다. 모델은 Agent 내부 구현 요소다. 직렬화 위치와 Graph 표시는 [Tool Invocation Control](graph-ir.md#tool-invocation-control)을 따른다.

## Binding, Transport, Backend 분리

Binding은 자산 연결 방식, Transport는 실제 실행·통신 경로, Backend는 구현이 접근하는 의존성이다.

| 축 | 값 또는 예 | 의미 |
| --- | --- | --- |
| Tool Binding | `function`, `mcp`, `built_in`, `unresolved` | Tool 계약을 실행 환경에 연결하는 방식 |
| Agent Binding | `a2a` 또는 `null` | 원격 Agent를 A2A로 호출하는 연결 |
| Transport | `in_process`, `stdio`, `http`, `unknown` | 호출의 실제 경로 |
| Backend/Dependency | Database, Document AI, External Service | 자산 구현이 내부에서 접근하는 대상 |

`built_in`은 실행 프레임워크가 공식 Tool 계약으로 제공·관리하는 기능에만 사용한다. 일반 내부 함수는 근거 없이 `built_in`으로 분류하지 않는다.

### “Local Tool”은 유형이 아니다

| 실행 사례 | Binding | Transport | Backend 예 |
| --- | --- | --- | --- |
| 로컬 함수 Tool | `function` | `in_process` | 내부 라이브러리 |
| 로컬 MCP Tool | `mcp` | `stdio` | 로컬 MCP server |
| 원격 MCP Tool | `mcp` | `http` | 원격 MCP server |

위치는 Transport로, 연결 방식은 Binding으로 각각 표현한다.

## A2A 경계

A2A는 Agent의 프로토콜 경계이며 자산 category가 아니다.

```yaml
# 원격 Agent 호출
asset_id: agent.external-document-reviewer
asset_type: agent
binding:
  kind: a2a
  contract_ref: a2a.document-review

---

# Agent 노출
asset_id: agent.document-review-provider
asset_type: agent
exposure:
  protocol: a2a
  contract_ref: a2a.document-review-provider
```

A2A 계약은 Agent Card, interface, lifecycle, auth, timeout, retry, fallback, cancellation, audit, data policy를 소유한다. A2A Agent를 Tool이나 별도 Catalog category로 바꾸지 않으며 Workflow에 A2A Binding 또는 Exposure를 부여하지 않는다.

## Business Context와 Ownership

Business Context는 적용 범위이고 Ownership은 변경·운영·품질 책임이다. Owner는 Domain과 같지 않다.

| 필드 | 허용 값 또는 형식 | 의미 |
| --- | --- | --- |
| `domain_scope` | `domain_specific`, `cross_domain`, `domain_neutral` | 하나의 업무, 여러 업무, 업무 중립 중 적용 범위 |
| `business_domains` | 업무 Domain 식별자 목록 | 실제 업무 범위 |
| `owner` | 책임 조직 식별자 | 변경·운영·품질 책임 팀 |

여러 업무에서 쓰인다는 사실은 `cross_domain` 또는 `domain_neutral`로, 책임 조직은 `owner`로 표현한다. Tool Node는 참조한 Tool 자산의 Owner를 유지하고 Function Node는 부모 Workflow의 맥락을 상속한다.

### OCR 자산 예시

```yaml
- asset_id: tool.ocr-text-extraction
  asset_type: tool
  domain_scope: domain_neutral
  business_domains: []
  owner: AI공통플랫폼팀

- asset_id: workflow.loan-document-review
  asset_type: workflow
  domain_scope: domain_specific
  business_domains: [loan]
  owner: 여신AI팀

- asset_id: tool.loan-application-ocr
  asset_type: tool
  domain_scope: domain_specific
  business_domains: [loan]
  owner: 여신AI팀
```

일반 OCR Tool이 여러 업무에서 쓰인다는 이유로 Owner가 각 업무 팀으로 바뀌지 않는다. 여신 전용 입력·오류·감사 계약이 독립적이면 별도 Tool로 검토할 수 있다.

## Workflow Profile

Workflow만 non-null `workflow_profile`을 갖는다. Agent와 Tool의 `workflow_profile`은 `null`이다.

```yaml
workflow_profile:
  representation: graph | dynamic | unresolved
  coordination: explicit | agent_delegation | mixed
  template_ref: string | null
```

| 축 | 값 | 해석 |
| --- | --- | --- |
| `representation` | `graph` | Node와 Edge가 명시된 Graph |
| `representation` | `dynamic` | 런타임 코드가 조건·반복·재귀 등 경로를 결정 |
| `representation` | `unresolved` | 정보 부족으로 표현 방식을 확정하지 못함 |
| `coordination` | `explicit` | 명시적 흐름이 실행 단위를 조정 |
| `coordination` | `agent_delegation` | Agent가 상황에 따라 다른 Agent로 위임 |
| `coordination` | `mixed` | 명시적 흐름과 Agent 위임을 함께 사용 |
| `template_ref` | 문자열 또는 `null` | 검토된 구현 패턴·template artifact 참조. ADK의 deprecated Template Workflow 클래스 선택기가 아님 |

정보가 부족하면 `representation: unresolved`, `status: needs_info`, `missing_information`을 함께 기록한다. 설명용 단어를 Workflow subtype으로 추가하지 않는다.

## Reuse Governance

재사용 상태는 자산 종류와 분리한다.

| `reuse_status` | 의미 |
| --- | --- |
| `not_reviewed` | 재사용 판단을 시작하지 않음 |
| `reuse_existing` | 검토된 기존 자산을 참조 |
| `publish_candidate` | Catalog 등록 후보 |
| `project_only` | 현재 프로젝트 안에서만 사용 |
| `excluded` | 재사용·등록 대상에서 제외 |

`capability_tags`는 검색용 선택 필드이며 자산 유형, 생성 경로, 보안 정책, Owner 또는 `reuse_status`를 결정하지 않는다.

## 판별 질문

1. 입력을 해석해 독립적으로 판단·선택·분류·요약·추천·생성하는가? 그렇다면 Agent 후보다.
2. 둘 이상의 실행 단위를 연결하고 순서·분기·병렬·반복·입력 대기·중단과 재개·종료 조건을 소유하는가? 그렇다면 Workflow 후보다.
3. 명확한 입력 계약으로 특정 기능을 수행하고 구조화된 결과 또는 오류를 반환하는가? 그렇다면 Tool 후보다.
4. 실행 기능이 아니라 데이터·문서·지식·외부 시스템·endpoint 자체인가? 그렇다면 Resource, Dependency 또는 Interface다.
5. 하나의 Workflow 안에서만 의미가 있고 Graph 도달 시 결정적으로 실행되는 private 단계인가? 그렇다면 Function Node 후보다.
6. 판단에 필요한 정보가 부족한가? 새 유형을 만들지 말고 `status: needs_info`와 `missing_information`을 기록한다.

## 금지되는 분류 패턴

| 금지 표현 | strict v2 처리 |
| --- | --- |
| Adapter를 네 번째 자산 유형으로 둔다 | Tool, Resource, Dependency 중 실제 책임을 다시 판별한다. |
| Remote A2A를 자산 category로 둔다 | Agent + A2A Binding/Exposure로 표현한다. |
| Shared, Specialist, Coordinator를 Agent 종류로 둔다 | 업무 범위, Graph 역할, 위임 관계, 재사용 상태로 분리한다. |
| Model 또는 LLM이 Invocation Control을 소유한다 | `workflow` 또는 `agent`만 사용한다. |
| 검색·계산·조회·변환 subtype을 만든다 | 필요하면 `capability_tags`를 사용한다. |
| 정보 부족을 정상 유형으로 만든다 | `unresolved`, `needs_info`, `missing_information`으로 드러낸다. |

## 지원하지 않는 입력

strict v2 read boundary는 legacy 전용 field, 제거된 category, 버전 없는 root를 변환하거나 보정하지 않고 거부한다. `module_category`, `adapter_kind`, `agent_kind`, `workflow_kind`, `runtime_binding`, `legacy_recommended_type`과 `asset_type: remote_a2a`는 지원하지 않는다. 입력을 수동 mapping하거나 load-time projection하지 말고 현재 Analyze/Design 경로에서 v2 artifact를 다시 생성한다.

## Current source locators

2026-07-19 현재 working tree에서 아래 path와 symbol을 재확인했다. locator는 탐색점이며 소스가 최종 권위다.

| 계약 표면 | Path | Stable symbol |
| --- | --- | --- |
| 자산·Binding·Workflow Profile enum과 TypeScript shape | `packages/web/src/analyzer/types.ts` | `TARGET_CONTRACT_VERSION`, `assetTypes`, `AssetCandidate`, `WorkflowProfile` |
| strict analysis read 검증 | `packages/web/src/analyzer/targetContract.ts` | `validateTargetAnalysisResult`, `assertTargetAnalysisResult` |
| 자산 JSON Schema | `schemas/asset-candidate.schema.json` | root schema와 `allOf` 자산별 제약 |
| Catalog strict read | `packages/web/src/catalog/catalogIndex.ts` | `parseCatalogIndexPayload`, `parseCatalogDocument` |
| Catalog bucket 선택 | `packages/web/server/catalogPublishTarget.ts` | `targetCatalogFile` |
| validator enum | `scripts/artifact-validation/constants.mjs` | `targetContractVersion`, `assetTypes`, `invocationControls` |

Catalog read와 publish는 `catalog/agents.yaml`, `catalog/workflows.yaml`, `catalog/tools.yaml`만 사용한다.
