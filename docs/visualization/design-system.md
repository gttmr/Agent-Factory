# Web Workbench Design System

이 문서는 `packages/web` 워크벤치 UI 의 디자인 시스템을 정의한다. 카테고리 색·글리프 컨트랙트, 공유 컴포넌트 패턴, 화면 배치, CSS 함정을 다룬다. Graph IR 의미와 marker 판정 규칙은 `docs/workbench/process-flow.md`를 따른다.

## 디자인 원칙

- **카테고리는 색으로 구분한다.** Agent / Workflow / Adapter / Remote A2A 의 분류는 라벨만 보고 식별하지 않고 색·글리프·stripe 로 즉시 구분되어야 한다. Analyze/Design, Graph IR, Runtime 계약, Reuse Hub가 동일 매핑을 사용한다.
- **특수 흐름은 시각적으로 부각한다.** `process-flow.md`에서 정의한 fan-out/fan-in, loop, human input, branch, Remote A2A boundary는 텍스트 라벨만 두지 말고 노드 형태, edge 스타일, container overlay로 표시한다.
- **Edge 는 흐름 안에 둔다.** 노드 리스트와 분리된 거대한 edge 테이블 대신, ReactFlow edge와 Graph Inspector의 edge detail로 `edge_kind`, `execution_semantics`, `data_label`, state/artifact/A2A metadata를 확인하게 한다.
- **Workbench 는 운영 콘솔이다.** 첫 화면은 marketing hero가 아니라 개발리더가 상태, 다음 단계, 작업면, context를 바로 읽는 Ops console이어야 한다.
- **카드는 상호작용 표면에만 쓴다.** 페이지 전체를 카드 모자이크로 만들지 말고 shell, rail, workspace, inspector의 정보 구조를 우선한다.

## 화면 골격

`packages/web/src/layout/WorkbenchLayout.tsx`(상단 셸)와 `packages/web/src/layout/StageShell.tsx`(스테이지 내부 셸), route별 workbench 화면이 현재 workbench의 기본 골격이다.

- 상단(`WorkbenchLayout`): `Agent Factory` 이름, artifact root 전환, approval gate chip 4개, stage navigation.
- stage navigation은 `/af/:reqId/analyze`, `/design`, `/build`, `/verify`로 4개 승인 스테이지를 나누고, 그 뒤에 **게이트 없는 보조 nav `실행`(`/af/:reqId/run`)**, `Reuse Hub`(`/catalog`), `Mock Lab`(`/mock-lab`)을 둔다. `실행`과 `Mock Lab`은 `afRunStageIds`(= manifest 스키마/게이트 칩의 원천)에 넣지 않는다 — 보조 nav 링크일 뿐이다.
- 스테이지 내부(`StageShell`): CLI 스킬 한 단계를 **좌측 스텝 레일(1실행·2검토·3승인)** 로 더 잘게 나눠, 선택된 스텝의 작업면만 중앙에 보인다. 한 화면에 실행+검토+승인을 한꺼번에 쌓지 않는다.
  - 좌측 레일: 스텝별 상태 글리프(`done ✓` / `current ●` / `todo ○` / `blocked ⚠`)와 활성 스텝 강조(accent 테두리·좌측 바·채운 index), 그리고 하단의 "다음에 할 일" 가이드 블록.
  - 중앙 상단: 항상 보이는 요약 strip(핵심 산출물 한 줄 요약). 그 아래 활성 스텝 콘텐츠. 하단: 다음 단계로 가는 next-action CTA(강한 가이드).
  - 활성 스텝은 얕은 `?step=run|review|approve` 쿼리 파라미터로 관리하고(`useStageStep`), 파라미터가 없으면 첫 미완료 스텝으로 착지한다. 스텝 status는 manifest.approvals + 산출물 존재에서 **읽기만** 하고 게이트를 재계산하지 않는다.
  - 게이트 토글(승인 스텝)은 `useApprovalGate` 경유다. Skill Runner 성공이 게이트를 자동으로 켜지 않는다.
- Design 검토 스텝은 **상/하 분할**(`af-design-split`)이다. **상단**은 `[선택 노드/엣지 정보 패널 │ 넓은 그래프 캔버스]` 2열이고, 좌측 패널은 선택한 노드/엣지 상세(재사용 `GraphInspector`)만 표시한다(선택이 없으면 안내 문구). **하단**은 신규 전체폭 패널(`af-design-bottom`)로, 모듈·Graph IR·Runtime/A2A 계약·경로·Comments 탭 목록을 담는다(상단 캔버스+좌측 패널 아래로 화면이 확장된다). 우측 Inspector 패널은 그래프 뷰에 폭을 양보하려고 비활성화돼 있다(`DesignWorkbench`의 `INSPECTOR_ENABLED=false`, `GraphCanvas`는 `hideInspector`로 `.graph-canvas-root--no-inspector` 1열). 플래그를 `true`로 되돌리면 상단 grid 에 Inspector 열이 복원된다. 비활성 동안 우측 Runtime 계약 편집기와 노드/엣지 앵커 코멘트 작성은 휴면이다. Remote A2A 계약 편집은 하단 `Remote A2A` 탭에서 활성화되어 목록 아래에 편집 surface를 둔다. Verify는 승인 게이트가 없어 2스텝(실행·기록)만 쓴다. `실행` 화면은 스텝 레일 없는 단일 도구 화면으로, ADK 런타임 연결 제어 + ADK 공식 dev UI(`web_url`, :8765)로의 링크 버튼만 둔다(AF 자체 간이 챗은 제거).

980px 이하에서는 stage navigation과 gate chip이 줄바꿈되어도 본문을 밀어내지 않도록 간격을 줄이고, 860px 이하에서는 StageShell 좌측 레일이 가로 탭으로 접힌다.
단계가 늘어나도 상단에 모든 버튼을 쌓지 않는다.

## 스타일시트 구조와 캐스케이드 레이어

CSS 는 `packages/web/src/styles/` 아래에 역할별로 분리되어 있고, `main.tsx` 는 단일 진입점 `styles/index.css` 만 import 한다.

```
src/styles/
  index.css      ← 진입점. @layer 순서 선언 + 각 partial 을 layer() 로 import
  tokens.css     ← 디자인 토큰(:root). 색·타이포·간격·radius·z·motion 의 단일 편집 지점
  base.css       ← element reset/기본값(button, input, table …). 토큰만 사용
  primitives.css ← .ui-* + 레거시 구조 클래스(.panel/.stack/.actions/.tag/.eyebrow …)
  category.css   ← 카테고리 비주얼 SSoT(배지·stripe·affinity·domain map). CategoryBadge.tsx 의 짝
  features/      ← 화면별 블록(analysis-brief.css, graph.css)
  router/        ← route shell + per-route 스타일(shell, design, catalog …)
```

`index.css` 가 선언하는 캐스케이드 레이어 순서(낮음 → 높음):

```css
@layer tokens, base, primitives, components, features, router, utilities;
```

레이어는 specificity 보다 우선한다. 같은 요소를 가리키는 규칙이 충돌하면 **항상 더 늦은 레이어가 이긴다.** 새 화면은 specificity 싸움 없이 올바른 레이어에 규칙을 넣기만 하면 된다.

- `tokens` — `:root` 커스텀 프로퍼티만.
- `base` — bare element. 항상 가장 약하다.
- `primitives` — `.ui-*` 와 공용 구조 클래스(`primitives.css`).
- `components` — 화면을 가로지르는 위젯(카테고리 배지 등, `category.css`).
- `features` — 특정 컴포넌트 전용 블록(`features/*.css`).
- `router` — route shell + per-route(`router/*.css`). utilities 를 빼면 가장 강하다.
- `utilities` — 단일 목적 override 예약 슬롯(현재 비어 있음).

새 partial 은 `index.css` 에 `@import "./x.css" layer(<레이어>);` 한 줄로 추가한다. Vite 가 빌드 시 각 import 를 해당 `@layer {}` 블록으로 인라인한다.

## 코드 primitives

공통 UI primitive는 `packages/web/src/ui/primitives.tsx`(마크업)와 `packages/web/src/styles/primitives.css`(스타일)에 둔다.
새 화면은 가능한 한 이 primitive를 먼저 사용한다.

- `Panel`: 실제 작업 surface 또는 inspector block에만 사용한다. `.panel` 은 `.ui-panel` 의 레거시 alias 로 같은 규칙을 공유한다 — 새 코드는 `<Panel>` / `.ui-panel` 을 쓴다.
- `SectionHeader`: eyebrow, 제목, 설명, 보조 action을 같은 구조로 배치한다.
- `Button`: `primary`, `secondary`, `ghost` variant만 쓴다.
- `Field`, `SelectField`, `TextareaField`, `FileField`: label과 control 간격을 통일한다.
- `MetricPill`: 상태 요약, context metric, 짧은 숫자 정보를 표시한다.
- `EmptyState`: 아직 trace나 결과가 없는 영역을 조용히 설명한다.

도메인 고유 표시는 이 primitive가 아니라 기존 `CategoryBadge` / `SubtypeBadge`를 사용한다.
카테고리 색·글리프 single source of truth를 중복 구현하지 않는다.

## 상태 구조

상태는 `@tanstack/react-query` 기반이며 화면 별로 hook 이 분리되어 있다 (`packages/web/src/state/*`).

- 각 route 는 `useArtifactRoot`, `useAnalysisArtifact`, `useApprovalGate`, `useCollaboration`, `useCatalog`, `useScaffoldPlan`, `useTextArtifact`, `useVerify`, `useRecentRoots`, `useStageRunner` 중 필요한 hook 만 사용한다.
- `af-run-manifest.json` 의 `approvals.*` 가 모든 게이트 UI 의 source of truth 이다. 후보 status 로부터 다시 계산하지 않는다.
- `af-run-manifest.json` 의 optional `stage_runs` 는 Stage Runner 실행 요약일 뿐 approval source of truth 가 아니다.
- `localStorage` 는 최근 root 목록과 코멘트 작성자 이름/역할 캐시에만 사용한다. 단계 상태나 분석 결과는 절대 `localStorage` 에 두지 않는다.

새 기능을 추가할 때는 우선 어느 artifact 가 source of truth 인지 확인하고, 필요한 hook 을 `state/` 에 둔 다음 화면 component 가 그 hook 만 호출하도록 연결한다. analysis-result, scaffold-plan, manifest 의 schema 는 UI refactor 때문에 바꾸지 않는다.

## 디자인 토큰 (tokens.css)

모든 토큰은 `packages/web/src/styles/tokens.css` 의 `:root` 에 있다. 색·폰트·타이포·간격·radius·z·motion 을 여기서만 편집한다. base/primitives/components/features/router 는 리터럴을 직접 쓰지 않고 이 토큰을 참조한다.

**색 — 카테고리.** 새 카테고리를 추가하려면 항상 base/soft/line 3종을 함께 추가하고, `category.css` 에 glyph + `.category-badge.cat-<name>` + `.row-stripe.cat-<name>` 규칙을 더한다.

| 카테고리 | 메인 | soft | line | 의미 |
| --- | --- | --- | --- | --- |
| `agent` | `--cat-agent` (#a21caf 자홍) | `--cat-agent-soft` | `--cat-agent-line` | reasoning 책임 |
| `workflow` | `--cat-workflow` (#b35900 주황) | `--cat-workflow-soft` | `--cat-workflow-line` | control flow / orchestration |
| `adapter` | `--cat-adapter` (#0c6b58 청록) | `--cat-adapter-soft` | `--cat-adapter-line` | callable capability |
| `remote_a2a` | `--cat-remote` (#b42318 빨강) | `--cat-remote-soft` | `--cat-remote-line` | 원격 protocol boundary |
| `input` | `--cat-input` (#2858a5 파랑) | `--cat-input-soft` | `--cat-input-line` | 흐름 입력 |
| `output` | `--cat-output` (#0e7c5f 녹색) | `--cat-output-soft` | `--cat-output-line` | 흐름 출력 |

빨강(`--cat-remote`)은 Remote A2A 외에는 쓰지 않는다. 에러/위험 빨강이 필요하면 `--red` 를 쓴다.

**색 — chrome (mock-lab 이식).** 표면 `--surface`(#ffffff)·`--surface-muted`(#f6f5f4)·`--page-bg`(#fafaf9), 테두리 `--line`(#e5e3df)·`--line-strong`(#c8c4be), 텍스트 `--text`(본문 #37352f)·`--text-strong`(제목·값·dark active fill #1a1a1a)·`--text-muted`(#5d5b54)·`--text-subtle`(#787671), 강조 `--accent` 보라(#5645d4, hover `--accent-strong` #4534b3), `--amber`·`--red`·`--blue`·`--success`, status tint 6종(`--tint-*`).

**색 — 상태(status state).** 칩·배너·리뷰 배지의 success/warning/danger는 `--{success,warning,danger}-{soft,line,text}` 한 벌로 통일한다(`soft`=배경, `line`=테두리, `text`=라벨; `--success-faint`는 더 옅은 OK 배경). 승인 칩(`.af-approval-chip-on`), Graph 노드 리뷰(`.graph-node-review.approved/needs/rejected`), Graph 검증 배너, `.tag.risk`가 모두 이 토큰을 참조하므로 상태색은 `tokens.css` 한 곳에서 바뀐다.

**타이포.** font-size 는 8단계 스케일로 통일했다(이전 24종 rem/px 혼용을 정리): `--fs-2xs 11 / --fs-xs 12 / --fs-sm 13 / --fs-md 14 / --fs-lg 16 / --fs-xl 18 / --fs-2xl 20 / --fs-3xl 28`(px). line-height `--lh-tight 1.3 / --lh-normal 1.5`. weight `--fw-medium 500 / --fw-semibold 600 / --fw-bold 700 / --fw-heavy 800`. 폰트 `--font-sans`(Inter …) / `--font-mono`. 새 텍스트는 rem 리터럴 대신 이 토큰을 쓴다.

**간격.** `--space-3xs 2 / --space-2xs 4 / --space-xs 6 / --space-sm 8 / --space-md 10 / --space-lg 12 / --space-xl 14 / --space-2xl 16 / --space-3xl 18 / --space-4xl 20 / --space-5xl 24`(px). gap/padding/margin 은 이 스케일을 쓴다(스케일에 없는 5·7px 등 소수 레거시 값은 인라인 유지).

**radius / z / motion.** `--radius-button 8`·`--radius-card 12`·`--radius-pill 9999`(px). `--z-overlay 50`(모달·드로어). `--transition-fast 120ms ease`. 그림자/링은 재사용이 거의 없어 graph 등 사용처에 인라인으로 둔다.

`agent` 카테고리 색은 기존 보라(#5b46c2)가 chrome primary 보라(#5645d4)와 거의 겹쳐, 배지를 버튼·링크와 구분하기 위해 자홍(#a21caf)으로 옮겼다. 나머지 카테고리 색은 그대로다.

`router/*.css`(셸 포함)도 토큰 기반으로 수렴했다. 이전 translucent-black 팔레트(`rgba(0,0,0,*)`)는 역할별로 `--text-*`(텍스트)·`--line`/`--line-strong`(테두리)·`--surface-muted`(옅은 배경)에 매핑했고, 슬레이트 active fill `#1f2937` → `--text-strong`, 링크 `#2858a5` → `--blue`, 에러 `#b42318`(bare) → `--red`, 승인 초록 → `--success-*`, 카테고리 hex → `--cat-*` 로 바꿨다. 남는 raw 값은 의도적 투명 효과뿐이다: 모달 backdrop `rgba(0,0,0,0.3)`, 오버레이 `rgba(255,255,255,*)`, 카테고리 tint 배경 `rgba(<cat>,0.12)`.

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

## 모달 / 드로어 surface

오버레이 UI 는 두 가지 공유 패턴만 쓴다. 스타일은 `packages/web/src/styles/router/modal-drawer.css`(router 레이어)에 모으고 backdrop `rgba(0,0,0,0.3)` + `--z-overlay` 를 따른다.

- **모달** — 화면 중앙 카드. 마크업은 `af-modal-backdrop` > `af-modal`(크기 modifier 예: `af-catalog-workflow-modal`) > `af-modal-header` / `af-modal-body` / `af-modal-footer` + `af-modal-close`, `role="dialog" aria-modal="true"`. 예: 카탈로그 핀(`PinTargetDialog`), Design 검토의 `카탈로그 워크플로우 삽입`(`CatalogWorkflowPicker`).
- **드로어** — 우측 슬라이드 패널. 마크업은 `af-drawer` > `af-drawer-header` / `af-drawer-body` / `af-drawer-footer` / `af-drawer-hint` + `af-modal-close`, 동일 ARIA. 예: Reuse Hub 의 `신규 등록 제안`(`RegisterProposalDrawer`)과 `등록 승인`(`PublishApprovalDrawer`).

새 오버레이는 위 클래스 골격을 재사용하고, 카테고리/서브타입을 표시할 때는 raw `<span>` 대신 `CategoryBadge`/`SubtypeBadge` 를 쓴다.

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

현재 Module Review 책임은 DesignWorkbench의 모듈 검토 패널에 있다. 같은 테이블을 필터링하는 화면이 아니라 두 작업면을 분리한 review console이다.

- `신규 모듈`: 사람이 승인/보류/반려할 후보를 다룬다. 컬럼은 이름, 분류, 세부 유형, 검토 상태, 입력/출력 계약 요약에 둔다.
- `카탈로그 계약`: 기존 runtime contract를 다룬다. 카탈로그 원본은 read-only로 표시하고, 현재 분석의 입력/출력 override와 Graph 연결만 편집한다.

위험도, 신뢰도, 재사용 여부는 탭의 메인 컬럼에 두지 않는다.
필요하면 inspector의 보조 evidence로만 표시한다.

정보 필요 후보의 Resolution Draft는 Design Stage Runner가 proposed artifact와 diff summary로 제안할 수 있다.
LLM 초안은 바로 적용하지 않고, 누락 항목 답변, patch preview, `Smoke 계약`을 같은 위치에서 검토하게 한다.
`object` 또는 `array<object>` 입력/출력은 textarea가 아니라 Schema Tree로 표시한다.

- object 행은 접힘/펼침 가능한 단일 row로 둔다.
- 하위 field는 들여쓰기와 얇은 divider로 표시하고, 타입은 작은 code pill로 보여준다.
- 필드 추가, required 토글, type select는 Inspector 안에 두며 테이블 컬럼으로 끌어내지 않는다.
- raw JSON은 주 편집면이 아니라 보조 확인 수단으로만 쓴다.
- `제안 적용`과 approval gate 토글은 분리한다. Stage Runner 성공이 `analysis_reviewed`, `boundaries_approved`, `runtime_contracts_approved`를 자동으로 켜면 안 된다.

## Process Flow 시각화

`packages/web/src/components/GraphCanvas.tsx` 와 `packages/web/src/components/graph/*`(렌더링 레이어: layout·nodeTypes·edgeTypes·containerOverlay·validationBanner) 가 Graph IR 로부터 노드, 엣지, 컨테이너 overlay 를 만든다. `packages/web/src/graph/` 는 순수 graph-IR 엔진 헬퍼(`containerMembership.ts`)만 남는다.
node, edge, container 의미와 marker 판정은 `docs/workbench/process-flow.md`의 Graph IR 규칙을 따른다.

**Marker / overlay 스타일**
- `parallel_region`, `loop_region`, `human_review_region`, `remote_boundary`는 `ContainerOverlay`의 점선 region으로 표시한다.
- 새 marker를 추가할 때는 Graph IR 의미를 먼저 `process-flow.md`에 정의한 뒤 `containerOverlay.tsx`, `nodeTypes.tsx`, `edgeTypes.tsx`, CSS 색을 함께 갱신한다.
- container overlay는 흐름의 실제 범위를 가려서는 안 된다. 점선 경계와 낮은 대비 배경으로 node/edge 읽기를 방해하지 않게 한다.
- Graph IR 화면의 container overlay는 노드를 재배치하지 않는다. 전체 workflow를 한 번 배치한 뒤 포함 node의 bounding box를 감싸는 내부 region으로 표시한다. Design 검토의 편집 모드에서는 드래그한 노드 좌표를 `node.position`으로 저장하며, 저장된 finite position은 dagre 재배치 대상에서 제외한다.

**편집 모드**
- `GraphCanvas`는 기본적으로 읽기 전용이다. `editable` prop이 전달된 Design 검토 스텝에서만 `편집 모드` 토글과 노드/엣지 추가, 선택 삭제, 드래그 이동, 저장/취소 컨트롤을 노출한다.
- 편집 중에는 로컬 draft Graph IR만 바꾸고, `저장` 시 `analysis-result.json.processFlow`만 PUT 한다. `manifest.approvals.*` 게이트는 자동으로 바꾸지 않는다.
- `카탈로그 워크플로우 삽입` 버튼은 편집 모드 draft와 별개다. picker modal은 `/api/catalog`의 workflow 항목을 이름, owner domain, version/status, responsibility로 보여주고, 선택 시 단일 `workflow` 노드와 matching `ModuleCandidate`를 `analysis-result.json`에 즉시 저장한다. 이 기능은 catalog workflow fragment를 확장하지 않고 재사용 workflow를 하나의 Graph IR node로 추가한다.
- 편집 모드에서 선택된 노드/엣지는 좌측 정보 패널이 `GraphElementEditor`로 바뀌어 field-level 편집을 제공한다. 모듈 연결 picker는 `agent`/`workflow`/`adapter`/`remote_a2a` 노드에만 표시하고, `candidate.module_category === node.node_kind`인 후보만 연결한다. `input`/`output`/`function`/`tool`/`human_input` 등 synthetic 또는 비모듈 노드는 모듈 picker 대상에서 제외한다.
- 새 그래프 설계의 1차 노드 메뉴는 taxonomy가 아니라 실행 흐름 중심이다: 판단, API/도구 호출, 조건 분기, 사람 입력/승인, 병합, 반복 제어, 서브워크플로우 호출, 외부 Agent 호출, 대기/callback. 내부 `node_kind`는 각각 `agent`, `adapter_call`, `router`, `human_input`, `join`, `loop_control`, `workflow_call`, `remote_agent_call`, `callback_wait`를 사용한다.
- `adapter_call`은 Workflow가 고정한 호출 노드이며, MCP smoke 연결은 `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`, `mock_binding.provider: mock_lab`로 표시한다. LLM-selected MCP toolset은 `agent` 쪽 `invoke_binding: mcp_toolset`, `call_control: selected_by_llm`로 분리하고 node card에 Adapter처럼 표시하지 않는다.
- `agent` 노드 편집 폼은 `agent_execution_mode`를 `Single turn`/`Chat` 세그먼트 컨트롤로 노출한다. `task`는 선택지로 노출하지 않는다. `Chat`은 같은 ADK session history를 암묵 입력으로 쓰므로 helper copy와 inspector context row에 stateful warning을 유지한다.
- `node_kind`는 v1 편집 폼에서 바꾸지 않는다. 종류를 바꾸려면 기존 노드를 삭제하고 새 노드를 추가한다.
- 새 노드는 `remote_agent_call`이 아니면 parent 없는 첫 `graph_workflow`/`dynamic_workflow` 컨테이너에 기본 배치하고, 해당 컨테이너의 `contains_node_ids`에도 즉시 추가한다. `remote_agent_call` 새 노드는 로컬 workflow 컨테이너에 자동 편입하지 않는다.
- `callback_wait`는 module category가 아니라 callback/resume execution semantics다. Inspector/Editor의 실행 설정 섹션에서 `invoke_binding`, `decision_owner`, `call_control`을 확인한다.
- 엣지는 핸들 드래그와 순차 클릭 모드가 같은 생성 규칙을 쓴다. 자기 연결과 동일한 `from -> to` 중복은 UI에서 거부하고 한국어 notice로 표시한다.

**노드 렌더링**
- `input`/`output` pill은 변수명만 보여준다(`INPUT`/`OUTPUT` eyebrow 텍스트 없음). 입력/출력 구분은 lane 위치와 `--cat-input`/`--cat-output` 틴트로 한다. 긴 변수명이 박스 밖으로 흘러내리지 않도록 박스 안에서 clamp 한다.
- `join` 노드는 박스를 dot(원) 크기에 맞춰(`JOIN_DOT_BOX`) dot 중심이 좌/우 edge 핸들과 같은 높이에 오게 한다. join 라벨은 박스 아래 absolute caption으로 깔아 dot 중심을 밀지 않는다.
- Graph node header는 책임 분류와 검토 상태만 빠르게 읽히게 한다. category/subtype, label, module id, review status가 visual owner이며 `runtime_binding`, `invoke_binding`, `call_control`, Mock Lab binding, ADK Skeleton contract는 node card에 올리지 않는다.
- `agent_execution_mode`의 visual owner는 선택된 Inspector/Editor의 실행 설정과 편집 segmented control이다. `execution_kind`가 `llm_single_turn`, `single_turn`, `chat`, `task`처럼 mode 의미를 담는 legacy/technical label이면 agent node header의 subtype badge로 반복 표시하지 않는다.
- Inspector/Editor는 축을 섞지 않는다. 섹션 순서는 `책임 분류` → `계약` → `실행 설정` → `정책·리스크` → `Mock Lab` → `ADK Skeleton`이고, `runtime_binding`은 `invoke_binding` 아래 legacy/compat 정보로만 표시한다.
- `agent` 노드에서 `chat` badge는 accent 색으로 session-history dependency를 스캔 가능하게 한다.

**Graph Inspector** *(노드/엣지를 선택하면 **상단 좌측 정보 패널**에 `GraphInspector`가 렌더된다 — 위 "화면 골격" 참고. 우측 Inspector 패널 자리(`INSPECTOR_ENABLED=true` 재활성)에서도 같은 명세를 쓴다.)*
- 노드 선택 시 `node_kind`, `module_id`, agent mode/context, container, lane, owner, review status, 연결된 module candidate risk/missing information을 표시한다.
- Inspector도 같은 de-duplication 규칙을 따른다. agent mode는 `agent_execution_mode` 기반의 한 row로 표시하고, mode와 충돌하거나 같은 뜻인 raw `execution_kind`는 주 정보 영역에 반복 표시하지 않는다.
- 엣지 선택 시 `edge_kind`, `execution_semantics`, `data_label`, `schema_ref`, `route_condition`, `state_key`, `artifact_key`, `a2a_contract_id`, boundary crossing을 표시한다.
- 선택된 edge는 label 유무와 관계없이 선 자체를 굵게 표시하고 다른 edge보다 위에 렌더링해 선택 상태를 즉시 알 수 있어야 한다.
- `remote_a2a` edge는 Remote A2A 계약 검토 화면으로 이동할 수 있어야 한다.

**Graph UI 변경 검증**
- Graph UI에 badge/chip/row를 추가하거나 의미 매핑을 바꾸는 PR은 실제 artifact 화면을 한 번 이상 열고, 같은 node card 안에서 같은 의미가 두 번 보이지 않는지 확인한다.
- 검증 대상은 최소 세 가지다: Canvas node card, 선택된 Inspector, 편집 모드 Editor. 특히 legacy artifact의 `execution_kind`와 새 semantic field가 동시에 존재하는 경우를 포함한다.
- 스크린샷 검토에서는 "새 정보가 보이는가"뿐 아니라 "기존 정보와 합쳐져도 한 문장으로 읽히는가"를 확인한다. 같은 의미가 반복되거나 서로 모순되면 새 visual owner를 정하고 나머지는 숨긴다.

**Remote A2A 하단 탭**
- `Remote A2A` 탭은 후보/계약 목록 아래에 `A2AContractInspector` 편집 surface를 둔다.
- 매칭 계약이 없는 선택 후보에는 `새 계약 생성` 버튼으로 placeholder 계약을 만들고, 후보의 `a2a_contract_id`를 같은 저장에서 연결한다.
- readiness issue가 남아 있으면 `contract_status: approved` 저장을 막고, 게이트 토글은 여전히 `manifest.approvals.runtime_contracts_approved`에서 reviewer가 별도로 수행한다.

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

**광범위 자손 선택자가 새 컴포넌트를 깨뜨린다.** 기존에 `.domain-map-table td span { display: block; }` 같은 룰이 있어서 새로 추가한 `.category-badge` (span) 가 block 으로 강제되어 안의 글리프와 텍스트가 두 줄로 깨졌다. 테이블/리스트의 마크업 스타일 룰은 항상 직계 자식 선택자(`>`)를 쓴다. `@layer` 는 *specificity 충돌*만 해결한다 — descendant 선택자가 안쪽 요소를 잡아버리는 매칭 문제는 레이어로 막지 못하므로 `>` 로 좁히는 규칙은 여전히 유효하다.

**flex / inline-flex 자식이 grid item 일 때.** grid container 안에 inline-flex 자식을 두면 grid track 폭에 따라 안의 텍스트가 wrap 될 수 있다. 카테고리 배지처럼 한 줄로 유지해야 하는 경우는 grid 가 아니라 flex column + align-items:flex-start 를 쓴다.

**HMR 캐시.** 한국어/영어 혼용 컨텐츠를 다루다 보니 CSS 변경이 가끔 hot reload 에 반영되지 않는다. 시각 결과가 코드와 어긋나면 chrome-devtools MCP `navigate_page` 의 `ignoreCache: true` 로 강제 reload 한다.

## 새 화면 추가 레시피

1. **레이어를 고른다.** 재사용 구조는 `primitives.css`(primitives), 카테고리/배지류는 `category.css`(components), 화면 전용 블록은 `features/<name>.css`(features), route 셸은 `router/<name>.css`(router). `index.css` 에 `@import "./… .css" layer(<레이어>);` 한 줄을 추가한다.
2. **토큰만 쓴다.** 색·font-size·간격·radius 는 리터럴 대신 `var(--*)`. 스케일에 없는 값이 필요하면 먼저 `tokens.css` 에 추가한다.
3. 카테고리·서브타입을 표시한다면 `CategoryBadge` / `SubtypeBadge` 를 import 한다 — 직접 `<span>` 작성 금지.
4. 카테고리 stripe 가 필요하면 `row-stripe` + `categoryClass()` 를 쓴다.
5. 새 색·글리프가 필요하면 `tokens.css` 토큰(base/soft/line) + `category.css` 규칙 + `subtypeGlyph` 매핑을 함께 추가한다.
6. 새 Graph marker 가 필요하면 Graph IR 의미(`process-flow.md`), node/edge/container 렌더러, `features/graph.css` 색을 모두 갱신한다.
7. 화면 단위 자손 선택자(`.foo-table td span`) 는 항상 `>` 직계 자식으로 좁힌다.
8. 변경 후 Chrome DevTools MCP 또는 Playwright로 스크린샷을 찍어 색 매핑·레이아웃이 맞는지 시각 확인한다.

## 검증

- `npm run build` (tsc + vite build) 통과
- 토큰/스케일은 `tokens.css` 한 곳에서만 편집했는지 확인 — 다른 stylesheet 에 색·font-size·간격 리터럴을 새로 넣지 않는다.
- Analyze Stage Runner / Design Stage Runner / Graph IR / Catalog에서 카테고리 색이 동일한지 시각 확인
- `before/after` 스크린샷이 필요할 때는 dev 서버 + Chrome DevTools MCP 또는 Playwright로 캡처
