# 02 — PathTracePanel (두 노드 선택 → highlight 경로 저장)

상태: 완료. DesignWorkbench `경로` 탭에서 두 노드를 선택해 simple path 후보를 계산하고 `kind:"path"` highlight 로 저장할 수 있다.

## 왜 필요한가

협업 시나리오에서 "이 노드부터 저 노드까지의 흐름이 문제다" 를 얘기하려면 두 노드를 골라 경로를 통째로 강조하는 게 가장 직관적이다. `highlights.json` 의 `kind: "path"` 스키마는 PR3 에서 준비됐지만 사용자가 GUI 로 경로를 만들 방법이 없다.

`01-canvas-collaboration-overlay.md` 의 highlight 시각화와 연결되어 저장 직후 canvas edge/node 강조가 반영된다.

## 현재 상태

- highlight POST 엔드포인트: `POST /api/af-collab/:reqId/highlights` (`packages/web/server/afCollaborationApi.ts`). 검증은 `kind:"path"` 일 때 `target.node_path` 필수.
- Graph IR: `analysis-result.json.processFlow.{nodes,edges}` 가 source of truth.
- `packages/web/src/design/pathSearch.ts` 가 simple path BFS 후보를 최대 5개까지 반환한다.
- `packages/web/src/design/PathTracePanel.tsx` 가 start/end selector, label 입력, 후보 목록, highlight 저장 버튼을 제공한다.

## 구현 결과

1. DesignWorkbench 사이드바에 `경로` 탭이 추가됐다.
2. 두 노드를 start/end 로 지정하면 가능한 simple path 후보가 최대 5개 나열된다.
3. 경로 후보가 0개면 "두 노드는 연결되어 있지 않습니다" 메시지를 표시한다.
4. 사용자가 한 경로를 선택해 `highlight로 저장`하면 `useCreateHighlight` 를 통해 `POST /api/af-collab/:id/highlights` 를 호출한다.
5. 저장 시 label 입력 필드와 `useAuthor` 작성자 값이 반영된다.

## 파일 / 디렉터리

- 신규
  - `packages/web/src/design/PathTracePanel.tsx`
  - `packages/web/src/design/pathSearch.ts`
  - `packages/web/src/design/pathSearch.test.ts`
- 수정
  - `packages/web/src/routes/DesignWorkbench.tsx` — `경로` 탭 추가, `useCreateHighlight` 연결.
  - `packages/web/src/styles/router/design.css` — path panel/candidate styles.

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
