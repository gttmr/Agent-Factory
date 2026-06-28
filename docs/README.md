# Documentation Index

이 디렉터리는 Agent Factory 분석 워크벤치 문서의 진입점이다.
Codex CLI 같은 에이전트는 기본적으로 아래 “기본 읽기 경로”만 프롬프트에 넣고, 필요한 경우에만 참조 문서를 추가로 읽는다.

## 기본 읽기 경로

1. [Analysis guide](./workbench/analysis-guide.md)
   Raw requirement를 Stage Runner 또는 skill output으로 정규화하고 evidence, module candidate, process flow, review decision으로 바꾸는 순서를 설명한다. 첫 화면에서 개발 리더가 확인해야 하는 핵심 계약과 은행 도메인 MVP의 역할도 여기서 먼저 파악한다.
2. [Taxonomy](./workbench/taxonomy.md)
   `module_category`, subtype enum, catalog runtime binding의 단일 활성 기준이다.
3. [Workflow decision guide](./workbench/workflow-decision-guide.md)
   ADK 2.0 baseline으로 `orchestration`, `graph`, `dynamic`, `unknown`을 판단하고, 작은 흐름은 Graph IR로 내리는 기준을 설명한다.
4. [ADK Agent Execution Modes](./workbench/adk-agent-execution-modes.md)
   ADK `LlmAgent.mode`를 Graph IR와 runnable source 생성에서 해석하는 기준이다. Graph node 기본은 `single_turn`, `chat`은 session-history를 암묵 입력으로 받는 stateful node, `task`는 static graph node가 아니라 coordinator/sub-agent topology라는 정책을 정의한다.
5. [Process Flow](./workbench/process-flow.md)
   분석 결과를 어떤 node와 edge로 그릴지 설명한다.
6. [Review Board](./workbench/review-board.md)
   개발 리더가 후보 모듈을 승인, 보류, 거절, 추가정보 요청으로 결정하는 기준이다. 현재 워크벤치 UI에서는 DesignWorkbench(`/af/:reqId/design`)의 모듈 검토 패널과 Design Stage Runner(`af-design-boundaries`)가 Resolution Draft/patch 제안을 분담하지만, 후보 승인 정책 자체와 hard/soft 게이트 의미는 이 문서가 기준이다.
7. [Validation](./workbench/validation.md)
   review artifact, Stage Runner run evidence, live analyzer draft schema, 최종 artifact schema, 문서 구조를 검증하는 기준이다. ADK Runtime Handoff(현 BuildWorkbench + VerifyWorkbench)가 배포가 아니라 승인 artifact 기반 source-bundle handoff와 검증 게이트라는 점은 이 문서의 `Scaffold-plan and ADK Runtime Handoff` 절을 기준으로 한다.
8. [Agent Factory Harness](./workbench/agent-factory-harness.md)
   Agent Factory 전용 하네스다. raw requirement를 reviewed artifact로 바꾸고, taxonomy 분류, Remote A2A high-friction 규칙, catalog review, docs 최신화, 검증 기준을 정의한다.

## 보조 참조

- [Decision log](./decision-log.md)
  코드 의사결정이 변경된 시점·내용·배경의 이력. 인터페이스/스키마/게이트/UX 계약을 바꾸는 PR마다 머지 시점에 항목을 추가한다. 동작 명세의 기준은 여전히 각 활성 문서다.
- [Local MCP Mock Lab](./mock-lab/local-mcp-mock-lab.md)
  `catalog/adapters.yaml`을 read-only prefill 소스로 사용해 Mock Lab에서 `MockSpec`을 편집·저장하고, 선택적으로 Codex가 자연어 prompt에서 `MockSpec` 초안을 만들게 한 뒤, 저장된 spec만으로 MCP stdio mock server를 실행·smoke test 하는 흐름이다. 실행 중인 mock은 network MCP(`/api/mock-lab/mcp/<key>` + `/api/mock-lab/mcp-discovery`)로 노출되어 runnable ADK 번들이 호출할 수 있다. 기본 사용자 경로는 5173 workbench의 `/mock-lab`이며, `packages/mock-lab`의 5176 standalone 앱은 개발/과도기용으로 유지한다.
- [Local dev server and input sensitivity](./workbench/local-dev-security.md)
  5173 Workbench, 5176 standalone Mock Lab, 8765 ADK runtime smoke, 9222 Chrome DevTools 같은 local-only surface와 raw requirement, MockSpec, screenshots, runtime env 입력 민감도 기준을 정리한다.
- [Agent Factory DLC skills](../.agents/skills)
  `af-analyze-requirement`, `af-design-boundaries`, `af-build-runtime-stub`, `af-verify-feedback`가 schema-first artifact 생산, 경계 승인, Runtime Handoff bundle 생성, 검증 feedback을 담당한다.
- [Target agent architecture](./reference/target-agent-architecture/README.md)
  Agent, Workflow, Adapter, Remote A2A의 target architecture 관점 참조다.
- [Protocol profile](./reference/target-agent-architecture/protocol-profile.md)
  local ADK boundary와 Remote A2A boundary를 구분한다.
- [Source links](./reference/target-agent-architecture/source-links.md)
  공개 참고 링크 목록이다.

## 시각화 참조

- [Design system](./visualization/design-system.md)

## Archive

`archive/` 아래 문서는 기본 프롬프트 경로가 아니며 활성 기준이 아니다.
과거 계획, 리뷰 기록, 스캐폴딩 노트, 스킬 노트, 유지보수 프롬프트를 보존하기 위한 위치다.

## Canonical Sources

- Model-facing working index: [../AGENTS.md](../AGENTS.md)
- Human-facing overview: [../README.md](../README.md)
- Analyzer/source enum: [../packages/web/src/analyzer/types.ts](../packages/web/src/analyzer/types.ts)
- Shared schemas: [../schemas](../schemas)
- Live analyzer compact draft schema: [../schemas/analysis-draft.schema.json](../schemas/analysis-draft.schema.json)
- 공식 ADK 문서: `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 확인한다. ADK 2.0 문서를 우선 조회하고 ADK 1.x 문서는 legacy compat 질문에만 사용한다. 복제한 ADK component 요약은 active docs에 두지 않는다.
- Skill files under `../.agents/skills/` are governed by their own `SKILL.md` files. The AF DLC stage skills are active operating entrypoints; `_shared` is reference material only.
