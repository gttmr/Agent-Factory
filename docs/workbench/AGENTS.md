# Active Workbench Docs

## Scope

이 디렉터리는 strict Target Contract v2의 활성 Product 문서를 소유한다. 현재 구현과 canonical 문서는 strict cutover 상태이며 additive migration이나 compatibility 동작을 활성 계약으로 설명하지 않는다. 최신 source가 최종 권위다.

## Where To Look

| 찾는 내용 | 기준 문서 |
| --- | --- |
| 문서 전체 진입점과 읽기 순서 | `../README.md` |
| Agent/Workflow/Tool 분류와 속성 | `taxonomy.md` |
| Graph Node·Edge·Region, Binding, Invocation Control | `graph-ir.md` |
| 단계, 승인 gate, artifact, Catalog, Runtime Handoff | `operating-model.md` |
| requirement 분석 절차 | `analysis-guide.md` |
| Workflow 판별 절차 | `workflow-decision-guide.md` |
| 사람 검토 축과 승인 결정 | `review-board.md` |
| 문서·artifact·code·evidence 검증 | `validation.md` |
| ADK `LlmAgent.mode` 세부 정책 | `adk-agent-execution-modes.md` |
| 역사적 migration 결정 | `../migration/taxonomy-vnext-status.md` |

실제 행동 위치는 `../handbook/README.md`에서 탐색하되 locator의 path와 symbol을 현재 checkout에서 다시 확인한다.

## Strict v2 invariants

- `contract_version`은 `"2.0"` only다.
- 최상위 자산 유형은 Agent, Workflow, Tool뿐이다.
- `analysis-result.json`은 embedded `assetCandidates`와 `graph`를 소유한다.
- 후보와 Graph split은 `asset-candidates.json`, `graph-ir.json`뿐이다.
- backward reader, compatibility normalization, dual serialization, in-memory projection을 현재 동작으로 쓰지 않는다.
- Graph `node_kind`는 `input`, `agent`, `tool`, `function`, `human_input`, `subworkflow`, `join`, `output`뿐이다.
- Edge는 `control.kind`와 `channel`을 분리하고 Region `kind`는 `parallel`, `loop`뿐이다.
- standalone Agent/Tool Graph는 `workflow_ref: null`이다.
- Invocation Control은 Workflow(`workflow`) 또는 Agent(`agent`)뿐이다.
- Catalog bucket은 `agents.yaml`, `workflows.yaml`, `tools.yaml`뿐이다.
- A2A는 Agent Binding/Exposure이지 자산 category가 아니다.

## Local Rules

- 자산 정의는 `taxonomy.md`, Graph shape는 `graph-ir.md`, 운영 단계는 `operating-model.md`에서만 정의한다.
- 보조 문서에 독자 enum이나 변형 계약을 만들지 않는다.
- “현재 구현이 아직 Target과 다르다”는 전제를 복사하지 않는다. source에서 확인한 strict 현재 동작을 직접 설명한다.
- legacy라는 표현은 지원하지 않는 입력이나 historical decision reference에만 최소 사용한다. 활성 호환 동작으로 쓰지 않는다.
- 제거된 field나 filename을 변환 방법으로 안내하지 않는다. 거부된 입력은 현재 Analyze/Design 경로에서 v2 artifact로 다시 생성한다.
- Handbook locator는 navigation aid다. path, stable symbol, caller, input/output, side effect를 현재 source에서 확인한다.
- Build, Verify, Run을 섞지 않는다. Runtime Handoff 생성, allow-list 검증, local runtime proof는 서로 다른 표면이며 production deployment가 아니다.
- `catalog/*.yaml`을 일반 run의 직접 write 경로로 안내하지 않는다. 승인 publish는 `POST /api/catalog/publish`를 사용한다.
- `docs/archive/**`, `docs/handoff/**`, historical decision은 현재 행동 계약이 아니다.

## Naming

- UI와 문서에서 Asset 또는 자산 후보를 사용한다. 삭제된 Module review 이름을 current locator로 쓰지 않는다.
- analyzer review locator는 `assetReview.ts`, 화면 locator는 `DesignAssetReview.tsx`다.
- Build UI의 Tool 연결 prop은 `toolConnections`다.
- visible selector를 언급해야 하면 `af-asset-*` 현재 이름을 사용한다.

## Anti-Patterns

- Adapter, Remote A2A, protocol, role, Domain을 asset category로 추가한다.
- Model/LLM 또는 사람을 Invocation Control owner로 추가한다.
- 제거된 Graph field를 새 `control`/`channel` shape와 함께 저장한다.
- `module-candidates.json`, `process-flow.json`을 현재 split artifact로 안내한다.
- invalid input을 load-time migration·coercion·backfill한다고 설명한다.
- source 확인 없이 route, API, symbol, validator, skill ID를 단정한다.
- 문서 작업을 schema·UI·generator 변경으로 확장한다.

## Verification

Docs-only 변경은 최소한 다음을 확인한다.

- `git diff --check`
- 변경 파일 목록과 허용 범위
- 변경 Markdown의 상대 링크와 anchor
- source locator path와 symbol 존재
- strict v2 enum과 serialized field agreement
- additive/compatibility 표현 residual
- 삭제·rename된 internal naming residual

Artifact 계약이 관련되면 root에서 `node scripts/validate-artifacts.mjs <target>`을 실행한다. TypeScript, React, analyzer, server 또는 visible UI를 바꾸지 않았다면 web build를 문서 변경의 증거로 과장하지 않는다.
