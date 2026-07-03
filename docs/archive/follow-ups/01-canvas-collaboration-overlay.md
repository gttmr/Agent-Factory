# 01 — Canvas collaboration overlay (코멘트 핀 + Highlight 시각화)

상태: 완료. 협업 데이터/API와 DesignWorkbench의 Comments thread에 더해, GraphCanvas 위에 comment pin, highlight edge/node/container 강조, comment tooltip 이 표시된다.

## 왜 필요한가

PR3 에서 협업 레이어의 데이터 모델 (`collaboration/{comments,highlights}.json`) 과 inspector 측 코멘트 thread 는 구현했지만, Graph IR canvas 자체에는 시각적 표지가 없다. 두 사람이 같은 화면을 보며 "여기 노드에 문제 있다" 를 가리키려면 노드 옆에 핀이 떠야 한다. highlight 도 path/region 정보가 파일로는 저장되지만 canvas 에 색이 입혀지지 않는다.

PR3 commit 메시지 `676b140` 의 "Deferred" 섹션에서 명시적으로 이 작업을 분리해두었다.

## 현재 상태

- 협업 데이터: `artifacts/af/<reqId>/collaboration/comments.json`, `highlights.json` 에 저장. anchor 종류: `node` / `edge` / `container` / `path` / `section`. `node` 인 경우 `node_id` 가 ReactFlow node id 와 일치한다.
- 서버: `packages/web/server/afCollaborationApi.ts` 에 CRUD 끝. 추가 작업 없음.
- 클라이언트 hooks: `packages/web/src/state/useCollaboration.ts` 에 `useComments`, `useHighlights`, `useCreate/Update/Delete...` 끝. 추가 작업 없음.
- UI: `packages/web/src/design/CommentThread.tsx` 는 sidebar + inspector 양쪽에서 사용한다. Canvas 표지는 `GraphCanvas` 가 `comments` / `highlights` prop 을 받아 ReactFlow node/edge data 로 주입한다.
- Graph IR 렌더링: `packages/web/src/components/GraphCanvas.tsx` 가 collaboration mark 를 계산해 `nodeTypes`, `edgeTypes`, `ContainerOverlay` 에 전달한다. 별도 absolute overlay 대신 기존 ReactFlow node/edge/container 렌더러를 확장해 zoom/pan 정렬 문제를 피했다.
- Tooltip: comment pin title 은 작성자, 생성 시간, 본문 앞부분을 표시한다. 핀/라벨 클릭은 기존 selection state 를 유지해 inspector comment thread 와 연결된다.

## 구현 결과

- `comments.json` 의 `node`, `edge`, `path` anchor 가 노드/엣지 comment pin 으로 표시된다.
- `highlights.json` 의 `path`, `node_group`, `edge_group`, `container_focus` 가 각각 edge 강조, node ring, edge 강조, container overlay 강조로 표시된다.
- 핀/강조는 ReactFlow node/edge/container renderer 안에 있으므로 viewport zoom/pan 에 따라 같이 이동한다.
- `GraphCanvas` 의 controlled `selection`, `hideInspector`, `onContinue` 동작은 유지된다.

## 파일 / 디렉터리

- 수정
  - `packages/web/src/components/GraphCanvas.tsx` — collaboration mark 계산, node/edge/container data 전달.
  - `packages/web/src/components/graph/nodeTypes.tsx` — node comment/highlight badges.
  - `packages/web/src/components/graph/edgeTypes.tsx` — edge highlight stroke + comment pin.
  - `packages/web/src/components/graph/containerOverlay.tsx` — highlighted container state.
  - `packages/web/src/routes/DesignWorkbench.tsx` — `comments` / `highlights` 를 GraphCanvas 로 전달.
  - `packages/web/src/styles.css` — graph node/edge/container collaboration styles.

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

- 고급 pin clustering, author별 필터, threaded popover 편집.
- 별도 absolute overlay 컴포넌트. 현재 구현은 ReactFlow node/edge/container renderer 확장 방식이다.

## 위험 / 메모

- ReactFlow viewport 좌표 계산은 `<ReactFlowProvider>` 자식에서만 가능. GraphCanvas 내부 children 슬롯이 필수.
- 핀 개수가 많아지면 (한 노드에 코멘트 5+) 클러스터링 정책 필요. 1차에서는 카운트 뱃지로 충분.
- DesignWorkbench 의 inspector 와 canvas overlay 양쪽이 같은 selection state 를 공유해야 한다 — 현재 `selection` 은 DesignWorkbench 가 owner, GraphCanvas/Overlay 가 controlled props 로 받는 패턴 유지.
