# Taxonomy vNext Migration Status

이 문서는 [자산 택소노미](../workbench/taxonomy.md)와 [Graph IR](../workbench/graph-ir.md)이 정의한 Target Contract의 Product 이행 상태를 기록한다. 2026-07-19에는 아직 커밋되지 않았던 additive dual serialization 방향을 폐기하고 strict Target Contract v2로 한 번에 전환했다. 아래 과거 용어는 역사 snapshot, 이전→현재 의미표, 또는 거부 입력 설명에만 나오며 실행 가능한 compatibility surface가 아니다.

## 1. Source snapshot

- Repository: `gttmr/Agent-Factory`
- Baseline commit SHA: `0cdcb829480def3c0a8ba4afdefb37913721f6d2`
- Product migration 작업일: `2026-07-19~20` (현재 worktree, commit 전)
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

## 2. 문서 감사표(2026-07-18 역사 snapshot)

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
| `docs/workbench/graph-ir.md` | 독립 문서 없음 | Catalog 자산과 분리된 strict Graph IR 단일 기준 | 재작성 | 신규 완료 |
| `docs/workbench/operating-model.md` | 구 harness에 분산된 운영 규칙 | 단계, 승인, artifact, Catalog, Handoff, 검증의 단일 기준 | 재작성 | 신규 완료 |
| `docs/workbench/analysis-guide.md` | 기존 module category 중심 분석 절차 | 책임 근거로 Agent, Workflow, Tool과 비자산을 판별하는 절차 | 재작성 | 완료 |
| `docs/workbench/workflow-decision-guide.md` | `legacy` Workflow subtype 판단 | Workflow 자산 여부와 representation·coordination 판단 가이드 | 재작성 | 완료 |
| `docs/workbench/review-board.md` | module 후보 검토 기준 | 책임·계약·Domain Scope·Owner·Reuse·Binding·Invocation Control 검토 기준 | 재작성 | 완료 |
| `docs/workbench/validation.md` | artifact와 구현 검증 기준 | 문서 vNext 검증과 Current Implementation 검증을 분리한 기준 | 재작성 | 완료 |
| `docs/workbench/adk-agent-execution-modes.md` | ADK 실행 모드의 현행 정책 | Current Implementation 문서로 유지하고 Target 분류 기준 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `docs/workbench/local-dev-security.md` | 로컬 개발·입력 민감도 경계 | 기존 보안 역할 유지와 Target/Current 용어 경계 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `docs/workbench/agent-factory-harness.md` | 운영·분류·Graph 규칙의 구 전문 | 활성 pointer 삭제, archive와 git history에만 보존 | 삭제 | strict cutover 완료 |
| `docs/workbench/process-flow.md` | Graph IR와 직렬화 계약의 구 전문 | 활성 pointer 삭제, archive와 git history에만 보존 | 삭제 | strict cutover 완료 |
| `docs/mock-lab/local-mcp-mock-lab.md` | Adapter 기반 Mock Lab 안내 | Tool + MCP mock과 `catalog/tools.yaml` 전용 구현 안내 | 재작성 | 완료 |
| `docs/visualization/design-system.md` | 현행 Workbench 시각 계약 | Agent·Workflow·Tool category와 MCP·A2A protocol 시각 계약 | 재작성 | 완료 |
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
| `packages/mock-lab/AGENTS.md` | Mock Lab 작업 규칙 | Tool + MCP 전용 strict 패키지 규칙 | 정합화 | 완료 |
| `packages/mock-lab/DESIGN.md` | 생성형 UI 디자인 참고 | 기존 시각 snapshot을 유지하고 canonical Taxonomy 경계만 연결 | 유지 | canonical 경계 정합화 후 유지 |
| `packages/mock-lab/README.md` | Mock Lab 실행·API 안내 | 현행 package 안내에 Target Tool·MCP 해석 연결 | 정합화 | 완료 |
| `packages/web/AGENTS.md` | web package 작업 규칙 | Target/Current 구분과 canonical 문서 연결 | 정합화 | 완료 |
| `packages/web/server/AGENTS.md` | server middleware 작업 규칙 | 현행 API 의미와 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/analyzer/AGENTS.md` | analyzer 작업 규칙 | strict Target enum과 read-boundary 정합성 규칙 | 정합화 | 완료 |
| `packages/web/src/catalog/AGENTS.md` | Reuse Hub 작업 규칙 | 현행 Catalog category와 Target 자산 경계 연결 | 정합화 | 완료 |
| `packages/web/src/components/AGENTS.md` | 화면 component 작업 규칙 | 현행 UI와 Target/Current 표시 경계 연결 | 정합화 | 완료 |
| `packages/web/src/components/graph/AGENTS.md` | Graph UI 작업 규칙 | 현행 Graph 계약과 canonical Graph IR 연결 | 정합화 | 완료 |
| `packages/web/src/design/AGENTS.md` | Design edit model 작업 규칙 | 현행 editor 계약과 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/state/AGENTS.md` | web state 작업 규칙 | 현행 state·API 계약과 Target 문서 경계 연결 | 정합화 | 완료 |
| `packages/web/src/styles/AGENTS.md` | workbench CSS 작업 규칙 | 세 asset category와 별도 protocol 시각 의미 규칙 | 정합화 | 완료 |
| `docs/archive/taxonomy-vnext-2026-07/README.md`와 `pre-rewrite/` 20개 원본 | 별도 vNext snapshot 없음 | 개편 전 문서의 경로 보존 역사 snapshot | archive | 신규 보존 완료 |

### 작업트리 선행 변경 구분

아래 항목은 문서 vNext 개편이 시작되기 전부터 존재한 사용자 소유 변경이다. 이번 개편의 삭제나 정리 결과로 계산하지 않는다.

| 경로 | 선행 상태 | 이번 개편과의 관계 |
| --- | --- | --- |
| `docs/onboarding/**` | 전체 삭제 | 이 작업 밖의 기존 변경이며 복원·수정하지 않음 |
| `docs/handoff/claude-home/**` | 전체 삭제 | 이 작업 밖의 기존 변경이며 복원·수정하지 않음 |
| 구 `docs/reference/target-agent-architecture/README.md`, `protocol-profile.md`, `source-links.md` | 세 파일 삭제 | 삭제 자체는 이 작업 밖의 기존 변경이며, 같은 활성 경로의 vNext 문서는 새 기준으로 재작성 |

`packages/mock-lab/package.json`, `packages/mock-lab/package-lock.json`, `packages/web/package.json`, `packages/web/package-lock.json` 변경과 미추적 `.evidence-reviews/`도 이번 문서 개편 밖의 기존 작업트리 상태다.

## 3. 개념 migration 기록

아래 표는 strict cutover 전에 사용하던 표현이 어떤 Target 의미로 재설계됐는지를 설명하는 역사 기록이다. 현재 reader의 변환 규칙이나 자동 치환 절차가 아니다.

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

## 4. Product 구현 상태

| 영향 영역 | 2026-07-19 strict 구현 | 제거·거부한 입력 | 상태 |
| --- | --- | --- | --- |
| Analyzer/types | `assetCandidates`, Domain/Owner/Reuse, Binding/Transport, Workflow Profile, Exposure, typed asset ref, Invocation Control, canonical `graph`를 직접 사용한다. | `moduleCandidates`, `module_category`, subtype/call-control field와 read normalization | strict v2 |
| JSON Schema | `contract_version: "2.0"`과 Target fields를 요구하고 `asset-candidate.schema.json`, `graph.schema.json`을 직접 참조한다. lifecycle manifest는 별도 `af-run-manifest.schema.json`에서 identity, 네 stage/status, 네 approval과 validation을 모두 요구한다. | 구 module candidate/process-flow schema, version 없는 artifact, partial manifest | strict v2 |
| Server/root validator | Stage Runner proposal과 root validator가 requirement ID, duplicate asset/contract/Graph ID, typed ref, embedded/split parity, Region membership·parent hierarchy를 fail-closed 검사한다. Derived split PUT을 막고 scaffold PUT은 Design gate·schema·canonical projection을 확인한다. Approval PATCH는 boolean과 gate hierarchy를 강제하고 Handoff true에 실제 stub을 요구한다. Build 모든 entrypoint와 Verify command/runner가 predecessor gate를 server에서 재검사하며 changed analysis는 stale downstream approval을 내린다. Validation result의 외부 PATCH surface는 없고 server-owned process만 기록한다. Apply는 process-global requirement lock 안에서 proposal hash·schema와 모든 canonical ETag를 첫 write 전에 확인한다. | legacy-only artifact hydration, split `a2a-contracts.json` API, `commonization-notes.json`, silent manifest backfill, public validation mutation, API gate bypass | strict v2 |
| Generator | candidate의 `asset_type`·`binding`과 canonical Graph를 직접 dispatch하고 candidate/contract/Node/Edge/Region identity·ref를 양쪽 입력 경계에서 확인한다. complete run manifest, non-empty approved projection, typed Graph ownership, required Runtime Contract coverage를 요구한다. owning Workflow의 `workflow_profile.representation`만으로 Graph/Dynamic mode를 선택한다. 실제 ADK 2.3.0에서 acyclic static route·state·terminal, non-loop dynamic execution, contract-backed Human Input resume/replay를 검증했다. HTTP MCP는 exact reviewed Tool allow-list를 적용한다. Remote A2A consumer는 failure, unsupported input/auth-required, empty/long-running-only result를 success terminal로 넘기지 않으며 provider surface는 approved exposure에만 생성한다. | input projection, legacy selector와 `runtime.remote_a2a`, old envelope, partial manifest, stdio/unknown MCP, 의미 미구현 control, bound 없는 loop, default 없는 condition route | Target-native fail-closed lowering |
| Catalog | `agents.yaml`, `workflows.yaml`, `tools.yaml` 세 bucket만 읽고 쓴다. A2A는 Agent binding/exposure다. | `adapters.yaml`, `remote-a2a-contracts.yaml`, Adapter/Remote A2A category와 Workflow A2A 변환 API | 세 자산 전용 |
| Workbench UI | Reuse Hub, 등록, 분석, Graph, Build가 Agent/Workflow/Tool과 Target Graph 계약만 표시·편집한다. Region은 `병렬 실행 범위`, `반복 실행 범위`로 표시하고 Workflow Profile과 구분한다. | legacy category tab, badge, copy, CSS alias와 fallback hydration | 사용자·편집 표면 전환 |
| DLC skills | `af-workflow`와 네 canonical Work Skill이 strict Target v2 artifact만 읽고 쓴다. | 구 stage ID shim과 compatibility reference | canonical 5개만 유지 |
| Templates/fixtures | active template과 generator/validator regression fixture가 strict Target v2를 사용한다. 제거 필드 재도입은 명시적인 rejection test로만 검사한다. | legacy/dual 성공 fixture와 byte-identity compatibility 기준 | strict fixture set |

## 5. 전환 결정

- 전환 방식은 `contract_version: "2.0"`을 사용하는 strict Target-only serialization이다. additive dual serialization은 커밋되기 전에 이 결정으로 대체됐다.
- 기존 artifact root는 저장소 밖에 백업한 뒤 active `artifacts/`에서 격리했다. version 누락, 구 key, 구 split 파일을 읽거나 자동 변환하지 않는다. `commonization-notes.json`도 별도 정본이 아니므로 API·store·schema에서 제거하고 validator와 generator가 파일 존재 자체를 거부한다.
- generator는 Target candidate와 Graph IR를 직접 소비한다. source artifact를 projection하거나 구 lowering selector를 합성하지 않는다. owning Workflow Profile이 Graph/Dynamic 선택을 소유하고 Region은 mode를 바꾸지 않는다.
- Graph는 canonical 8개 node kind, edge `control`과 `channel`, `parallel|loop` region을 사용한다. Route, callback, resume, loop는 별도 자산 종류가 아니라 이 구조의 control/role/region으로 표현한다.
- Reuse Hub와 publish는 Agent/Workflow/Tool만 노출한다. Tool은 `catalog/tools.yaml`에 쓰고 A2A는 Agent의 binding/exposure로 표현한다.
- 활성 compatibility pointer 문서는 제거했다. 과거 전문은 `docs/archive/**`와 git history에서만 확인한다.
- 구 전문과 과거 상태는 `docs/archive/**` 및 git history에 보존하며 현재 구현 설명으로 다시 쓰지 않는다.

## 6. 지원하지 않는 입력과 별도 기능 gap

| 영역 | 현재 판정 |
| --- | --- |
| 구 artifact | 저장소 밖 백업만 보존한다. active product는 version 없는 root, legacy field, 구 split 파일과 `commonization-notes.json`을 거부한다. migration command와 rollback reader는 제공하지 않는다. |
| 구 Graph | old node/edge/container enum과 call-control selector는 거부한다. canonical Target Graph를 다시 생성해야 한다. |
| 구 Catalog | `adapters.yaml`, `remote-a2a-contracts.yaml`과 관련 API bucket은 삭제됐고 읽지 않는다. 필요한 계약은 Agent 또는 Tool로 새로 등록한다. |
| 구 skill ID | 네 shim은 삭제됐다. [Skills vNext removal result](skill-vnext-status.md#8-legacy-removal-result)에 검증 결과를 기록한다. |
| ADK runtime pattern | acyclic static Graph와 loop 없는 dynamic Workflow는 runnable이다. 승인된 structured `async_resume` 계약이 exact Human Input/Tool annotation을 가질 때 stable resume·expiry·replay·session-state at-most-once synthetic side effect를 지원한다. 별도 callback·retry·fallback·error·resume·cancel·timeout control Edge, bound/exhaustion 계약 없는 loop, static routed cycle, default 없는 condition route는 현재 지원하지 않고 generator가 명시적으로 거부한다. 이는 compatibility가 아닌 기능 gap이다. |

이번 단계는 raw requirement→code 금지, 사람 approval gate, Catalog proposal-first publish, synthetic-data 경계를 바꾸지 않는다. `docs/archive/**`, `docs/handoff/**`, 사용자 소유 삭제는 이 migration의 수정 대상이 아니다.

## 7. 완료 판정

Product Target Contract v2의 쓰기·검증·표시·generator input·Catalog publish 경로는 strict 형식으로 전환했다. 구 reader, projection, Graph envelope, Catalog bucket, skill shim, active fixture는 지원하지 않는다. 따라서 현재 계약은 **strict Target v2 cutover**다. 과거 용어가 migration 표·decision log·rejection test에 남아 있는 것은 지원 표면을 뜻하지 않는다.
