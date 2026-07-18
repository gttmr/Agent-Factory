# Agent Factory 문서 안내

이 문서는 Agent Factory 문서의 점진적 공개(progressive disclosure) 진입점이다. 개념을 먼저 확인한 뒤 필요한 운영 단계와 소스 위치로 내려가며, Target Contract와 Current Implementation을 섞어 읽지 않는다.

## 기본 읽기 순서

1. [Agent Factory 개요](../README.md)
   저장소의 목적, 주요 사용자, raw requirement에서 reviewed artifact와 Runtime Handoff로 이어지는 전체 흐름을 먼저 확인한다. Runtime Handoff는 production deployment가 아니다.
2. [자산 택소노미(Taxonomy)](./workbench/taxonomy.md)
   Target Contract의 Agent·Workflow·Tool 정의와 업무 맥락, Owner, 재사용 거버넌스를 확인한다. 다른 문서에서 이 분류를 다시 정의하지 않는다.
3. [그래프 중간 표현(Graph IR)](./workbench/graph-ir.md)
   Catalog 자산과 Graph Node의 차이, Node·Edge, Invocation Control, Binding·Transport 표현을 확인한다. Workflow 내부 실행 구조의 단일 기준이다.
4. [운영 모델(Operating Model)](./workbench/operating-model.md)
   분석·설계·승인·Runtime Handoff·검증 단계와 missing-information gate를 확인한다. 현재 Stage Runner 동작은 문서의 Current Implementation 절에서 별도로 읽는다.
5. [Handbook Overview](./handbook/overview.md)
   Agent Factory 저장소의 행동 경계와 stage 간 artifact 흐름을 L1 수준에서 파악한다. 구현 세부는 Overview에 추정해 넣지 않고 뒤의 source locator로 확인한다.
6. [Handbook Index](./handbook/index.md)와 [Registers](./handbook/registers.md)
   Index는 필요한 행동 stage와 L3 source map을 찾는 경로를 제공한다. Registers는 stage 사이에서 생성·읽기·갱신되는 상태와 artifact의 producer·consumer를 추적한다.
7. [필요한 Stage 문서](./handbook/stages/)
   Index에서 고른 stage만 열어 입력·출력·분기·실패와 최신 source locator를 확인한다. 실제 구현 판단은 Stage 문서가 가리키는 현재 소스에서 다시 검증한다.
8. Migration Status
   [Taxonomy vNext](./migration/taxonomy-vnext-status.md)에서 Target Contract와 legacy Current Implementation 사이의 차이·영향·위험을 확인하고, [Skills vNext](./migration/skill-vnext-status.md)에서 canonical 5-skill 체계, Compatibility Layer, legacy shim, Product blocker와 forward-test 상태를 확인한다. 두 문서 모두 코드 migration 완료를 선언하지 않는다.
9. 필요한 세부 reference
   - [분석 가이드](./workbench/analysis-guide.md)는 raw requirement에서 evidence, 정규화 요구사항, missing information, 자산 후보를 도출하는 순서를 설명한다.
   - [Workflow 판단 가이드](./workbench/workflow-decision-guide.md)는 Workflow 자산 여부와 representation·coordination 축을 구분하는 질문을 제공한다.
   - [Review Board](./workbench/review-board.md)는 개발 리더가 후보 책임, 계약, 위험, 재사용 판단을 검토하는 기준을 제공한다.
   - [Validation](./workbench/validation.md)은 artifact, 문서, Runtime Handoff의 검증 기준과 남은 불확실성 기록 원칙을 설명한다.
   - [Local MCP Mock Lab](./mock-lab/local-mcp-mock-lab.md)은 Tool의 MCP mock을 로컬 test double로 준비하고 검증하는 Current Implementation 흐름을 설명한다.
   - [시각화 Design System](./visualization/design-system.md)은 Workbench 화면과 Graph 표시의 시각·상호작용 규칙을 제공한다.
   - [Target Agent Architecture](./reference/target-agent-architecture/README.md)는 Agent·Workflow·Tool, Graph Node, 프로토콜, Resource/Dependency의 목표 아키텍처 위치를 요약한다.
   - [Local Dev Security](./workbench/local-dev-security.md)는 로컬 개발 표면과 requirement·mock·runtime 입력의 민감도 경계를 설명한다.
   - [ADK Agent Execution Modes](./workbench/adk-agent-execution-modes.md)는 ADK 실행 모드를 Graph 및 Runtime Handoff 문맥에서 해석할 때 필요한 세부 기준을 제공한다.

## 보조 참조

- [Decision Log](./decision-log.md)는 설계 결정의 날짜·근거·영향을 보존하는 이력이다. 현재 규칙은 각 canonical 문서에서 확인한다.
- [Agent Factory DLC skills](../.agents/skills/AGENTS.md)는 read-only entrypoint `af-workflow`와 `af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime` 네 Work Skill로 구성된다. 구 `af-analyze-requirement`, `af-design-boundaries`, `af-build-runtime-stub`, `af-verify-feedback`는 compatibility shim이며, current artifact를 쓸 때는 Target 판단 뒤 Compatibility Layer로 legacy 직렬화를 생산한다. [Skills vNext Migration Status](./migration/skill-vnext-status.md)와 함께 읽는다.

## Archive

- [Archive](./archive/)는 과거 계획, 검토 기록, 스냅샷을 보존하며 활성 기준이 아니다. 현재 행동을 설명하기 위해 archive 문서를 수정하거나 규칙을 되살리지 않는다.
- [Taxonomy vNext 2026-07 스냅샷](./archive/taxonomy-vnext-2026-07/)은 전면 개편 전 문서와 전환 근거를 보존한다. 현재 용어와 판단은 canonical 문서에서 다시 확인한다.

## Compatibility pointers

- [process-flow.md](./workbench/process-flow.md)는 기존 링크를 보존하는 Graph IR compatibility pointer다. 새 Graph 정의는 이 문서가 아니라 canonical `graph-ir.md`에서 확인한다.
- [agent-factory-harness.md](./workbench/agent-factory-harness.md)는 기존 skill과 문서 링크를 보존하는 Operating Model compatibility pointer다. 현재 작업 단계와 gate는 canonical `operating-model.md`에서 확인한다.

## Canonical sources

- ADK 기능이나 용어를 확인할 때는 `adk-docs-mcp`에서 [공식 `llms.txt`](https://adk.dev/llms.txt)를 출발점으로 관련 공식 페이지를 찾고, 확인 날짜와 기능별 근거를 남긴다. 저장소 문서에 ADK 전체 설명을 복제하지 않는다.
- [Google ADK 공식 문서](https://adk.dev/)는 프레임워크 동작을 확인하는 외부 기준이다. 현재 저장소 소스와 문서가 다르면 Target Contract, Current Implementation, 미확인 사항을 분리해 기록한다.
- ADK 버전 번호는 택소노미의 본질이 아니다. 버전은 특정 연결·실행 기능의 검증 메타데이터일 뿐 Agent·Workflow·Tool의 책임 정의를 바꾸지 않는다.
