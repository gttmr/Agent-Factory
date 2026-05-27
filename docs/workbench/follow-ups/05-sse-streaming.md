# 05 — SSE streaming for verify/run and runtime-stub/build

상태: 구현됨. Analyze/Design Stage Runner와 함께 `verify/run`, `runtime-stub/build`도 SSE 진행 로그를 제공하며 기존 JSON 응답 경로를 유지한다.

## 왜 필요한가

PR4 의 `POST /api/af/:id/verify/run` 과 `POST /api/af/:id/runtime-stub/build` 는 child_process 가 완료될 때까지 응답을 보류한 뒤 한 번에 JSON 으로 stdout/stderr 를 반환한다. validate-artifacts 가 빠르게 끝나는 시나리오는 문제없지만, `npm run build` (수십초) 나 `generate-adk-source.mjs` (수초~수십초) 는 진행 상황이 안 보여서 사용자가 답답해한다.

## 구현 결과

- 서버 핸들러: `packages/web/server/afArtifactsApi.ts` 가 `Accept: text/event-stream` 또는 `streamProgress: true` 요청에서 `start`, `stdout`, `stderr`, `done`, `error` SSE 이벤트를 전송한다.
- 기존 JSON 호출은 그대로 유지한다. `runtime-stub/build` 는 기존 파일 목록 응답을, `verify/run` 은 기존 검증 결과와 manifest validation 갱신을 유지한다.
- 클라이언트 mutation: `state/useScaffoldPlan.ts`, `state/useVerify.ts` 가 fetch `ReadableStream` 기반 SSE helper 를 사용한다.
- 진행 중 표시: BuildWorkbench/VerifyWorkbench 는 작은 monospace live log 를 표시하고 기존 query invalidation 을 유지한다.
- 테스트: `server/afArtifactsApi.streaming.test.ts`, `src/state/useStreamingProcess.test.ts` 가 SSE 이벤트와 JSON 보존 경로를 검증한다.

## 작업 정의 (Done means)

1. `POST /api/af/:id/runtime-stub/build` 가 `Accept: text/event-stream` 요청에 대해 SSE 로 응답.
   - event: `start`, `stdout`, `stderr`, `progress`(optional), `done`.
   - JSON 응답도 그대로 유지 (Accept 헤더에 따라 분기).
2. `POST /api/af/:id/verify/run` 동일 패턴.
3. BuildWorkbench / VerifyWorkbench 가 EventSource 를 열어 실시간 로그를 표시.
4. mutation 종료 시 manifest invalidate, runtime-stub list invalidate (기존 동작 유지).

## 파일 / 디렉터리

- 수정
  - `packages/web/server/afArtifactsApi.ts` — `runProcess` 를 EventEmitter 기반으로 분리. 또는 새 helper `streamProcess(...)` 추가.
  - `packages/web/src/state/useScaffoldPlan.ts` — `useBuildRuntimeStub` 가 EventSource 옵션 지원.
  - `packages/web/src/state/useVerify.ts` — 동일.
  - `packages/web/src/routes/BuildWorkbench.tsx` / `VerifyWorkbench.tsx` — 실시간 log viewer (작은 monospace `<pre>` + auto-scroll).
  - `packages/web/src/styles-router.css` — `.af-stream-log` 클래스 (auto-scroll, 최대 높이).
- 신규
  - `packages/web/src/state/useStreamingProcess.ts` (선택) — EventSource 추상화.

## 구현 메모

- Node `child_process` `stdout.on("data")` 콜백마다 `res.write(\`event: stdout\\ndata: ${JSON.stringify(chunk)}\\n\\n\`)` 형식으로 푸시.
- 클라이언트에서는 `new EventSource(url)` 가 POST 를 지원하지 않으므로 두 가지 옵션:
  a. POST body 가 없는 동작이면 GET 로 변경 (verify/run 은 명령 키만 받으니 GET + query 가 가능).
  b. `fetch` + `ReadableStream` reader 직접 구현.
- (b) 가 가장 보편적. helper `streamServerEvents(url, init, onEvent)` 추가.

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
```

MCP 스모크:
1. req-pr-sse 에 scenario-a import + design gate 통과.
2. BuildWorkbench → runtime-stub 생성 → 로그 영역에 줄별로 stdout 이 나타나는지 확인.
3. VerifyWorkbench → build_web 실행 (느린 명령) → 진행 중에도 stdout 라인이 흐르는지 확인.
4. 종료 시 manifest.validation.last_result 갱신, runtime-stub list 갱신.

## Out of scope

- Scaffold-plan 생성 (현재 클라이언트 사이드 in-memory) 은 SSE 가 의미 없음.
- Codex CLI (분석) SSE 는 별도 (`06-analyze-pipeline.md`).

## 위험 / 메모

- SSE 응답 도중 클라이언트가 nav 으로 벗어나면 server 측 `close` handler 가 AbortController 로 child_process 에 SIGTERM 을 보낸다.
- 동시에 동일 명령을 두 번 트리거하는 경우 server 측에서 isRunning lock 검토 (codexAnalyzer 의 `isAnalyzing` 패턴 참고).
