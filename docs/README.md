# Documentation Index

이 디렉터리는 Agent Factory 분석 워크벤치 문서의 진입점이다.
Codex CLI 같은 에이전트는 기본적으로 아래 “기본 읽기 경로”만 프롬프트에 넣고, 필요한 경우에만 참조 문서를 추가로 읽는다.

## 기본 읽기 경로

1. [Analysis guide](./workbench/analysis-guide.md)
   Raw requirement를 정규화하고 evidence, module candidate, process flow, review decision으로 바꾸는 순서를 설명한다.
2. [Taxonomy](./workbench/taxonomy.md)
   `module_category`와 subtype enum의 단일 활성 기준이다.
3. [Workflow decision guide](./workbench/workflow-decision-guide.md)
   ADK 2.0 (Beta) baseline으로 `sequential`, `parallel`, `loop`, `human_review`, `orchestration`, `graph`, `dynamic`을 판단한다 (1.14 stable agent 매핑은 legacy compat 메모로 표시).
4. [Process Flow](./workbench/process-flow.md)
   분석 결과를 어떤 node와 edge로 그릴지 설명한다.
5. [Review Board](./workbench/review-board.md)
   개발 리더가 후보 모듈을 승인, 보류, 거절, 추가정보 요청으로 결정하는 기준이다.
6. [Validation](./workbench/validation.md)
   export artifact, ADK source 생성, 문서 구조를 검증하는 기준이다.

## 보조 참조

- [Target agent architecture](./reference/target-agent-architecture/README.md)
  Agent, Workflow, Adapter, Remote A2A의 target architecture 관점 참조다.
- [Protocol profile](./reference/target-agent-architecture/protocol-profile.md)
  local ADK boundary와 Remote A2A boundary를 구분한다.
- [Source links](./reference/target-agent-architecture/source-links.md)
  공개 참고 링크 목록이다.

## 시각화 참조

- [Design system](./visualization/design-system.md)
- [Reuse Heatmap](./visualization/reuse-heatmap.md)
- [Domain Capability Map](./visualization/domain-capability-map.md)

## Archive

`archive/` 아래 문서는 기본 프롬프트 경로가 아니다.
과거 계획, 리뷰 기록, 스캐폴딩 노트, 스킬 노트, 유지보수 프롬프트를 보존하기 위한 위치다.

## Canonical Sources

- Model-facing working index: [../AGENTS.md](../AGENTS.md)
- Human-facing overview: [../README.md](../README.md)
- Analyzer/source enum: [../packages/web/src/analyzer/types.ts](../packages/web/src/analyzer/types.ts)
- Shared schemas: [../schemas](../schemas)
- 공식 ADK 문서: `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 확인한다. ADK 2.0 (Beta) 섹션을 우선 조회하고 1.14 stable agent 페이지는 legacy compat 질문에만 사용한다. 복제한 ADK component 요약은 active docs에 두지 않는다.
- Skill files under `../.agents/skills/` are governed by their own `SKILL.md` files and are not indexed as active workbench docs here.
