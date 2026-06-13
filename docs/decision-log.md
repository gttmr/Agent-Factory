# Decision Log

코드의 **의사결정이 변경된 시점과 내용**을 기록하는 문서다. 동작 명세는 각 활성 문서(`docs/workbench/*`, `docs/visualization/design-system.md`, `CLAUDE.md`)가 기준이고, 이 파일은 "언제, 왜, 무엇이 바뀌었는지"의 이력만 담는다.

운영 규칙:

- 의사결정이 바뀌는 PR(인터페이스/스키마/게이트/UX 계약 변경)마다 머지 시점에 항목을 추가한다. 단순 버그 수정이나 리팩터링은 기록하지 않는다.
- 최신 항목이 위로 오는 역시간순. 항목 형식: 날짜 · PR/머지 커밋 · 결정 요약 · 배경(왜) · 영향 범위.
- 결정을 되돌리거나 대체하면 과거 항목을 지우지 말고 새 항목에서 `(대체: YYYY-MM-DD 항목)`으로 연결한다.

---

## 2026-06-13 · 작업 브랜치 `feat/workflow-a2a-registration` — Reuse Hub 등록 승인 publish 경로

### 카탈로그 정책을 승인 게이트 publish API 단일 쓰기 경로로 개정
- **결정**: `catalog/*.yaml` 직접 편집 금지를 유지하되, Reuse Hub `등록 승인` drawer 에서 검토자가 `catalog-delta.yaml` 제안을 항목별 승인하면 `POST /api/catalog/publish` 가 matching catalog YAML 에만 append 하는 app 쓰기 경로를 추가한다. publish 는 target YAML 을 `js-yaml` load→dump 로 canonical re-serialization 하므로 semantics 는 보존하지만 formatting 은 바뀔 수 있고, 최종 human PR 에서 git diff 로 검토한다. bulk/seed 변경은 여전히 human PR merge 로 처리한다.
- **배경**: 기존 Reuse Hub 는 `catalog-delta.yaml` 제안만 남기고 app 안에서 catalog 반영을 할 수 없어, 단건 승인 흐름이 manual merge 에 묶여 있었다.
- **영향**: `packages/web/server/afCatalogApi.ts`, Reuse Hub 등록 승인 UI, catalog governance 문서.

### Versioned catalog entry 모델 채택
- **결정**: publish 된 항목은 stable `id`, `version`, `status: published`, `provenance: catalog_published`, `published_at`, `published_from`, 선택적 `source_candidate_id` 를 포함한다. 같은 category/name 의 기존 항목은 `status: deprecated` 로 표시하고, catalog hydration 은 deprecated 를 제외한 최고 version 을 Reuse Hub 에 노출한다.
- **배경**: 기존 readers 는 name 기반으로 동작하므로 append-only publish 와 기존 seed 항목을 함께 유지하려면 명시적 version/status 모델이 필요했다.
- **영향**: catalog YAML entry shape, Reuse Hub index hydration, `CatalogEntry` 타입.

## 2026-06-12 · PR [#26](https://github.com/gttmr/Agent-Factory/pull/26) (merge `ea78ced`) — Design 검토 Graph IR 편집 + 모듈 승인 흐름

### Graph IR을 검토 화면에서 직접 편집할 수 있게 결정
- **결정**: 설계 검토의 GraphCanvas에 명시적 `편집 모드`를 추가. 노드/엣지 추가·삭제, 핸들 드래그·순차 클릭 두 경로의 엣지 생성, 노드 드래그 이동을 지원한다. 편집은 로컬 draft에서만 일어나고 `저장` 시 `analysis-result.json.processFlow`만 PUT 하며, `manifest.approvals.*` 게이트는 절대 자동 변경하지 않는다.
- **배경**: 기존 캔버스는 읽기 전용(`nodesDraggable=false`)이라 Stage Runner 재실행 외에는 Graph IR을 다듬을 방법이 없었다.
- **영향**: `GraphCanvas.tsx`, `layout.ts`, `docs/visualization/design-system.md` 편집 모드 절.

### 노드 수동 배치를 `node.position`으로 영속화
- **결정**: `GraphNode`에 선택적 `position {x,y}` 필드를 추가. finite position이 있는 노드는 dagre 자동 배치에서 제외하고 좌표를 그대로 쓴다. 저장 시 전체 노드 좌표를 기록한다.
- **배경**: dagre가 매 렌더마다 재배치해 사용자가 옮긴 위치가 유지되지 않았다.
- **영향**: `analyzer/types.ts`, `schemas/process-flow.schema.json`·`analysis-result.schema.json`, `scripts/validate-artifacts.mjs`, `docs/workbench/process-flow.md`.

### 속성 편집은 좌측 인스펙터 패널 전환 방식 채택
- **결정**: 편집 모드에서 노드/엣지를 선택하면 좌측 정보 패널이 읽기 전용 `GraphInspector`에서 편집형 `GraphElementEditor`로 전환된다(모달/팝오버 대안 기각 — 사용자 선택). 모듈 연결은 **기존 후보 연결만** 지원하고(새 후보 생성 없음), `candidate.module_category === node.node_kind` 필터를 강제한다. `node_kind` 자체는 v1에서 편집 불가(삭제 후 재추가).
- **배경**: 추가된 노드가 속성 없는 껍데기로 남아 검토를 진행할 수 없었다.
- **영향**: `GraphElementEditor.tsx`(신규), `DesignWorkbench.tsx`, `docs/visualization/design-system.md`.

### 새 로컬 노드는 루트 workflow 컨테이너에 기본 편입
- **결정**: 편집 모드에서 추가한 노드(remote_a2a 제외)는 parent 없는 첫 `graph_workflow`/`dynamic_workflow` 컨테이너에 `container_id` + `contains_node_ids` 동시 기록으로 편입한다.
- **배경**: 컨테이너 미편입 노드는 주황 경계 오버레이가 추적하지 못했다(삭제만 컨테이너를 정리하는 비대칭).
- **영향**: `GraphCanvas.tsx`, `docs/workbench/process-flow.md`.

### 화면 소프트 검증과 내보내기 검증의 정합 — `node_missing_module_id`
- **결정**: `validateGraphIRSoft`에 module-kind(agent/workflow/adapter/remote_a2a) 노드의 `module_id` 누락을 ERROR로 추가해, 화면 검토 게이트가 `validate-artifacts.mjs`의 export 규칙과 같은 기준으로 차단하게 한다.
- **배경**: 껍데기 노드가 화면 게이트는 통과하지만 내보내기 검증에서 실패하는 어긋남이 있었다.
- **영향**: `analyzer/graphMigration.ts`, `docs/workbench/validation.md`.

### 모듈 후보 승인은 워크벤치 모듈 탭에서 수행 (Legacy 워크벤치 경로 폐기 확정)
- **결정**: 하단 `모듈` 탭에 검토 상세 패널을 추가 — `missing_information` 항목별 해소(선택 메모) 후에만 `승인` 활성화, `보류`/`반려` 지원. 승인은 서버 `resolveCandidateForDesign`과 동일한 필드 세트(`resolved_missing_information`, `resolution_applied_at`, `schema_review_state: applied`, `smoke_spec`)를 기록해 빌드 단계 blocker도 함께 해소한다. 후보 status는 같은 `module_id` 노드의 `review_status`로 미러된다.
- **배경**: 후보 status를 바꾸는 UI가 없고 게이트 안내문이 제거된 "Legacy 워크벤치"를 가리켜 설계 검토가 막다른 길이었다. needs_info 재오픈과 Runtime/A2A 인라인 계약 편집기 부활은 범위에서 제외(계약 수정은 Stage Runner 재실행/외부 편집으로 안내).
- **영향**: `analyzer/moduleReview.ts`(신규), `DesignWorkbench.tsx`, `docs/workbench/review-board.md`·`agent-factory-harness.md`.

### 게이트 안내 문구는 미충족 조건만 열거
- **결정**: "다음에 할 일" 힌트가 고정 문구 대신 미충족 조건만 나열한다(예: "미승인 모듈 N개 — 하단 모듈 탭에서 승인"). 계약이 0개면 자동 통과임을 명시한다.
- **배경**: 수행할 수 없는 행동을 일괄 안내해 사용자가 무엇을 해야 하는지 알 수 없었다.
- **영향**: `DesignWorkbench.tsx` `buildDesignNextAction`.

### 분석 검토 '수용' 상태를 아티팩트에 영속화
- **결정**: 누락 정보 "수용" 토글을 컴포넌트 메모리가 아니라 `evidence.accepted_missing_information`(optional string array)에 토글 즉시 저장한다. 아티팩트 루트가 canonical store라는 원칙의 일관 적용.
- **배경**: 수용 상태가 리로드 시 초기화되는 버그.
- **영향**: `AnalyzeWorkbench.tsx`, `analyzer/types.ts`, `schemas/analysis-result.schema.json`, `docs/workbench/validation.md`·`agent-factory-harness.md`.

---

## 2026-06-09 이전 (backfill 요약)

- **2026-06-09 · PR #25 (`ada1d7d`)** — generator의 MCP adapter 입력 fallback을 `State.to_dict().items()` 기반으로 수정(worktree-rag-state-fix).
- **2026-06-09 · PR #24 (`352ea8f`)** — Design 검토 화면을 top/bottom split(`af-design-split`)로 재구성: 상단 `[선택 정보 패널 | 캔버스]`, 하단 전폭 탭 패널(`af-design-bottom`). 우측 인라인 Inspector는 `INSPECTOR_ENABLED=false`로 파킹.

> 이전 이력은 git 머지 히스토리(`git log --merges`)를 기준으로 필요 시 추가 backfill 한다.
