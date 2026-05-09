# Web Workbench Design System

이 문서는 `packages/web` 워크벤치 UI 의 디자인 시스템을 정의한다. 카테고리 색·글리프 컨트랙트, 공유 컴포넌트 패턴, 화면 배치, CSS 함정을 다룬다. Graph IR 의미와 marker 판정 규칙은 `docs/workbench/process-flow.md`를 따른다.

## 디자인 원칙

- **카테고리는 색으로 구분한다.** Agent / Workflow / Adapter / Remote A2A 의 분류는 라벨만 보고 식별하지 않고 색·글리프·stripe 로 즉시 구분되어야 한다. 모든 화면(Module Review, Graph IR, Catalog, A2A Contract Review)이 동일 매핑을 사용한다.
- **특수 흐름은 시각적으로 부각한다.** `process-flow.md`에서 정의한 fan-out/fan-in, loop, human input, branch, Remote A2A boundary는 텍스트 라벨만 두지 말고 노드 형태, edge 스타일, container overlay로 표시한다.
- **Edge 는 흐름 안에 둔다.** 노드 리스트와 분리된 거대한 edge 테이블 대신, ReactFlow edge와 Graph Inspector의 edge detail로 `edge_kind`, `execution_semantics`, `data_label`, state/artifact/A2A metadata를 확인하게 한다.
- **Workbench 는 운영 콘솔이다.** 첫 화면은 marketing hero가 아니라 개발리더가 상태, 다음 단계, 작업면, context를 바로 읽는 Ops console이어야 한다.
- **카드는 상호작용 표면에만 쓴다.** 페이지 전체를 카드 모자이크로 만들지 말고 shell, rail, workspace, inspector의 정보 구조를 우선한다.

## 화면 골격

`packages/web/src/ui/WorkbenchShell.tsx`가 workbench의 기본 골격이다.

- 상단: `Agent Factory` 이름과 분석 상태 요약.
- 좌측: workflow rail. 단계 그룹은 `입력`, `검토`, `자산화`, `생성` 순서다. `생성`은 승인된 scaffold-plan을 ADK Runtime Handoff로 넘기는 review-gated 영역이다.
- 중앙: 현재 단계의 주 작업면.
- 우측: 실제 단계별 context가 있을 때만 표시한다. 현재 공통 상태/검토 게이트 요약 패널은 렌더링하지 않는다. Intake에서는 파일 가져오기, 입력 metric, 분석 trace를 보여준다.

980px 이하에서는 좌측 rail을 한 줄 가로 스크롤로 압축하고 context는 작업면 아래로 내려간다.
단계가 늘어나도 상단에 모든 버튼을 쌓지 않는다.

## 코드 primitives

공통 UI primitive는 `packages/web/src/ui/primitives.tsx`에 둔다.
새 화면은 가능한 한 이 primitive를 먼저 사용한다.

- `Panel`: 실제 작업 surface 또는 inspector block에만 사용한다.
- `SectionHeader`: eyebrow, 제목, 설명, 보조 action을 같은 구조로 배치한다.
- `Button`: `primary`, `secondary`, `ghost` variant만 쓴다.
- `Field`, `SelectField`, `TextareaField`, `FileField`: label과 control 간격을 통일한다.
- `MetricPill`: 상태 요약, context metric, 짧은 숫자 정보를 표시한다.
- `EmptyState`: 아직 trace나 결과가 없는 영역을 조용히 설명한다.

도메인 고유 표시는 이 primitive가 아니라 기존 `CategoryBadge` / `SubtypeBadge`를 사용한다.
카테고리 색·글리프 single source of truth를 중복 구현하지 않는다.

## 상태 구조

`packages/web/src/workbench/useWorkbenchState.ts`가 화면 상태 전이의 기준이다.

- `StepId`, `StepDefinition`, 단계 그룹 label을 이 파일에서 관리한다.
- 분석 실행, 저장/불러오기, 모듈 후보 변경, A2A 계약 변경, catalog 변경은 reducer action으로 처리한다.
- `App.tsx`는 상태를 직접 조립하지 않고 shell과 화면 component를 연결한다.

새 기능을 추가할 때는 먼저 reducer action과 step availability를 정의한 뒤 화면 component를 연결한다.
저장된 분석과 scaffold-plan artifact shape는 UI refactor 때문에 바꾸지 않는다.

## 색 토큰

`packages/web/src/styles.css` 의 `:root` 에 카테고리 토큰이 정의되어 있다. 새 카테고리 색을 추가하려면 항상 다음 4종을 함께 추가한다.

| 카테고리 | 메인 | soft | line | 의미 |
| --- | --- | --- | --- | --- |
| `agent` | `--cat-agent` (#5b46c2 보라) | `--cat-agent-soft` | `--cat-agent-line` | reasoning 책임 |
| `workflow` | `--cat-workflow` (#b35900 주황) | `--cat-workflow-soft` | `--cat-workflow-line` | control flow / orchestration |
| `adapter` | `--cat-adapter` (#0c6b58 청록) | `--cat-adapter-soft` | `--cat-adapter-line` | callable capability |
| `remote_a2a` | `--cat-remote` (#b42318 빨강) | `--cat-remote-soft` | `--cat-remote-line` | 원격 protocol boundary |
| `input` | `--cat-input` (#2858a5 파랑) | `--cat-input-soft` | `--cat-input-line` | 흐름 입력 |
| `output` | `--cat-output` (#0e7c5f 녹색) | `--cat-output-soft` | `--cat-output-line` | 흐름 출력 |

빨강은 Remote A2A 외에는 쓰지 않는다. 위험도(`risk-high`)는 별도 색 체계(연한 핑크 배경)를 사용한다.

## 글리프 매핑

화면에 텍스트만 있을 때보다 한 글자 글리프를 함께 보여주면 인지 비용이 크게 줄어든다. 컨트랙트는 `packages/web/src/components/CategoryBadge.tsx` 에 있다.

**카테고리:**
- agent → `◆`
- workflow → `▶`
- adapter → `⚙`
- remote_a2a → `⇨`
- input → `⇥`
- output → `⇤`

**서브타입 (workflow_kind / adapter_kind / agent_kind / remote_contract_kind):**
- orchestration → `⋈`, graph → `⬢`, dynamic → `λ`
- retrieval → `🔎`, rule_registry → `§`, legacy_api → `API`, data_query → `?`, template → `T`, computation → `Σ`, external_service → `↗`
- specialist → `S`, shared → `★`, a2a → `A2A`, unknown → `·`

새 서브타입을 enum 에 추가할 때는 반드시 `subtypeGlyph` 매핑도 함께 갱신한다. 누락되면 `·` 로 fallback 된다.

## 공유 컴포넌트

이 컴포넌트들은 모든 화면이 같은 카테고리 표시를 갖도록 강제하는 single source of truth 다. 새 화면에서 카테고리를 표시할 때 직접 `<span>` 을 작성하지 말고 이들을 import 한다.

**`CategoryBadge`** — `packages/web/src/components/CategoryBadge.tsx`
```tsx
<CategoryBadge category={candidate.module_category} />
```
카테고리 색 + 글리프 + 한글 라벨을 묶은 알약 배지.

**`SubtypeBadge`**
```tsx
<SubtypeBadge value={candidate.adapter_kind!} />
```
서브타입 enum 값(`legacy_api`, `graph`, `shared` 등)을 받아 글리프와 한글/영문 라벨을 표시. 라벨 매핑은 `classificationRules.ts` 의 `*KindLabels` 를 사용한다.

**`getSubtypeValue(candidate)`**
`module_category` 에 따라 올바른 서브타입 필드(`adapter_kind` / `workflow_kind` / `agent_kind` / `remote_contract_kind`)를 반환하는 헬퍼. UI 에서 어떤 필드를 봐야 할지 매번 분기하지 않도록 만든다.

**`categoryClass(category)`**
`cat-agent` / `cat-workflow` / `cat-adapter` / `cat-remote` 중 하나의 CSS 클래스 이름을 반환. `remote_a2a` 는 `cat-remote` 로 매핑한다.

## 행 stripe 와 cell-stack 패턴

테이블과 리스트는 좌측에 5px 카테고리 색 stripe 를 둔다.

```tsx
<tr className={`row-${categoryClass(c.module_category)}`}>
  <td className="row-name-cell">
    <span className={`row-stripe ${categoryClass(c.module_category)}`} aria-hidden="true" />
    {/* ... */}
  </td>
</tr>
```

한 셀에 카테고리 배지와 서브타입 배지를 세로로 쌓을 때는 `cell-stack` 클래스를 쓴다 (flex column + align-items:flex-start). grid 로 만들면 자식 inline-flex 가 block 으로 변환되어 배지가 두 줄로 깨진다.

## Module Review 탭

Module Review는 같은 테이블을 필터링하는 화면이 아니라 두 작업면을 분리한 review console이다.

- `신규 모듈`: 사람이 승인/보류/반려할 후보를 다룬다. 컬럼은 이름, 분류, 세부 유형, 검토 상태, 입력/출력 계약 요약에 둔다.
- `카탈로그 계약`: 기존 runtime contract를 다룬다. 카탈로그 원본은 read-only로 표시하고, 현재 분석의 입력/출력 override와 Graph 연결만 편집한다.

위험도, 신뢰도, 재사용 여부는 탭의 메인 컬럼에 두지 않는다.
필요하면 inspector의 보조 evidence로만 표시한다.

## Process Flow 시각화

`packages/web/src/components/GraphCanvas.tsx` 와 `packages/web/src/graph/*` 가 Graph IR 로부터 노드, 엣지, 컨테이너 overlay 를 만든다.
node, edge, container 의미와 marker 판정은 `docs/workbench/process-flow.md`의 Graph IR 규칙을 따른다.

**Marker / overlay 스타일**
- `parallel_region`, `loop_region`, `human_review_region`, `remote_boundary`는 `ContainerOverlay`의 점선 region으로 표시한다.
- 새 marker를 추가할 때는 Graph IR 의미를 먼저 `process-flow.md`에 정의한 뒤 `containerOverlay.tsx`, `nodeTypes.tsx`, `edgeTypes.tsx`, CSS 색을 함께 갱신한다.
- container overlay는 흐름의 실제 범위를 가려서는 안 된다. 점선 경계와 낮은 대비 배경으로 node/edge 읽기를 방해하지 않게 한다.
- Graph IR 화면의 container overlay는 노드를 재배치하지 않는다. 전체 workflow를 한 번 배치한 뒤 포함 node의 bounding box를 감싸는 내부 region으로 표시한다.

**Graph Inspector**
- 노드 선택 시 `node_kind`, `module_id`, container, lane, owner, review status, 연결된 module candidate risk/missing information을 표시한다.
- 엣지 선택 시 `edge_kind`, `execution_semantics`, `data_label`, `schema_ref`, `route_condition`, `state_key`, `artifact_key`, `a2a_contract_id`, boundary crossing을 표시한다.
- `remote_a2a` edge는 Remote A2A 계약 검토 화면으로 이동할 수 있어야 한다.

## `adk_hints` UI 블록

`adk_hints` 는 Process Flow 의 `FlowNodeCard` 와 Module Review 카드의 판단 근거 아래에만 접이식 블록으로 표시한다.

- `state_memory` → `Session/State`
- `callbacks` → `Callbacks/Guardrail`
- `artifacts_events` → `Artifacts/Events`
- `mcp_a2a` → `MCP↔A2A`
- `streaming_grounding` → `Streaming/Grounding`

값이 있는 키만 표시하고, UI 에서 값을 새로 만들거나 빈 placeholder 를 보여주지 않는다.

## Domain × Capability Map 셀 강도

`낮음` / `중간` / `높음` 만 사용한다. 색은 `.affinity.low/medium/high` 에 정의되어 있고 모두 진한 배경 + 어두운 텍스트로 대비를 충분히 둔다. 셀 색이 옅으면 강도 차이가 무의미해진다.

## CSS 함정

**광범위 자손 선택자가 새 컴포넌트를 깨뜨린다.** 기존에 `.domain-map-table td span { display: block; }` 같은 룰이 있어서 새로 추가한 `.category-badge` (span) 가 block 으로 강제되어 안의 글리프와 텍스트가 두 줄로 깨졌다. 테이블/리스트의 마크업 스타일 룰은 항상 직계 자식 선택자(`>`)를 쓴다.

**flex / inline-flex 자식이 grid item 일 때.** grid container 안에 inline-flex 자식을 두면 grid track 폭에 따라 안의 텍스트가 wrap 될 수 있다. 카테고리 배지처럼 한 줄로 유지해야 하는 경우는 grid 가 아니라 flex column + align-items:flex-start 를 쓴다.

**HMR 캐시.** 한국어/영어 혼용 컨텐츠를 다루다 보니 CSS 변경이 가끔 hot reload 에 반영되지 않는다. 시각 결과가 코드와 어긋나면 chrome-devtools MCP `navigate_page` 의 `ignoreCache: true` 로 강제 reload 한다.

## 새 화면 추가 시 체크리스트

1. 카테고리·서브타입을 표시한다면 `CategoryBadge` / `SubtypeBadge` 를 import 한다 — 직접 `<span>` 작성 금지.
2. 카테고리 stripe 가 필요하면 `row-stripe` + `categoryClass()` 를 쓴다.
3. 새 색·글리프가 필요하면 `:root` 토큰 + `subtypeGlyph` 매핑을 함께 추가한다.
4. 새 Graph marker 가 필요하면 Graph IR 의미, node/edge/container 렌더러, CSS 색을 모두 갱신한다.
5. 화면 단위 자손 선택자(`.foo-table td span`) 는 항상 `>` 직계 자식으로 좁힌다.
6. 변경 후 chrome-devtools MCP 로 스크린샷을 찍어 색 매핑이 맞는지 시각 확인한다.

## 검증

- `npm run build` (tsc + vite build) 통과
- Module Review / Graph IR / Catalog / A2A Contract Review에서 카테고리 색이 동일한지 시각 확인
- `before/after` 스크린샷이 필요할 때는 dev 서버 + chrome-devtools MCP 의 `take_screenshot` 으로 캡처
