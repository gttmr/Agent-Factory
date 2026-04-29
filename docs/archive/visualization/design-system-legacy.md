# Web Workbench Design System

이 문서는 `packages/web` 워크벤치 UI 의 디자인 시스템을 정의한다. 카테고리 색·글리프 컨트랙트, 공유 컴포넌트 패턴, Process Flow 의 stage 모델, CSS 함정을 다룬다. 새 화면을 추가하거나 기존 화면을 수정할 때 이 문서의 컨트랙트를 따른다.

## 디자인 원칙

- **카테고리는 색으로 구분한다.** Agent / Workflow / Adapter / Remote A2A 의 분류는 라벨만 보고 식별하지 않고 색·글리프·stripe 로 즉시 구분되어야 한다. 모든 화면(Module Review, Process Flow, Reuse Heatmap, Domain × Capability Map)이 동일 매핑을 사용한다.
- **특수 흐름은 시각적으로 부각한다.** parallel / loop / human_review / branch 같은 흐름은 텍스트 라벨이 아니라 stage marker 와 점선 박스로 표시한다.
- **Edge 는 흐름 안에 둔다.** 노드 리스트와 분리된 거대한 edge 테이블 대신, stage 사이 connector 화살표와 데이터 라벨 chip 으로 통합한다.

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
- parallel → `⇉`, loop → `↻`, human_review → `✓`, sequential → `→`, orchestration → `⋈`
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
서브타입 enum 값(`legacy_api`, `loop`, `shared` 등)을 받아 글리프와 한글/영문 라벨을 표시. 라벨 매핑은 `classificationRules.ts` 의 `*KindLabels` 를 사용한다.

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

## Process Flow stage 모델

`packages/web/src/components/ProcessFlowView.tsx` 의 `buildFlowStages()` 가 candidate 와 process flow 로부터 stage 를 만든다.

**Stage 순서 (모듈이 존재할 때만 표시):**
1. **입력 컨텍스트** — `input` 노드들
2. **Adapter 호출** — `adapter_kind` 가 `legacy_api` 또는 `retrieval` 인 노드. 2개 이상이면 layout=parallel + parallel marker
3. **Local 검토 / Orchestration** — workflow / agent / 그 외 adapter (rule_registry 제외)
4. **Rule Registry 라우팅** — `adapter_kind: rule_registry` 노드 단독
5. **Remote A2A 경계** — `remote_a2a` 노드들
6. **결과 산출** — `output` 노드들
7. (필요 시) **추가 모듈** — 위에 자동 배치되지 않은 잔여 노드 (출력 직전에 끼워 넣음)

**Stage marker 자동 감지:**
- `parallel` — Adapter 호출이 2개 이상이거나 candidate 중 `workflow_kind: parallel` 이 있을 때
- `human_review` — candidate 중 `workflow_kind: human_review` 이거나 `risk_signals` 에 `human_approval_required` 가 있을 때
- `loop` — candidate 중 `workflow_kind: loop` 이거나 edge data 가 `loop:` 로 시작할 때
- `branch` — edge data 가 `branch:` 로 시작할 때

새 marker 를 추가할 때는 stage builder 의 감지 로직과 `markerCopy` (글리프·라벨)와 `.stage-marker.marker-*` 의 CSS 색을 모두 갱신한다.

**Stage connector** — stage 사이에 화살표와 edge data chip 을 표시한다. `buildInterStageEdges()` 가 stage 간 edge 를 모은다. 같은 stage 내부의 edge 는 표시하지 않는다 (stage 자체가 그 묶음을 의미). 한 connector 는 데이터 라벨을 최대 4 개까지만 표시한다.

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
4. 새 stage marker 가 필요하면 `markerCopy`, 감지 로직, `.stage-marker.marker-*` 색을 모두 갱신한다.
5. 화면 단위 자손 선택자(`.foo-table td span`) 는 항상 `>` 직계 자식으로 좁힌다.
6. 변경 후 chrome-devtools MCP 로 스크린샷을 찍어 색 매핑이 맞는지 시각 확인한다.

## 검증

- `npm run build` (tsc + vite build) 통과
- Process Flow / Module Review / Reuse Heatmap / Domain Map 네 화면에서 카테고리 색이 동일한지 시각 확인
- `before/after` 스크린샷이 필요할 때는 dev 서버 + chrome-devtools MCP 의 `take_screenshot` 으로 캡처
