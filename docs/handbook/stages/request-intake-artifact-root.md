# request-intake-artifact-root 요구사항 접수와 Artifact Root

## 목적

requirement identity를 정하고 검토 가능한 canonical artifact root를 만든 뒤 Analyze 진입점을 연다. 기존 `analysis-result.json` import는 같은 진입 화면의 별도 분기다.

## Trigger와 진입 조건

- Trigger: Landing에서 새 root 생성 또는 기존 분석 JSON import를 선택한다.
- 진입 조건: 사용자가 지정한 ID는 `REQ_ID_PATTERN`을 만족해야 한다. ID를 비우면 서버가 사용 가능한 `req-NNN`을 선택한다.

## 종료 조건

- `artifacts/af/:reqId/af-run-manifest.json`이 생성되고 네 stage가 pending, 네 approval이 false, validation이 `not_run`으로 초기화된다.
- 브라우저가 `/af/:reqId/analyze`로 이동한다.
- import 분기에서는 검증된 `analysis-result.json`도 canonical root에 저장된다.

## 주요 입력

- 선택적 requirement ID
- 또는 로컬 `analysis-result.json`
- 현재 root 목록과 browser recent-root cache

## 주요 출력

- 새 artifact root와 초기 manifest
- Analyze route
- import 분기의 canonical analysis artifact

## Main Flow

1. Landing은 서버 root 목록과 browser recent-root cache를 표시한다.
2. 새 root 생성은 `POST /api/af`를 호출한다.
3. 서버는 ID를 검증하거나 자동 부여하고 `ArtifactRootStore.createRoot`로 manifest-only root를 만든다.
4. client는 root query를 invalidate하고 recent-root를 갱신한 뒤 Analyze route로 이동한다.
5. import는 JSON shape를 먼저 파싱한다. 같은 ID root가 이미 있으면 create 409만 허용하고, 이어서 canonical `analysis-result.json`을 PUT한다.

## 분기와 실패/needs-info

- 잘못된 ID는 400, 이미 존재하는 ID는 409다.
- import JSON이 현재 analysis shape를 만족하지 않거나 requirement ID가 없으면 저장하지 않는다.
- 기존 manifest는 requirement/root identity, 네 stage/status, 네 approval과 validation이 모두 있어야 한다. 누락값이나 잘못된 enum을 읽을 때 보정하지 않고 422로 거부한다.
- root list는 읽을 수 없는 manifest를 전체 목록 실패로 전파하지 않고 해당 entry를 건너뛴다.
- artifact root 삭제·복원 API는 확인되지 않았다.

## 읽는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)

## 쓰는 Register

- [`reg.artifact-root`](../registers.md#cross-stage-registers)
- [`reg.run-manifest`](../registers.md#cross-stage-registers)
- [`reg.approvals`](../registers.md#cross-stage-registers)
- [`reg.stage-status`](../registers.md#cross-stage-registers)
- [`reg.recent-roots`](../registers.md#cross-stage-registers)
- import 분기: [`reg.analysis-result`](../registers.md#cross-stage-registers)

## 이전·다음 Stage

- 이전: 외부 requirement 수신 또는 기존 분석 artifact 선택
- 다음: [analyze-review-gate](analyze-review-gate.md)

## 외부 경계

- 브라우저 파일 읽기와 localStorage
- `/api/af` HTTP boundary
- 로컬 파일시스템 `artifacts/af/:reqId/`

## L3 Source Map

### Landing orchestration

- Path: `packages/web/src/routes/LandingPage.tsx`
- Stable anchor: default `LandingPage`, `handleImport`
- Role in behavior: root 생성·선택·import와 Analyze navigation을 조정한다.
- Inputs: optional requirement ID, local JSON file, root query, recent-root cache
- Outputs: create/PUT 요청, user message, `/af/:reqId/analyze` navigation
- State/artifact reads: `reg.artifact-root`, `reg.recent-roots`
- State/artifact writes: `reg.recent-roots`; import 시 `reg.analysis-result`
- Important callers: `AppRouter`
- Important callees: `createArtifactRoot`, `putArtifactJson`, `parseAnalysisResultArtifact`, `useRecentRoots`
- External boundaries: browser File API, HTTP, localStorage
- Failure/edge behavior: import create의 409만 기존 root 분기로 허용하고 다른 오류는 중단한다.
- Related registers: `reg.artifact-root`, `reg.analysis-result`, `reg.recent-roots`
- Verified at commit: `7deea45`
- Locator status: `active`

### Route shell

- Path: `packages/web/src/routes/router.tsx`
- Stable anchor: `AppRouter`
- Role in behavior: Landing, Catalog, Mock Lab과 requirement별 Analyze·Design·Build·Verify·Run route를 선언한다.
- Inputs: browser location
- Outputs: lazy-loaded route element 또는 redirect
- State/artifact reads: 없음
- State/artifact writes: 없음
- Important callers: `packages/web/src/App.tsx` · `App`
- Important callees: `Routes`, `Navigate`, 각 route component
- External boundaries: browser router
- Failure/edge behavior: `/af/:reqId`는 Analyze로, wildcard는 `/`로 redirect한다.
- Related registers: `reg.artifact-root`
- Verified at commit: `7deea45`
- Locator status: `active`

### Artifact root HTTP CRUD

- Path: `packages/web/server/afArtifactCrudApi.ts`
- Stable anchor: `handleListRoots`, `handleCreateRoot`, `handleGetManifest`, `handlePutJson`
- Role in behavior: root list/create와 allowlisted canonical artifact·manifest transport를 처리한다.
- Inputs: HTTP request body, reqId, optional `If-Match`
- Outputs: root summary, created identity, artifact content 또는 HTTP error
- State/artifact reads: `reg.artifact-root`, `reg.run-manifest`
- State/artifact writes: `reg.artifact-root`, `reg.run-manifest`; import 시 `reg.analysis-result`
- Important callers: `createAfArtifactsMiddleware`
- Important callees: `ArtifactRootStore`, `validateAnalysisResult`, `validateScaffoldPlanWrite`, HTTP body/response helpers
- External boundaries: HTTP, local filesystem through store
- Failure/edge behavior: invalid analysis·scaffold plan은 422, Build approval 없는 scaffold save와 ETag mismatch는 409다. derived split PUT은 405다.
- Related registers: `reg.artifact-root`, `reg.run-manifest`, `reg.analysis-result`
- Verified at commit: `7deea45`
- Locator status: `active`

### Artifact root store

- Path: `packages/web/server/artifactRootStore.ts`
- Stable anchor: `ArtifactRootStore`, `ArtifactRootStore.createRoot`, `ArtifactRootStore.listRoots`, `computeEtag`
- Role in behavior: root containment, path allowlist, initial manifest, safe read/write와 ETag를 소유한다.
- Inputs: repo root, reqId, relative artifact path, content, optional ETag
- Outputs: root summary, read/write result, validation/conflict error
- State/artifact reads: `reg.artifact-root`, `reg.run-manifest`
- State/artifact writes: `reg.artifact-root`, `reg.run-manifest`
- Important callers: artifact CRUD, Stage Runner, Build·Verify·Runtime middleware
- Important callees: Node filesystem, `parseAfRunManifest`, `serializeAfRunManifest`
- External boundaries: local filesystem
- Failure/edge behavior: path traversal·allowlist 위반을 거부하고 기존 manifest가 있으면 create를 409로 막는다. manifest parse는 complete shape와 canonical requirement/root identity를 요구한다.
- Related registers: `reg.artifact-root`, `reg.run-manifest`, `reg.approvals`, `reg.stage-status`
- Verified at commit: `7deea45`
- Locator status: `active`

## 확인되지 않은 사항

- root-level DELETE 또는 복원 경로는 현재 source에서 확인되지 않았다.
- browser recent-root와 author localStorage를 한 번에 지우는 앱-wide reset은 확인되지 않았다.
