> **Target Contract** — 이 문서는 목표 아키텍처의 참조 지도다. 자산 정의와 분류의 단일 기준은 [Taxonomy](../../workbench/taxonomy.md)이며, Current Implementation과의 차이는 `docs/migration/taxonomy-vnext-status.md`가 기록한다.

# 목표 Agent 아키텍처 참조

이 참조는 Agent Factory가 검토하는 자산, Workflow 안의 실행 단위, 연결 경계, 업무 맥락, 재사용 거버넌스를 서로 다른 관점으로 읽는 방법을 요약한다. 독자 enum이나 자산 정의를 만들지 않으며, Graph 표현은 [Graph IR](../../workbench/graph-ir.md), 작업 단계와 승인 흐름은 [Operating Model](../../workbench/operating-model.md)을 따른다.

## 아키텍처 관점

| 관점 | 목표 위치 | 기준 문서 |
| --- | --- | --- |
| 재사용·검토 자산 | Agent, Workflow, Tool | [Taxonomy의 최상위 자산](../../workbench/taxonomy.md#최상위-자산) |
| Workflow 실행 계층 | 자산을 참조하는 Graph Node와 Workflow 내부 실행·제어 Node | [Graph IR의 Catalog 자산과 Graph Node](../../workbench/graph-ir.md#카탈로그catalog-자산과-그래프-노드graph-node) |
| 호출 결정과 연결 | Invocation Control, Binding, Transport를 각각 분리 | [Taxonomy의 계층 분리](../../workbench/taxonomy.md#계층-분리) |
| 데이터와 외부 경계 | Resource, Dependency, Interface를 실행 자산과 분리 | [Taxonomy의 자산이 아닌 것](../../workbench/taxonomy.md#자산이-아닌-것) |
| 업무와 책임 | Domain Scope·Business Domains와 Owner를 분리 | [Taxonomy의 Business Context와 Ownership](../../workbench/taxonomy.md#business-context와-ownership) |
| 재사용과 등록 | 자산 종류와 별개인 Catalog 검토·publish 상태 | [Taxonomy의 Reuse Governance](../../workbench/taxonomy.md#reuse-governance) |

## 자산과 Graph 실행 계층

Agent, Workflow, Tool만 재사용·검토 대상인 최상위 자산이다. 역할명, 프로토콜, 실행 위치, 업무 범위, 재사용 상태는 새 자산 유형을 만들지 않는다.

Graph Node는 특정 Workflow에서 무엇을 실행·대기·합류할지 표현한다. Agent Node, Tool Node, Subworkflow Node는 각각 검토된 자산 계약을 참조하고, Function Node와 Human Input Node, Join Node 같은 실행 요소는 그 존재만으로 Catalog 자산이 되지 않는다. Node·Edge 종류와 호출 관계는 [Graph IR](../../workbench/graph-ir.md)에서만 정의한다.

## 프로토콜과 연결 위치

Function, MCP, A2A는 Agent/Workflow/Tool과 나란히 놓는 자산 유형이 아니다. Function은 Workflow 내부 실행 또는 Tool의 연결 방식에, MCP는 Tool 연결 프로토콜에, A2A는 원격 Agent 노출·호출 경계에 위치한다. 세부 프로파일은 [Protocol Profile](protocol-profile.md)을 따른다.

Local과 Remote도 자산 유형이 아니다. 실제 위치는 Binding과 Transport의 조합 결과로 읽는다. 예를 들어 Function과 `in_process`, MCP와 `stdio`, MCP와 `http`, A2A 원격 경계는 서로 다른 연결 결과지만 Tool 또는 Agent의 자산 책임을 바꾸지 않는다.

## Resource와 Dependency

데이터셋·문서 집합 같은 Resource는 실행 기능이 아니라 읽고 쓰거나 참조하는 대상이다. 외부 시스템·API endpoint 같은 Dependency 또는 Interface도 연결 대상이며, 그 자체를 Tool로 분류하지 않는다. 해당 대상에 구조화된 기능 계약을 제공하는 실행 자산이 별도로 확인될 때만 Tool 후보를 검토한다.

## Domain, Owner, Catalog

Domain Scope와 Business Domains는 자산의 업무 적용 범위를 설명하고, Owner는 변경·운영·품질 책임을 설명한다. 두 축은 서로 대체하지 않는다.

Catalog는 검토된 자산 계약의 발견·버전·재사용·publish 근거를 관리한다. 재사용 상태는 Agent/Workflow/Tool 종류와 분리하며, Graph Node는 필요한 Catalog 자산을 참조할 뿐 자산의 Binding, Owner, 버전 계약을 중복 소유하지 않는다.

Super Agent, Context Manager, Task Manager, Active Owner Router, A2A Gateway는 Agent Factory의 기본 아키텍처 구성요소가 아니며 외부 계약 대상일 수만 있다.

## 함께 읽을 문서

- [Taxonomy](../../workbench/taxonomy.md): 자산, 업무 맥락, 소유권, 재사용 거버넌스의 단일 기준
- [Graph IR](../../workbench/graph-ir.md): Node·Edge, Invocation Control, Binding 표시의 단일 기준
- [Operating Model](../../workbench/operating-model.md): 분석·설계·승인·Runtime Handoff·검증 흐름
- [Protocol Profile](protocol-profile.md): Function, MCP, A2A와 실행 경계
- [Public Source Links](source-links.md): 확인한 공식·공개 근거
