# Local MCP Mock Lab

Mock Lab v0.1은 ADK Agent가 나중에 `McpToolset`으로 소비할 수 있는 MCP stdio mock server를 로컬에서 만들고 검증하기 위한 별도 앱이다. 기존 Agent Factory workbench의 `/af/:reqId/analyze`, `/design`, `/build`, `/verify` 흐름에는 붙이지 않는다.

## 실행

```bash
cd packages/mock-lab
npm install
npm run dev
```

기본 URL은 `http://127.0.0.1:5176/` 이다. 기존 `packages/web` 수동 테스트 포트인 `5173`을 사용하지 않는다.

## Catalog Prefill

`GET /api/mock-lab/catalog-prefill`은 `catalog/adapters.yaml`을 읽기 전용으로 파싱한다. 표시 대상은 `contract_status == "mock_ready"`, `runtime_mock` 존재, 또는 `component_source == "stub"` 중 하나를 만족하는 adapter다.

좌측 패널은 저장된 Mock server 목록만 표시한다. 저장된 Mock은 선택해서 편집하거나 삭제할 수 있고, 삭제는 `artifacts/mock-lab/<mock-id>/` 아래의 해당 Mock artifact를 제거한다.

Catalog prefill은 Mock Spec Editor의 `+ tool`을 누를 때 뜨는 3x3 선택 창에서 사용한다. 첫 칸의 `new`를 선택하면 catalog prefill 없이 빈 tool을 직접 작성하고, adapter를 선택하면 새로 추가된 tool의 `inputSchema`, `outputSchema`, `successResponse`, `riskSignals`, `auditRequired`를 채운다. 선택지가 9개를 넘으면 페이지네이션으로 이동한다. 이 prefill은 tool draft를 빠르게 채우는 시작점일 뿐 자동 승인된 runtime contract가 아니다. Mock Lab은 `catalog/*.yaml`을 저장하거나 수정하지 않는다.

저장된 Mock 삭제는 `DELETE /api/mock-lab/:mockId`를 사용한다. 삭제 전에 실행 중인 generated server process가 있으면 stop을 시도한다.

## Generate And Apply

`POST /api/mock-lab/:mockId/generate`는 현재 `mock-spec.json`을 검증한 뒤 백그라운드 `codex exec` run을 시작하고 즉시 `run_id`와 `running` 상태를 반환한다. Codex는 `artifacts/mock-lab/<mock-id>/runs/<run-id>/proposed-files/` 아래에만 파일을 쓴다.

`GET /api/mock-lab/:mockId/runs`와 `GET /api/mock-lab/:mockId/runs/:runId`는 실행 중 run도 표시한다. 실행 중에는 partial proposed files, event log, stdout/stderr tail을 볼 수 있고, `POST /api/mock-lab/:mockId/runs/:runId/cancel`로 중단할 수 있다.

`POST /api/mock-lab/:mockId/runs/:runId/apply`만 canonical `generated/` 디렉터리를 갱신한다. path traversal, symlink, 누락된 `package.json`, 누락된 server entry는 apply 전에 거부한다.

## Server And Smoke

Server control API는 generated package의 `scripts.start`를 실행하고 mock별 process registry를 유지한다.

Smoke test는 다음을 확인한다.

- `tools/list`: tool name, description, inputSchema, outputSchema 존재
- `tools/call`: sample input 검증, `structuredContent` 존재, outputSchema 검증, text content 존재, synthetic marker 존재, audit log 기록

생성된 MCP stdio server는 ADK `McpToolset` 소비를 염두에 둔 local test double이다. ADK smoke agent 생성과 A2A mock server는 v0.1 범위가 아니다.

## Non-goals

- 기존 workbench route 통합
- `catalog/*.yaml` 직접 수정
- `catalog-delta.yaml` 생성
- 실제 은행 endpoint 연결
- credential/auth 실구현
- 운영 배포 스크립트
- production business logic
