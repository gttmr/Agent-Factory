# runtime-execution 로컬 Runtime 실행 증명

## 목적

생성된 Runtime Handoff bundle을 로컬 ADK server로 기동해 chat 동작을 확인하고, legacy `remote_a2a` provider가 있는 경우 A2A 상태·Agent Card·input-required resume 흐름을 점검한다. 이 Stage는 승인 gate가 없는 실행 도구다.

## Trigger와 진입 조건

- Trigger: requirement의 Run route 진입 또는 runtime chat/A2A start·status·resume 요청
- 진입 조건: non-empty `runtime-stub/`이 있어야 한다. process start에는 공유 ADK venv와 실행 파일이 필요하며, A2A provider는 launcher와 실행 중인 Mock Lab prerequisite도 요구한다.

## 종료 조건

- chat runtime은 status와 ADK dev UI URL을 제공하고 필요 시 stop된다.
- A2A provider가 있는 경우 Agent Card와 semantic probe 결과를 확인하고, input-required이면 같은 task/context에 function response를 전송할 수 있다.
- 실행 결과는 approval이나 Verify stage completion을 자동 변경하지 않는다.

## 주요 입력

- `runtime-stub/**`와 현재 bundle fingerprint
- analysis module candidate의 legacy `remote_a2a` provider target
- 공유 ADK venv와 runtime 환경 변수
- optional Mock Lab MCP prerequisite
- A2A resume의 provider requirement ID, task/context/interrupt/function ID와 response

## 주요 출력

- chat server status, ADK dev UI URL, stdout/stderr tail
- A2A server status, Agent Card, message/send·task probe와 resume metadata
- `.adk/runtime-chat-process.json`, `.adk/runtime-a2a-process.json`
- A2A resume response와 마지막 message/send probe

## Main Flow

1. Run UI는 runtime-stub 존재를 확인하고 analysis에서 A2A provider target을 파생한다.
2. chat manager는 shared venv, bundle package, port owner와 Mock Lab prerequisite를 점검한다.
3. start는 `adk api_server`를 local child process로 실행하고 readiness와 bundle fingerprint를 기록한다.
4. status는 in-memory process, advisory process record, port owner와 현재 fingerprint를 합쳐 running·failed·stale 상태를 만든다.
5. A2A provider가 있으면 별도 manager가 port 8001에서 launcher를 실행하고 Agent Card 및 message/send semantic probe를 확인한다.
6. ADK session event에 input-required가 있으면 Workbench가 A2A provider의 같은 task/context에 function response를 POST하고 probe를 갱신한다.
7. stop은 관리 중인 child나 검증된 record의 PID를 종료하고 process record를 정리한다.

## 분기와 실패/needs-info

- runtime-stub이 없으면 Run UI는 Build로 되돌린다.
- 웹에서 dependency install은 지원하지 않으며 install endpoint는 405다.
- chat port owner가 현재 runtime인지 안전하게 판별하지 못하면 자동 종료하지 않는다. 안전한 다른 ADK runtime은 start 시 교체될 수 있다.
- A2A start는 Mock Lab prerequisite가 하나라도 running이 아니면 process를 시작하지 않고 blocked status를 반환한다.
- 시작 뒤 bundle fingerprint가 바뀌면 `stale=true`이며 재시작 전까지 기존 bundle로 동작한다.
- process record는 advisory다. chat manager와 A2A manager의 in-memory child state가 현재 process의 직접 근거이며, 기록된 PID 생존 여부를 다시 확인한다.
- resume 필수 필드가 없으면 400이며 provider HTTP·JSON-RPC 실패는 API 실패로 전파된다.

## 읽는 Register

- [`reg.analysis-result`](../registers.md#cross-stage-registers)
- [`reg.module-candidates`](../registers.md#cross-stage-registers)
- [`reg.runtime-stub`](../registers.md#cross-stage-registers)
- [`reg.runtime-process`](../registers.md#cross-stage-registers)
- [`reg.mock-lab-lifecycle`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.runtime-process`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: [runtime-handoff-build](runtime-handoff-build.md)
- 병행 prerequisite: [mock-tool-integration](mock-tool-integration.md)
- 결과 검토: [verify-feedback](verify-feedback.md); 이 Stage 자체가 Verify gate를 통과시키지는 않는다.

## 외부 경계

- browser와 Workbench HTTP
- local filesystem의 runtime-stub과 `.adk/` process record
- shared ADK venv, child process, TCP ports 8765·8001
- ADK dev UI/session HTTP와 A2A JSON-RPC
- Mock Lab MCP discovery·process

## L3 Source Map

### Run sandbox orchestration

- Path: `packages/web/src/routes/RunSandbox.tsx`
- Stable anchor: default `RunSandbox`
- Role in behavior: runtime-stub readiness, chat controls, ADK dev UI와 optional A2A provider/resume panel을 조정한다.
- Inputs: reqId, runtime-stub listing, analysis, chat/A2A status
- Outputs: start·stop requests, UI link와 action message
- State/artifact reads: `reg.runtime-stub`, `reg.analysis-result`, `reg.module-candidates`, `reg.runtime-process`, `reg.mock-lab-lifecycle`
- State/artifact writes: `reg.runtime-process`를 HTTP action으로 간접 갱신하고 `reg.recent-roots`를 touch한다.
- Important callers: `AppRouter`
- Important callees: runtime query hooks, `runtimeA2aProviderTarget`, `RuntimeA2aProviderPanel`, `MockLabPrerequisiteRows`
- External boundaries: browser, HTTP, ADK dev UI link
- Failure/edge behavior: stub이 없으면 controls를 숨기고 Build link를 제공하며, stale runtime은 restart action을 연다.
- Related registers: `reg.runtime-stub`, `reg.analysis-result`, `reg.module-candidates`, `reg.runtime-process`, `reg.recent-roots`
- Verified at commit: `7deea45`
- Locator status: `active`

### Runtime chat HTTP actions

- Path: `packages/web/server/afRuntimeChatApi.ts`
- Stable anchor: `handleRuntimeChat`
- Role in behavior: chat status·input-required·start·stop route를 manager에 전달한다.
- Inputs: reqId, route action, HTTP method
- Outputs: runtime status/result 또는 HTTP error
- State/artifact reads: `reg.runtime-stub`, `reg.runtime-process`
- State/artifact writes: `reg.runtime-process`
- Important callers: `createAfArtifactsMiddleware`
- Important callees: `RuntimeChatManager.status`, `RuntimeChatManager.start`, `RuntimeChatManager.stop`, `runtimeChatInputRequiredFromStatus`
- External boundaries: HTTP
- Failure/edge behavior: method mismatch와 install은 405, unknown action은 404다.
- Related registers: `reg.runtime-stub`, `reg.runtime-process`
- Verified at commit: `7deea45`
- Locator status: `active`

### ADK chat process manager

- Path: `packages/web/server/runtimeChat.ts`
- Stable anchor: `RuntimeChatManager`, `resolveAdkRuntimeVenv`, `buildAdkServerCommand`
- Role in behavior: shared venv와 runtime-stub을 해석하고 ADK dev server child lifecycle·port ownership·staleness를 관리한다.
- Inputs: repo root, artifact store, reqId, optional host/port 환경 변수
- Outputs: chat status, start/stop result, ADK server command
- State/artifact reads: `reg.runtime-stub`, chat process record, Mock Lab prerequisites
- State/artifact writes: chat process record와 in-memory child map
- Important callers: server middleware bootstrap, `handleRuntimeChat`
- Important callees: `buildRuntimeProcessEnv`, `mockLabPrerequisites`, child-process·filesystem·port helpers
- External boundaries: filesystem, OS process, TCP, shared venv
- Failure/edge behavior: package를 발견하지 못하거나 ADK 실행 파일이 없으면 start가 실패하고, 확인 불가능한 port owner는 종료하지 않는다.
- Related registers: `reg.runtime-stub`, `reg.runtime-process`, `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### ADK session input-required reader

- Path: `packages/web/server/runtimeChatInputRequired.ts`
- Stable anchor: `runtimeChatInputRequiredFromStatus`
- Role in behavior: smoke session identity를 정하고 ADK session events에서 remote input-required 표시 상태를 추출한다.
- Inputs: `RuntimeChatStatus`, optional `runtime-chat-smoke.json`
- Outputs: input-required display state, session reference, fetch error
- State/artifact reads: `reg.runtime-stub`, running ADK session
- State/artifact writes: 없음
- Important callers: `handleRuntimeChat`
- Important callees: `extractRemoteInputRequiredFromAdkEvents`, global `fetch`
- External boundaries: filesystem, ADK session HTTP
- Failure/edge behavior: smoke config가 없으면 `af-reviewer`/`af-smoke` fallback을 쓰며, session route 실패를 data-level error로 반환한다.
- Related registers: `reg.runtime-stub`, `reg.runtime-process`
- Verified at commit: `7deea45`
- Locator status: `active`

### Runtime A2A HTTP actions

- Path: `packages/web/server/afRuntimeA2aApi.ts`
- Stable anchor: `handleRuntimeA2a`
- Role in behavior: provider status·Agent Card·start·stop과 function-response resume route를 제공한다.
- Inputs: consumer reqId, action, optional resume JSON
- Outputs: provider result, resume probe summary 또는 HTTP error
- State/artifact reads: `reg.runtime-process`
- State/artifact writes: provider의 last message/send probe
- Important callers: `createAfArtifactsMiddleware`
- Important callees: `RuntimeA2aManager`, `postFunctionResponseResume`
- External boundaries: HTTP, provider A2A JSON-RPC
- Failure/edge behavior: resume identity 다섯 필드와 response가 필요하며 install은 405다.
- Related registers: `reg.runtime-process`
- Verified at commit: `7deea45`
- Locator status: `active`

### ADK A2A provider manager

- Path: `packages/web/server/runtimeA2a.ts`
- Stable anchor: `RuntimeA2aManager`, `DEFAULT_ADK_A2A_PORT`
- Role in behavior: generated launcher를 기동하고 Agent Card, process, prerequisite와 semantic message/send probe를 관리한다.
- Inputs: provider reqId, runtime-stub, shared venv, Mock Lab prerequisite
- Outputs: status, Agent Card, start/stop result, cached 또는 active probe
- State/artifact reads: `reg.runtime-stub`, `reg.runtime-process`, `reg.mock-lab-lifecycle`
- State/artifact writes: A2A process record와 last message/send probe
- Important callers: server middleware bootstrap, `handleRuntimeA2a`
- Important callees: command/card/probe helpers, `runtimeProcessControl`, `mockLabPrerequisites`
- External boundaries: filesystem, OS process, TCP, A2A HTTP, Mock Lab
- Failure/edge behavior: prerequisite·launcher·port·venv 실패를 차단하고, cached working task는 task/get으로 다시 확인한다.
- Related registers: `reg.runtime-stub`, `reg.runtime-process`, `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Shared A2A process-control helpers

- Path: `packages/web/server/runtimeProcessControl.ts`
- Stable anchor: `writeProcessRecord`, `readProcessRecord`, `clearProcessRecord`, `runtimeStubFingerprint`
- Role in behavior: A2A manager가 쓰는 PID record, process termination, port probe와 deterministic bundle fingerprint helper를 제공한다.
- Inputs: runtime context, registry path, PID record, runtime-stub directory
- Outputs: parsed record, process/port state, SHA-256 fingerprint
- State/artifact reads: `reg.runtime-stub`, A2A process record
- State/artifact writes: A2A process record
- Important callers: `RuntimeA2aManager`
- Important callees: Node filesystem, process, TCP, crypto
- External boundaries: local filesystem, OS process, TCP
- Failure/edge behavior: invalid PID/host/port record는 null이며, stop은 platform별 termination을 시도한다. chat manager는 같은 파일의 helper가 아니라 자체 private record helper를 사용한다.
- Related registers: `reg.runtime-stub`, `reg.runtime-process`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- generated ADK app 내부의 session event shape와 A2A task state 전이는 외부 runtime 응답에 의존하므로 이 Handbook에서 완전한 호출 그래프로 확정하지 않았다.
- port owner 탐지는 운영체제별 command 결과에 의존한다. 모든 platform에서 동일한 판별 성공을 보장하는지는 source inspection만으로 확인하지 않았다.
