# Agent Factory 검증(Validation)

> strict Target Contract v2의 정의는 [Taxonomy](taxonomy.md), [Graph IR](graph-ir.md), [Operating Model](operating-model.md)이 소유한다. 이 문서는 문서, artifact, code, runtime, behavior evidence가 그 기준에 맞는지 검증하는 방법을 정한다.

검증은 “파일이 존재한다”와 “요청한 행동이 증명됐다”를 구분한다. 각 claim은 가능한 가장 낮은 계층의 직접 evidence로 확인하고, 실행하지 못한 검증은 이유와 잔여 불확실성을 기록한다.

## 1. 문서 단계 검증

### 1.1 Canonical 정의 중복

- Agent·Workflow·Tool과 자산 속성은 [Taxonomy](taxonomy.md)로 연결한다.
- Node·Edge·Region·Invocation Control은 [Graph IR](graph-ir.md)로 연결한다.
- stage·approval·artifact·Catalog·Handoff 규칙은 [Operating Model](operating-model.md)로 연결한다.
- 보조 문서에 독자 enum이나 변형 정의가 있으면 실패다.

### 1.2 Strict-cutover 표현

활성 문서는 현재 구현을 additive migration, dual serialization, compatibility projection, backward reader가 있는 것처럼 설명해서는 안 된다.

다음을 확인한다.

- `contract_version: "2.0"` only
- top-level asset type은 Agent, Workflow, Tool only
- analysis root는 embedded `assetCandidates`와 `graph`
- candidate/Graph split은 `asset-candidates.json`, `graph-ir.json`
- Graph Node, `control.kind`, `channel`, Region enum이 현재 source와 일치
- standalone Graph의 `workflow_ref: null`
- Invocation Control은 `workflow`, `agent` only
- Catalog bucket은 agents, workflows, tools only
- A2A는 Agent Binding/Exposure이고 category가 아님

### 1.3 지원하지 않는 입력 표현

legacy라는 단어는 제거된 입력이나 역사적 decision을 설명할 때만 사용할 수 있다. 활성 호환 동작, 자동 변환, projection이 존재한다고 쓰면 실패다. 제거된 field나 filename을 나열할 때는 “거부한다”, “지원하지 않는다”, “현재 경로에서 다시 생성한다”는 의미가 분명해야 한다.

### 1.4 Handbook locator 유효성

Handbook과 product doc의 locator는 탐색점이다. 인용할 때마다 다음을 현재 checkout에서 확인한다.

1. path가 존재하는가?
2. stable symbol이 존재하는가?
3. caller가 실제로 그 symbol을 사용하는가?
4. input/output과 write side effect가 문서 설명과 일치하는가?

삭제·rename된 파일이나 symbol이 남으면 문서 검증 실패다.

### 1.5 상대 링크와 anchor

- Markdown 상대 링크 target이 존재해야 한다.
- fragment가 있으면 target heading 또는 명시 anchor가 존재해야 한다.
- archive나 handoff를 현재 규칙의 authority로 연결하지 않는다.
- 외부 문서는 현재 저장소 구현의 증거를 대신하지 않는다.

### 1.6 수정 범위

마지막 status와 diff를 확인해 허용 파일 밖의 기존 변경과 이번 변경을 구분한다. 다른 작업자의 변경을 revert하거나 정리하지 않는다.

### 1.7 문서 검증 최소 명령

```bash
git diff --check
git status --short --untracked-files=all
```

strict-cutover residual 예:

```bash
rg -n "additive|dual serialization|compatibility projection|backward reader|legacy-only|module-candidates\.json|process-flow\.json" docs/workbench
```

검색 결과는 지원하지 않는 입력 또는 historical reference인지 문맥으로 판별한다.

## 2. Artifact·코드 검증

### 2.1 기본 검증 명령

Artifact root 또는 fixture tree:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-directory>
```

Analyzer/schema/validator agreement와 회귀:

```bash
cd packages/web
npm run test:analyzer
```

TypeScript/React/server bundle:

```bash
cd packages/web
npm run build
```

명령 통과가 의미하는 범위를 과장하지 않는다. Artifact validation은 approval, 모든 generator lowering, runtime behavior 또는 production readiness의 증거가 아니다.

### 2.2 Verify 화면 allow-list

| Command key | 실행 |
| --- | --- |
| `validate_artifact_root` | `node scripts/validate-artifacts.mjs <artifact-root>` |
| `build_web` | `npm run build` in `packages/web` |
| `test_analyzer` | `npm run test:analyzer` in `packages/web` |

임의 shell command를 Verify allow-list로 간주하지 않는다. allow-list의 현재 권위는 `packages/web/server/afVerifyRunApi.ts`의 `VERIFY_COMMANDS`다.

## 3. Artifact root 검증

기본 root는 `artifacts/af/<req-id>/`다.

### 3.1 Manifest와 canonical analysis

- `af-run-manifest.json`이 requirement ID, stage, approvals, validation state를 보존한다.
- `analysis-result.json.contract_version`은 정확히 `"2.0"`이다.
- root key는 `normalizedRequirement`, `evidence`, `assetCandidates`, `a2aContracts`, `runtimeContracts`, `graph`와 version뿐이다.
- unknown field와 제거된 field는 오류다.
- 모든 candidate와 Graph의 `source_requirement_id`가 `normalizedRequirement.id`와 일치한다.
- candidate ref와 runtime/A2A `contract_id`가 중복되지 않는다. non-null runtime contract `asset_id`는 실제 candidate를 가리키고, Agent의 A2A `contract_ref`는 그 Agent 자신을 `agent_ref`로 소유한 계약을 가리킨다.

### 3.2 Split artifact

- `asset-candidates.json`은 embedded `assetCandidates`와 같은 값이다.
- `graph-ir.json`은 embedded `graph`와 같은 값이다.
- `normalized-requirement.json`은 schema-valid하며 embedded `normalizedRequirement`과 같은 값이다.
- 후보 split 또는 Graph split에 다른 filename을 허용하지 않는다.
- A2A 계약은 `analysis-result.json.a2aContracts`에만 저장한다. split `a2a-contracts.json`은 API read/write allow-list에도 없으며 거부한다.
- artifact sync 전후 drift status와 실제 write inventory가 일치해야 한다.

### 3.3 Graph artifact

- `node_kind`는 `input`, `agent`, `tool`, `function`, `human_input`, `subworkflow`, `join`, `output` 중 하나다.
- 각 Node variant의 required/allowed field가 정확하다.
- `from`, `to`, Region node ref, `parent_region_id`가 dangling하지 않는다.
- `control.kind`와 `channel`이 [Graph IR](graph-ir.md#edge-계약)의 enum과 일치한다.
- Region `kind`는 `parallel`, `loop`뿐이다.
- root `workflow_ref`가 non-null이면 Workflow asset을 참조하고 standalone이면 `null`이다.
- Agent/Tool/Subworkflow ref가 해당 `asset_type`과 일치한다.
- Agent available Tool은 `invocation_control: agent`, Tool Node는 `invocation_control: workflow`다.

### 3.4 Scaffold plan

- `contract_version: "2.0"`, `source: approved_workbench_artifact`, `raw_requirement_to_code: false`다.
- `assets`는 canonical analysis의 approved candidate와 byte-shape 수준으로 일치한다.
- `graph`와 `runtime_contracts`가 approved analysis와 drift하지 않는다.
- `excluded_assets`, blocker, warning이 candidate·contract·Graph 상태와 일치한다.
- generator는 `analysis-result.json`과 `scaffold-plan.json`에서 candidate·contract·Node·Edge·Region identity와 reference를 각각 직접 검증한 뒤 두 artifact의 승인 계약 parity를 확인한다.

## 4. Stage Runner evidence 검증

한 run은 `runs/<stage>/<run-id>/` 아래 request, summary, events, diagnostics, diff와 허용된 proposal을 보존한다.

- Analyze proposal inventory: `analysis-result.json`
- Design proposal inventory: `analysis-result.json`, `boundary-design.md`
- Build proposal inventory: 없음; server primitive가 canonical `runtime-stub/`을 쓴다.
- Verify proposal inventory: `validation-report.md`, `catalog-delta.yaml`

Analyze와 Design의 proposed `analysis-result.json`은 apply 전에 parse와 strict validation을 통과해야 한다. apply는 process-global requirement write lock 안에서 등록된 파일, current proposal hash/schema와 모든 base ETag를 검사한 뒤 쓴다. conflict는 batch write 전에 거부한다. 이는 server-process 동시성 보장이지 process crash나 직접 filesystem writer에 대한 rollback 트랜잭션은 아니다. run 또는 apply가 approval을 대신하지 않는다.

실패한 Verify run은 통과로 보고하지 않는다. 적용 가능한 실패 report가 있더라도 `validation.ok=false`, exit code, stderr, residual uncertainty를 유지한다.

## 5. Scaffold와 Runtime Handoff 게이트 검증

다음을 모두 확인한다.

- `analysis_reviewed`, `boundaries_approved`, `runtime_contracts_approved`가 실제 manifest에 true다.
- included candidate가 `approved`이고 unresolved missing information이 없다.
- runtime/A2A contract가 필요한 상태와 승인 상태를 충족한다.
- Graph validation error가 없다.
- scaffold plan `validation.can_generate_source`가 true다.
- generator 입력의 candidate·Graph·runtime contract가 canonical analysis와 일치한다.

Runtime Handoff는 production deployment가 아니다. compile/import, selected pattern test, synthetic smoke 또는 live local proof 중 실제 실행한 것만 주장한다.

## 6. Validation report와 Catalog 제안

`validation-report.md`에는 최소한 다음을 남긴다.

- 검증 대상과 source snapshot
- 실행 command
- pass/fail 결과와 핵심 출력
- 재현 가능한 failure
- residual uncertainty
- feedback destination

`catalog-delta.yaml`은 검토 proposal이다. `POST /api/catalog/publish`가 active root의 proposal과 request를 field별로 비교한 뒤 Agent, Workflow, Tool bucket 중 하나에 기록한다. Catalog YAML 직접 편집으로 publish gate를 우회하지 않는다.

## 7. 완료 체크리스트

- 요청 결과가 실제 파일·행동으로 존재한다.
- strict v2 shape와 enum이 current source와 일치한다.
- backward conversion 또는 projection을 성공 경로로 설명하지 않았다.
- source locator path와 symbol을 현재 checkout에서 재확인했다.
- exact verification command와 결과를 기록했다.
- 수정 범위 밖 변경을 건드리지 않았다.
- 남은 불확실성을 명시했다.

## 8. Current source locators

2026-07-19 현재 working tree에서 다음을 재확인했다.

| 검증 표면 | Path | Stable symbol |
| --- | --- | --- |
| strict JSON tree validator | `scripts/validate-artifacts.mjs` | `validateAnalysis`, `validateSplitParity`, `validateAssetList`, `validateGraph`, `validateScaffoldPlan`, `rejectRemovedRecursive` |
| enum agreement | `scripts/artifact-validation/constants.mjs` | exported strict v2 sets |
| analysis runtime assertion | `packages/web/src/analyzer/targetContract.ts` | `validateTargetAnalysisResult`, `validateA2AReferences`, `validateRuntimeContracts`, `assertTargetAnalysisResult` |
| Graph validation | `packages/web/src/analyzer/graphValidation.ts` | `validateGraphIR` |
| Stage proposal validation/apply | `packages/web/server/stageRunner.ts` | `buildDiffSummary`, `applyStageRun` |
| Verify allow-list | `packages/web/server/afVerifyRunApi.ts` | `VERIFY_COMMANDS`, `normalizeVerifyCommandKey`, `verifyCommandArgv` |
| generator read/gate | `scripts/adk-source/context.mjs` | `loadArtifactContext`, `assertAssetIntegrity`, `assertRuntimeContractIntegrity`, `assertGraphReferences`, `validateRunInputs` |
