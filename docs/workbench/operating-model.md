# Agent Factory 운영 모델(Operating Model)

> 이 문서는 strict Target Contract v2에 맞춘 운영 단계, 승인 gate, artifact, Catalog, Runtime Handoff, 검증의 단일 기준이다. 자산 분류는 [Taxonomy](./taxonomy.md), 실행 구조는 [Graph IR](./graph-ir.md), 행동 위치 탐색은 [Handbook](../handbook/README.md)을 따른다.

## 1. 목적과 파이프라인

Agent Factory는 raw requirement를 바로 runtime code로 바꾸지 않는다.

```text
Requirement
  -> Analyze: evidence + normalizedRequirement + assetCandidates + graph
  -> human analysis approval
  -> Design: reviewed assets + Graph IR + runtime/A2A contracts
  -> human boundary/runtime approval
  -> Build: approved artifacts -> scaffold-plan -> Runtime Handoff
  -> Verify: artifact/code/runtime/behavior evidence + Catalog proposal
  -> human publish decision
```

모든 새 analysis와 scaffold artifact는 `contract_version: "2.0"`을 사용한다. 다른 버전, 제거된 field, 이전 split filename을 읽는 compatibility 단계는 없다.

## 2. 작업 단계

| 단계 | 책임 | canonical 입력 | 출력 | 완료 조건 |
| --- | --- | --- | --- | --- |
| Define | 목표, 사용자, 입출력, 시스템, 위험, 누락 정보 식별 | raw requirement | 실행 가능한 분석 범위와 질문 | 중대한 가정이 드러나고 다음 판단에 필요한 evidence가 있다. |
| Analyze | Agent·Workflow·Tool 후보와 초안 Graph 발견 | requirement, Catalog evidence | proposed `analysis-result.json` | strict v2 검증을 통과하고 사람이 분석을 검토할 수 있다. |
| Design | 자산 책임, Graph, runtime/A2A 계약, 재사용·Owner·risk 경계 검토 | approved analysis | proposed `analysis-result.json`, `boundary-design.md` | 후보 hard gate와 Graph·계약 blocker가 해소되었다. |
| Build | 승인된 계약으로 Runtime Handoff 생성 | canonical analysis, approvals, derived scaffold plan | canonical `runtime-stub/`, `implementation-handoff.md` | 승인 artifact와 생성 입력의 provenance가 확인되고 생성 결과가 검토 가능하다. |
| Verify | 문서·artifact·code·runtime·behavior를 계층별 검증 | canonical artifacts, Runtime Handoff | proposed `validation-report.md`, `catalog-delta.yaml` | artifact-root와 generated-runtime 필수 evidence가 모두 통과하고 실패·잔여 불확실성이 기록되었다. |
| Publish | 검토된 Catalog proposal 승인 | active root의 `catalog-delta.yaml` | versioned Catalog entry | proposal source와 publish payload가 일치하고 사람이 등록을 승인했다. |
| Run | 로컬 runtime proof | approved Runtime Handoff | runtime event와 transcript | 검증 목적의 실행 결과가 관찰되었다. production deployment를 뜻하지 않는다. |

### Current Product surfaces

| 단계 | Route | Stage Runner primitive | Proposed/canonical write |
| --- | --- | --- | --- |
| Analyze | `/af/:reqId/analyze` | `af-discover-assets` | `runs/analyze/<run-id>/proposed-artifacts/analysis-result.json`; apply 후 canonical 반영 |
| Design | `/af/:reqId/design` | `af-compose-solution` | proposed `analysis-result.json`, `boundary-design.md`; apply 후 canonical 반영 |
| Build | `/af/:reqId/build` | `af-scaffold-runtime` + server artifact-sync/generator | canonical derived artifacts와 `runtime-stub/`; 별도 apply 없음 |
| Verify | `/af/:reqId/verify` | `af-verify-runtime` + server allow-list | proposed `validation-report.md`, `catalog-delta.yaml`; 명시적 apply |
| Catalog | `/reuse` | Catalog read/publish API | 승인 시 `agents.yaml`, `workflows.yaml`, `tools.yaml` 중 하나 |
| Run | `/af/:reqId/run` | local runtime controls | runtime-only evidence |

Stage Runner 성공은 approval boolean을 자동 변경하지 않는다.

## 3. 승인 게이트 모델

승인은 사람이 검토한 결정이며 artifact 생성, validator 통과, Stage Runner 완료와 별개다.

| Gate | 현재 manifest field | 막는 경계 |
| --- | --- | --- |
| 분석 검토 | `analysis_reviewed` | Design 시작 |
| 자산·Graph 경계 승인 | `boundaries_approved` | Build 시작 |
| Runtime/A2A 계약 승인 | `runtime_contracts_approved` | Build 시작 |
| Handoff 후속 준비 | `stub_ready_for_followup` | Verify command와 Verify Stage Runner 시작 |

`PATCH /api/af/:reqId/manifest/approvals`가 approval과 stage status를 함께 갱신한다. 값은 boolean만 허용하고 Analyze → 경계 → Runtime 계약 → Handoff 순서를 건너뛸 수 없다. 상위 승인을 취소하면 하위 승인은 함께 내려가며, Handoff 승인은 실제 non-empty `runtime-stub/`을 요구한다. Stage Runner run/apply, artifact sync, generator, validator, Runtime smoke는 gate를 대신 켜지 않는다. 모든 server Build 진입점은 Analyze와 두 Design approval을 다시 검사하고, Verify는 Build `complete`, `stub_ready_for_followup=true`, non-empty `runtime-stub/`을 검사한다.

Canonical analysis가 바뀌면 기존 승인은 그 revision에 더 이상 유효하지 않다. `normalizedRequirement` 또는 `evidence` 변경은 Analyze 이후 approval을 모두 내리고, Asset·Graph·runtime/A2A 계약 변경은 Design 이후 approval을 내린다. 두 경우 모두 이전 validation result를 `not_run`으로 되돌린다.

Requirement 수준 누락 정보는 `evidence.missing_information`과 선택적 `evidence.accepted_missing_information`으로 추적한다. 자산 후보 hard gate는 `AssetCandidate.missing_information`과 `status: needs_info`다. unresolved Binding, unknown Transport, unresolved Workflow representation, 미해결 candidate Missing Information, 승인되지 않았거나 필요한 key가 빠진 runtime/A2A 계약, 유효하지 않은 Graph는 approval·Catalog publish·scaffold 생성을 막는다.

승인된 `async_resume` Runtime Contract는 typed `resume_policy`와 `side_effect_guard`를 모두 가져야 한다. Policy는 stable interrupt ID, invocation correlation, positive timeout, timeout·duplicate·conflict·restart 처리를 소유하고, guard는 reviewed Tool·idempotency input·`at_most_once`·`session_state` ledger를 소유한다. Human Input과 side-effect Tool Node annotation이 정확히 맞지 않거나 side-effect 경로가 reject/default 경로와 분리되지 않으면 Build/generator가 중단한다.

## 4. Artifact 태도

`artifacts/af/<req-id>/`는 한 requirement run의 canonical store다.

### Canonical analysis

`analysis-result.json`은 다음 strict root를 소유한다.

- `contract_version: "2.0"`
- `normalizedRequirement`
- `evidence`
- embedded `assetCandidates`
- `a2aContracts`
- `runtimeContracts`
- embedded `graph`

embedded `assetCandidates`와 `graph`가 canonical 의미다. artifact sync는 이를 그대로 다음 split artifact로 쓴다.

- `asset-candidates.json`
- `graph-ir.json`

`normalized-requirement.json`은 normalized requirement의 split copy이고 `scaffold-plan.json`은 승인 후보·Graph·runtime contract에서 파생한다. 후보와 Graph의 split filename은 위 두 이름뿐이다. `module-candidates.json`, `process-flow.json`은 허용되지 않는다.

`normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json`은 읽기 가능한 derived snapshot이지만 외부 PUT 대상은 아니다. 갱신 주체는 server artifact-sync뿐이다. `scaffold-plan.json`은 Build UI가 저장할 수 있지만 server가 두 Design approval, strict schema와 canonical analysis·Catalog projection을 다시 확인하며 approved Tool의 명시적 Mock Lab MCP binding 외 drift는 거부한다.

### Strict read/write boundary

- version 없는 root나 제거된 field를 load-time 변환하지 않는다.
- backward reader, compatibility normalization, in-memory projection을 두지 않는다.
- invalid artifact는 현재 Analyze/Design 경로에서 다시 생성한다.
- proposed artifact는 명시적 preview/apply 전 canonical root를 바꾸지 않는다.
- `af-run-manifest.json`은 requirement/root identity, 네 stage, 네 approval, validation을 모두 요구한다. parser·generator·root validator는 누락값이나 잘못된 enum을 default로 보정하지 않는다.
- apply는 stage allow-list에 등록된 파일만 처리한다. 같은 Node 프로세스의 모든 `ArtifactRootStore` 인스턴스가 공유하는 artifact-root+requirement lock 안에서 현재 proposal hash·strict schema와 모든 canonical ETag를 먼저 확인한다. conflict가 있으면 canonical 파일을 하나도 쓰지 않고 전체를 거부한다. Analyze/Design batch는 approval을 write 전에 취소하고 각 이전 bytes를 보관해 write failure를 역순 복구한다. 이 경계는 동시 HTTP/API 쓰기를 직렬화하고 in-process write failure를 복구하지만 process crash, rollback 중 storage failure, 다른 process의 직접 파일 쓰기까지 원자화하는 디스크 트랜잭션은 아니다.

### Stage Runner evidence

각 run은 `runs/<stage>/<run-id>/` 아래 request, event, summary, diff, diagnostics와 허용된 `proposed-artifacts/`를 보존한다. Analyze·Design Codex run은 실행 전후 tracked, non-ignored untracked, 개별 ignored file과 active artifact-root content를 비교해 허용 경계 밖 mutation을 실패로 기록한다. ignored directory와 `.git`·`node_modules`는 재귀 hash하지 않으며 감지한 변경을 자동 rollback하지 않는다. Build는 server primitive가 canonical `runtime-stub/`을 직접 생성하므로 diff artifact apply가 없다. Stage Runner의 process-level write lock과 workspace snapshot은 서로 다른 경계이며 둘 다 외부 process의 직접 파일 쓰기를 막는 sandbox는 아니다.

## 5. Catalog·재사용 거버넌스

Reuse Hub와 Catalog API는 세 bucket만 읽고 쓴다.

- `catalog/agents.yaml`
- `catalog/workflows.yaml`
- `catalog/tools.yaml`

Adapter나 Remote A2A bucket은 없다. A2A는 Agent entry의 `binding.kind: a2a` 또는 `exposure.protocol: a2a`다.

일반 run에서 `catalog/*.yaml`을 직접 편집하지 않는다. `POST /api/catalog/publish`는 active artifact root의 검토된 `catalog-delta.yaml` proposal과 request payload를 비교하고 `asset_type`에 맞는 bucket에 versioned entry를 기록한다. bulk seed 정비를 위한 human PR은 별도 변경으로 다룬다.

`reuse_status`는 자산 유형과 분리하며 publish된 entry는 `reuse_existing` 상태로 기록된다.

## 6. 원격 경계(A2A) 고마찰 원칙

A2A는 Agent 호출·노출 프로토콜이다. 로컬 다단계 흐름, 여러 자산의 조합, 재사용 가능성만으로 원격 경계를 만들지 않는다.

다음 정보가 검토 가능해야 한다.

- 독립 Owner와 Agent 책임
- Agent Card와 supported interface
- message/task lifecycle과 terminal state
- auth와 token handling
- timeout, retry, fallback, cancellation
- streaming과 artifact contract
- audit와 data policy

계약이 없거나 `contract_status`가 승인되지 않았으면 Runtime Handoff 실행 가능으로 표시하지 않는다. A2A task/context/interrupt ID는 runtime event, local registry, API transcript에만 두고 analysis, Graph, scaffold plan, Catalog entry, generated source에 저장하지 않는다.

Generated Remote A2A consumer는 remote error, failed/canceled/rejected task, 현재 generated consumer가 이어갈 수 없는 input-required/auth-required, usable result 없는 stream을 typed failure로 종료한다. 이 non-success 결과는 success terminal로 계속 진행하지 않는다. Reviewed `fallback_handoff`와 input/auth follow-up은 실패 메시지와 수동 handoff 문맥에만 반영하며 자동 fallback 또는 remote resume 실행 권한으로 해석하지 않는다.

## 7. 보안·비공개 경계

- private endpoint, credential, 실제 고객 데이터, 조직 전용 배포 코드를 저장소 artifact나 Catalog seed에 넣지 않는다.
- 외부 연결은 synthetic example과 환경 변수 seam으로 검토한다.
- side effect, auth, masking, audit, idempotency, compensation 요구를 runtime contract에 드러낸다.
- missing information을 추정값으로 닫지 않는다.
- Agent-owned MCP capability는 approved Tool의 exact `tool_name`을 generated allow-list로 사용한다. 같은 server의 다른 Tool을 server 승인에 포함된 것으로 간주하지 않는다.

## 8. 문서 영향 규율

interface, schema, gate, UX contract, Catalog publication 또는 운영 정책이 바뀌면 같은 변경에서 canonical 문서를 갱신하고 `docs/decision-log.md`에 결정 이력을 추가한다. 문구 정렬만으로 새 결정을 만들지 않는다.

Handbook locator는 탐색 지도다. path와 stable symbol을 현재 checkout에서 다시 열어 inputs, outputs, callers, side effects를 확인한다.

## 9. 검증 기대

문서 변경은 최소한 다음을 통과해야 한다.

```bash
git diff --check
```

또한 변경 Markdown의 상대 링크·anchor, 수정 파일 범위, strict v2 residual을 확인한다.

Artifact 계약 검증:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-directory>
```

Web/analyzer 계약 변경의 기본 검증:

```bash
cd packages/web
npm run test:analyzer
npm run build
```

Verify Stage Runner allow-list는 다음 네 command key만 허용한다. 그중 아래 굵은 두 항목이 모두 최신 `passed`이고 실패 evidence가 없어야 Verify stage가 `complete`다.

| Key | 실행 |
| --- | --- |
| **`validate_artifact_root`** | `node scripts/validate-artifacts.mjs <artifact-root>` |
| **`validate_generated_runtime`** | `node scripts/validate-generated-runtime.mjs <artifact-root>`; generated Python compile + bundle pytest/import |
| `build_web` | `npm run build` in `packages/web` |
| `test_analyzer` | `npm run test:analyzer` in `packages/web` |

`validation.commands`는 command key별 최신 exact command와 pass/fail을 누적한다. 필수 집합이 미완료이면 Verify는 `pending`, 실패가 있으면 `blocked`다. 검증 통과는 approval, live MCP/A2A network interoperability, 모든 generator pattern 지원, production readiness를 뜻하지 않는다.

## 10. Done 기준

- 요청한 artifact가 실제로 존재한다.
- 모든 analysis/scaffold root가 `contract_version: "2.0"`이다.
- 자산 유형이 Agent, Workflow, Tool뿐이다.
- Graph Node·Edge·Region과 Invocation Control이 [Graph IR](./graph-ir.md)과 일치한다.
- missing-information, runtime/A2A contract, approval gate가 닫혔다.
- Runtime Handoff가 승인된 artifact만 소비한다.
- 검증 command, 결과, 실패, 잔여 불확실성이 기록됐다.
- Catalog publish가 검토된 proposal source를 사용했다.
- unrelated edit가 포함되지 않았다.

## 11. Current source locators

2026-07-20 현재 working tree에서 아래 path와 symbol을 재확인했다.

| 행동 | Path | Stable symbol |
| --- | --- | --- |
| Stage 정의와 proposed/apply 계약 | `packages/web/server/stageRunner.ts` | `STAGE_DEFINITIONS`, `applyStageRun`, `captureWorkspaceSnapshot`, `validateCurrentProposal` |
| 화면별 stage 안내와 gate | `packages/web/src/routes/stageRunnerScreenConfig.ts` | `buildAnalyzeStageRunnerConfig`, `buildDesignStageRunnerConfig`, `buildBuildStageRunnerConfig`, `buildVerifyStageRunnerConfig` |
| artifact root allow-list, ETag와 process-level write lock | `packages/web/server/artifactRootStore.ts` | `WRITE_WHITELIST`, `runWithCanonicalWriteLock`, `ArtifactRootStore.withCanonicalWriteLock` |
| embedded analysis에서 split/scaffold 파생 | `packages/web/server/artifactSync.ts` | `DERIVED_JSON_PATHS`, `syncArtifactRoot`, `serializeDerivedArtifacts` |
| Build sync/generation/validation 순서 | `packages/web/server/artifactSyncRunApi.ts` | `handleArtifactSyncRun` |
| approval 저장·revision invalidation·scaffold PUT gate | `packages/web/server/afArtifactCrudApi.ts` | `handlePatchApprovals`, `writeAnalysisResult`, `handlePutJson` |
| Build·Verify server gate | `packages/web/server/runManifestBuild.ts`, `packages/web/server/verifyReadiness.ts` | `assertBuildApprovals`, `assertVerifyReady` |
| scaffold plan strict save | `packages/web/server/scaffoldPlanValidation.ts`, `scripts/artifact-validation/scaffold-asset-projection.mjs` | `validateScaffoldPlanWrite`, `scaffoldAssetProjectionErrors` |
| Catalog read/publish | `packages/web/server/afCatalogApi.ts` | `createAfCatalogMiddleware`, `handleCatalogPublish`, `handleCatalogIndex` |
| Catalog bucket 결정 | `packages/web/server/catalogPublishTarget.ts` | `targetCatalogFile` |
| generator strict input와 gate | `scripts/adk-source/context.mjs` | `loadArtifactContext`, `assertAssetIntegrity`, `assertRuntimeContractIntegrity`, `assertGraphReferences`, `validateRunInputs` |
