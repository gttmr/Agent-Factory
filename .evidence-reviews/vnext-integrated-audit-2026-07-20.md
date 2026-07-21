# Agent Factory vNext 통합 점검 상세 Finding 기록

> 2026-07-21 closure 상태: 신규 Blocker `AFV2-031`, `AFV2-032`, `AFV2-033`은 모두 Fixed이며 open Blocker는 0건이다. Product/runtime matrix는 검증한 local/synthetic 범위에서 review-ready다. `AFV2-014` Moderate partial은 별도로 남는다. 최종 판정은 `docs/reviews/2026-07-20-vnext-audit.md`, fresh proof는 `.evidence-reviews/vnext-blocker-closure-2026-07-21.md`를 따른다.
> 감사 기준 시각: 2026-07-20 (Asia/Seoul)
> 감사 지시서: `agent-factory-vnext-integrated-audit-work-order.md`

## 1. Snapshot

- Repository: `/home/ilmaswsl/work/Agent-Factory`
- Branch: `main`
- BASE_REF: `0cdcb829480def3c0a8ba4afdefb37913721f6d2` (`origin/main`, ahead 0 / behind 0)
- Worktree HEAD: `0cdcb829480def3c0a8ba4afdefb37913721f6d2`
- HEAD subject: `docs(sync)+test(skills): 커밋 후 문서 재동기화 + 시나리오 forward 전수 증거`
- Staged changes: 없음
- Baseline unstaged tracked changes: 463개 (`+12,751 / -53,708`)
- Baseline untracked entries: 55개
- Baseline patch ownership: 감사 시작 전에 존재하던 사용자 소유 변경으로 간주하며 되돌리거나 정리하지 않는다.
- Remote push: 수행하지 않음
- Reviewer environment: Codex, bash, WSL/Linux, repository root

## 2. Audit write boundary

- 감사 중 지속 기록: `.evidence-reviews/vnext-integrated-audit-2026-07-20.md`
- Finding 보완이 확정되기 전 제품·문서·Skill·Schema 파일: read-only
- Finding 확정 후 수정: 해당 Root Finding과 직접 연결된 최소 파일만 허용
- 제외: `docs/archive/**`, `docs/handoff/**`, 기존 사용자 소유 삭제/변경의 임의 복원, remote push, production endpoint/credential

## 3. Source of Truth map

| Concept | Target source | Skill source | Serialization / Current source | UI / Runtime source | Test / Handbook source | Initial status |
|---|---|---|---|---|---|---|
| Asset Type | `docs/workbench/taxonomy.md` | `.agents/skills/_shared/taxonomy.md`, `target-contract-v2.md` | `schemas/asset-candidate.schema.json`, `packages/web/src/analyzer/targetContract.ts` | analyzer/catalog/UI consumers, generator asset lowering | validator parity tests, Handbook Analyze/Design | 조사 중 |
| Graph Node / Edge | `docs/workbench/graph-ir.md` | `.agents/skills/_shared/graph-ir.md` | `schemas/graph.schema.json`, analyzer Graph types | Graph editor, scaffold projection, generator lowering | graph/analyzer/generator tests, Handbook Design | 조사 중 |
| Invocation Control | `docs/workbench/graph-ir.md` | `_shared/target-contract-v2.md` | Graph schema + analyzer types | Graph UI + Agent/Tool emitters | parity and generated behavior tests | 조사 중 |
| Binding / A2A | Taxonomy + Graph IR | runtime pattern cards | asset/A2A schemas and contracts | Design UI, Mock Lab, generator/runtime | analyzer/runtime tests + Handbook | 조사 중 |
| Approval | `docs/workbench/operating-model.md` | `_shared/lifecycle-invariants.md` | manifest schema + server validation | Stage Runner / build readiness | server tests + Handbook Registers | 조사 중 |
| Runtime patterns | active ADK references + installed package | `_shared/adk/*.md` | runtime contracts / scaffold plan | generator + generated runtime | runtime smoke/evidence + Handbook | 조사 중 |

## 4. Initial decisions

### D-01 Audit evidence path

- Decision: 기존 관례인 `.evidence-reviews/`에 하나의 증분 보고서를 유지한다.
- Alternatives considered: ignored `artifacts/af-audit/<timestamp>/`, 새 `docs/reviews/` 문서.
- Evidence: 저장소에 B2/B4/C1-C6 등 `.evidence-reviews/*.md` 감사 기록이 이미 존재한다.
- Why chosen: 기존 관례를 따르면서 실행 중 Finding과 최종 보고를 같은 durable file에 유지한다.
- Impact: 이 파일만 첫 Pass의 유일한 write다.
- Residual risk: `.evidence-reviews/`가 현재 untracked이므로 최종 반영 여부는 사용자가 결정해야 한다.

### D-02 Comparison base

- Decision: `BASE_REF`와 Worktree HEAD를 모두 `0cdcb829...`로 고정하고, 현재 unstaged/untracked 전체를 vNext 통합 후보 상태로 감사한다.
- Alternatives considered: Remote의 별도 과거 commit, 문서/Skill/Code별 중간 commit.
- Evidence: `HEAD == origin/main`, ahead/behind `0/0`; 지시서는 remote보다 현재 local diff를 우선한다.
- Why chosen: 감사 대상은 commit 간 차이가 아니라 현재 로컬 통합 상태다.
- Impact: 기존 463개 tracked 변경과 55개 untracked entry를 모두 잠재 검토 범위로 취급한다.
- Residual risk: 여러 선행 작업의 소유 경계가 diff 자체에 표시되지 않으므로 Finding과 무관한 변경은 수정하지 않는다.

### Safety invariant evidence (pre-fix)

| Invariant | Fresh/current evidence | Pre-fix disposition |
|---|---|---|
| Proposed-first | `stageRunner.test.ts:99-114`, `:174-190`은 Analyze/Design 결과가 run별 `proposed-artifacts/`에만 쓰이고 canonical artifact·승인 상태가 즉시 바뀌지 않음을 독립 확인 | Pass |
| Approval Source of Truth | `afArtifactsApi.streaming.test.ts:257-307`은 타입 오류·unknown gate·선행 승인 생략·runtime-stub 없는 follow-up 승인을 차단하고 하위 승인을 연쇄 무효화 | Pass |
| Raw requirement / unapproved Build gate | `stageRunner.test.ts:524-543` 및 `artifactSyncRoute.test.ts:33-55`은 승인 없는 Build/Sync가 primitive·command·artifact write 전에 중단됨을 확인 | Pass |
| Artifact revision invalidation | `afArtifactsApi.streaming.test.ts:322-387`은 Design/Analyze 변경 시 후속 승인·Build·Verify 상태가 단계별로 무효화됨을 확인 | Pass |
| Concurrent apply | `stageRunner.test.ts:670-753`은 stale ETag와 batch preflight 이후 race를 conflict/atomic write로 처리 | Pass |
| Server-owned validation | `afArtifactsApi.streaming.test.ts:310-319`은 클라이언트가 validation pass 상태를 위조하는 endpoint를 허용하지 않음 | Pass |

## 5. Findings

## AFV2-001 승인 자산이 없는 Graph를 Scaffold-ready로 오판한다

- Severity: Blocker
- Behavior: strict v2 분석 artifact가 승인 자산 없이 다단계 Function Graph를 포함해도 schema·validator·Graph validator를 통과하고, `buildScaffoldPlan`은 `can_generate_source: true`를 반환한다. 실제 generator는 같은 plan을 `at least one approved asset` 조건으로 거부한다.
- Layer: Taxonomy ↔ Graph IR ↔ Schema/Types ↔ Scaffold Plan ↔ Generator ↔ active regression fixtures
- Expected: 실행 Graph는 standalone Agent/Tool 또는 owning Workflow 자산에 연결되어야 하며, 승인 자산이 0개이면 Scaffold Readiness가 false여야 한다. Function Node는 부모 Workflow 내부 단계다.
- Actual: `assetCandidates: []`, `workflow_ref: null`, Function Node를 가진 `scenario-c-rule-based-routing`이 root validator를 통과한다. 동일 입력으로 `buildScaffoldPlan(..., outputMode: "runnable")`을 실행한 fresh probe 결과는 `asset_count: 0`, `can_generate_source: true`, `blockers: []`다. 반면 generator는 승인 자산 1개 이상을 요구한다.
- Evidence:
  - Target: `docs/workbench/graph-ir.md:5`, `:14-16`, `:35`, `:54-56`; `docs/workbench/taxonomy.md:29`, `:194-197`
  - Contract gap: `schemas/analysis-result.schema.json`의 `assetCandidates`에 `minItems` 또는 readiness 의미가 없고, `packages/web/src/analyzer/targetContract.ts:280-329`은 빈 배열을 허용한다.
  - Graph gap: `packages/web/src/analyzer/graphValidation.ts:17-45`는 root ownership과 실행 Node 의미를 교차 검증하지 않는다.
  - Readiness gap: `packages/web/src/analyzer/scaffoldPlan.ts:25-43`, `:81-85`는 `assets.length === 0`을 blocker로 만들지 않는다.
  - Runtime contradiction: `scripts/adk-source/context.mjs:122-130`은 빈 approved asset plan을 거부한다.
  - Active fixture: `templates/regression-scenarios/scenario-c-rule-based-routing/analysis-result.json`은 빈 `assetCandidates`, `workflow_ref: null`, Function route Node를 함께 가진다. 같은 형태가 scenario G/L에도 있다.
  - Fresh reproduction: repository root validator PASS 후, packages/web loader로 scenario C를 `buildScaffoldPlan`에 전달했을 때 `{ asset_count: 0, can_generate_source: true, blockers: [] }` 관찰.
- Files / Symbols: `buildScaffoldPlan`, `validateTargetAnalysisResult`, `validateGraphIR`, `assertStrictScaffoldPlan`, scenario C/G/L fixtures 및 관련 tests.
- User impact: UI가 생성 가능으로 표시한 plan이 Build에서 실패하며, Workflow가 필요한 요구를 자산 없는 Graph로 승인할 수 있다. 문서의 Agent/Workflow/Tool 계약과 runtime gate가 반대 의미를 갖는다.
- Root cause hypothesis: strict shape 검증과 cross-artifact semantic readiness 검증이 분리되는 과정에서 “승인 자산 최소 1개”와 “private/control Node의 owning Workflow” 불변조건이 Scaffold Plan 쪽에 구현되지 않았고, graph-only 과거 regression fixture가 strict v2 shape로만 변환됐다.
- Recommended direction: 우선 `buildScaffoldPlan`과 server-side plan validation에 승인 자산 0개 fail-closed blocker를 추가한다. 이어 no-Workflow Graph에 허용할 standalone shape를 canonical 문서 기준으로 명시하고, Function/Subworkflow/명시 control 구조의 owning Workflow invariant를 shared semantic validator로 고정한다. 활성 fixtures는 의미에 맞는 Workflow 자산·root ref를 갖게 하거나 명시적 unsupported/blocked fixture로 바꾼다.
- Verification after fix: 빈 approved asset plan negative test, Function Node + null owner negative test, standalone Agent positive test, schema/analyzer/root-validator parity, scenario C/G/L validator disposition, web build, generator tests.
- Status: Fixed — scaffold planning은 approved Asset 최소 1개, 모든 typed Graph ref의 approved projection/type, standalone ownership invariant를 검증한다. 빈 plan·dangling/deferred/wrong-type ref·Workflow-required standalone 음성 및 standalone Agent 양성 case를 고정했다.

## AFV2-002 필수 Runtime Contract가 없어도 runnable 승인이 성립한다

- Severity: Blocker
- Behavior: MCP, write side effect, 사람 승인, 외부 메시지 경계가 필요한 자산도 `runtimeContracts: []`이면 supplied-contract 검사 루프가 비어 있는 채 생성 가능 판정을 받는다.
- Expected / Actual: Target은 선택된 runtime boundary별 계약 존재·승인을 요구하지만, Current의 `buildScaffoldPlan`과 generator는 “존재하는 계약이 승인됐는지”만 검사하고 “필요한 계약이 존재하는지”를 검사하지 않는다.
- Evidence: `packages/web/src/analyzer/runtimeContracts.ts:48-58`은 자산·요구에서 필요한 kind를 이미 도출하지만 `scaffoldPlan.ts:20`, `:38`은 이를 사용하지 않는다. `scripts/adk-source/context.mjs:258-281`도 supplied set만 검사한다. `target-behavior-matrix.test.mjs:555` 부근 fixture는 MCP/A2A 자산과 빈 계약 배열을 함께 ready로 둔다.
- Root cause / impact: approval을 required-contract completeness가 아닌 optional collection의 상태 검사로 모델링해 auth·timeout·retry·idempotency·compensation·resume 경계를 우회한다.
- Recommended direction / verification: approved assets와 Graph 의미에서 필요한 계약 key를 도출해 plan과 generator에서 각각 fail-closed하고 MCP/write/human approval/external message/A2A missing-contract negative test를 추가한다.
- Status: Fixed — analyzer와 generator가 MCP, HTTP/A2A, write, human approval, external message 경계별 required contract key를 독립적으로 도출해 exactly-once approved/complete coverage가 없으면 차단한다.

## AFV2-003 동적 control edge가 일반 순서 edge로 의미 소실된다

- Severity: Blocker
- Behavior: `retry`, `fallback`, `error`, `callback`, `resume`, `cancel`, `timeout`이 dynamic mode에서 지원되는 것처럼 등록되지만 실제 lowerer는 metadata만 복사하고 downstream은 precedence/input 관계로만 실행한다.
- Expected / Actual: Target의 callback·retry·timeout·cancel·failure 의미는 실제 hook/control behavior여야 한다. Current는 `scripts/adk-source/dispatch/edge-controls.mjs:5-30`, `:119`에서 공통 transition으로 낮추고 `graph/dynamic.mjs:91`, `:530`에서 일반 ordering으로 소비한다.
- Root cause / impact: semantic 이름 등록과 runtime 구현이 분리되어 guard·재시도·fallback·timeout·중단·resume를 조용히 누락한 실행물을 만든다.
- Recommended direction / verification: per-kind runtime lowerer가 없는 control은 runnable에서 fail-closed한다. 각 unsupported kind negative generation test와, 추후 지원 시 callback Continue/Override 및 각 failure outcome behavior test를 요구한다.
- Status: Fixed as fail-closed — 구현되지 않은 `retry/fallback/error/callback/resume/cancel/timeout`은 static·dynamic runnable 생성 모두 명시적으로 거부한다.

## AFV2-004 Verify가 단일 비-runtime 명령으로 complete 된다

- Severity: Blocker
- Behavior: web build, analyzer test, 구조 artifact validation 중 하나만 성공해도 Verify stage가 `complete`가 되고 기존 command ledger를 한 항목으로 교체한다.
- Expected / Actual: Verify는 생성 bundle의 compile/import/runtime 및 선택 pattern evidence를 구분·누적해야 한다. Current allowlist `packages/web/server/afVerifyRunApi.ts:8-21`에는 generated-runtime check가 없고, `manifestValidation.ts:21-45`는 한 결과로 complete/blocked를 덮어쓴다. `verifyReadiness.ts`는 runtime-stub 비어 있지 않음까지만 확인한다.
- Root cause / impact: Verify를 required claims 집합이 아니라 마지막 command status로 모델링해 runtime을 실행하지 않고도 완료 인증이 가능하다.
- Recommended direction / verification: output mode와 selected pattern별 required checks를 정의해 누적하고 전부 통과할 때만 complete로 만든다. `build_web` 단독 성공과 generated-runtime 실패가 complete를 만들 수 없음을 server test로 증명한다.
- Additional UI evidence: `stageRunnerScreenConfig.ts:217-241`은 `disabledReason: null`을 고정하고 `VerifyWorkbench.tsx:46`은 Build/handoff/stub readiness를 config에 전달하지 않는다. 따라서 server가 409로 거부할 revoked/incomplete root에서도 Run control이 actionable이다.
- Additional fix/verification: manifest Build status와 handoff approval, runtime-stub presence에서 visible disabled reason을 도출하고 revoked/incomplete/empty/ready component·API case를 검증한다.
- Status: Fixed — UI/server readiness를 정렬하고, manifest command ledger는 항목별 최신 pass/fail을 누적한다. `validate_artifact_root`와 `validate_generated_runtime`이 모두 통과하고 실패 evidence가 없을 때만 Verify complete가 된다. generated-runtime 명령은 생성 Python 전체를 무변경 compile하고 bundle pytest의 계약·ADK import를 실행한다. Catalog delta도 이 집합을 통과한 최신 Verify run에서만 적용된다.

## AFV2-005 승인된 MCP transport가 HTTP로 바뀐다

- Severity: Major
- Behavior: `connection.transport: stdio`를 허용·보존하지만 Agent/Workflow emitter 모두 Streamable HTTP로 생성한다.
- Expected / Actual: transport는 승인 계약대로 보존하거나 unsupported로 차단해야 한다. Schema는 `schemas/asset-candidate.schema.json:139`에서 `stdio|http`를 허용하지만 `scripts/adk-source/tools.mjs:3`은 binding만 보고, `emitters/agent-node.mjs:24`와 `emitters/connected-tool.mjs:22`는 HTTP만 emit한다.
- Root cause / impact: transport가 emitter dispatch에 참여하지 않아 생성 코드가 승인 연결 계약과 달라지고 stdio server에 연결할 수 없다.
- Recommended direction / verification: transport-aware emission 또는 명시적 fail-closed를 적용하고 두 invocation owner × HTTP/stdio를 생성·실행 검증한다.
- Status: Fixed as fail-closed — generator는 명시적 HTTP MCP만 지원하고 Workflow/Agent invocation owner 모두 stdio/unknown transport를 거부한다.

## AFV2-006 선택하지 않은 A2A exposure가 모든 bundle에 추가된다

- Severity: Major
- Behavior: A2A exposure가 없는 local workflow에도 Agent Card, provider launcher, A2A 문서·test가 생성된다.
- Expected / Actual: `_shared/runtime-pattern-selection.md:51-60`은 선택하지 않은 pattern의 file/dependency/endpoint/hook 부재를 요구한다. Current `scripts/adk-source/file-builder.mjs:78-124`는 `agent.json`, `af_adk_a2a_server.py` 등을 unconditional 생성하고 `support/readme.mjs:73`은 provider 노출 안내를 항상 쓴다.
- Root cause / impact: provider capability를 승인된 exposure가 아닌 bundle default로 모델링해 local-only 설계에 미승인 network protocol boundary를 추가한다.
- Recommended direction / verification: 명시적 approved A2A exposure일 때만 provider/card/test/docs를 emit하고 no-exposure·consuming-only 음성 fixture와 exposure provider smoke를 분리한다.
- Status: Fixed — provider 파일·Agent Card·문서·test는 approved A2A exposure가 있을 때만 생성하며 no-A2A와 consuming-only bundle에는 부재함을 실제 ADK import test로 검증했다.

## AFV2-007 Dynamic loop가 임의 3회 정책과 정상 종료를 발명한다

- Severity: Major
- Behavior: 모든 dynamic loop를 3회로 제한하고 exhaustion을 state flag+break로 처리한 뒤 terminal output으로 진행한다.
- Expected / Actual: loop bound·exit·exhaustion은 승인 artifact에서 와야 하고 failure가 명시되어야 한다. Current `scripts/adk-source/agent-dynamic.mjs:15`, `:118`은 3회를 hard-code하고 `graph/dynamic.mjs:753`은 default 부재를 `loop_exit`로 바꾼다.
- Root cause / impact: Graph IR이 표현하지 않는 business policy를 generator가 공급해 정상 workflow를 조기 종료하거나 exhaustion을 성공처럼 보이게 한다.
- Recommended direction / verification: approved bound/exhaustion contract를 표현·소비하기 전에는 runnable loop를 차단한다. 임의 bound 부재, missing default, exhaustion failure/cancel negative test를 추가한다.
- Status: Fixed as fail-closed — Graph IR에 승인된 bound/exhaustion 계약이 없으므로 dynamic loop runnable 생성을 거부하고 임의 3회 정책을 제거했다.

## AFV2-008 Route 불일치가 첫 작성 branch를 실행한다

- Severity: Major
- Behavior: condition match와 default가 모두 없으면 generated route가 첫 branch/case를 선택한다.
- Expected / Actual: route default 또는 unmatched/error 결과는 명시적이고 edge ordering과 무관해야 한다. Current `scripts/adk-source/emitters/route-function.mjs:31`, `:158`은 positional fallback을 사용하고 `graph/guards.mjs:23`은 multiple default만 막는다.
- Root cause / impact: emitter 편의값이 검토되지 않은 업무 default가 되어 unknown 값이 잘못된 branch를 실행하고 edge 순서에 따라 행동이 바뀐다.
- Recommended direction / verification: 정확히 하나의 explicit default 또는 unmatched/error contract를 요구하고 no-default rejection, unknown value, edge-order invariance test를 추가한다.
- Status: Fixed as fail-closed — condition route는 명시적 default/unmatched 계약이 없으면 runnable 생성을 거부한다.

## AFV2-009 ADK 호환 범위가 검증 기준보다 넓다

- Severity: Moderate
- Behavior: `requirements/adk-runtime.txt`는 `google-adk>=2.1.0` 전체를 허용하지만 구현·test·private-source patch는 2.2/2.3 API를 전제로 한다.
- Expected / Actual: version-specific API 가정은 지원 범위와 함께 검증돼야 한다. Current A2A compatibility patch는 source needle이 맞지 않으면 조용히 no-op하며, local 2.3.0에서는 해당 needle이 확인되지 않았다.
- Root cause / impact: tested baseline과 dependency range가 결합되지 않아 fresh install이 미검증 버전을 선택하고 import/signature/A2A drift를 늦게 드러낼 수 있다.
- Recommended direction / verification: 검증된 범위로 pin하거나 startup version/signature gate를 두고 최소·최대 지원 버전에서 generated runtime/A2A startup을 검증한다.
- Status: Fixed — dependency를 실제 검증한 `google-adk[a2a,mcp]>=2.3.0,<2.4.0` line으로 제한했다.

## AFV2-010 Compose Skill이 standalone Graph envelope를 생략하도록 안내한다

- Severity: Major
- Behavior: `af-compose-solution`은 standalone Agent/Tool에 “Graph 없음”을 안내하고 필요할 때만 Graph를 조립한다.
- Expected / Actual: strict v2 `analysis-result.json`에는 항상 6-field Graph가 필요하고 standalone은 `workflow_ref: null`이다. `af-compose-solution/SKILL.md:83-96`의 안내가 `schemas/analysis-result.schema.json:7`, `graph.schema.json:7`, canonical `graph-ir.md:24-35` 및 strict parser와 충돌한다.
- Root cause / impact: owning Workflow 없음과 serialized Graph 없음이 혼동되어 Skill을 문자 그대로 실행하면 schema-invalid proposal을 만들 수 있다.
- Recommended direction / verification: 문구를 “owning Workflow 없음”으로 바꾸고 strict v2 write에는 standalone envelope를 요구한다. standalone Agent proposal을 validator/parser로 검증한다.
- Status: Fixed — standalone을 no-owning-Workflow로 구분하고 strict v2 write에는 `workflow_ref: null` Graph envelope를 명시했다.

## AFV2-011 Compose의 Missing Information stop과 defer가 충돌한다

- Severity: Moderate
- Behavior: 후보별 approve/defer/reject를 요구하면서 Stop Conditions는 후보 Missing Information이 남으면 phase 구분 없이 중단한다.
- Expected / Actual: unresolved 후보는 `needs_info|deferred`와 blocker를 가진 Design 결과로 기록할 수 있으나 approval·handoff·scaffold는 차단돼야 한다. `af-compose-solution/SKILL.md:31`, `:73`, `:239-246`과 `_shared/missing-information.md:15-43`의 단계 의미가 충돌한다.
- Root cause / impact: Scaffold hard gate가 lifecycle 전체 stop으로 복제돼 에이전트마다 deferred artifact를 쓰거나 아예 중단하는 비결정적 결과가 난다.
- Recommended direction / verification: Compose는 Not Ready design 기록을 허용하고 downstream만 명시 차단한다. missing-info fresh scenario가 valid deferred proposal을 남기되 approval/handoff를 만들지 않음을 검증한다.
- Status: Fixed — Compose는 deferred/needs-info Not Ready proposal을 기록하고 approval·handoff·scaffold 전에 중단하도록 phase를 명시했다.

## AFV2-012 Handbook locator 집계와 snapshot이 동기화되지 않았다

- Severity: Moderate
- Behavior: Index, Coverage, 8개 stage card의 active locator 수가 서로 다르고 README는 제거된 shim→canonical locator scope를 현재형으로 설명한다.
- Expected / Actual: current stage files 직접 집계는 request 4, analyze 6, design 7, build 11, verify 6, catalog 8, runtime 8, mock 8, 총 58이다. Index와 Coverage는 일부 subtotal 및 total 57을 보고한다.
- Evidence: `docs/handbook/index.md:6-11`, `coverage.md:20-28`, `:70`, `stages/runtime-handoff-build.md:189`, `README.md:34-41`.
- Root cause / impact: 2026-07-20 locator 추가·shim 제거 뒤 aggregate table을 재계산하지 않아 “전수 reverified” 신뢰성을 훼손한다.
- Recommended direction / verification: stage card에서 한 번 재집계하고 Index/Coverage/README snapshot을 맞춘 뒤 자동 count와 subtotal/total 일치를 확인한다.
- Status: Fixed — 8개 stage card의 active count `4/6/7/11/6/8/8/8 = 58`로 Index·Coverage를 맞추고 snapshot을 2026-07-20 canonical five-skill 기준으로 갱신했다.

## AFV2-013 active Design locator가 제거된 callee를 가리킨다

- Severity: Major
- Behavior: Handbook `Design mutation actions`가 current source에 없는 `applyNodeReviewStatus`를 active callee로 열거한다.
- Expected / Actual: locator symbol은 source에 resolve돼야 하고 candidate status를 strict Graph review status로 투영하지 않아야 한다. 실제 `createDesignWorkbenchActions`는 현재 analysis-save/prune/A2A helper만 사용한다.
- Evidence: `docs/handbook/stages/design-boundary-contract.md:111-121`, `packages/web/src/routes/design/designWorkbenchActions.ts:1-100`, `docs/workbench/review-board.md:66-71`.
- Root cause / impact: retired status-projection callee가 locator에 남아 maintainer를 존재하지 않고 계약상 부적절한 edit site로 안내한다.
- Recommended direction / verification: stale symbol을 실제 current helper 목록으로 교체하고 active locator의 symbol resolution을 전수 확인한다.
- Status: Fixed — nonexistent symbol을 current save/prune/catalog/A2A helper로 교체하고 source에서 재확인했다.

## AFV2-014 Migration 완료 주장이 superseded Skill/fixture evidence에 의존한다

- Severity: Moderate
- Behavior: migration status는 forward 16/16을 완료 증거로 제시하지만 해당 실행은 shim 포함 tree, S07/S11 stop path, legacy S16을 대상으로 했다.
- Expected / Actual: final canonical five-skill tree와 현재 positive-path S07/S11, canonical-direct S16을 fresh-session에서 검증해야 한다. `docs/migration/skill-vnext-status.md:135-149`의 claim과 `tests/skills/evidence/*/forward-2026-07-18.md`의 실제 대상이 다르다.
- Root cause / impact: strict-cutover와 fixture 교체 뒤 behavior evidence를 갱신하지 않아 trigger·progressive disclosure·A2A/HITL positive path confidence를 과장한다.
- Recommended direction / verification: 기존 evidence를 historical로 표시하고 최종 target revision에서 rubric 비노출, isolated fixture, S07/S11 positive artifact, S16 direct canonical routing을 fresh-run한다.
- Status: Partially fixed — 2026-07-18/19 결과를 historical evidence로 명시해 current 완료 claim에서 제외했다. Current isolated S16 canonical-direct는 5/5와 no-write를 통과했다. 2026-07-21 S11 rerun은 evaluator 11/11과 Product/runtime stable resume·expiry·at-most-once를 통과했지만, explicit scaffold 요청이 `af-workflow`를 먼저 읽고 transient probe가 output root 밖에 생성됐으며 mandatory reference read 증거가 불완전했다. 따라서 Product `AFV2-031`은 닫았지만 `AFV2-014`와 current 16-scenario 완료 claim은 열어 둔다.

## AFV2-015 unresolved 자산이 승인·Scaffold gate를 통과한다

- Severity: Blocker
- Behavior: Tool의 `binding.kind: unresolved`, `connection.transport: unknown`, 빈 `missing_information`, `status: approved` 조합이 schema와 strict TypeScript validator를 통과하고 `approveCandidate` 및 `buildScaffoldPlan`도 승인/생성 가능으로 판정한다.
- Expected / Actual: Target은 unresolved를 `needs_info`와 Missing Information으로 드러내고 downstream을 차단해야 한다. Current는 binding/transport/workflow representation, status, missing array를 독립 필드로만 검사한다.
- Evidence: `schemas/asset-candidate.schema.json:53`, `:116`, `:143`; `targetContract.ts:304-319`; `assetReview.ts:15`; `scaffoldPlan.ts:27-38`; manifest approval PATCH는 `afArtifactCrudApi.ts:92-115`에서 boolean hierarchy만 본다. Fresh probe는 schema/Target errors `[]`, approval status `approved`, plan ready `true`를 재현했다.
- Root cause / impact: 공통 semantic-readiness predicate가 없어 unresolved 계약을 승인 진실원본과 생성 입력으로 승격할 수 있다.
- Additional Catalog evidence: Reuse Hub의 unresolved Tool/Workflow default (`RegisterProposalDrawer.tsx:65`)를 publish UI와 server가 shape-valid로 받아 `catalogPublishEntry.ts`에서 `published`/`reuse_existing`으로 승격한다. Fresh API probe는 unresolved Tool publish HTTP 200과 `catalog/tools.yaml` write를 재현했다.
- Recommended direction / verification: 하나의 readiness 규칙을 schema/strict validator/review/approval PATCH/plan 및 server-side Catalog publish에 적용한다. unresolved Binding, unknown Transport, unresolved Workflow representation/policy가 approved·Design approval·source readiness·Catalog publication으로 갈 수 없음을 검증한다.
- Status: Fixed — shared semantic readiness가 strict artifact validation, candidate approval, scaffold plan, Catalog publish에서 unresolved Binding, unknown Transport, unresolved Workflow representation과 미해결 Missing Information을 차단한다.

## AFV2-016 root validator가 Agent→A2A contract 역참조를 검사하지 않는다

- Severity: Major
- Behavior: Agent binding/exposure가 `contract_ref`를 유지한 채 `a2aContracts: []`여도 root validator가 PASS한다.
- Expected / Actual: 모든 A2A ref는 top-level reviewed contract를 가져야 한다. Current `validate-artifacts.mjs:73-83`, `:231-239`는 existing contract→Agent만 확인하고 Agent→contract 존재는 확인하지 않지만 web validator `targetContract.ts:639-669`는 확인한다.
- Root cause / impact: 양방향 identity contract의 한 방향이 빠져 CLI와 browser/server 판정이 다르고, 구조 Verify가 web reader가 거부할 artifact를 인증할 수 있다.
- Recommended direction / verification: root validator에 동일한 역참조 검사를 추가하고 missing/wrong-owner/orphan/duplicate/valid binding·exposure case를 검증한다.
- Status: Fixed — Agent binding/exposure→contract 역참조를 추가하고 missing ref negative test로 고정했다.

## AFV2-017 Agent Binding/Connection 결합이 schema에서 빠졌다

- Severity: Major
- Behavior: Agent가 `binding: null`, `connection: {transport:http}`여도 JSON Schema는 통과하지만 TypeScript strict validator는 거부한다.
- Expected / Actual: connection은 실제 binding에만 붙어야 하며 strict readers가 같은 shape를 받아야 한다. Agent schema conditional은 이 결합을 표현하지 않고 root validator는 schema에 의존한다.
- Evidence: `schemas/asset-candidate.schema.json:78` 대 `packages/web/src/analyzer/targetContract.ts:376-397`; fresh probe에서 schema errors `[]`, TypeScript connection error가 재현됐다.
- Root cause / impact: Tool/Workflow에만 적용된 conditional parity가 Agent에 누락돼 root PASS 뒤 import/server failure가 가능하다.
- Recommended direction / verification: Agent의 `binding:null ↔ connection:null`, A2A binding→connection 조건을 schema에 추가하고 동일 corpus를 schema/Target/root validator에 통과시킨다.
- Status: Fixed — Agent의 null/null 및 A2A/HTTP 결합을 schema에 추가하고 schema·Target validator parity corpus로 검증했다.

## AFV2-018 A2A identifier 문법이 Target·schema·parser에서 다르다

- Severity: Moderate
- Behavior: canonical 예시 `a2a.document-review`는 TypeScript validator가 받지만 schema의 `^a2a-\\d{3,}$` pattern이 거부한다.
- Expected / Actual: 문서화한 하나의 ID grammar를 모든 경계가 동일하게 적용해야 한다. 현재 parity test는 nested pattern을 비교하지 않는다.
- Evidence: `docs/workbench/taxonomy.md:104-113`, `schemas/a2a-contract.schema.json:42`, `targetContract.ts:623`, `validate-artifacts.test.mjs:17`; fresh dotted-ID probe에서 TS PASS/schema FAIL.
- Recommended direction / verification: documented grammar를 schema/analyzer/minting/test에 공유하고 dotted/numeric/malformed/duplicate/ref case를 전 경계에서 검증한다.
- Status: Fixed — dotted namespaced와 legacy numeric ID를 schema/Target 모두 수용하고 malformed ID는 거부하는 공통 corpus를 추가했다.

## AFV2-019 root validator가 runtime-stub 없는 handoff approval을 통과시킨다

- Severity: Major
- Behavior: 선행 승인이 모두 true이고 `stub_ready_for_followup: true`지만 `runtime-stub/` 파일이 없어도 root validator가 PASS한다.
- Expected / Actual: Target handoff approval은 non-empty runtime stub을 요구한다. Server `verifyReadiness.ts:16`은 확인하지만 schema와 `validateRunManifest`는 hierarchy/requirement ID만 확인한다.
- Root cause / impact: filesystem-dependent gate coherence가 server에만 있어 standalone artifact gate가 불가능한 handoff 상태를 인증한다.
- Recommended direction / verification: artifact root 검증 시 handoff gate true이면 runtime-stub regular file을 요구하고 no-dir/empty/non-empty/gate-false를 테스트한다.
- Status: Fixed — handoff gate true이면 artifact root의 `runtime-stub/` 아래 regular file 존재를 요구한다. no-dir/empty/non-empty case를 검증했다.

## AFV2-020 active scaffold Skill fixture 3개가 strict v2가 아니다

- Severity: Major
- Behavior: S08 callback, S10 ambient, S15 private-data의 `approved-scaffold-plan.json`은 `contract_version`, requirement, assets, Graph, manifest, validation이 없는 bespoke object다.
- Expected / Actual: scaffold Skill은 reviewed strict v2 predecessor만 소비해야 한다. Root validator는 `skill-scenarios` 전체를 건너뛰고, 파일 단독 입력도 basename dispatch가 없어 PASS하며 scenario command는 bespoke field/JSON parse만 확인한다.
- Evidence: `templates/skill-scenarios/S08-callback-guardrail/context/approved-scaffold-plan.json`, S10/S15 대응 파일; `scripts/validate-artifacts.mjs:267`; 각 `verification-commands.txt`.
- Root cause / impact: scenario가 selected Skill의 실제 입력 계약 대신 존재·특정 값만 검증해 invalid pre-v2 입력에서 scaffold하는 behavior를 보상한다.
- Recommended direction / verification: 세 context를 valid v2 analysis/manifest/scaffold artifact로 교체하고 모든 scaffold-trigger scenario에 strict root validation precondition을 둔다.
- Status: Fixed — S08/S10/S15를 complete strict v2 artifact set으로 교체하고 legacy filename을 제거했다. 현재 지원 수준에 따라 Callback·Ambient·private external HTTP Tool은 `validation.can_generate_source=false`, Build blocked, explicit Stop으로 표현하며 runnable 지원을 주장하지 않는다. S15 prohibited literal은 `prompt.md` 밖에 존재하지 않는다.

## AFV2-021 path-insensitive legacy key 검사로 payload schema를 손상시킨다

- Severity: Moderate
- Behavior: 합법적인 embedded JSON Schema property `module_id`도 retired Agent Factory vocabulary로 거부된다.
- Expected / Actual: legacy rejection은 AF 구조 필드에만 적용하고 payload schema/example/arbitrary data map은 opaque해야 한다. Current `validate-artifacts.mjs:255-260`은 모든 nested object를 무차별 순회한다.
- Root cause / impact: structural vocabulary와 domain payload namespace를 구분하지 않아 유효한 API schema가 내부 과거 명칭과 우연히 같다는 이유로 실패한다.
- Recommended direction / verification: known structural path에만 retired check를 적용하고 모든 retired key에 structural rejection + nested opaque allowance test를 둔다.
- Status: Fixed — schema/examples/maps의 opaque payload boundary에서는 retired-key 재귀 검사를 중단하고, structural retired-key rejection은 유지했다.

## AFV2-022 Manifest parser가 schema-invalid unknown field를 조용히 버린다

- Severity: Moderate
- Behavior: `parseAfRunManifest`가 unknown nested Stage Run/Codex metadata를 받아 projection 중 삭제해 round-trip에서 데이터가 사라진다.
- Expected / Actual: strict manifest boundary는 `additionalProperties:false`와 같이 명시 거부하거나 documented extension map을 보존해야 한다. Schema는 거부하지만 parser는 exact-key check가 없고 test는 `codex.usage` 소실을 기대한다.
- Evidence: `schemas/af-run-manifest.schema.json:80-93`, `afRunManifest.ts:199-230`, `afRunManifest.test.ts:75`, canonical store callers `artifactRootStore.ts:256-281`.
- Root cause / impact: parser가 strict read가 아닌 selective projection이라 direct/old manifest를 명확히 거부하지 않고 canonical rewrite로 손실시킨다.
- Recommended direction / verification: schema와 맞춘 nested exact-key 검사를 추가하고 valid deep-equality round-trip 및 unknown field explicit rejection을 검증한다.
- Status: Fixed — 모든 manifest object boundary를 exact-key로 읽고, valid deep-equal round-trip 및 unknown nested field 명시 거부를 검증했다.

## AFV2-023 Manifest template가 stale Skill ID와 불가능한 Verify history를 가르친다

- Severity: Minor
- Behavior: active template에 `runtime-stub/build`, `verify/run`이 있고 Build/Verify pending·handoff false인데 두 stage run은 completed다.
- Expected / Actual: current identity는 `af-scaffold-runtime`, `af-verify-runtime`이며 Verify는 Build handoff/stub 없이 실행할 수 없다.
- Evidence: `templates/af-run-manifest.json:22-43`, `packages/web/server/stageRunner.ts:98-111`.
- Recommended direction / verification: coherent current lifecycle snapshot으로 교체하고 canonical skill ID 및 gate/run consistency assertions를 추가한다.
- Status: Fixed — 불가능한 Build/Verify run history를 제거하고 post-Design/pre-Build current snapshot과 `not_run` validation ledger로 정리했다.

## AFV2-024 stale manifest write가 취소된 승인을 되살린다

- Severity: Blocker
- Behavior: validation 또는 Stage Runner metadata writer가 manifest를 lock 밖에서 읽고, 그 사이 수행된 approval revocation 뒤 stale whole manifest를 ETag 없이 써서 승인 true를 복원한다.
- Expected / Actual: manifest approval은 source of truth이고 revocation은 durable해야 한다. Current `manifestValidation.ts:4-18`과 `stageRunner.ts:1617`의 read-modify-write transaction은 canonical lock 밖이며 `artifactRootStore.ts:215`의 개별 write lock만으로 stale read를 막지 못한다.
- Root cause / impact: writer-owned subtree merge가 아닌 stale whole-manifest write 때문에 Analyze/Design/Runtime 승인 취소가 validation/run completion race로 복구되고 unreviewed Build가 가능해진다.
- Fresh reproduction: barrier race에서 validation read와 write 사이 승인을 취소했더니 최종 manifest가 세 Build approval을 모두 true로 복원했다.
- Recommended direction / verification: 모든 manifest read-modify-write를 `withCanonicalWriteLock` 내부 reread+writer-owned field merge로 바꾸고 외부 whole update는 CAS를 요구한다. validation·Stage Runner barrier test 뒤 revoked false와 Build 409를 확인한다.
- Status: Fixed — validation과 Stage Runner metadata RMW를 canonical lock 내부 reread+owned-subtree merge로 변경했다. 두 deterministic barrier test에서 승인 취소가 유지되고 Build가 차단됨을 확인했다.

## AFV2-025 Design apply 중간 실패가 승인된 partial canonical state를 남긴다

- Severity: Blocker
- Behavior: multi-file apply가 ETag preflight 후 파일을 순차 write하고 마지막에만 approval을 무효화해 두 번째 write 실패 시 첫 canonical analysis만 변경되고 과거 승인/Design complete가 남는다.
- Expected / Actual: apply failure는 partial canonical write를 남기지 않아야 한다. Current `stageRunner.ts:717-757`은 fallible writes 뒤 invalidation을 수행하고 Operating Model도 filesystem-error rollback 부재를 Current gap으로 기록한다.
- Root cause / impact: staged replacement/backup/journal 없는 batch와 늦은 approval invalidation 때문에 새 unreviewed analysis가 Build-enabled 상태가 된다.
- Fresh reproduction: `boundary-design.md` write에 failure를 주입하자 apply는 실패했지만 analysis가 변경되고 세 승인 true, Design complete가 유지됐으며 `assertBuildApprovals`가 PASS했다.
- Recommended direction / verification: recoverable atomic batch protocol을 도입하고 failure injection에서 canonical bytes 원상복구, 승인 차단, Build 409를 증명한다.
- Status: Fixed with residual risk — apply 전에 approval을 취소하고 canonical bytes를 snapshot한 뒤 역순 rollback한다. 두 번째 파일 실패에서 byte identity, revoked gate, Build 차단, 성공 재시도를 검증했다. 프로세스 자체가 rollback 도중 종료되거나 저장장치가 함께 실패하는 경우 byte 복구는 보장하지 못하지만 approval은 먼저 취소되어 fail-closed한다.

## AFV2-026 Build completion 문구가 canonical write를 부정한다

- Severity: Moderate
- Behavior: Build는 `runtime-stub/`을 즉시 canonical write하고 Apply가 없는데 server/UI 완료 문구는 canonical artifact가 바뀌지 않았다고 말한다.
- Evidence: `stageRunner.ts:98`, `:501`; `BuildRunStep.tsx:201`; `StageRunnerPanel.tsx:102`; canonical direct-write 계약 `operating-model.md:36`.
- Root cause / impact: shared proposed-first 메시지가 stage-aware하지 않아 사용자가 Build rerun side effect를 잘못 이해한다.
- Recommended direction / verification: Build만 direct-write/no-Apply 문구를 사용하고 Analyze/Design/Verify와 분리한 event/component test를 추가한다.
- Status: Fixed — server completed event와 shared UI message를 stage-aware하게 분리해 Build는 canonical `runtime-stub` direct-write와 no-Apply 사실을 명시한다.

## AFV2-027 Analyze import가 취소된 승인 UI를 즉시 갱신하지 않는다

- Severity: Moderate
- Behavior: changed analysis import는 server에서 approval을 취소하지만 성공 후 analysis query만 invalidate해 manifest approval chip은 최대 polling 4초 동안 stale하다.
- Evidence: `AnalyzeWorkbench.tsx:100`, 표준 save hook `useAnalysisArtifact.ts:20`, server invalidation `afArtifactCrudApi.ts:214`, polling `useArtifactRoot.ts:5`.
- Root cause / impact: import path가 domain save mutation의 query invalidation을 우회해 사용자가 이미 취소된 승인을 현재 승인으로 본다.
- Recommended direction / verification: save hook 재사용 또는 manifest query 즉시 invalidation을 적용하고 approved cache에서 import 후 false state/refetch를 검증한다.
- Status: Fixed — import 성공 시 analysis와 manifest query를 함께 즉시 invalidate한다.

## AFV2-028 Invocation Control UI가 serialization 값을 label로 노출한다

- Severity: Moderate
- Behavior: Graph editor/inspector가 lowercase `workflow`, `agent`를 그대로 표시한다.
- Expected / Actual: 사용자 label은 `Workflow`, `Agent`, 직렬화만 lowercase여야 한다. `GraphElementEditor.tsx:179`, `:256`, `GraphInspector.tsx:53`이 raw enum을 렌더링한다.
- Root cause / impact: presentation mapping 부재로 canonical UI vocabulary와 화면이 불일치한다.
- Recommended direction / verification: presentation-only label map을 공유하고 렌더는 대문자, save JSON은 lowercase임을 component/round-trip test로 증명한다.
- Status: Fixed — 공유 presentation map으로 `Workflow`/`Agent`를 렌더링하고 underlying enum 값은 lowercase로 유지했다.

## AFV2-029 A2A bearer 계약의 빈 scope가 UI에서만 승인을 차단한다

- Severity: Major
- Behavior: S07 A2A consuming 계약은 schema, strict Target validator, root validator, generator를 통과하지만 Design UI만 `security_requirements.*.scopes must include at least one reviewed value`를 표시해 `runtime_contracts_approved` 게이트를 막았다.
- Expected / Actual: `schemas/a2a-contract.schema.json`과 Target validator는 `scopes`를 필수 배열로 두되 빈 배열을 허용하고, shared A2A reference도 bearer/metadata auth에 reviewed scheme·requirement entry를 요구할 뿐 scope 발명을 요구하지 않는다. UI readiness helper만 모든 string array에 `minItems: 1` 의미를 덧붙였다.
- Fresh reproduction: S07 `analysis-result.json`을 실제 Workbench에 import하고 A2A 계약 탭을 열었을 때 단일 readiness issue와 비활성화된 계약 저장/승인 상태를 관찰했다. 같은 파일은 `node scripts/validate-artifacts.mjs`와 generator/runtime smoke를 통과했다.
- Root cause / impact: `a2aContractReadinessIssues`가 일반 필수 string-array helper를 OAuth scope에도 사용해 schema보다 강한 미문서 계약을 만들었다. 검증·생성 가능한 승인 artifact가 UI lifecycle을 완료할 수 없었다.
- Status: Fixed — scope 배열은 존재·항목 정합성만 검사하고 비어 있어도 허용하도록 UI validator를 schema와 맞췄다. S07 전체 artifact를 regression corpus로 추가했고, 실제 UI에서 `모든 Runtime/A2A 계약 OK`, 경계 승인, Runtime/A2A 계약 승인, Build 이동 가능 상태를 재확인했다.

## AFV2-030 Verify Skill이 새 필수 runtime command를 가르치지 않는다

- Severity: Major
- Behavior: fresh Codex Verify trigger가 읽은 canonical `af-verify-runtime` 본문과 `validation-allowlist.md`는 Workbench allow-list가 세 key라고 명시하고 `validate_generated_runtime`을 누락했다.
- Expected / Actual: current server는 네 key를 제공하고 `validate_artifact_root`와 `validate_generated_runtime`의 최신 pass를 aggregate completion에 필수로 요구한다. Skill은 구조 validator만으로 runtime claim을 완료할 수 있는 과거 계약을 계속 가르쳤다.
- Evidence: `packages/web/server/afVerifyRunApi.ts`, `packages/web/server/manifestValidation.ts`, `docs/workbench/operating-model.md`와 fresh Codex output의 직접 불일치.
- Root cause / impact: AFV2-004 구현·문서 수정 때 operational Skill과 direct reference가 영향 목록에서 빠졌다. 수동/fresh agent가 새 server semantics와 다른 검증 계획을 세울 수 있었다.
- Status: Fixed — Skill 본문과 allow-list reference를 네 command 및 두 required evidence의 pending/blocked/complete 의미로 동기화하고 generated runtime 검증 명령을 canonical script로 교체했다.

## AFV2-031 Human Input 승인 계약의 correlation·timeout·idempotency가 ADK path로 lowering되지 않는다

- Severity: Blocker
- Behavior: S11 approved async-resume 계약은 stable interrupt/invocation/session/idempotency ID, 60초 expiry, wrong-ID·duplicate·reject·abandoned no-apply를 요구하지만 generated ADK Human Input은 message, payload, response schema만 `RequestInput`에 전달한다.
- Layer: Skill scenario → Runtime Contract → Graph/Human Input emitter → generated ADK behavior
- Expected: `synthetic-approval-001`로 같은 invocation을 재개하고 duplicate는 실제 Tool side effect를 한 번만 적용하며 timeout·abandoned·reject·wrong-ID는 적용 없이 종료해야 한다.
- Actual: ADK가 임의 function-call UUID를 interrupt ID로 만들었다. approved ID resume은 `Function call not found`, emitted UUID resume은 성공했고 duplicate response는 새 event를 내지 않았지만, generated ADK Tool은 TODO이며 output-local idempotency HTTP store와 분리됐다. timeout/abandoned expiry도 구현되지 않아 abandoned state가 restart 뒤 계속 `pending_approval`이었다.
- Evidence: `templates/skill-scenarios/S11-human-input-resume/context/boundary-design.md:7-13`, `analysis-result.json:185-239`, `.evidence-reviews/codex-remaining-verification-2026-07-20.md:58-69`, official S11 `fresh-20260720T135406Z/result-summary.md`.
- Files / Symbols: `scripts/adk-source/emitters/hitl.mjs:5-22` (`emitHumanInputFunc`, `emitHumanInputNodeDecl`). 특히 `:11`의 `RequestInput(...)`에는 `interrupt_id`와 expiry/idempotency integration이 없다. `scripts/adk-source/emitters/function-node.mjs:10-34`는 side-effect Tool을 `TODO_IMPLEMENT_HERE` stub으로 emit한다.
- User impact: artifact review에서 승인한 correlation과 write safety가 generated runtime에서 보존된다고 믿을 수 없고, API caller가 approved ID로 resume하지 못하거나 abandoned approval이 무기한 남을 수 있다.
- Root cause hypothesis: Human Input node shape 일부만 emitter에 투영되고 top-level approved `async_resume` Runtime Contract의 identifiers/policies/side-effect boundary를 연결하는 lowering 단계와 persistent resume coordinator가 없다.
- Recommended direction: Human Input node와 approved async-resume contract를 deterministic하게 결합하고 stable ID, expiry lifecycle, idempotency store/actual Tool boundary를 한 runtime path로 생성한다. 지원하지 못하는 policy는 runnable generation을 fail-closed한다.
- Verification after fix: current S11을 rubric 비노출 fresh Codex session에서 다시 생성해 approved ID same-invocation resume, wrong ID, invalid response, duplicate/restart at-most-once side effect, reject/cancel/timeout/abandoned no-apply를 실제 ADK path로 검증한다.
- Closure evidence: current S11 evaluator 11/11, fresh generated compile/pytest, installed ADK 2.3.0 Runner restart resume가 approved `synthetic-approval-001`을 사용했다. approve/duplicate/second invocation은 apply count 1을 유지했고 conflict/wrong ID는 reject, reject/expiry/abandoned는 no-side-effect로 끝났다. Fresh agent run의 routing/output-boundary 실패는 `AFV2-014`로 분리했다.
- Status: **Fixed (2026-07-21)** — Product/runtime `AFV2-031` PASS; local `session_state` synthetic ledger 범위. Evidence: `.evidence-reviews/vnext-blocker-closure-2026-07-21.md`, official S11 `fresh-20260720T165321Z`.

## AFV2-032 Agent-owned MCP가 reviewed Tool allow-list 밖의 server Tool을 노출한다

- Severity: Blocker
- Behavior: reviewed Tool asset은 `server_ref`와 단일 `tool_name`을 지정하지만 generated Agent의 `McpToolset`은 server URL만 설정하고 Tool filter를 설정하지 않는다.
- Layer: approved Asset/Graph binding → generator → ADK MCP discovery/LLM tool surface
- Expected: Agent에는 approved `tool_name`만 노출되어야 하고 같은 MCP server의 다른 Tool은 호출 가능 surface가 되어서는 안 된다.
- Actual: approved `lookup`과 synthetic `unapproved_admin_tool`을 함께 노출한 localhost MCP server에서 generated Agent의 `get_tools()`가 두 Tool을 모두 반환했다.
- Evidence: `.evidence-reviews/codex-remaining-verification-2026-07-20.md:128-137`; live success path는 `lookup`을 호출했지만 별도 two-tool probe가 allow-list 우회를 재현했다.
- Files / Symbols: `scripts/adk-source/tools.mjs:3-7,14-18,24-51`은 `binding.tool_name` 존재를 connection 조건으로 사용한다. `scripts/adk-source/emitters/agent-node.mjs:24-32`의 `emitAgentTools`는 `McpToolset(connection_params=...)`만 emit하고 `tool_filter`를 누락한다.
- User impact: reviewed approval 범위를 넘어서는 Tool, 잠재적으로 write/admin Tool이 LLM 호출 surface에 노출된다. 이는 approval boundary와 least privilege를 직접 우회한다.
- Root cause hypothesis: MCP server 연결 승인을 Tool 승인과 동일시해 asset-level `tool_name`을 discovery filter로 lowering하지 않았다.
- Recommended direction: Agent-owned 및 Workflow-owned MCP emitter 모두 reviewed exact Tool allow-list를 ADK `tool_filter` 또는 동등한 fail-closed wrapper로 적용하고, discovery 결과에 누락/중복/unexpected Tool이 있으면 명시적으로 거부한다.
- Verification after fix: 한 server가 approved/read-only Tool과 unapproved/write Tool을 제공하는 fixture에서 generated Agent/Workflow 양쪽의 discovery와 live model 호출 surface가 approved Tool 하나만 포함함을 검증한다. approved Tool 부재와 server unavailable도 fail-closed해야 한다.
- Closure evidence: Agent emitter가 exact approved `tool_name`을 `McpToolset.tool_filter`로 생성한다. `lookup`과 `unapproved_admin_tool`을 함께 광고한 actual FastMCP probe에서 configured filter와 discovered Tool 모두 `lookup` 하나였다.
- Status: **Fixed (2026-07-21)** — approval/security gate restored; generator regression과 live two-tool discovery PASS.

## AFV2-033 Remote A2A 실패 뒤 Workflow가 terminal completed를 emit한다

- Severity: Blocker
- Behavior: S07 reviewed failure boundary는 timeout/remote failure를 observable manual-review handoff로 종료해야 하지만 generated static Graph는 Remote A2A node의 오류와 무관하게 `next` edge를 계속 실행한다.
- Layer: approved A2A runtime policy → Graph lowering → RemoteA2aAgent event → terminal output semantics
- Expected: remote error/timeout은 success terminal로 진행하지 않고 explicit failed 또는 manual-review handoff outcome을 만들어야 한다.
- Actual: real localhost ADK A2A success, auth-missing, 5초 timeout, unavailable peer는 각각 관찰 가능했다. 그러나 unavailable peer를 full generated Workflow에서 실행하면 Agent Card resolution error 뒤 terminal text와 `{status: "completed"}`가 이어졌다.
- Evidence: `templates/skill-scenarios/S07-a2a-consuming/context/boundary-design.md:13-15`, `.evidence-reviews/codex-remaining-verification-2026-07-20.md:140-152`.
- Files / Symbols: `scripts/adk-source/remote-a2a.mjs:59-77`은 retry/fallback wrapper support를 false로 기록하고 `:106-126`은 auth/timeout RemoteA2aAgent만 emit한다. `scripts/adk-source/graph/lowering.mjs:30-55,86-101`은 일반 edge를 무조건 pair로 낮추며, `scripts/adk-source/emitters/terminal-output.mjs:4-24`는 input/error state와 무관하게 `completed`를 emit한다.
- User impact: upstream remote failure가 event stream에 있어도 최종 machine-readable status가 성공으로 보이므로 automation, audit, operator가 실패한 작업을 완료로 처리할 수 있다.
- Root cause hypothesis: ADK child error event를 Graph branch/terminal status로 변환하는 failure outcome contract가 없고 static lowerer가 edge topology만 보존한다.
- Recommended direction: Remote A2A node outcome을 explicit success/error/timeout state로 normalize하고 reviewed failure handoff edge 또는 failed terminal로 route한다. runtime wrapper가 없으면 fallback policy가 있는 runnable contract를 fail-closed한다.
- Verification after fix: real localhost ADK A2A peer로 success, auth-missing, timeout, unavailable, malformed response를 full generated Workflow에서 실행해 success만 completed이고 나머지는 reviewed manual-review/failed terminal로 끝나는지 검증한다.
- Closure evidence: generated `RemoteA2aAgent` subclass가 error, failed/canceled/rejected task, unsupported input-required/auth-required와 usable result 없는 stream을 typed `_RemoteA2aFailure_*`로 중단한다. Fresh full-root unavailable probe는 2 events 뒤 typed failure로 끝났고 terminal output/completed status가 없었다. Final review에서 content가 있는 input-required의 pre-fix pass-through를 추가 재현한 뒤 보완했다. Interactive event는 Workbench 관찰을 위해 보존하고 그 다음 typed failure로 일반 `next` 진행을 막는다. Full root는 3 events 중 input-required 1개, terminal 0개와 reviewed input follow-up failure를 반환했다. 자동 resume/fallback은 실행하지 않는다.
- Status: **Fixed (2026-07-21)** — success path와 failure terminal semantics 모두 local ADK scope PASS.

## 6. Command evidence

| Command | Exit | Observed result | Claim supported |
|---|---:|---|---|
| `git rev-parse HEAD` / upstream / merge-base | 0 | HEAD와 `origin/main`이 동일 | 비교 기준 |
| `git diff --numstat` + status inventory | 0 | tracked 463, staged 0, untracked 55 | 감사 전 변경 상태 |
| `git diff --check` | 0 | 출력 없음 | baseline patch whitespace 정합성 |
| `node scripts/validate-skills.mjs` | 0 | files 42, markdown 37, skills 5, errors 0, warnings 0 | canonical Skill 구조 |
| `node scripts/validate-artifacts.test.mjs` | 0 | 23/23 pass | strict v2 schema·validator·analyzer 계약 및 negative cases |
| `node scripts/validate-artifacts.mjs` | 0 | `Artifact validation OK` | 현재 template/catalog/artifact 계약 |
| `node scripts/generate-adk-source.test.mjs` | 0 | 22/22 pass; ADK 2.3 static/dynamic runtime tests 포함 | generator guard/lowering baseline |
| `npm run test:analyzer --prefix packages/web` | 0 | 전체 command chain pass; 마지막 root suites 45/45 pass | analyzer·server·UI model·generator integration baseline |
| `npm run build --prefix packages/web` | 0 | TypeScript + Vite build pass, 686 modules | web compile/build |
| `npm test --prefix packages/mock-lab` | 0 | MCP bridge 포함 pass | local synthetic MCP baseline |
| `npm run build --prefix packages/mock-lab` | 0 | TypeScript + Vite build pass | Mock Lab compile/build |
| credential/private-key signature scan (`rg`, generated/dependency 제외) | 1 | 일치 항목 없음 (`rg` no-match exit) | obvious secret material 미검출 |
| `node scripts/validate-artifacts.test.mjs` (root parity fix) | 0 | 26/26 pass; 새 A2A reverse, stub gate, opaque payload cases 포함 | AFV2-016/019/021 regression proof |
| `node scripts/validate-artifacts.mjs` (root parity fix) | 0 | `Artifact validation OK` | 현재 template tree와 강화 validator compatibility |
| focused `server/afCatalogApi.test.ts` with repository TS loader | 0 | unresolved Tool/Workflow publish 422, Catalog files unchanged; 기존 positive publish pass | AFV2-015 Catalog facet |
| `node scripts/validate-skills.mjs` (Compose fix) | 0 | 5 skills, 0 errors, 0 warnings; Compose SKILL 300 lines | AFV2-010/011 |
| Handbook active-locator count | 0 | `4+6+7+11+6+8+8+8 = 58`, Index/Coverage 일치 | AFV2-012/013 |
| manifest JSON parse + `node scripts/validate-artifacts.mjs` | 0 | coherent template parse, full template tree PASS | AFV2-023 |
| focused `server/stageRunner.test.ts` + `server/afArtifactCrudApi.test.ts` | 0 | 두 stale-writer race에서 revoked gate 유지; second-file failure rollback·byte identity·Build 차단·retry pass | AFV2-024/025 |
| focused `graphElementEditorModel.test.ts` + `designStageModel.test.ts` | 0 | Invocation Control label map과 Verify ready/blocked config cases pass | AFV2-004 UI facet, AFV2-028 |
| UI patch scoped `git diff --check` | 0 | 출력 없음 | AFV2-004 UI facet, AFV2-027/028 |
| focused `stageRunnerNarrative.test.ts` | 0 | Build direct-write/no-Apply와 proposed-first 완료 문구 분기 pass | AFV2-026 |
| integrated `npm run test:analyzer` | 0 | analyzer/server/UI model + root validator/generator 최종 합산 63 tests pass | AFV2-001/002/003/005-009/015/017/018/022/024-028/031 통합 회귀 |
| integrated `npm run build` | 0 | TypeScript + Vite, 686 modules | web compile/build |
| integrated `node scripts/generate-adk-source.test.mjs` | 0 | 33/33; actual ADK 2.3 static/dynamic/async-resume/MCP/A2A import/runtime 포함 | AFV2-002/003/005-009/031-033 |
| integrated `node --test scripts/validate-artifacts.test.mjs` | 0 | 30/30 | schema/root validator parity |
| focused `scaffoldPlan.test.ts` after A2A parity | 0 | A2A consumer/exposure에 external_connection key 요구 | AFV2-002 analyzer parity |
| focused `stageRunner.test.ts` + `afArtifactsApi.streaming.test.ts` | 0 | 단일 structural pass는 pending/blocked, runtime evidence 누적 후 complete; incomplete run의 Catalog delta 적용 차단 | AFV2-004 |
| `node scripts/validate-generated-runtime.mjs <temporary S07 root>` | 0 | 13 Python files compile, generated A2A bundle pytest 4 passed with real ADK 2.3.0 | AFV2-004 fresh runtime evidence |
| S08/S10/S15 `verification-commands.txt` + scoped artifact validation | 0 | 세 strict v2 context PASS, legacy `approved-scaffold-plan.json` 0개, unsupported generator preflight Stop | AFV2-020 |
| focused `a2aContractValidator.test.ts` | 0 | S07 approved bearer contract with empty scopes is UI-ready | AFV2-029 |
| Playwright Design/Verify/A2A review | 0 | `Agent` display label, Build/stub Verify gate, S07 A2A approval gates and screenshots confirmed | AFV2-004/028/029 UI evidence |
| Vertical A standalone + generated runtime | 0 | artifact validation, 13 Python files compile, generated pytest 4 passed on ADK 2.3.0 | standalone Scaffold/Runtime/Verify |
| Vertical B Agent-selected HTTP MCP + Mock Lab | 0 | artifact/runtime smoke 4 passed; real Streamable HTTP MCP child proxy and tool call passed | MCP scaffold and behavior evidence |
| Vertical C S07 A2A consuming | 0 | artifact/generation/runtime smoke 4 passed; fake-provider message/resume behavior tests passed | A2A scaffold/runtime behavior evidence |
| Vertical C missing `external_connection` failure | 1 (expected) | generator rejected `Missing required runtime contract boundaries: external message for A2A consumer...` | A2A fail-closed gate |
| Codex 6 natural triggers + explicit invocation | 0 | five canonical routes and one README non-trigger correct; predecessor Stop conditions preserved | Codex fresh-session routing |
| Claude Code 6 natural triggers + test-only explicit load | 0 | five canonical routes and one README non-trigger correct; native slash command remains unsupported | Claude fresh-session routing with documented loader boundary |
| fresh Codex Verify inspection + post-fix Skill validation | 0 | stale three-key contract found; Skill/reference synchronized to four keys and required evidence pair | AFV2-030 |
| isolated Codex S11 `verification-commands.txt` | 0 each | current 11/11 + installed ADK runtime PASS; full agent behavior FAIL | AFV2-031 fixed, AFV2-014 partial; official `fresh-20260720T165321Z` evidence |
| isolated Codex S16 `verification-commands.txt` | 0 each | 5/5 pass; direct `af-discover-assets`, no writes | AFV2-014; official `fresh-20260720T135900Z` evidence |
| S11 installed ADK Runner resume/replay probe | 0 | approved stable ID, restart resume, apply count 1, duplicate replay, conflict/wrong-ID reject, expiry/reject/abandoned no-side-effect | AFV2-031 fixed |
| generated standalone Agent live-model run | 0 | Gemini 2.5 Flash returned `CODEX_RUNTIME_OK` in 3 events | local live-model E2E |
| generated Agent + real localhost Mock Lab MCP | 0 | model-selected `lookup`, function call/response, final `CODEX_MCP_OK` | MCP success path |
| MCP two-tool discovery probe | 0 | configured filter `lookup`; generated Agent discovered `lookup` only | AFV2-032 fixed |
| generated S07 + real localhost ADK A2A peer | 0 success path | remote answer in 4 events; auth-missing, 5.027s timeout, unavailable branches observed | A2A connection behavior |
| A2A non-success full-Workflow/wrapper probes | expected typed failure | unavailable 2 events/no terminal; input-required event preserved, full root 3 events/no terminal + reviewed follow-up failure | AFV2-033 fixed |
| Codex-only final structural/runtime regression | 0 | Skills 5/0/0, artifact 30/30, generator 33/33, web integrated 63/63 + build 686 modules, Mock Lab MCP 2/2 + build 42 modules | current-worktree regression baseline |
| active docs relative-link check | 0 | 39 Markdown files, 418 local targets, 0 broken | active documentation navigation |
| Handbook path/anchor check | 0 | 58 cards, 0 missing path/anchor | current source locators |
| official evidence shape + secret signature scan | 0 / no-match expected | S11/S16 each seven required files; no credential/private-key pattern | evidence completeness and data boundary |
| `git diff --check` + listener/process sweep | 0 / no-match expected | whitespace clean; no listener on 5173/5176/18081/18787/18788 and no matching temporary process | patch integrity and cleanup |

## 7. Residual uncertainty

- 실제 UI round-trip, 세 기존 Vertical Slice, current isolated Codex S11/S16, live model + localhost MCP/A2A E2E를 수행했다. 상세 결과는 final report, fresh-session evidence, `.evidence-reviews/codex-remaining-verification-2026-07-20.md`를 따른다.
- localhost peer는 실제 MCP/A2A protocol implementation이지만 외부 승인/production peer는 아니다. production identity, credential provisioning, persistent store, TLS/mTLS, deployment, observability는 unverified다.
- 사용자 지시에 따라 Claude Code는 후속 완료 조건에서 제외했고 추가 실행하지 않았다. 기존 routing evidence는 참고 기록일 뿐 현재 판정을 gate하지 않는다.
- `AFV2-014`의 isolated S16은 통과했고 S11 Product/runtime도 통과했지만, S11 agent behavior가 direct routing/output boundary/reference evidence에서 실패해 historical 16-scenario 완료 claim은 복원하지 않는다.
