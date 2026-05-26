# 01 — Canvas collaboration overlay (코멘트 핀 + Highlight 시각화)

## 왜 필요한가

PR3 에서 협업 레이어의 데이터 모델 (`collaboration/{comments,highlights}.json`) 과 inspector 측 코멘트 thread 는 구현했지만, Graph IR canvas 자체에는 시각적 표지가 없다. 두 사람이 같은 화면을 보며 "여기 노드에 문제 있다" 를 가리키려면 노드 옆에 핀이 떠야 한다. highlight 도 path/region 정보가 파일로는 저장되지만 canvas 에 색이 입혀지지 않는다.

PR3 commit 메시지 `676b140` 의 "Deferred" 섹션에서 명시적으로 이 작업을 분리해두었다.

## 현재 상태

- 협업 데이터: `artifacts/af/<reqId>/collaboration/comments.json`, `highlights.json` 에 저장. anchor 종류: `node` / `edge` / `container` / `path` / `section`. `node` 인 경우 `node_id` 가 ReactFlow node id 와 일치한다.
- 서버: `packages/web/server/afCollaborationApi.ts` 에 CRUD 끝. 추가 작업 없음.
- 클라이언트 hooks: `packages/web/src/state/useCollaboration.ts` 에 `useComments`, `useHighlights`, `useCreate/Update/Delete...` 끝. 추가 작업 없음.
- UI: `packages/web/src/design/CommentThread.tsx` 는 sidebar + inspector 양쪽에서 사용. **canvas 위에 그려지는 것은 없음.**
- Graph IR 렌더링: `packages/web/src/components/GraphCanvas.tsx` 가 ReactFlow 를 `ReactFlowProvider` 안에 마운트하고 `selection` 을 prop 으로 받는다. `hideInspector` prop 으로 inspector 를 끌 수 있다 — DesignWorkbench 는 이 모드를 사용 중.
- 가능 진입점: `GraphCanvas` 에 optional render-prop 이나 children slot 을 추가하고 그 안에서 `useReactFlow().project()` 로 데이터→스크린 좌표 변환을 수행.

## 작업 정의 (Done means)

1. Graph IR canvas 위에 `comments.json` 의 `node` / `edge` anchor 마다 작은 핀이 보인다.
   - 핀은 카테고리 색 토큰 (`--cat-{agent,workflow,adapter,remote}-base`) 을 따른다.
   - 핀 호버 시 작성자 + 시간 + 본문 앞부분 tooltip.
   - 핀 클릭 시 inspector 가 해당 anchor 의 thread 로 스크롤/포커스.
2. `highlights.json` 의 항목별로 canvas edge / node 가 강조된다.
   - `path` → 해당 edge 시퀀스를 다른 색으로 굵게.
   - `node_group` → 노드 테두리에 컬러 ring.
   - `edge_group` → 해당 edge 색 변경.
   - `container_focus` → 컨테이너 오버레이 강조.
3. 핀 / 강조는 viewport zoom / pan 에 따라 정확한 위치를 유지한다.
4. ReactFlow 의 nodeTypes / edgeTypes 를 재사용하면서도 GraphCanvas 의 기존 props (controlled selection, onContinue 등) 가 깨지지 않는다.

## 파일 / 디렉터리

- 신규
  - `packages/web/src/design/CollaborationOverlay.tsx`
  - `packages/web/src/design/HighlightOverlay.tsx`
- 수정
  - `packages/web/src/components/GraphCanvas.tsx` — 자식 슬롯 또는 render-prop 추가. ReactFlowProvider 내부에서 overlay 가 `useReactFlow()` 를 호출할 수 있어야 함.
  - `packages/web/src/routes/DesignWorkbench.tsx` — overlay 마운트.
  - `packages/web/src/styles-router.css` — `.af-comment-pin`, `.af-highlight-edge`, `.af-highlight-container` 클래스.

## 구현 메모

- ReactFlow 의 `useReactFlow().getNode(nodeId)?.positionAbsolute` 와 `viewportInstance.transform` 또는 `<NodeToolbar>` 컴포넌트 활용을 검토.
- 핀 position 은 `<div className="af-comment-overlay">` 안에 absolute 로 배치. 부모는 ReactFlow root 의 `position: relative` 영역. 시각 좌표는 매 frame `useStore` 의 transform 으로 재계산.
- highlight path 의 edge 식별은 `from`/`to` node id 시퀀스 → edge.id 매칭 (analysis-result.processFlow.edges) → ReactFlow edge id 로 변환.

## 검증

```bash
# build / test
cd packages/web && npm run build && npm run test:analyzer
```

MCP 시나리오 (scenario-d-graph-workflow 사용 권장 — 노드 / edge / container 가 풍부):

1. `POST /api/af { requirement_id: "req-pr-collab" }` + `PUT analysis-result.json` (scenario-d).
2. `POST /api/af-collab/req-pr-collab/comments` 로 `{ stage: "design", anchor: { kind: "node", node_id: "<실제 노드 id>" }, body_md: "..." }` 3건 추가.
3. `/af/req-pr-collab/design` 진입 → canvas 에 3 핀이 나타나는지 스크린샷.
4. `POST /api/af-collab/req-pr-collab/highlights` 로 `{ kind: "path", target: { node_path: [...] } }` 추가 → 해당 경로의 edge 가 강조되는지 스크린샷.
5. ReactFlow 의 zoom in/out 후에도 핀이 정확한 노드 위에 머무는지 확인.

## Out of scope

- PathTracePanel (두 노드 선택으로 highlight 자동 생성) → `02-path-trace-panel.md`.
- Highlight 만들기 UI (현재는 API 만 동작) → 02 에서 다룸.
- 핀 클릭 시 thread 자동 펼침은 02 에서 다루는 게 자연스럽다.

## 위험 / 메모

- ReactFlow viewport 좌표 계산은 `<ReactFlowProvider>` 자식에서만 가능. GraphCanvas 내부 children 슬롯이 필수.
- 핀 개수가 많아지면 (한 노드에 코멘트 5+) 클러스터링 정책 필요. 1차에서는 카운트 뱃지로 충분.
- DesignWorkbench 의 inspector 와 canvas overlay 양쪽이 같은 selection state 를 공유해야 한다 — 현재 `selection` 은 DesignWorkbench 가 owner, GraphCanvas/Overlay 가 controlled props 로 받는 패턴 유지.
