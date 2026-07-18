# Local MCP Mock Lab

> Target 개념에서 Mock Lab은 **MCP binding을 가진 Tool의 로컬 테스트 더블 실행실**이다. 자산 분류는 [Taxonomy](../workbench/taxonomy.md), Tool과 MCP Binding의 관계는 [Graph IR](../workbench/graph-ir.md)가 기준이다.

Mock Lab은 합성 `MockSpec`을 편집·저장하고, 저장된 spec으로 MCP stdio runtime을 실행하며, smoke와 network MCP discovery를 수행하는 로컬 검토 표면이다. Mock은 Tool 계약의 개발·검증용 대역이며 실제 backend, 실제 고객 데이터, production business logic을 구현하지 않는다.

MCP는 Tool의 연결 방식이지 자산 유형이 아니다. 따라서 이 문서는 legacy `Adapter`를 새 택소노미 유형으로 정의하지 않고, 현재 구현에 남은 이름으로만 설명한다.

## Target 역할

Mock Lab은 다음 책임만 가진다.

- MCP binding을 가진 Tool의 입력·출력·오류 계약을 synthetic `MockSpec`으로 표현한다.
- 사람이 `MockSpec`을 편집·검토하고 canonical spec으로 저장한다.
- 자연어 prompt에서 spec 초안을 만들되 자동 승인하거나 자동 저장하지 않는다.
- 저장된 spec을 package-owned generic MCP stdio runtime으로 실행한다.
- `tools/list`와 `tools/call` smoke로 schema, synthetic response, audit 기록을 검증한다.
- 실행 중 runtime을 network MCP로 노출하고 discovery로 연결 가능성을 확인한다.

Mock Lab 성공은 Tool의 Catalog 승인, 실제 backend 연결, 운영 준비 또는 production 배포를 뜻하지 않는다. Catalog와 승인 단계의 관계는 [Operating Model](../workbench/operating-model.md#5-catalog재사용-거버넌스)을 따른다.

## Current Implementation(`legacy`)

현재 UI와 source는 legacy `Adapter` 어휘를 사용한다. read-only prefill source는 `catalog/adapters.yaml`이고, 통합 route는 `/mock-lab`이며, Reuse Hub 이동 query도 `adapter` 이름을 사용한다. 이 파일·route·query는 이번 문서 정합화에서 변경하지 않는다.

현재 legacy `Adapter` row를 Target Tool로 자동 해석하지 않는다. Mock Lab에 나타난 항목이 실제로 구조화된 호출 기능인지 확인하고, 데이터·지식·외부 시스템 자체라면 Resource 또는 Dependency로 판별한다. 구현 gap은 [Migration Status](../migration/taxonomy-vnext-status.md)를 따른다.

### 실행 경로

기본 사용자 경로는 5173 main workbench의 통합 Shell route다.

```bash
cd packages/web
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

기본 URL은 `http://127.0.0.1:5173/mock-lab`이다. 이 route가 일상적인 Mock Lab 편집·실행·검증 표면이다.

`packages/mock-lab` standalone 앱은 패키지 개발과 과도기 호환을 위해 유지한다.

```bash
cd packages/mock-lab
npm install
npm run dev
```

standalone 개발 앱 URL은 `http://127.0.0.1:5176/`이다. 5176 앱은 별도 자산 유형이나 별도 운영 Mock 서비스를 뜻하지 않는다.

### Catalog Prefill(`legacy`)

`GET /api/mock-lab/catalog-prefill`은 legacy `catalog/adapters.yaml`을 읽기 전용으로 파싱한다. 현행 표시 대상은 `contract_status == "mock_ready"`, `runtime_mock` 존재, 또는 `component_source == "stub"` 중 하나를 만족하는 row다.

좌측 패널은 저장된 Mock server 목록을 표시한다. 저장된 Mock은 선택해 편집하거나 삭제할 수 있으며, 삭제는 실행 중 saved-spec process의 stop을 시도한 뒤 `artifacts/mock-lab/<mock-id>/`의 해당 로컬 artifact를 제거한다.

Catalog prefill은 Mock Spec Editor의 `+ tool` 선택 창에서 사용한다. 첫 `new` 항목은 빈 Tool mock을 만들고, legacy `Adapter` row를 고르면 현행 `inputSchema`, `outputSchema`, `successResponse`, `riskSignals`, `auditRequired` 초안을 채운다. 선택 창은 3×3과 pagination 흐름을 유지한다.

Reuse Hub의 legacy `Adapter` 카드에서 Mock Lab을 열면 `/mock-lab?adapter=<catalog-name>&req=<reqId>`로 이동한다. Prefill은 편집 시작점일 뿐 승인된 Tool 계약이 아니며, Mock Lab은 `catalog/*.yaml`을 저장하거나 수정하지 않는다.

### MockSpec 편집과 저장

현재 artifact root는 `artifacts/mock-lab/<mock-id>/`다. Editor의 저장은 검증된 spec으로 `mock-spec.json`을 교체하고 `audit-log.jsonl`에 저장 event를 추가한다.

UI에서 실행 중 spec을 편집해도 이미 실행 중인 process에 즉시 반영되지 않는다. 변경을 저장한 뒤 runtime을 stop/start해야 새 canonical `mock-spec.json`으로 실행된다.

주요 Current API는 다음과 같다.

| 목적 | API |
| --- | --- |
| Mock 목록·생성 | `GET /api/mock-lab`, `POST /api/mock-lab` |
| Mock 상세·삭제 | `GET /api/mock-lab/:mockId`, `DELETE /api/mock-lab/:mockId` |
| canonical spec 저장 | `PUT /api/mock-lab/:mockId/spec` |
| audit 조회 | `GET /api/mock-lab/:mockId/audit-log` |

### Prompt-to-Spec 초안

`Draft Spec with Codex`는 server project나 runtime 코드를 생성하지 않는다. 자연어 prompt에서 `MockSpec` 초안을 만들고, 사용자가 editor에서 검토·수정한 뒤 별도의 `Save spec`으로 canonical `mock-spec.json`을 저장한다.

`POST /api/mock-lab/:mockId/drafts`는 prompt와 model을 받아 background draft run을 시작한다. 상태와 결과는 `GET /api/mock-lab/:mockId/drafts` 및 `GET /api/mock-lab/:mockId/drafts/:draftId`에서 확인하고, 실행 중 초안은 `POST /api/mock-lab/:mockId/drafts/:draftId/cancel`로 취소할 수 있다.

성공한 초안은 `drafts/<draft-id>/draft-spec.json`에 남는다. `MockSpec` schema 검증을 통과한 초안만 editor로 가져올 수 있으며, draft runner는 canonical spec을 자동 교체하지 않는다. 실패 evidence와 validation error도 자동 적용하지 않고 검토 자료로 남긴다.

### Stdio Runtime과 Smoke

Server control API는 저장되고 schema-valid한 `mock-spec.json`을 읽어 package-owned generic MCP stdio child runtime을 실행한다. Codex-generated server project나 `generated/package.json`은 필요하지 않다.

| 목적 | API |
| --- | --- |
| runtime 시작·정지 | `POST /api/mock-lab/:mockId/server/start`, `POST /api/mock-lab/:mockId/server/stop` |
| runtime 상태 | `GET /api/mock-lab/:mockId/server/status` |
| Tool 목록 smoke | `POST /api/mock-lab/:mockId/smoke/tools-list` |
| Tool 호출 smoke | `POST /api/mock-lab/:mockId/smoke/tools-call` |

`tools/list` smoke는 Tool name, description, input schema, output schema를 확인한다. `tools/call` smoke는 sample input 검증, structured output, output schema, text content, synthetic marker, audit log 기록을 확인한다.

실행된 stdio MCP server는 local test double이다. Mock Lab은 A2A mock server를 만들지 않는다. A2A 검증은 별도의 합성 scenario와 Agent 연결 계약에서 다룬다.

### Network MCP와 Discovery

현재 network bridge는 실행 중인 saved-spec stdio runtime을 Streamable HTTP MCP endpoint로 노출한다. Bridge는 Tool business logic을 추가하지 않고 `tools/list`와 `tools/call`을 같은 runtime process에 위임한다.

- `GET /api/mock-lab/mcp-discovery`는 저장된 mock, running 여부, live Tool 이름과 `mcp_url`을 반환한다. `?server=<name>&tool=<tool>` query로 특정 연결을 확인할 수 있다.
- `POST`, `GET`, `DELETE /api/mock-lab/mcp/:server-or-id`는 MCP session lifecycle을 제공한다.
- discovery의 connected 판단은 in-memory process가 실행 중이고 요청한 Tool이 live `tools/list`에 있을 때만 참이다. persisted `server-state.json`의 running 값만으로 연결됨을 주장하지 않는다.
- runtime이 실행 중이지 않으면 network bridge는 사용 가능한 Tool endpoint로 취급하지 않는다.

생성된 Current Implementation runnable bundle은 `AF_MOCK_LAB_MCP_URL`과 server 식별자를 사용하거나 현행 runtime config의 legacy `Adapter` MCP URL override를 통해 이 bridge에 연결할 수 있다. 이 연결은 synthetic local 검증 전용이며 Target에서 Tool + MCP Binding + HTTP Transport로 해석한다.

## 로컬 입력 보안

Mock spec, draft prompt, event log, smoke input, audit log는 ignored local artifact 아래에 저장되더라도 screenshot, log, generated bundle로 복사될 수 있다. synthetic 또는 masked 값만 사용한다.

다음 정보는 prompt, `mock-spec.json`, catalog YAML, fixture, 문서에 넣지 않는다.

- private endpoint URL
- credential, token, secret
- 실고객·실거래·실은행 데이터
- production business logic
- 사내 배포 정보

runtime secret이 필요하면 ignored local env 경계를 사용하며 MockSpec이나 문서에 저장하지 않는다.

## Non-goals

- legacy `Adapter`를 Target의 새 자산 유형으로 정의
- Reuse Hub Catalog 거버넌스를 Mock Lab으로 이전
- `catalog/*.yaml` 직접 수정 또는 `catalog-delta.yaml` 생성
- 실제 은행 endpoint나 External Dependency 연결
- credential·auth의 운영 구현
- A2A mock server 생성
- 운영 배포 스크립트 또는 production business logic 생성
