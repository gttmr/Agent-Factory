# mock-tool-integration Synthetic Mock Tool 연결

## 목적

synthetic·local-only MockSpec을 작성·검증·저장하고 saved spec 기반 MCP child server와 Streamable HTTP bridge를 실행해 Runtime Handoff의 Tool prerequisite를 제공한다.

## Trigger와 진입 조건

- Trigger: `/mock-lab` 진입, Catalog prefill 선택, Codex SDK draft 요청, saved mock server start 또는 smoke/MCP request
- 진입 조건: 저장과 실행에는 schema-valid MockSpec이 필요하다. server start·smoke·network bridge는 canonical saved `mock-spec.json`을 사용한다.

## 종료 조건

- valid MockSpec이 `artifacts/mock-lab/:mockId/mock-spec.json`에 저장된다.
- saved spec runtime이 tool list/call을 제공하고 smoke 검사가 synthetic output·audit 기록까지 확인한다.
- Runtime stage에서 discovery 가능한 MCP URL과 running prerequisite가 제공된다.

## 주요 입력

- 사용자가 편집한 MockSpec 또는 Codex SDK draft prompt
- read-only Catalog legacy `adapter` prefill 후보
- tool input/output JSON Schema와 synthetic response/error scenario
- saved mock identity와 MCP request

## 주요 출력

- canonical `mock-spec.json`, draft evidence, `audit-log.jsonl`, `server-state.json`
- in-memory child process와 JSON-RPC result
- MCP discovery·Streamable HTTP endpoint
- smoke tools/list·tools/call validation result

## Main Flow

1. Mock Lab UI는 saved mocks와 legacy `catalog/adapters.yaml` prefill을 불러오고 draft 편집 상태를 유지한다.
2. 사용자는 직접 편집하거나 Codex SDK가 만든 isolated draft를 선택한다. draft 선택은 canonical spec을 자동 교체하지 않는다.
3. save는 MockSpec과 guardrail/schema를 검증한 뒤 canonical file과 audit event를 쓴다.
4. server start는 반드시 saved spec을 다시 읽고 local Node child process를 기동한다.
5. child의 stdio JSON-RPC tools/list·tools/call은 process registry를 통해 smoke 검사와 network bridge 양쪽에 제공된다.
6. smoke는 advertised schema, output structured content, synthetic marker와 audit log를 확인한다.
7. MCP bridge는 running child를 Streamable HTTP로 노출하고 discovery가 server/tool availability를 반환한다.

## 분기와 실패/needs-info

- invalid 또는 unsaved spec은 run을 막고, running server 중 editor 변경은 현재 process에 반영되지 않는다.
- 같은 mock의 draft가 이미 running이면 기존 summary를 반환한다. cancel·timeout·invalid output은 draft evidence에 terminal status로 남는다.
- stored `server-state.json`의 running 상태는 재시작 뒤 stopped로 정규화된다. live process map과 tools/list 성공이 현재 실행의 근거다.
- MCP initialize는 POST가 필요하고 이후 request는 유효한 `mcp-session-id`가 필요하다. 유휴 session은 10분 뒤 다음 session 생성 시 sweep된다.
- mock ID·server name·Catalog entry alias가 중복되면 bridge는 임의 binding하지 않는다.
- delete는 active server stop을 먼저 시도한 뒤 mock directory를 제거한다.

## 읽는 Register

- [`reg.catalog-entries`](../registers.md#cross-stage-registers)
- [`reg.mock-lab-lifecycle`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.mock-lab-lifecycle`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전 또는 seed: [catalog-publication](catalog-publication.md)의 legacy `adapter` entry
- 다음: [runtime-handoff-build](runtime-handoff-build.md)의 Mock Lab binding, [runtime-execution](runtime-execution.md)의 prerequisite 확인
- 독립 사용: Mock Lab 자체 authoring·smoke workflow

## 외부 경계

- browser와 Mock Lab HTTP API
- local filesystem `artifacts/mock-lab/**`
- Codex SDK
- local Node child process와 stdio JSON-RPC
- MCP Streamable HTTP
- read-only `catalog/adapters.yaml`

## L3 Source Map

### Mock Lab application workflow

- Path: `packages/mock-lab/src/App.tsx`
- Stable anchor: default `App`
- Role in behavior: Catalog prefill, editor, isolated draft, saved spec, server와 smoke surface의 순서를 조정한다.
- Inputs: Catalog prefill, saved mocks, edited/draft spec, server status
- Outputs: create·save·delete·run·smoke UI actions
- State/artifact reads: `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- State/artifact writes: `reg.mock-lab-lifecycle`를 API action으로 간접 갱신
- Important callers: `packages/mock-lab/src/main.tsx`
- Important callees: Mock Lab client, editor/draft/server/smoke components, `validateMockSpec`
- External boundaries: browser, HTTP
- Failure/edge behavior: invalid·dirty·running state를 구분해 save/run/test를 차단하고 unsaved 전환 전에 확인한다.
- Related registers: `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Mock Lab HTTP composition

- Path: `packages/mock-lab/server/mockLabApi.ts`
- Stable anchor: `createMockLabMiddleware`
- Role in behavior: spec CRUD, draft, process, smoke, audit, discovery와 MCP bridge route를 하나의 middleware로 조립한다.
- Inputs: repo root, path·method·JSON body
- Outputs: JSON response 또는 raw MCP transport response
- State/artifact reads: `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- State/artifact writes: `reg.mock-lab-lifecycle`
- Important callers: Mock Lab server plugin/bootstrap
- Important callees: `MockSpecStore`, `MockDraftRegistry`, `MockProcessRegistry`, `createMcpNetworkBridge`, validation·prefill helpers
- External boundaries: HTTP, local filesystem, child process, MCP
- Failure/edge behavior: malformed path/body와 method mismatch를 구분하고 typed `MockLabError`를 HTTP status로 변환한다.
- Related registers: `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Mock artifact store

- Path: `packages/mock-lab/server/mockSpecStore.ts`
- Stable anchor: `MockSpecStore`, `MockSpecStore.writeSpec`, `MockSpecStore.writeDraftSpec`
- Role in behavior: canonical spec, isolated draft, audit·server-state path와 containment를 소유한다.
- Inputs: repo root, mock/draft ID, spec
- Outputs: parsed spec/list/status paths와 write result
- State/artifact reads: `reg.mock-lab-lifecycle`
- State/artifact writes: `reg.mock-lab-lifecycle`
- Important callers: Mock Lab middleware, draft/process registries, MCP bridge
- Important callees: `assertValidMockSpec`, Node filesystem
- External boundaries: local filesystem
- Failure/edge behavior: invalid ID·path escape·ID mismatch를 거부하고 missing canonical spec은 404다.
- Related registers: `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Codex SDK draft registry

- Path: `packages/mock-lab/server/mockDraftRunner.ts`
- Stable anchor: `MockDraftRegistry`, `SdkMockDraftRunner`, `readDraftDetail`
- Role in behavior: 한 mock당 하나의 active draft를 실행하고 request·events·output·validation summary를 isolated draft directory에 남긴다.
- Inputs: mock ID, prompt, allowlisted model, optional cancellation signal
- Outputs: draft spec과 terminal summary/evidence
- State/artifact reads: 기존 active draft, `reg.mock-lab-lifecycle`
- State/artifact writes: draft subtree의 `reg.mock-lab-lifecycle`
- Important callers: `createMockLabMiddleware`
- Important callees: Codex SDK, `validateMockSpec`, `MockSpecStore.writeDraftSpec`
- External boundaries: Codex SDK, local filesystem
- Failure/edge behavior: timeout 기본값은 10분이고 JSON 추출·schema validation 실패를 failed draft로 기록한다. canonical spec은 직접 쓰지 않는다.
- Related registers: `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Saved-spec process registry

- Path: `packages/mock-lab/server/mockProcessRegistry.ts`
- Stable anchor: `MockProcessRegistry`
- Role in behavior: saved MockSpec runtime child와 pending stdio JSON-RPC request를 in-memory로 관리한다.
- Inputs: mock ID, saved spec, tools/list·tools/call request
- Outputs: server status와 JSON-RPC envelope
- State/artifact reads: canonical spec, advisory `server-state.json`
- State/artifact writes: in-memory process map, `server-state.json`
- Important callers: Mock Lab middleware, MCP bridge
- Important callees: `mockSpecRuntime.ts` child, `MockSpecStore`
- External boundaries: Node child process, stdio, filesystem
- Failure/edge behavior: 같은 mock 중복 start는 409, request timeout은 기본 5초이며 persisted running은 live process가 없으면 stopped로 읽는다.
- Related registers: `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### MCP network bridge

- Path: `packages/mock-lab/server/mcpNetworkBridge.ts`
- Stable anchor: `createMcpNetworkBridge`
- Role in behavior: running stdio child의 tools/list·tools/call을 stateful Streamable HTTP MCP와 discovery로 재노출한다.
- Inputs: process registry, spec store, MCP HTTP request 또는 discovery query
- Outputs: MCP transport response, server/tool discovery payload
- State/artifact reads: live process map, saved specs, MCP session map
- State/artifact writes: in-memory MCP session map
- Important callers: `createMockLabMiddleware`
- Important callees: MCP SDK `Server`, `StreamableHTTPServerTransport`, `MockProcessRegistry.sendJsonRpc`
- External boundaries: MCP Streamable HTTP, stdio-backed child
- Failure/edge behavior: missing/expired session은 404, stopped mock initialize는 409, ambiguous alias는 binding 실패다.
- Related registers: `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### MockSpec and value validation

- Path: `packages/mock-lab/server/schemaValidation.ts`
- Stable anchor: `validateMockSpec`, `validateValueAgainstSchema`, `sampleValueFromSchema`
- Role in behavior: MockSpec shape·guardrail과 smoke input/output를 검증하고 synthetic sample input을 만든다.
- Inputs: unknown spec/value와 JSON Schema
- Outputs: validation issues, assertion 또는 sample value
- State/artifact reads: 없음
- State/artifact writes: 없음
- Important callers: UI, API, artifact store, draft runner, smoke handlers
- Important callees: local recursive schema/value validators
- External boundaries: 없음
- Failure/edge behavior: spec structural/guardrail 위반은 error이며 success response/schema 불일치 일부는 warning으로 보고한다.
- Related registers: `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

### Catalog legacy adapter prefill

- Path: `packages/mock-lab/server/catalogPrefillLoader.ts`
- Stable anchor: `loadCatalogPrefill`, `sanitizeToolName`
- Role in behavior: legacy `catalog/adapters.yaml`의 mock-ready/stub 후보를 synthetic MockSpec 초안으로 투영한다.
- Inputs: repo root와 legacy adapter entries
- Outputs: Catalog prefill payload
- State/artifact reads: `reg.catalog-entries`
- State/artifact writes: 없음
- Important callers: `createMockLabMiddleware`
- Important callees: YAML parser, local field/schema mappers
- External boundaries: local filesystem
- Failure/edge behavior: 후보 조건은 legacy `contract_status`, `runtime_mock`, `component_source`이며 source Catalog를 수정하지 않는다.
- Related registers: `reg.catalog-entries`, `reg.mock-lab-lifecycle`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- Codex SDK 내부 scheduling·model response behavior는 외부 SDK 경계이므로 source map에서 구현 관계를 확정하지 않았다.
- MCP client가 session을 명시적으로 close하지 않을 때의 실제 회수 시점은 다음 신규 session 요청 시 sweep되는 현재 process 동작에 달려 있다.
