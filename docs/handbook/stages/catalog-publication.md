# catalog-publication Catalog 재사용 환류와 게시

## 목적

검토된 root-scoped `catalog-delta.yaml`을 provenance로 사용해 strict Target Agent·Workflow·Tool entry를 검증·버전 관리·atomic publish한다.

## Trigger와 진입 조건

- Trigger: Verify 후 Reuse Hub에서 등록 승인 drawer를 열고 proposal publish를 요청한다.
- 진입 조건: active reqId, valid Agent·Workflow·Tool proposal, 같은 root의 matching `catalog-delta.yaml` entry가 필요하다.

## 종료 조건

- 동일 `asset_id`와 published fields 재요청이면 기존 published entry를 idempotent success로 반환한다.
- 새 publish이면 같은 `asset_id`의 기존 entry는 deprecated되고 증가한 version의 새 entry가 대상 Catalog YAML에 기록된다.
- Catalog query cache가 invalidate되어 새 index를 읽을 수 있다.

## 주요 입력

- reqId와 publish proposal
- `catalog-delta.yaml`
- 현재 Catalog YAML

## 주요 출력

- versioned published Catalog entry
- target Catalog filename, ID, name, version을 담은 publish response

## Main Flow

1. Reuse Hub는 active root와 Catalog index를 표시하고 등록 승인 surface를 연다.
2. client가 `POST /api/catalog/publish`로 reqId와 proposal을 보낸다.
3. server는 exact Target `asset_type`과 Domain/Owner/Reuse, Binding/Profile을 검증한다. Tool 실행 계약은 `binding`/`connection`과 Asset `inputs`/`outputs`를 권위로 삼는다.
4. proposal이 root의 `catalog-delta.yaml` entry와 일치하는지 확인한다.
5. process-global queue 안에서 대상 YAML을 읽고 idempotency 또는 next version을 결정한다.
6. 새 document를 temp file에 쓰고 rename으로 atomic replace한다.

## 분기와 실패/needs-info

- manifest approval을 직접 읽지 않는다. delta provenance와 publish validation이 별도 gate다.
- invalid reqId/proposal과 missing/mismatched delta는 422다.
- 같은 `asset_id`의 기존 published entry가 proposal과 다르면 deprecated 후 새 version을 만든다.
- queue는 server process 안에서만 직렬화한다. 여러 독립 process 간 coordination은 제공하지 않는다.
- publish와 index read는 `catalog/agents.yaml`, `catalog/workflows.yaml`, `catalog/tools.yaml` 세 파일만 사용한다.
- A2A는 Agent entry의 Binding/Exposure로 표현되며 Catalog category나 별도 bucket이 아니다.

## 읽는 Register

- [`reg.catalog-delta`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.catalog-delta`](../registers.md#cross-stage-registers)
- [`reg.catalog-entries`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: [verify-feedback](verify-feedback.md)
- 다음: 새 Analyze/Design/Build run의 Catalog reuse input으로 환류
- 병행: Catalog에서 Mock Lab prefill 또는 A2A-bound Agent reuse 선택

## 외부 경계

- browser Reuse Hub와 `/api/catalog`
- local Catalog YAML filesystem
- A2A protocol metadata는 Agent Catalog entry의 Binding/Exposure field 경계에 머문다.

## L3 Source Map

### Reuse Hub surface

- Path: `packages/web/src/routes/ReuseHubPage.tsx`
- Stable anchor: default `ReuseHubPage`
- Role in behavior: Agent·Workflow·Tool 세 탭의 Catalog 탐색, active root 선택, pin·registration proposal·publish approval surface를 조정한다. A2A는 Agent의 Binding/Exposure로 표시한다.
- Inputs: Catalog index, artifact roots, recent roots, search/filter state
- Outputs: drawer actions, reuse pin, publication flow
- State/artifact reads: `reg.catalog-entries`, `reg.artifact-root`, `reg.recent-roots`, `reg.catalog-delta`
- State/artifact writes: drawer를 통해 `reg.catalog-delta`, `reg.catalog-entries`
- Important callers: `AppRouter`
- Important callees: `PublishApprovalDrawer`, `RegisterProposalDrawer`, `CatalogCard`, `PinTargetDialog`
- External boundaries: React query, URL search params, HTTP
- Failure/edge behavior: active root가 없으면 탐색은 허용하지만 pin·proposal·publish action을 disabled한다.
- Related registers: `reg.catalog-entries`, `reg.catalog-delta`, `reg.artifact-root`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Catalog pin

- Path: `packages/web/src/catalog/catalogPin.ts`
- Stable anchor: `isCatalogPinCompatible`, `applyCatalogPin`
- Role in behavior: 선택한 Agent·Workflow·Tool Catalog 항목을 같은 Target asset type 후보에 적용한다.
- Inputs: canonical `AnalysisResult`, Asset candidate ID, parsed `CatalogHubEntry`
- Outputs: 선택 Asset의 Target fields가 갱신된 새 `AnalysisResult`
- State/artifact reads: caller가 읽은 `reg.analysis-result`, `reg.catalog-entries`
- State/artifact writes: 직접 없음; `PinTargetDialog`가 결과를 `reg.analysis-result`에 저장한다.
- Important callers: `PinTargetDialog`
- Important callees: 없음; pure Asset candidate field mapping
- External boundaries: 없음
- Failure/edge behavior: Asset type이 다르면 pin을 허용하지 않는다. pin은 `analysis.graph`를 변경하지 않는다.
- Related registers: `reg.analysis-result`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Catalog publish client

- Path: `packages/web/src/state/useCatalogPublish.ts`
- Stable anchor: `useCatalogPublish`
- Role in behavior: publish request를 전송하고 성공 뒤 Catalog index cache를 invalidate한다.
- Inputs: reqId, `CatalogPublishProposal`
- Outputs: publish result 또는 `AfApiError`
- State/artifact reads: `reg.catalog-delta`는 server가 검증한다.
- State/artifact writes: server를 통해 `reg.catalog-entries`
- Important callers: `PublishApprovalDrawer`
- Important callees: `POST /api/catalog/publish`, query client
- External boundaries: HTTP, React query cache
- Failure/edge behavior: non-2xx response의 details를 보존한 `AfApiError`를 throw한다.
- Related registers: `reg.catalog-delta`, `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Strict Catalog parser

- Path: `packages/web/src/catalog/catalogIndex.ts`
- Stable anchor: `parseCatalogIndexPayload`, `parseCatalogDocument`
- Role in behavior: exact Agent·Workflow·Tool Catalog buckets와 strict entry fields를 parsing한다.
- Inputs: `/api/catalog` aggregate payload
- Outputs: strict `CatalogIndex`
- State/artifact reads: `reg.catalog-entries`
- State/artifact writes: 없음
- Important callers: `useCatalog`, server Catalog index loader
- Important callees: local exact-key and entry parsers
- External boundaries: HTTP, React query cache
- Failure/edge behavior: `agents`, `workflows`, `tools` 외 bucket과 제거된 entry field를 거부하며 누락 bucket을 생성하지 않는다.
- Related registers: `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Catalog index and atomic publish

- Path: `packages/web/server/afCatalogApi.ts`
- Stable anchor: `createAfCatalogMiddleware`, section `handleCatalogPublish`, section `handleCatalogIndex`
- Role in behavior: Catalog index read와 validated/versioned/serialized publish transaction을 소유한다.
- Inputs: GET index 또는 POST publish body
- Outputs: aggregated Catalog payload 또는 publish result
- State/artifact reads: `reg.catalog-entries`, `reg.catalog-delta`
- State/artifact writes: `reg.catalog-entries`
- Important callers: Vite middleware mount; client Catalog/publish hooks
- Important callees: publish validators, target mapper, versioning, entry builder, YAML parser/dumper
- External boundaries: HTTP, local filesystem
- Failure/edge behavior: process-global promise queue로 publish를 직렬화하고 temp+rename으로 target file을 교체한다.
- Related registers: `reg.catalog-entries`, `reg.catalog-delta`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Publish request and provenance validation

- Path: `packages/web/server/catalogPublishValidation.ts`
- Stable anchor: `validatePublishRequest`, `validatePublishedProposalSource`
- Role in behavior: Agent·Workflow·Tool request와 root-scoped delta의 Target 계약 필드 전체 일치를 검증한다.
- Inputs: repo root, reqId, category, proposal
- Outputs: validation detail list
- State/artifact reads: `reg.catalog-delta`, `reg.artifact-root`
- State/artifact writes: 없음
- Important callers: Catalog publish handler
- Important callees: `parseCatalogDelta`, strict proposal comparison helpers
- External boundaries: local filesystem
- Failure/edge behavior: missing root/delta, Target field 변조·누락과 Asset type/name mismatch를 detail로 반환한다.
- Related registers: `reg.catalog-delta`, `reg.artifact-root`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Publish target mapping

- Path: `packages/web/server/catalogPublishTarget.ts`
- Stable anchor: `targetCatalogFile`
- Role in behavior: Target Agent/Workflow/Tool을 대상 Catalog YAML 및 top-level key에 매핑한다.
- Inputs: Catalog directory, `AssetType`
- Outputs: absolute path, repository-relative path, document key
- State/artifact reads: 없음
- State/artifact writes: 직접 없음
- Important callers: Catalog publish handler
- Important callees: Node path `join`
- External boundaries: 없음
- Failure/edge behavior: Agent는 `agents.yaml`/`agents`, Workflow는 `workflows.yaml`/`workflows`, Tool은 `tools.yaml`/`tools`만 선택한다.
- Related registers: `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

### Published entry builder

- Path: `packages/web/server/catalogPublishEntry.ts`
- Stable anchor: `buildPublishedEntry`, `deepEqualPublishedFields`
- Role in behavior: version/provenance metadata를 가진 serialized entry와 idempotency 비교 snapshot을 만든다.
- Inputs: validated proposal, version, reqId
- Outputs: Catalog entry object 또는 equality boolean
- State/artifact reads: in-memory `reg.catalog-entries`
- State/artifact writes: 직접 없음; handler가 `reg.catalog-entries`에 반영한다.
- Important callers: Catalog publish handler
- Important callees: local strict entry field builders
- External boundaries: clock for `published_at`
- Failure/edge behavior: validated proposal의 Target fields와 version/provenance만 직렬화하며 제거된 subtype/category field를 생성하지 않는다.
- Related registers: `reg.catalog-entries`
- Verified at: baseline `0cdcb82` + 2026-07-19 worktree
- Locator status: `active`

## 확인되지 않은 사항

- process-global publish queue는 여러 server process나 외부 writer를 직렬화하지 않는다.
- publish가 `catalog-delta.yaml`을 자동 삭제하거나 완료 상태로 표시하는 동작은 확인되지 않았다.
