# Web Workbench Design System

이 문서는 `packages/web` Workbench의 Current Implementation 시각 계약을 설명한다. 자산 분류는 [Taxonomy](../workbench/taxonomy.md), Node·Edge·Region 의미는 [Graph IR](../workbench/graph-ir.md)가 소유하며, 이 문서는 그 의미를 별도 enum으로 다시 정의하지 않는다.

## 디자인 원칙

- **자산과 프로토콜을 분리한다.** Agent·Workflow·Tool은 자산 배지로, MCP·A2A는 프로토콜 배지로 표시한다.
- **자산은 색·글리프·stripe로 구분한다.** Analyze, Design, Graph IR, Runtime 계약, Reuse Hub에서 같은 매핑을 사용한다.
- **흐름 의미는 Canvas 안에서 읽힌다.** Node 형태, Edge의 `control`·`channel`, `parallel`·`loop` Region overlay를 함께 사용한다.
- **Workbench는 운영 콘솔이다.** 상태, 다음 단계, 작업면, 선택 context를 먼저 읽을 수 있어야 한다.
- **카드는 상호작용 surface에만 쓴다.** shell, workspace, inspector의 정보 구조를 카드 모자이크보다 우선한다.

## 화면 골격

`packages/web/src/layout/WorkbenchLayout.tsx`와 `packages/web/src/layout/StageShell.tsx`, route별 Workbench가 기본 골격이다.

- 상단 shell은 artifact root 전환, approval gate chip, Analyze·Design·Build·Verify stage navigation과 보조 `실행`, `Reuse Hub`, `Mock Lab` navigation을 제공한다.
- Stage 내부는 compact stepper로 실행·검토·승인을 분리한다. Stage Runner 성공이 approval gate를 자동으로 켜지 않는다.
- Design 검토는 `af-design-split` 안에서 Graph 작업면과 하단 전체폭 검토 패널을 세로로 배치한다.
- Graph 작업면은 왼쪽 선택 context와 오른쪽 Canvas의 2열이다. 읽기 상태에서는 `GraphInspector`, 편집 상태에서는 `GraphElementEditor`가 왼쪽에 표시된다.
- Design 하단 탭 ID는 정확히 `assets`, `runtime`, `a2a`, `reviewNotes`다. 화면 라벨은 `Assets`, `Runtime 계약`, `A2A 계약`, `검토 메모`다.
- `assets` 탭은 Asset 목록과 선택한 Asset의 분류 근거·누락 정보·승인 상태를 함께 표시한다. `reviewNotes`는 comment와 path highlight를 함께 소유한다.

현재 Workbench 운영·QA 기준은 desktop viewport다. 좁은 viewport의 줄바꿈과 단일 열 전환은 지원하지만 mobile/tablet은 acceptance baseline이 아니다.

## 스타일시트 구조와 캐스케이드

`packages/web/src/main.tsx`는 `packages/web/src/styles/index.css`만 import한다. `index.css`는 다음 순서로 레이어를 선언한다.

```css
@layer tokens, base, primitives, components, features, router, utilities;
```

| 레이어 | 소유 범위 |
| --- | --- |
| `tokens` | `tokens.css`의 `:root` 디자인 토큰 |
| `base` | element reset과 기본값 |
| `primitives` | `.ui-*`와 공유 구조 |
| `components` | `CategoryBadge`, `ProtocolBadge`, stripe 같은 화면 공통 표현 |
| `features` | Graph 등 특정 기능 블록 |
| `router` | route shell과 화면별 배치 |
| `utilities` | 단일 목적 override 예약 |

새 partial은 `index.css`에서 정확한 레이어로 import한다. 색·font-size·간격·radius는 가능한 한 `tokens.css`의 토큰을 사용한다.

## 자산·프로토콜 토큰

자산 category 토큰은 base·soft·line 세 값을 한 벌로 유지한다.

| 표현 | base | soft | line | 의미 |
| --- | --- | --- | --- | --- |
| Agent | `--cat-agent` | `--cat-agent-soft` | `--cat-agent-line` | Agent 책임 |
| Workflow | `--cat-workflow` | `--cat-workflow-soft` | `--cat-workflow-line` | 실행 조정 책임 |
| Tool | `--cat-tool` | `--cat-tool-soft` | `--cat-tool-line` | 구조화된 호출 기능 |
| A2A protocol | `--protocol-a2a` | `--protocol-a2a-soft` | `--protocol-a2a-line` | Agent의 A2A 경계 |

MCP protocol badge는 chrome의 `--tint-lavender`, `--line-strong`, `--accent`를 사용한다. A2A의 빨강은 자산 category 색이 아니며 오류·위험 상태에는 `--danger-*` 또는 `--red` 계열 상태 토큰을 사용한다.

`--cat-input*`과 `--cat-output*`은 Graph의 입출력 lane 토큰이다. Agent·Workflow·Tool 자산 category에 포함하지 않는다.

## 공유 배지

시각 표시의 source of truth는 `packages/web/src/components/CategoryBadge.tsx`와 `packages/web/src/styles/category.css`다.

### `CategoryBadge`

`CategoryBadge`는 `AssetType`만 받는다.

| 값 | 라벨 | 글리프 | CSS class |
| --- | --- | --- | --- |
| `agent` | Agent | `◆` | `cat-agent` |
| `workflow` | Workflow | `▶` | `cat-workflow` |
| `tool` | Tool | `⚙` | `cat-tool` |

```tsx
<CategoryBadge category={candidate.asset_type} />
```

`categoryClass(category)`는 `cat-agent`, `cat-workflow`, `cat-tool` 중 하나를 반환한다.

### `ProtocolBadge`

`ProtocolBadge`는 `mcp` 또는 `a2a`만 받으며 자산 배지 옆에 별도로 렌더링한다.

```tsx
<ProtocolBadge value="mcp" />
<ProtocolBadge value="a2a" />
```

`CandidateCategoryBadge`는 항상 자산 `CategoryBadge`를 먼저 표시하고, Tool의 `binding.kind: mcp`에는 MCP 배지를, Agent의 `binding.kind: a2a` 또는 `exposure.protocol: a2a`에는 A2A 배지를 추가한다. A2A를 네 번째 자산 색이나 자산 라벨로 표시하지 않는다.

테이블 stripe도 같은 `categoryClass(asset.asset_type)` 결과를 사용한다.

```tsx
<tr className={`row-${categoryClass(asset.asset_type)}`}>
  <td className="row-name-cell">
    <span className={`row-stripe ${categoryClass(asset.asset_type)}`} aria-hidden="true" />
  </td>
</tr>
```

## Asset Review

Design의 자산 검토 구현 파일은 `packages/web/src/routes/design/DesignAssetReview.tsx`다. 하단 `assets` 탭의 조합은 `DesignBottomPanel.tsx`가 소유한다.

- `AssetSidebar`는 `assetCandidates`를 `CandidateCategoryBadge`, 이름, 근거, 상태와 함께 표시한다.
- `AssetReviewDetail`은 `asset_id`, `asset_type`, `binding`, risk, missing information을 보여주고 누락 항목 해소와 승인·보류·반려 action을 제공한다.
- CSS 파일은 `packages/web/src/styles/router/design.css`이며 클래스명은 `.af-asset-list`, `.af-asset-item-*`, `.af-asset-review-*` 계열을 사용한다.
- Asset과 protocol 표시는 직접 만든 raw badge 대신 `CategoryBadge`, `ProtocolBadge`, `CandidateCategoryBadge`를 재사용한다.

## Graph IR 시각화

Graph 의미는 [Graph IR](../workbench/graph-ir.md)가 소유한다. Current Implementation의 source enum은 `packages/web/src/analyzer/types.ts`의 `graphNodeKinds`, `graphControlKinds`, `graphChannels`, `graphRegionKinds`다.

`packages/web/src/analyzer/graphValidation.ts`의 `validateGraphIR`가 canonical envelope와 exact key, Node ref, Edge, Region을 검증한다. 현재 Graph 경로에는 normalize·merge API가 없으며 validator는 입력을 보정하지 않는다.

### Node

Node kind는 정확히 여덟 가지다.

| `node_kind` | 표시 |
| --- | --- |
| `input` | 입력 pill |
| `agent` | Agent asset card |
| `tool` | Tool asset card |
| `function` | Function 또는 route surface |
| `human_input` | 사람 입력 card |
| `subworkflow` | Workflow asset card |
| `join` | fan-in dot |
| `output` | 출력 pill |

Graph 편집기의 Node 추가 메뉴도 이 여덟 값을 그대로 사용한다. `agent`, `tool`, `subworkflow`는 각각 typed `agent_ref`, `tool_ref`, `workflow_ref`로 Asset을 연결한다. A2A 경계는 A2A Binding 또는 Exposure를 가진 Agent Node에 `ProtocolBadge`로 표시한다.

### Edge

모든 Edge는 `id`, `from`, `to`, `control`, `channel`을 갖는다.

- `control`은 흐름 제어를 소유하며 `kind`, `condition`, `accepted_aliases`, `default`를 포함한다.
- `channel`은 데이터 전달 축이며 `event`, `state`, `artifact` 또는 `null`이다.
- Edge label과 선 스타일은 `control.kind`와 optional `channel`을 함께 반영한다. 두 축을 하나의 종류로 합치지 않는다.
- callback, resume, cancel, timeout은 별도 Node가 아니라 Edge `control.kind`다.

### Region

Region kind는 직렬화상 `parallel`, `loop` 둘뿐이다. 화면에서는 각각 `병렬 실행 범위`, `반복 실행 범위`로 표시한다. `RegionOverlay`는 membership에서 계산한 경계를 낮은 대비 배경과 점선으로 표시하며 Node 위치를 다시 쓰지 않는다. 편집기는 `node_ids`, `entry_node_ids`, `exit_node_ids`를 관리한다.

Region은 Graph 구조 표시이며 Workflow 실행 방식 선택기가 아니다. 실행 방식은 연결된 Workflow의 `workflow_profile.representation`이 소유하고, UI는 Region을 ADK `ParallelAgent`·`LoopAgent` 또는 별도 Workflow 유형처럼 설명하지 않는다.

### Canvas와 편집기

- `GraphCanvas.tsx`는 React Flow orchestration과 draft 저장을 담당한다.
- `components/graph/nodeTypes.tsx`, `edgeTypes.tsx`, `containerOverlay.tsx`, `layout.ts`는 렌더링 레이어다.
- `graph/graphDisplay.ts`는 Node kind에서 Asset type으로 가는 표시 mapping과 canonical Edge ID를 제공한다.
- 기본 Canvas는 읽기 전용이고 Design review에서 `editable`일 때만 Node·Edge·Region 추가, 삭제, drag, 저장을 노출한다.
- 저장은 `analysis-result.json`의 canonical `graph`를 갱신한다. approval gate, generator, validator는 자동 실행하지 않는다.
- Inspector/Editor group은 현재 데이터에 따라 `요약`, `입출력`, `흐름`, `호출·채널`, `검토·리스크`, `원본`을 노출한다.

## 모달과 드로어

오버레이 style은 `packages/web/src/styles/router/modal-drawer.css`에 둔다.

- 모달: `af-modal-backdrop` > `af-modal` > header/body/footer 구조와 `role="dialog" aria-modal="true"`를 사용한다.
- 드로어: `af-drawer` > header/body/footer 구조와 같은 ARIA 계약을 사용한다.
- 자산과 프로토콜을 표시할 때 공유 badge component를 사용한다.

## CSS 주의사항

- `.foo-table td span` 같은 광범위 자손 selector는 badge 내부 `span`까지 잡는다. 화면 구조 rule은 가능한 한 `>` 직계 자식 selector로 좁힌다.
- `inline-flex` badge를 grid item으로 두면 track 폭에 따라 label이 줄바꿈될 수 있다. badge stack은 `display:flex`, `flex-direction:column`, `align-items:flex-start`를 사용한다.
- HMR 결과가 source와 다르면 cache를 비운 reload로 다시 확인한다.

## 새 화면 또는 Graph 표현 추가

1. 재사용 구조는 `primitives`, 공통 badge는 `components`, 기능 전용 style은 `features`, route 배치는 `router` 레이어에 둔다.
2. 새 색·간격은 먼저 `tokens.css`에서 기존 scale로 표현 가능한지 확인한다.
3. 자산은 `CategoryBadge`, protocol은 `ProtocolBadge`를 사용한다.
4. 자산 stripe는 `categoryClass(asset_type)`와 `.row-stripe`를 사용한다.
5. Graph 의미 변경은 먼저 canonical [Graph IR](../workbench/graph-ir.md)에 반영하고 TypeScript enum, validator, renderer, editor를 함께 맞춘다.
6. 실제 artifact 화면에서 Canvas, Inspector, Editor의 중복·모순을 확인하고 visible UI 변경이면 screenshot을 남긴다.

## Build/Design artifact sync UX

- Design 저장의 observable은 `analysis-result.json.graph` 갱신이다.
- Build primary action은 `계약 동기화 + runtime-stub 재생성`이며 `POST /api/af/:reqId/artifact-sync/run`을 사용한다.
- 작업 순서는 `Graph IR 저장 → artifact 동기화 → scaffold-plan 작성 → runtime-stub 재생성 → validate-artifacts 실행 → reviewer approval`로 설명한다.
- 동기화 성공은 산출물 갱신을 뜻하며 approval gate를 자동으로 변경하지 않는다.

## Current source locators

| 행동 | Path | Stable anchor |
| --- | --- | --- |
| 자산·프로토콜 badge | [CategoryBadge.tsx](../../packages/web/src/components/CategoryBadge.tsx) | `CategoryBadge`, `ProtocolBadge`, `CandidateCategoryBadge`, `categoryClass` |
| badge와 stripe CSS | [category.css](../../packages/web/src/styles/category.css) | `.category-badge`, `.protocol-badge`, `.row-stripe` |
| 자산·A2A token | [tokens.css](../../packages/web/src/styles/tokens.css) | `--cat-agent`, `--cat-workflow`, `--cat-tool`, `--protocol-a2a` |
| Design 하단 탭 | [designWorkbenchTabs.ts](../../packages/web/src/design/designWorkbenchTabs.ts) | `DESIGN_BOTTOM_TABS` |
| Asset Review | [DesignAssetReview.tsx](../../packages/web/src/routes/design/DesignAssetReview.tsx) | `AssetSidebar`, `AssetReviewDetail` |
| 하단 검토 panel | [DesignBottomPanel.tsx](../../packages/web/src/routes/design/DesignBottomPanel.tsx) | `DesignBottomPanel`, `AssetReviewTab` |
| Graph enum과 envelope | [types.ts](../../packages/web/src/analyzer/types.ts) | `graphNodeKinds`, `graphControlKinds`, `graphChannels`, `graphRegionKinds`, `GraphIR` |
| Graph 검증 | [graphValidation.ts](../../packages/web/src/analyzer/graphValidation.ts) | `validateGraphIR` |
| Graph 추가 메뉴 | [graphElementEditorModel.ts](../../packages/web/src/components/graphElementEditorModel.ts) | `TARGET_NODE_KIND_OPTIONS` |
| Canvas 저장·편집 | [GraphCanvas.tsx](../../packages/web/src/components/GraphCanvas.tsx) | `GraphCanvas`, `GraphEditToolbar`, `buildEditableNode`, `buildEditableEdge` |
| canonical Graph 저장 | [designWorkbenchActions.ts](../../packages/web/src/routes/design/designWorkbenchActions.ts) | `saveGraphIR` |
| Node·Edge·Region 렌더링 | [components/graph](../../packages/web/src/components/graph/) | `nodeTypes`, `edgeTypes`, `RegionOverlay` |

## 검증

UI source 변경 시 `packages/web`에서 `npm run build`와 관련 test를 실행한다. visible UI 변경은 고정 포트 `5173`의 실제 화면에서 배지 mapping, Design 탭, Graph Node·Edge·Region, Asset Review layout을 확인한다. 문서만 변경할 때는 저장소 root에서 `git diff --check`, 상대 링크·anchor 확인, edited-file inventory를 수행한다.
