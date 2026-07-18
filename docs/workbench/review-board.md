# Agent Factory 검토 보드(Review Board)

> 이 문서는 Target Contract의 검토 정책이다. 자산 정의와 속성 값은 [Taxonomy](taxonomy.md), 실행 구조와 호출 관계는 [Graph IR](graph-ir.md), 단계와 승인 게이트는 [Operating Model](operating-model.md)이 단일 기준이다. 이 문서는 그 정의를 다시 만들지 않는다.

검토 보드는 분석 후보를 승인 가능한 설계 artifact로 바꾸는 사람 중심 결정 표면이다. Analyzer나 skill이 제안한 분류·계약·상태는 근거이지 결정이 아니며, 검토자는 각 축을 독립적으로 확인한다.

## Target Contract: 검토 축

| 검토 축 | 검토자가 판단할 질문 | 승인에 필요한 근거 |
| --- | --- | --- |
| 자산 유형 | 독립 판단 책임, 흐름 소유, 구조화된 호출 기능 중 무엇인가? 실행 자산이 아니라 Resource 또는 Dependency인가? | [Agent/Workflow/Tool 판별 기준](taxonomy.md#판별-질문)에 따른 책임 근거와 반례 |
| 책임 경계 | 후보가 소유하는 결정·흐름·기능은 어디까지이며 다른 자산과 어디서 분리되는가? | 한 문장 책임, 포함·제외 범위, 상·하위 경계 |
| 입출력 계약 | 호출자가 무엇을 제공하고 무엇을 받으며 오류·빈 결과·부분 결과는 어떻게 드러나는가? | 검토 가능한 입력·출력 schema, 오류 계약, 예시 또는 synthetic smoke 근거 |
| Domain Scope | 적용 범위와 실제 Business Domain이 구분되어 있는가? | [Business Context 기준](taxonomy.md#business-context와-ownership)에 맞는 범위 근거 |
| Owner | 변경·운영·품질·장애 대응 책임자가 명확한가? Domain과 Owner를 혼동하지 않았는가? | 책임 조직과 경계 간 합의 또는 확인 필요 기록 |
| Reuse 상태 | 기존 자산을 재사용할지, 등록 후보인지, 프로젝트 전용인지 결정했는가? | [Taxonomy의 `reuse_status`](taxonomy.md#reuse-governance), Catalog 근거, 버전·중복 검토 |
| Binding | Tool 또는 Agent 경계를 어떤 방식으로 연결하며 미결 연결을 확정된 것처럼 쓰지 않았는가? | [Binding 기준](taxonomy.md#binding-transport-backend-분리), 연결 대상, 필요한 계약 |
| Invocation Control | Tool 실행을 Workflow의 명시적 Graph가 결정하는가, Agent가 상황을 판단하는가? | [Workflow/Agent 호출 결정권](graph-ir.md#tool-invocation-control)과 실제 실행 관계의 일치 |
| 보안·감사·side effect | 권한, 개인정보·금융정보, 외부 메시지, 거래 쓰기, 감사, 재시도 시 중복 효과를 드러냈는가? | 위험 신호, 승인 주체, audit evidence, 실패·재시도·보상 경계 |
| missing information | 현재 증거로 확정할 수 없는 정보가 무엇이며 어느 결정을 막는가? | 질문, 필요한 답변 주체, 영향받는 축, 해소 또는 수용 근거 |

### 유형 승인 규칙

`Shared`, `Common`, `Specialist`, `Root`, `Sub`, `Coordinator`, `Worker` 여부를 Agent 종류로 승인하지 않는다. 여러 Domain에서 쓰이는지, 누가 소유하는지, 어떤 Graph 역할을 맡는지, 재사용 검토 상태가 무엇인지를 각각 해당 축에 기록한다. 이 원칙의 상세 의미는 [Taxonomy](taxonomy.md#agent가-아닌-분류)를 따른다.

### 호출 관계 승인 규칙

Workflow가 Tool을 고정 단계로 호출하면 Graph의 Tool Node와 명시적 실행 경로를 검토한다. Agent가 Tool 사용 여부를 판단하면 Agent가 사용할 수 있는 Tool 관계를 검토하며, 이를 고정 실행 순서로 승인하지 않는다. Binding과 Transport는 호출 결정권을 대신하지 않는다.

### 보안·원격 경계 승인 규칙

side effect가 있는 자산은 권한, idempotency, 재시도, 보상, audit, 데이터 보존 경계를 입력·출력 계약과 함께 검토한다. 위험 신호는 자동 반려 사유가 아니지만, 필요한 사람 승인이나 통제가 빠진 상태에서는 승인하지 않는다.

A2A는 자산 유형이 아니라 Agent의 원격 연결 경계다. 독립 Owner, discovery 계약, auth, lifecycle, timeout, retry, fallback, audit 정보가 없으면 추정하지 않고 추가정보로 돌린다. 자세한 운영 원칙은 [Operating Model의 원격 경계](operating-model.md#6-원격-경계a2a-고마찰-원칙)를 따른다.

## Target Contract: 승인 결정

아래 값은 검토자가 내리는 결정의 사람 대상 표시명이다. 별도의 자산 subtype이나 재사용 상태가 아니다.

| 결정 | 적용 기준 | 후속 상태 |
| --- | --- | --- |
| 승인 | 모든 필수 축에 근거가 있고, 남은 불확실성이 해당 자산의 계약과 Handoff를 막지 않는다. | 승인 artifact에 포함할 수 있다. |
| 보류 | 후보와 근거는 유효하지만 현재 범위·시점에서는 결정하거나 사용할 필요가 없다. | 보류 이유와 재검토 조건을 남긴다. |
| 반려 | 책임 경계가 성립하지 않거나 중복·오분류·계약 결함 때문에 후보로 사용할 수 없다. | 반려 근거를 남기고 승인 artifact에서 제외한다. |
| 추가정보 | 필수 사실이 없어 유형·경계·계약·통제를 안전하게 결정할 수 없다. | `missing_information`과 차단되는 결정을 기록한다. |

승인은 두 층 missing-information 게이트와 함께 해석한다. 요구사항 수준 정보 부족은 분석 검토의 soft gate이고, 후보 수준 정보 부족은 후보 승인과 Runtime Handoff를 막는 hard gate다. 검토 결정, artifact 저장, validation 성공은 게이트를 자동으로 변경하지 않는다. 전체 관계는 [Operating Model의 승인 게이트 모델](operating-model.md#3-승인-게이트-모델)이 단일 기준이다.

## 검토 기록 최소 요건

각 후보 기록은 최소한 다음 내용을 추적할 수 있어야 한다.

- 후보를 뒷받침하는 requirement evidence
- 자산 유형과 한 문장 책임 경계
- 입출력·오류 계약
- Domain Scope와 Owner
- `reuse_status`와 Catalog 근거
- 필요한 Binding과 Invocation Control
- 보안·감사·side effect 검토 결과
- 미해결 정보, 해소 근거, 최종 결정과 이유

Catalog에서 참조한 기존 자산은 원본 Catalog 계약과 이번 Workflow의 입력·출력 매핑을 구분한다. 현재 설계 artifact의 override나 Graph 연결을 검토하는 일이 Catalog 원본 수정 승인을 뜻하지 않는다. Catalog 등록은 [Operating Model의 재사용 거버넌스](operating-model.md#5-catalog재사용-거버넌스)를 따른다.

## Current Implementation(`legacy`)

현재 `DesignWorkbench`의 `/af/:reqId/design` 모듈 탭과 Agent Factory stage skills는 후보를 현행 `ModuleCandidate`의 legacy category/subtype으로 표시하고 저장한다. 예를 들어 `module_category`, `agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`는 Current Implementation 식별자다. 이 UI와 skill 출력은 Target Contract가 이미 구현되었다는 증거가 아니다.

검토자는 legacy `module_category: adapter` 후보를 일괄 Tool로 바꾸지 않는다. 이름, 입출력, 실제 호출 책임, 참조 대상과 side effect를 보고 Target에서 Tool, Resource, Dependency 중 무엇인지 문맥으로 판단한다. legacy `remote_a2a` 후보도 Agent와 A2A Binding/Exposure 경계로 다시 읽는다. 전체 gap과 영향 영역은 [Migration Status](../migration/taxonomy-vnext-status.md)를 따른다.

### 현행 모듈 탭 흐름

- `catalog_entry_id`가 없는 후보는 신규 후보로 검토한다. 검토자는 현행 입력·출력 계약과 누락 정보를 수정하고 legacy 상태를 결정한다.
- `catalog_entry_id`가 있는 후보는 Catalog-bound 계약으로 다룬다. 모듈 탭에서는 현재 분석 artifact의 입력·출력 override와 Graph 연결을 검토하며 Catalog 원본을 직접 수정하지 않는다.
- legacy `status`는 `approved`, `deferred`, `rejected`, `needs_info`를 사용하며 각각 승인, 보류, 반려, 추가정보 결정에 대응한다. 이는 Target의 새 직렬화 계약이 아니다.
- `needs_info` 후보는 후보별 `missing_information`을 해소하기 전에는 현행 승인 상태로 바꿀 수 없다. 해소 메모와 schema/smoke 검토 근거는 현재 artifact에 보존한다.
- 후보 상태 저장은 같은 `module_id`를 참조하는 현행 Graph IR 노드의 `review_status`와 맞춰진다. 저장 뒤 Graph IR 재파생은 검토된 후보·연결을 기준으로 하며 analyzer를 다시 실행하는 동작이 아니다.

### 현행 원격 계약과 위험 신호

현재 `Remote A2A` 탭은 legacy `remote_a2a` 후보와 현행 `a2aContracts`를 연결해 Agent Card, message/task lifecycle, auth, retry, fallback, audit, data policy를 검토한다. 계약이 없거나 readiness issue가 남으면 현행 runtime 계약 승인 게이트를 켤 수 없으며, 후보나 계약 승인은 자동화되지 않는다.

현행 `risk_signals`는 개인정보·금융정보·고객 영향·외부 메시지·거래 쓰기·사람 승인·감사 필요 등의 검토 근거다. 이 값만으로 자동 승인하거나 반려하지 않고, Target의 보안·감사·side effect 축에 필요한 통제를 기록한다.

## 검토 완료 조건

- 자산 유형과 Graph 표현을 같은 분류 축으로 섞지 않았다.
- Shared/Common 여부를 Agent 종류로 승인하지 않았다.
- legacy `adapter` 후보를 Tool·Resource·Dependency 문맥으로 재판별했다.
- 책임, 입출력, Domain Scope, Owner, `reuse_status`를 각각 검토했다.
- Binding과 Invocation Control을 분리했다.
- 보안·감사·side effect와 원격 경계 계약을 확인했다.
- missing-information의 층과 차단 영향을 기록했다.
- 승인 결정과 운영 게이트의 관계를 [Operating Model](operating-model.md)에 맞췄다.
