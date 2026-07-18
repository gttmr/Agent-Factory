# Taxonomy vNext Migration Status

이 문서는 [자산 택소노미](../workbench/taxonomy.md)와 [Graph IR](../workbench/graph-ir.md)이 정의한 Target Contract를 현재 구현의 `legacy` 직렬화 표면과 구분해 기록한다. 문서 vNext가 현재 코드·스키마·Catalog·DLC skills에 구현되었다는 뜻이 아니다.

## 1. Source snapshot

- Repository: `gttmr/Agent-Factory`
- Commit SHA: `7deea452e73f63828fc14402b7e16dcf40e753ac`
- 작업일: `2026-07-18`
- 조사 디렉터리: `packages/web/src`, `packages/web/server`, `packages/mock-lab`, `scripts`, 그리고 `schemas`, `catalog`, `templates`의 계약 표면
- ADK 공식 문서 확인일: `2026-07-18`
- Handbook 구조 원칙 확인일: `2026-07-18`

ADK 확인 결과, model은 Agent의 내부 구성요소이고 Tool 사용 여부는 사람 대상 개념에서 Agent의 판단으로 표현한다. graph, dynamic, collaborative, template은 하나의 상호 배타적 Workflow subtype이 아니라 상보적인 구성 방법이다. ADK Graph는 Agent, Tool, human input task, code function을 Node로 다루며, Function Tool은 Tool 체계에 속한다. MCP는 Tool 연결 프로토콜이고 A2A는 원격 Agent 간 프로토콜이다. 확인한 A2A 문서는 Agent 노출과 `RemoteA2aAgent` 소비를 설명하지만 Workflow의 A2A 노출을 일반 규칙으로 선언할 직접 근거는 찾지 못했다.

확인한 공식 URL은 다음과 같다.

- <https://adk.dev/agents/index.md>
- <https://adk.dev/agents/llm-agents/index.md>
- <https://adk.dev/workflows/index.md>
- <https://adk.dev/workflows/collaboration/index.md>
- <https://adk.dev/graphs/index.md>
- <https://adk.dev/graphs/routes/index.md>
- <https://adk.dev/graphs/human-input/index.md>
- <https://adk.dev/tools-custom/function-tools/index.md>
- <https://adk.dev/mcp/index.md>
- <https://adk.dev/tools-custom/mcp-tools/index.md>
- <https://adk.dev/a2a/index.md>
- <https://adk.dev/a2a/intro/index.md>
- <https://adk.dev/a2a/quickstart-exposing/index.md>

Handbook은 behavior에서 필요한 source locator로 단계적으로 내려가는 구조, stage 간 상태를 추적하는 Register, 최신 소스가 최종 권위라는 원칙을 반영했다. 근거는 Harness Handbook 논문 <https://arxiv.org/html/2607.13285>이다.

## 2. 문서 감사표

개편 전 원본 20개는 `docs/archive/taxonomy-vnext-2026-07/pre-rewrite/` 아래에 원래 경로를 보존해 스냅샷으로 저장했다. 이 스냅샷은 역사 자료이며 활성 기준이 아니다.

| 문서 | 기존 역할 | 새 역할 | 처리(재작성/정합화/pointer/archive/유지) | 상태 |
| --- | --- | --- | --- | --- |
| `README.md` | 저장소 개요와 사용 흐름 | 개발 리더 대상 목적, reviewed artifact 흐름, Target 진입점 | 재작성 | 완료 |
| `AGENTS.md` | 저장소 전역 coding-agent 규칙 | canonical 읽기 순서, Target/Current 경계, 문서 영향 규율 | 재작성 | 완료 |
| `CLAUDE.md` | Claude용 저장소 작업 지침 | canonical 문서와 Handbook을 우선하는 탐색·검증 지침 | 재작성 | 완료 |
| `STATUS.md` | 저장소 상태 요약 | 문서 vNext 완료와 코드 migration 미수행을 구분하는 상태 진입점 | 재작성 | 완료 |
| `docs/AGENTS.md` | docs 트리 작업 규칙 | 활성·archive·handoff·pointer 경계와 문서 검증 규칙 | 정합화 | 완료 |
| `docs/README.md` | 문서 인덱스 | Taxonomy, Graph IR, Operating Model, Handbook, Migration의 점진적 읽기 순서 | 재작성 | 완료 |
| `docs/decision-log.md` | 과거 결정 이력 | 기존 이력을 보존하면서 문서 vNext 결정을 최상단에 기록 | 정합화 | 이번 항목 추가 |
| `docs/workbench/AGENTS.md` | workbench 문서 로컬 규칙 | canonical 역할 분리, Target/Current 경계, locator 검증 규칙 | 정합화 | 완료 |
| `docs/workbench/taxonomy.md` | 자산 분류와 현행 enum 설명 | Agent, Workflow, Tool 및 업무·소유·재사용의 Target 단일 기준 | 재작성 | 완료 |
| `docs/workbench/graph-ir.md` | 독립 문서 없음 | Catalog 자산과 분리된 Graph IR Target 단일 기준 및 `legacy` 대응 | 재작성 | 신규 완료 |
| `docs/workbench/operating-model.md` | 구 harness에 분산된 운영 규칙 | 단계, 승인, artifact, Catalog, Handoff, 검증의 단일 기준 | 재작성 | 신규 완료 |
| `docs/workbench/analysis-guide.md` | 기존 module category 중심 분석 절차 | 책임 근거로 Agent, Workflow, Tool과 비자산을 판별하는 절차 | 재작성 | 완료 |
| `docs/workbench/workflow-decision-guide.md` | `legacy` Workflow subtype 판단 | Workflow 자산 여부와 representation·coordination 판단 가이드 | 재작성 | 완료 |
| `docs/workbench/review-board.md` | module 후보 검토 기준 | 책임·계약·Domain Scope·Owner·Reuse·Binding·Invocation Control 검토 기준 | 재작성 | 완료 |
| `docs/workbench/validation.md` | artifact와 구현 검증 기준 | 문서 vNext 검증과 Current Implementation 검증을 분리한 기준 | 재작성 | 완료 |
| `docs/workbench/adk-agent-execution-modes.md` | ADK 실행 모드의 현행 정책 | Current Implementation 문서로 유지하고 Target 분류 기준 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `docs/workbench/local-dev-security.md` | 로컬 개발·입력 민감도 경계 | 기존 보안 역할 유지와 Target/Current 용어 경계 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `docs/workbench/agent-factory-harness.md` | 운영·분류·Graph 규칙의 구 전문 | Operating Model과 Handbook으로 연결하는 호환 경로 | pointer | 완료 |
| `docs/workbench/process-flow.md` | Graph IR와 직렬화 계약의 구 전문 | Graph IR과 현행 `legacy` 직렬화 절로 연결하는 호환 경로 | pointer | 완료 |
| `docs/mock-lab/local-mcp-mock-lab.md` | `legacy` Adapter 기반 Mock Lab 안내 | Tool의 MCP mock과 현재 `catalog/adapters.yaml` 구현을 구분하는 안내 | 재작성 | 완료 |
| `docs/visualization/design-system.md` | 현행 Workbench 시각 계약 | `legacy` Adapter·Remote A2A UI를 유지하면서 Target 기준 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `docs/reference/target-agent-architecture/README.md` | 구 target architecture 개요 | Target 자산·Graph·protocol·Resource/Dependency 아키텍처 개요 | 재작성 | 완료 |
| `docs/reference/target-agent-architecture/protocol-profile.md` | 구 protocol profile | Function, MCP, A2A와 Transport를 분리한 Target profile | 재작성 | 완료 |
| `docs/reference/target-agent-architecture/source-links.md` | 구 source links | Target과 Current Implementation을 구분하는 근거 링크 | 재작성 | 완료 |
| `docs/workbench/follow-ups/17-a2a-ui-error-surfacing.md` | 미완료 A2A UI follow-up | 비정본 backlog 기록 | 유지 | 판정 후 무수정 |
| `docs/workbench/follow-ups/INDEX.md` | follow-up 인덱스 | 비정본 backlog 인덱스 | 유지 | 판정 후 무수정 |
| `docs/workbench/follow-ups/STATUS.md` | follow-up 상태표 | 비정본 backlog 상태 기록 | 유지 | 판정 후 무수정 |
| `docs/workbench/skill-refresh-evidence-2026-07.md` | DLC skill refresh 검증 원장 | 역사 evidence 기록 | 유지 | 판정 후 무수정 |
| `docs/handbook/README.md` | 독립 Handbook 없음 | source-backed Handbook 사용 순서와 locator 원칙 | 재작성 | 신규 완료 |
| `docs/handbook/overview.md` | 독립 Handbook 없음 | L1 시스템 행동·경계·artifact 흐름 | 재작성 | 신규 완료 |
| `docs/handbook/index.md` | 독립 Handbook 없음 | Stage, Register, L3 source map 탐색 인덱스 | 재작성 | 신규 완료 |
| `docs/handbook/registers.md` | 독립 Handbook 없음 | cross-stage 상태·artifact producer와 consumer 지도 | 재작성 | 신규 완료 |
| `docs/handbook/coverage.md` | 독립 Handbook 없음 | 포함·제외·미확인 locator와 coverage 기록 | 재작성 | 신규 완료 |
| `docs/handbook/maintenance.md` | 독립 Handbook 없음 | 소스 변경 뒤 수동 재검증·동기화 규칙 | 재작성 | 신규 완료 |
| `docs/handbook/stages/request-intake-artifact-root.md` | 독립 Handbook 없음 | requirement intake와 artifact-root 생성 Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/analyze-review-gate.md` | 독립 Handbook 없음 | Analyze proposal·review·gate Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/design-boundary-contract.md` | 독립 Handbook 없음 | Design 경계·Graph·계약 Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/runtime-handoff-build.md` | 독립 Handbook 없음 | artifact sync와 Runtime Handoff Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/verify-feedback.md` | 독립 Handbook 없음 | validation evidence와 Catalog delta Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/catalog-publication.md` | 독립 Handbook 없음 | Catalog publish Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/runtime-execution.md` | 독립 Handbook 없음 | 로컬 runtime chat·A2A proof Source Map | 재작성 | 신규 완료 |
| `docs/handbook/stages/mock-tool-integration.md` | 독립 Handbook 없음 | Mock Lab lifecycle과 MCP 연결 Source Map | 재작성 | 신규 완료 |
| `docs/migration/taxonomy-vnext-status.md` | 독립 migration status 없음 | Target Contract와 Current Implementation gap 원장 | 재작성 | 신규 완료 |
| `catalog/AGENTS.md` | Catalog 로컬 작업 규칙 | 현행 YAML 계약과 Target 문서 경계를 구분하는 로컬 규칙 | 정합화 | 완료 |
| `schemas/AGENTS.md` | Schema 로컬 작업 규칙 | 현행 schema 정합성과 Target 문서 경계를 구분하는 로컬 규칙 | 정합화 | 완료 |
| `scripts/AGENTS.md` | generator·validator 작업 규칙 | 현행 직렬화 소비와 Target 문서 경계를 구분하는 로컬 규칙 | 정합화 | 완료 |
| `templates/AGENTS.md` | template 작업 규칙 | 현행 fixture 계약과 Target 문서 경계를 구분하는 로컬 규칙 | 정합화 | 완료 |
| `packages/mock-lab/AGENTS.md` | Mock Lab 작업 규칙 | 현행 Adapter 표면을 `legacy`로 표시하는 패키지 규칙 | 정합화 | 완료 |
| `packages/mock-lab/DESIGN.md` | 생성형 UI 디자인 참고 | 기존 시각 snapshot을 유지하고 canonical Taxonomy 경계만 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `packages/mock-lab/README.md` | Mock Lab 실행·API 안내 | 현행 package 안내에 Target Tool·MCP 해석 연결 | 정합화 | 완료 |
| `packages/web/AGENTS.md` | web package 작업 규칙 | Target/Current 구분과 canonical 문서 연결 | 정합화 | 완료 |
| `packages/web/server/AGENTS.md` | server middleware 작업 규칙 | 현행 API 의미와 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/analyzer/AGENTS.md` | analyzer 작업 규칙 | `legacy` enum 정합성과 Target migration 경계 연결 | 정합화 | 완료 |
| `packages/web/src/catalog/AGENTS.md` | Reuse Hub 작업 규칙 | 현행 Catalog category와 Target 자산 경계 연결 | 정합화 | 완료 |
| `packages/web/src/components/AGENTS.md` | 화면 component 작업 규칙 | 현행 UI와 Target/Current 표시 경계 연결 | 정합화 | 완료 |
| `packages/web/src/components/graph/AGENTS.md` | Graph UI 작업 규칙 | 현행 Graph 계약과 canonical Graph IR 연결 | 정합화 | 완료 |
| `packages/web/src/design/AGENTS.md` | Design edit model 작업 규칙 | 현행 editor 계약과 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/state/AGENTS.md` | web state 작업 규칙 | 현행 state·API 계약과 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/styles/AGENTS.md` | workbench CSS 작업 규칙 | 현행 `legacy` UI label과 Target 시각 의미 경계 연결 | 정합화 | 완료 |
| `docs/archive/taxonomy-vnext-2026-07/README.md`와 `pre-rewrite/` 20개 원본 | 별도 vNext snapshot 없음 | 개편 전 문서의 경로 보존 역사 snapshot | archive | 신규 보존 완료 |

### 작업트리 선행 변경 구분

아래 항목은 문서 vNext 개편이 시작되기 전부터 존재한 사용자 소유 변경이다. 이번 개편의 삭제나 정리 결과로 계산하지 않는다.

| 경로 | 선행 상태 | 이번 개편과의 관계 |
| --- | --- | --- |
| `docs/onboarding/**` | 전체 삭제 | 이 작업 밖의 기존 변경이며 복원·수정하지 않음 |
| `docs/handoff/claude-home/**` | 전체 삭제 | 이 작업 밖의 기존 변경이며 복원·수정하지 않음 |
| 구 `docs/reference/target-agent-architecture/README.md`, `protocol-profile.md`, `source-links.md` | 세 파일 삭제 | 삭제 자체는 이 작업 밖의 기존 변경이며, 같은 활성 경로의 vNext 문서는 새 기준으로 재작성 |

`packages/mock-lab/package.json`, `packages/mock-lab/package-lock.json`, `packages/web/package.json`, `packages/web/package-lock.json` 변경과 미추적 `.evidence-reviews/`도 이번 문서 개편 밖의 기존 작업트리 상태다.

## 3. 개념 migration

아래 표는 `legacy` 표현을 Target 관점에서 해석하는 기준이다. 자동 치환 규칙이나 코드 변경 절차가 아니다.

| 현재 `legacy` 개념 | Target 개념 | 판별·전환 의미 |
| --- | --- | --- |
| `adapter` | 문맥에 따라 Tool, Resource, Dependency | 구조화된 호출 계약일 때만 Tool이며 데이터·문서·외부 시스템 자체는 Resource 또는 Dependency로 판별한다. |
| `adapter_kind` | 필수 subtype 제거 | 필요한 발견 정보만 선택적 `capability_tags`로 두고 Resource·Dependency·미결 정보는 각각 분리한다. |
| `agent_kind` | Agent subtype 제거 | `specialist`, `shared`를 자산 유형으로 계승하지 않고 업무 범위·Graph 역할·재사용 상태로 분리한다. |
| Domain Agent, Common Agent, 공통 Agent | Agent 유형에서 제거 | `domain_scope`, `business_domains`, `owner`, `reuse_status`로 서로 다른 축을 기록한다. |
| `remote_a2a` | Agent 자산 + A2A Binding 또는 Exposure | 원격 프로토콜을 최상위 자산 유형으로 두지 않는다. |
| `adapter_call` | Tool Node | 참조 대상이 Tool인지 확인하고 Workflow 명시 호출이면 Invocation Control: Workflow로 해석한다. |
| `workflow_call` | Subworkflow Node | Workflow 자산 참조와 검토된 입출력 계약으로 해석한다. |
| `remote_agent_call` | Agent Node + A2A boundary | 독립 Agent 책임과 A2A protocol boundary를 함께 확인한다. |
| `fixed_by_workflow` | Invocation Control: Workflow | Target 직렬화 의미는 `invocation_control: workflow`다. |
| `selected_by_llm` | Invocation Control: Agent | 모델을 상위 결정권자로 두지 않고 Agent의 런타임 판단으로 표현한다. |
| `decision_owner: llm` | Agent | 모델은 Agent 내부 구현 요소이며 사람 대상 결정 책임은 Agent로 표현한다. |
| `local_function` | Function binding 또는 Function Node | 독립 Tool 계약이면 Function binding을 가진 Tool, 한 Workflow 내부 결정적 단계면 Function Node로 재판별한다. |
| `mcp_tool` | Tool + MCP binding | Tool 자산과 `binding.kind: mcp`의 조합으로 해석한다. |
| `mcp_toolset` | Agent의 available MCP Tool 관계 | Agent가 사용할 수 있는 Tool capability 관계이며 고정 Graph 실행 순서가 아니다. |
| `공통` Domain | Domain Scope, Business Domains, Owner로 분리 | `공통`을 Business Domain 값으로 두지 않고 `cross_domain` 또는 `domain_neutral`과 책임 조직을 별도로 기록한다. |
| `unknown` subtype | `unresolved` + `needs_info` | 정상 유형으로 계승하지 않고 `missing_information`과 함께 미결 상태를 드러낸다. |
| `orchestration` subtype | coordination 서술 | Workflow subtype에서 제거하고 `workflow_profile.coordination` 또는 조정 책임 설명으로 기록한다. |

## 4. 구현과 목표 문서의 차이

| 영향 영역 | 현재 `legacy` identifier 예 | 목표 개념 | 위험·주의점 | 후속 코드 단계 필요 여부 |
| --- | --- | --- | --- | --- |
| Analyzer enum surface, `packages/web/src/analyzer/types.ts` | `moduleCategories`, `adapterKinds`, `agentKinds`, `workflowKinds`, `GRAPH_NODE_KINDS`, `GRAPH_INVOKE_BINDINGS`, `GRAPH_DECISION_OWNERS`, `GRAPH_CALL_CONTROLS`; 값 `adapter`, `remote_a2a`, `selected_by_llm` | Agent, Workflow, Tool 자산과 분리된 Graph IR, Binding, Invocation Control | analyzer output과 UI·validator·generator consumer가 같은 현행 enum에 결합되어 있어 Target 문서를 구현 사실로 읽으면 계약 불일치가 생긴다. | 예 |
| JSON Schemas, `schemas/**` | `module_category`, `adapter_kind`, `agent_kind`, `workflow_kind`, 현행 node·edge kind와 호출 관련 값 | Target 자산 필드, Workflow Profile, Graph IR, Binding·Transport의 분리 | 저장 artifact의 허용 값과 required field가 현행 계약이므로 새 개념을 그대로 직렬화하면 schema validation과 호환성이 깨질 수 있다. | 예 |
| Validator constants, `scripts/artifact-validation/constants.mjs` | `categories`, `adapterKinds`, `agentKinds`, `workflowKinds`, `remoteKinds`, 현행 Graph 상수 | analyzer·schema와 일치하는 Target validation vocabulary | enum이 analyzer와 별도 중복되어 있어 한 표면만 Target으로 간주하면 검증 결과가 갈라질 수 있다. | 예 |
| Generator dispatch, `scripts/adk-source/dispatch` | node key `adapter`, `adapter_call`, `workflow_call`, `remote_a2a`, `remote_agent_call`; edge key `remote_a2a` | Tool Node, Subworkflow Node, Agent Node와 분리된 A2A boundary | dispatch key는 runnable lowering의 현재 입력 계약이므로 문서 의미와 실제 생성 경로를 혼동하면 지원 범위를 과장할 수 있다. | 예 |
| Catalog YAML | 파일명 `catalog/adapters.yaml`, 현행 `agent`, `workflow`, `adapter`, `remote_a2a` category | Agent, Workflow, Tool과 별도 Binding·Exposure·Reuse 상태 | 파일명과 category가 Reuse Hub projection·publish 경로에 연결되어 있어 Target 분류가 현재 Catalog에 저장된다고 가정하면 조회·등록 의미가 달라진다. | 예 |
| Workbench UI label | `Adapter`, `Remote A2A`, `specialist`, `shared`, 현행 category badge | Agent, Workflow, Tool 표시와 protocol·role·scope의 별도 표현 | 화면은 현재 artifact를 표시하므로 문서의 Target label과 실제 UI vocabulary가 한동안 다르며 사용자 검토에서 Target과 Current를 구분해야 한다. | 예 |
| DLC skills, `.agents/skills/**` | `module_category`, `adapter_kind`, `agent_kind`, `remote_a2a`, 현행 Graph·호출 vocabulary | Target 분석·설계 개념과 승인된 현행 artifact contract의 명시적 경계 | skills는 현재 Stage Runner가 소비하는 직렬화 산출물을 생산하므로 Target 개념이 이미 출력된다고 간주할 수 없다. | 예 |
| Templates와 fixture | 현행 module category, subtype, node·edge kind, Binding·호출 필드 | Target 자산·Graph·Binding·Invocation Control 예시 | fixture는 schema·validator·generator agreement의 기준이므로 문서 예시와 현재 실행 fixture를 동일 계약으로 오인하면 검증 의미가 흐려진다. | 예 |

## 5. 경로 호환 결정

- [agent-factory-harness.md](../workbench/agent-factory-harness.md)는 구 전문을 대체해 [Operating Model](../workbench/operating-model.md)과 [Handbook](../handbook/README.md)으로 연결하는 pointer다.
- [process-flow.md](../workbench/process-flow.md)는 구 전문을 대체해 [Graph IR](../workbench/graph-ir.md)로 연결하는 pointer다.
- 현행 artifact의 로드베어링 직렬화 계약은 [Graph IR의 Current Implementation 직렬화 계약](../workbench/graph-ir.md#current-implementation-직렬화-계약legacy)에 보존했다. Target Node 이름과 필드가 이미 구현되었다는 뜻은 아니다.
- `.agents/skills/**`는 수정하지 않았다. 기존 skill이 참조하는 `agent-factory-harness.md` 경로를 그대로 유지해 링크가 깨지지 않으며, `process-flow.md`를 사용하는 활성 consumer도 기존 경로에서 새 canonical 문서로 이동할 수 있다.
- 구 전문은 `docs/archive/taxonomy-vnext-2026-07/pre-rewrite/`에 원래 경로대로 보존했다.

## 6. 제외된 영역

아래 영역은 Current Implementation의 `legacy` 표현을 유지하며 이번 문서 개편에서 변경하지 않았다.

| 제외 영역 | 남아 있는 Current Implementation 표면 | 이번 작업의 경계 |
| --- | --- | --- |
| `.agents/skills/**` | 현행 module category, subtype, Graph·호출 어휘로 artifact를 생산하는 운영 material | 무변경 |
| `schemas/**` | 현행 JSON Schema의 module·Graph·runtime enum과 필드 | 무변경 |
| `catalog/**` | `adapters.yaml`을 포함한 현행 category YAML과 publish 계약 | Markdown 작업 규칙 외 데이터 무변경 |
| `packages/**` 소스 | analyzer enum, UI label, server projection, Mock Lab의 Adapter 표면 | 소스 무변경 |
| `scripts/**` | validator constants와 generator dispatch의 현행 key | Markdown 작업 규칙 외 script 무변경 |
| `templates/**` | 현행 schema·generator가 소비하는 template·fixture vocabulary | Markdown 작업 규칙 외 template 무변경 |
| 테스트와 fixture | 현행 직렬화·생성 결과를 고정하는 test contract | 무변경 |
| `docs/archive/**` 기존 파일 | 과거 문서의 `legacy` 표현 | 기존 파일 무변경; 이번 개편의 새 pre-rewrite snapshot만 추가 |
| `docs/handoff/**` | 기준 시점에 보존된 역사·전달 문서의 `legacy` 표현 | 개편 대상에서 제외; 현재 worktree 삭제는 이 작업 밖의 기존 변경 |

## 7. 코드 migration 미수행 선언

이번 개편은 문서 전용이다. Analyzer enum, JSON Schema, validator, generator dispatch, Catalog YAML, Workbench UI, DLC skills, templates, fixture와 테스트의 코드 migration은 수행하지 않았다. 따라서 Target Contract와 Current Implementation 사이에는 위 gap이 남아 있다.

후속 코드 작업은 별도 단계다. 이 문서는 그 단계의 구현 설계·순서·수정 절차를 정하지 않는다.
