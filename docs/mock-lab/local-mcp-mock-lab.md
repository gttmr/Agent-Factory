# Local MCP Mock Lab

Mock Lab은 ADK Agent가 `McpToolset`(또는 stdio)으로 소비하는 MCP mock server를 로컬에서 만들고 검증하기 위한 Adapter runtime lab이다. 기본 사용자 경로는 5173 workbench의 `/mock-lab` 단일 Shell route이며, 실행 중인 mock은 network MCP로도 노출되어 생성된 runnable ADK 번들이 직접 호출한다(아래 "Network MCP" 참고). `packages/mock-lab` standalone 앱은 개발/과도기용으로 유지한다.

## 실행

```bash
cd packages/mock-lab
npm install
npm run dev
```

기본 URL은 `http://127.0.0.1:5173/mock-lab` 이다. standalone 개발 앱을 직접 확인할 때만 `http://127.0.0.1:5176/` 을 사용한다.

## Catalog Prefill

`GET /api/mock-lab/catalog-prefill`은 `catalog/adapters.yaml`을 읽기 전용으로 파싱한다. 표시 대상은 `contract_status == "mock_ready"`, `runtime_mock` 존재, 또는 `component_source == "stub"` 중 하나를 만족하는 adapter다.

좌측 패널은 저장된 Mock server 목록만 표시한다. 저장된 Mock은 선택해서 편집하거나 삭제할 수 있고, 삭제는 `artifacts/mock-lab/<mock-id>/` 아래의 해당 Mock artifact를 제거한다.

Catalog prefill은 Mock Spec Editor의 `+ tool`을 누를 때 뜨는 3x3 선택 창에서 사용한다. Reuse Hub Adapter 카드에서 `Mock Lab`을 누르면 `/mock-lab?adapter=<catalog-name>&req=<reqId>`로 이동하고, 해당 catalog prefill을 editor에 연다. 첫 칸의 `new`를 선택하면 catalog prefill 없이 빈 tool을 직접 작성하고, adapter를 선택하면 새로 추가된 tool의 `inputSchema`, `outputSchema`, `successResponse`, `riskSignals`, `auditRequired`를 채운다. 선택지가 9개를 넘으면 페이지네이션으로 이동한다. 이 prefill은 tool draft를 빠르게 채우는 시작점일 뿐 자동 승인된 runtime contract가 아니다. Mock Lab은 `catalog/*.yaml`을 저장하거나 수정하지 않는다.

저장된 Mock 삭제는 `DELETE /api/mock-lab/:mockId`를 사용한다. 삭제 전에 실행 중인 saved-spec runtime process가 있으면 stop을 시도한다.

## Prompt-To-Spec Draft

Codex는 server project를 생성하지 않는다. `Draft Spec with Codex`는 자연어 prompt에서 `MockSpec` 초안을 만드는 보조 기능이다. 사용자는 초안을 editor로 불러온 뒤 직접 검토·수정하고 `Save spec`으로 canonical `mock-spec.json`에 저장해야 한다.

`POST /api/mock-lab/:mockId/drafts`는 `{ prompt, model }`을 받아 백그라운드 `codex exec` draft run을 시작하고 즉시 `draft_id`와 `running` 상태를 반환한다. 성공한 draft는 `artifacts/mock-lab/<mock-id>/drafts/<draft-id>/draft-spec.json`에 저장된다.

`GET /api/mock-lab/:mockId/drafts`와 `GET /api/mock-lab/:mockId/drafts/:draftId`는 draft 상태, validation 결과, event log, stdout/stderr tail, valid draft preview를 표시한다. `POST /api/mock-lab/:mockId/drafts/:draftId/cancel`로 실행 중 draft를 중단할 수 있다.

Draft는 `MockSpec` 검증을 통과해야만 editor에 불러올 수 있다. 실패한 draft는 stdout/stderr와 validation error를 볼 수 있지만 자동 적용되지 않으며 canonical `mock-spec.json`도 변경하지 않는다.

## Server And Smoke

Server control API는 저장된 `mock-spec.json`을 읽어 package-owned generic MCP stdio runtime을 실행하고 mock별 process registry를 유지한다. `generated/package.json` 또는 Codex-generated project files는 필요하지 않다.

Smoke test는 다음을 확인한다.

- `tools/list`: tool name, description, inputSchema, outputSchema 존재
- `tools/call`: sample input 검증, `structuredContent` 존재, outputSchema 검증, text content 존재, synthetic marker 존재, audit log 기록

실행된 MCP stdio server는 local test double이다. 같은 runtime process를 network MCP로도 노출한다(아래). A2A mock server는 v0.1 범위가 아니다.

## Network MCP (Streamable HTTP)

생성된 ADK **runnable** 번들의 connected adapter가 실제 tool을 호출할 수 있도록, 실행 중인 saved-spec stdio runtime을 Streamable-HTTP MCP 엔드포인트로 다시 노출한다. 공식 MCP TypeScript SDK(`@modelcontextprotocol/sdk`)로 구현하며 별도 HTTP/SSE 핸드셰이크를 직접 만들지 않는다(`server/mcpNetworkBridge.ts`).

- `ALL /api/mock-lab/mcp/<key>` — `<key>`(mock_id, `server_name`, 또는 `source.catalog_entry_name`)로 실행 중인 runtime을 찾아 Streamable-HTTP MCP server를 띄운다. `tools/list`와 `tools/call`은 `MockProcessRegistry.sendJsonRpc`로 runtime에 그대로 위임하므로 single source of truth와 기존 audit log를 재사용한다. bridge 자체는 business logic을 추가하지 않는다. runtime이 실행 중이 아니면 409를 반환한다.
- `GET /api/mock-lab/mcp-discovery` — 저장된 mock과 running 여부, live `tools/list` tool 이름, `mcp_url`(`/api/mock-lab/mcp/<mock_id>`)을 반환한다. `?server=<name>&tool=<tool>`로 adapter↔server 매칭을 조회한다. **connected**는 in-memory process가 running이고 해당 tool이 live `tools/list`에 있는 경우만 true다(persisted `server-state.json`의 running은 advisory).

생성된 runnable 번들은 `AF_MOCK_LAB_MCP_URL`(기본 `http://127.0.0.1:5173/api/mock-lab/mcp`) + `<mcp_server>`로 `streamablehttp_client`를 연결하거나, `agents.config.yaml`의 adapter `mcp_url`로 override한다. BuildWorkbench의 runnable mode에서는 reviewer가 running Mock Lab tool을 명시적으로 선택해 `scaffold-plan.json`의 adapter MCP binding을 저장한다. 모든 호출은 synthetic Mock Lab 한정이며 private endpoint/credential/실데이터를 담지 않는다.

## Non-goals

- 기존 workbench route 통합
- `catalog/*.yaml` 직접 수정
- `catalog-delta.yaml` 생성
- 실제 은행 endpoint 연결
- credential/auth 실구현
- 운영 배포 스크립트
- production business logic
