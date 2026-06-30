# brief 17 — A2A UI error surfacing cleanup

상태: **대기**.

`req-page-recommendation-a2a-consumer`를 화면에서 생성하고 local A2A provider를 import하는 동안 기능 흐름과 별개로 발견한 UI/console 잔무다.
이 브리프는 UI noise/detail cleanup만 다룬다. A2A `input-required`는 interactive task state이고, plain ADK Web text chat을 통한 full remote HITL resume bridge는 아직 검증되지 않았으므로 별도 후속으로 둔다.

## 관찰된 문제

1. 신규 artifact root는 아직 `analysis-result.json`이 없을 때 정상 상태인데, 브라우저 console에는 404 fetch error가 그대로 보인다.
2. import한 `analysis-result.json`의 Graph IR id가 `graph-NNN` 패턴을 벗어나면 API는 구체적인 422 validation detail을 반환하지만, UI는 `analysis-result 검증 실패`만 보여 원인을 알기 어렵다.
3. React Flow가 `nodeTypes`/`edgeTypes` object 재생성 경고를 반복한다.

## 기대 동작

- "아직 없음" 상태와 실제 실패를 구분해 console noise를 줄인다.
- artifact import/save 실패는 validator detail을 화면 message에 노출한다.
- React Flow type object는 안정 참조로 유지한다.

## 검증

- fixed-port Workbench(`http://127.0.0.1:5173/`)에서 새 root 생성 → import 실패 fixture → 오류 detail 확인.
- local A2A provider import flow 재실행 시 console에 예상 가능한 404/React Flow 경고가 남지 않는지 확인.
- `cd packages/web && npm run build && npm run test:analyzer`.
