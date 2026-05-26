# 02 — PathTracePanel (두 노드 선택 → highlight 경로 저장)

## 왜 필요한가

협업 시나리오에서 "이 노드부터 저 노드까지의 흐름이 문제다" 를 얘기하려면 두 노드를 골라 경로를 통째로 강조하는 게 가장 직관적이다. `highlights.json` 의 `kind: "path"` 스키마는 PR3 에서 준비됐지만 사용자가 GUI 로 경로를 만들 방법이 없다.

`01-canvas-collaboration-overlay.md` 의 highlight 시각화가 선행되어야 결과를 즉시 볼 수 있다.

## 현재 상태

- highlight POST 엔드포인트: `POST /api/af-collab/:reqId/highlights` (`packages/web/server/afCollaborationApi.ts`). 검증은 `kind:"path"` 일 때 `target.node_path` 필수.
- Graph IR: `analysis-result.json.processFlow.{nodes,edges}` 가 source of truth.
- BFS 가능 자료구조: 이미 `useGraphIR()` 이 검증된 graph 를 반환 (`state/useGraphIR.ts`).

## 작업 정의 (Done means)

1. DesignWorkbench 의 사이드바 또는 인스펙터에 "경로 추적" 진입점 추가.
2. 두 노드를 (start, end) 로 지정하면 가능한 path 후보가 1개 이상 나열된다 (DAG 기준 BFS).
   - 사이클이 있을 경우 (loop_region) 첫 번째 단순 경로 우선.
   - 경로 후보가 0개면 "두 노드는 연결되어 있지 않습니다" 명시.
3. 사용자가 한 경로를 선택 → "highlight 로 저장" 버튼 → `POST /api/af-collab/:id/highlights` 호출.
4. 저장된 highlight 가 canvas 에 즉시 색으로 표시 (01 의 HighlightOverlay 가 이미 동작 중이어야 함).
5. 저장 시 label 입력 필드 + 작성자 (useAuthor) 가 따라간다.

## 파일 / 디렉터리

- 신규
  - `packages/web/src/design/PathTracePanel.tsx`
  - `packages/web/src/design/pathSearch.ts` (BFS 헬퍼; export `findSimplePaths(graphIR, fromId, toId, limit=5)` 형태 권장)
- 수정
  - `packages/web/src/routes/DesignWorkbench.tsx` — 사이드바 탭에 "경로" 추가 또는 인스펙터 하단에 collapsible 섹션 추가.
  - `packages/web/src/state/useCollaboration.ts` — 이미 `useCreateHighlight` 존재. 재사용.

## 구현 메모

- BFS 는 `graphIR.edges` 만으로 단순 인접 리스트 만들면 충분. node_kind 필터 (input/output 제외 등) 는 옵션.
- 단순 경로 (simple path) 정의: 같은 노드를 두 번 거치지 않는 경로. 최대 결과 5개 정도로 제한.
- label 자동 제안: `start.label + " → " + end.label` 정도. 사용자가 자유 편집.

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
```

선택적으로 `pathSearch.ts` 에 unit test 추가 (templates/regression-scenarios/scenario-d-graph-workflow 로 알려진 path 가 나오는지).

MCP 스모크:
1. scenario-d 를 req-pr-path 로 import.
2. `/af/req-pr-path/design` → "경로 추적" 진입 → start, end 노드 선택 → 후보 path 표시 → 저장.
3. `artifacts/af/req-pr-path/collaboration/highlights.json` 에 `kind: "path"`, `target.node_path: [...]` 확인.
4. canvas 에 path edge 가 강조되는지 스크린샷.

## Out of scope

- 가중치 / 우선순위가 있는 path ranking → 단순 BFS 만.
- 여러 path 를 한 highlight 로 묶기 → 1개씩만.

## 위험 / 메모

- Graph IR 에 사이클 (loop_region) 이 있으면 simple path 알고리즘이 무한 루프에 빠지지 않도록 visited set 사용.
- 경로 후보가 너무 많을 때 (broad fan-out) UI 가 폭발하지 않게 limit 강제.
