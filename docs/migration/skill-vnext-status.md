# Skills vNext Migration Status

이 문서는 Agent Factory coding-agent skill 재편의 현재 상태를 기록한다. 2026-07-21 strict cutover 후속 검증 기준에서 skill 계층은 `af-workflow`와 네 canonical Work Skill만 사용하며, Product v2 artifact에 Target fields를 직접 쓴다. 구 stage ID shim과 legacy projection 계약은 제거됐다. Product generator가 아직 실행 코드로 내리지 못하는 ADK pattern은 별도 기능 범위이며 skill migration 완료 여부와 섞어 판단하지 않는다.

## 1. Source Snapshot

- Repository: `gttmr/Agent-Factory`
- Branch: `main`
- Product migration baseline: `0cdcb829480def3c0a8ba4afdefb37913721f6d2` (2026-07-19 worktree, commit 전)
- Date: `2026-07-18~21`
- Skill tree state: 승격 완료 — docs `0ee7784` → skills `b3911fd` → code `a4f55a0` 순서로 `main`에 반영
- Codex 실행 기록: `codex-companion 1.0.6`, 기본 모델 `gpt-5.6`; 최신 격리 검증은 `codex-cli 0.144.6`, `gpt-5.6-luna`
- Claude Code 실행 기록: Fable 기반 5 sessions; 문서 갱신 시 로컬 `claude --version`은 `2.1.214`
- ADK: `.agent-factory/runtime/.venv`의 `google-adk 2.3.0` 설치를 `pip show`와 설치 소스로 확인
- Google Agents CLI reference: `~/.agents/skills/google-agents-cli-*` 로컬 사본을 구조 참고 자료로 사용했다. 이 사본이 어느 upstream repository commit에서 왔는지는 확인되지 않았다.

이 문서의 line locator는 base commit에서 시작해 docs `0ee7784`, skills `b3911fd`, code `a4f55a0`까지 검증한 시점의 snapshot hint다. 실제 동작의 최종 권위는 현재 source다.

## 2. Migration Mode

판정은 **Complete — strict Target v2**다.

이 판정은 canonical tree·contract·legacy 제거 상태에 대한 구조적 migration 판정이다. Fresh behavior campaign의 전체 완료 주장은 별도다. 2026-07-21 S11 재검증에서 Product/runtime 계약은 통과했지만 explicit scaffold 요청이 `af-workflow`를 먼저 읽은 routing deviation, output root 밖 transient probe, 필수 reference read 증거 부족이 남아 `AFV2-014`는 Moderate partial로 유지한다. 따라서 historical 16-scenario 완료율을 current 완료 증거로 복원하지 않는다.

- Skill layer는 `af-workflow`와 네 canonical Work Skill, version-neutral shared references로 구성된다.
- Product Contract v2는 Agent·Workflow·Tool, Invocation Control, Binding, Workflow Profile, Domain/Owner/Reuse를 직접 직렬화·검증한다.
- 새 skill은 strict Target fields만 proposed/canonical artifact에 쓰며 legacy field를 만들거나 보완하지 않는다.
- 구 stage ID shim과 legacy-only artifact 해석은 지원하지 않는다. generator가 아직 지원하지 않는 ADK runtime pattern은 [Taxonomy vNext Migration Status](taxonomy-vnext-status.md)의 별도 기능 gap으로 추적한다.

## 3. Old → New Mapping

### Skill

구 canonical Work Skill 4개는 새 canonical Work Skill 4개로 이동했고, lifecycle entrypoint `af-workflow`가 추가됐다. 결과는 **4 → 4+1**이다.

| 구 ID | 새 canonical ID | 역할 |
| --- | --- | --- |
| 없음 | `af-workflow` | 저장소·artifact 상태와 predecessor gate를 확인해 다음 Work Skill로 routing하는 read-only entrypoint |
| `af-analyze-requirement` | `af-discover-assets` | requirement evidence에서 Agent·Workflow·Tool 후보, resource, dependency, missing information을 발견 |
| `af-design-boundaries` | `af-compose-solution` | reviewed 후보를 standalone 또는 Workflow·Graph IR·runtime contract 구조로 조합 |
| `af-build-runtime-stub` | `af-scaffold-runtime` | approved compose artifact에서 ADK Runtime Handoff 또는 explicit local scaffold 생성 |
| `af-verify-feedback` | `af-verify-runtime` | skill·artifact·code·runtime·behavior를 다섯 evidence layer로 검증 |

### Reference

구 `_shared` 12개 파일의 보존 가치와 중복을 `r1-skill-audit`에서 분류한 뒤, 새 `_shared` 20개 파일로 승계·통합·신규 구성했다.

| 새 reference | 구 reference 또는 근거 | 구분 |
| --- | --- | --- |
| `_shared/source-of-truth.md` | Target/Current/installed-source truth order를 독립화 | 신규 |
| `_shared/lifecycle-invariants.md` | `workflow-invariants.md` | 승계·개명 |
| `_shared/artifact-root-and-stage-runner.md` | `artifact-root-stage-runner.md` | 승계·개명 |
| `_shared/taxonomy.md` | `taxonomy-boundaries.md`의 Target 판단을 canonical Taxonomy 링크 중심으로 재편 | 통합·재구성 |
| `_shared/graph-ir.md` | canonical Graph IR routing reference | 신규 |
| `_shared/target-contract-v2.md` | strict Target v2 artifact와 승인 경계를 한곳에 정리 | 신규 |
| `_shared/missing-information.md` | `missing-information-gates.md` | 승계·개명 |
| `_shared/security-and-data.md` | 공통 private data·credential·synthetic fixture 경계 | 신규 |
| `_shared/catalog-and-reuse.md` | `catalog-feedback.md` | 승계·확장 |
| `_shared/runtime-pattern-selection.md` | evidence에 따른 pattern-card 선택 규칙 | 신규 |
| `_shared/testing-contract.md` | deterministic validation과 behavior evaluation 규약 | 신규 |
| `_shared/adk/agents-workflows-tools.md` | `adk-2.3-baseline.md` | 승계·version-neutral 개명 |
| `_shared/adk/function-and-mcp-tools.md` | Function/MCP Tool API·계약 근거 | 신규 |
| `_shared/adk/a2a.md` | `adk-2.3-remote-a2a.md` | 승계·version-neutral 개명 |
| `_shared/adk/callbacks.md` | callback·Plugin pattern | 신규 |
| `_shared/adk/event-loop.md` | Event action과 commit timing pattern | 신규 |
| `_shared/adk/ambient-agents.md` | generic run·Pub/Sub·Eventarc entry pattern | 신규 |
| `_shared/adk/state-and-artifacts.md` | `adk-2.3-data-handling.md` | 승계·version-neutral 개명 |
| `_shared/adk/human-input-and-resume.md` | `adk-2.3-human-input.md` | 승계·resume 확장 |
| `_shared/adk/graph-and-dynamic-workflows.md` | `adk-2.3-routes.md` + `adk-2.3-dynamic.md` | 통합 |

구 `runtime-contracts.md`는 독립 파일로 유지하지 않았다. Target pattern 계약은 Compose, strict Target v2 reference, ADK cards로 나눠 소유한다.

### Artifact, Stage Runner, Trigger, Compatibility

| 항목 | vNext 상태 |
| --- | --- |
| Artifact | 산출물 계약과 approval semantics는 유지한다. Stage Runner와 canonical write는 strict Target v2만 생산·검증한다. |
| Stage Runner | `STAGE_DEFINITIONS`의 `skillName`·`skillPath`는 canonical ID/경로(`af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime`)만 가리킨다. Analyze·Design은 canonical SKILL.md를 직접 읽고 Build·Verify는 server primitive가 실행 주체다. |
| Trigger | canonical 5개 skill은 frontmatter `description`에 should-trigger와 should-not-trigger 경계를 둔다. `_shared`는 trigger 대상이 아니다. |
| Compatibility | 구 stage ID shim 4개와 compatibility reference를 삭제했다. validator는 구 ID가 다시 생기면 실패하며, S16은 canonical direct 호출과 shim 부재를 확인한다. |

## 4. Product Contract Integration

### Supported

- strict Target v2 `analysis-result.json`의 생산·parse·validator 적용
- Target `asset_type`, `invocation_control`, `binding`, `workflow_profile`, `domain_scope`, `owner`, `reuse_status`의 Product 직렬화와 직접 소비
- Target-only generator input의 직접 lowering
- Agent/Workflow/Tool Reuse Hub와 `catalog/tools.yaml` publish
- Analyze 한 파일, Design 두 파일, Build server-owned canonical `runtime-stub/`, Verify 두 proposal이라는 현행 artifact 계약
- 현행 approval 불변, proposed-first apply, Catalog delta proposal-only 경계
- Workbench Build는 두 Design approval과 complete manifest를 요구하고 Verify는 complete Build handoff와 non-empty Runtime Handoff를 요구한다. canonical analysis가 바뀌면 downstream approval과 stale validation을 무효화한다.
- canonical skill의 Target 판단을 structured fields에 보존하는 strict output

### Intentionally unsupported

- 구 Graph node/edge/container envelope와 legacy generator selector
- legacy-only artifact root와 구 split artifact 파일. 별도 정본에서 제외한 `commonization-notes.json`도 skill validator가 재도입을 거부한다.
- `catalog/adapters.yaml`, `catalog/remote-a2a-contracts.yaml`, Adapter/Remote A2A 분류
- 삭제된 stage ID shim을 통한 direct/manual 호출

### Separate capability gap

- Product v2 field 지원과 특정 ADK pattern의 runnable generator 지원은 별도다. Pattern card 존재만으로 lowering 지원을 주장하지 않는다.

### Resolved blockers

1. **~~Target Product schema 부재~~ (2026-07-19 해결)**: strict v2 schema, Stage Runner validation, Target-only generator 입력, 3자산 Catalog/UI를 함께 구현했다.
2. **~~Stage Runner legacy ID 하드코딩~~ (2026-07-18 해결)**: `STAGE_DEFINITIONS`·UI label·fake output·테스트 fixture가 canonical ID/경로로 이행됐다. 2026-07-19에는 direct/manual 호출용 shim도 삭제했다.
3. **~~Design 두 파일 계약의 약한 강제~~ (2026-07-18 해결)**: 등록된 필수 proposed artifact가 하나라도 누락되면 run이 `failed`가 되고 누락 파일 목록 진단과 `diagnostics.md`를 남긴다(RED→GREEN 회귀 포함). Analyze(1파일) 행동은 불변.
4. **~~실패한 Verify command의 Catalog proposal apply 가능성~~ (2026-07-19 해결)**: validation 실패 시 `validation-report.md`만 적용하고 `catalog-delta.yaml`은 건너뛴다. 모든 적용 대상 ETag를 실제 write 전에 검사한다.
5. **~~넓은 SDK write 범위~~ (2026-07-19 해결)**: 실행 전후 workspace content snapshot을 비교해 proposal과 run ledger 밖의 생성·수정·삭제를 실패로 기록한다.
6. **~~Product gate와 skill 선행 조건 불일치~~ (2026-07-20 해결)**: 모든 Build server entrypoint와 scaffold plan save가 두 Design approval을 검사하고, Verify command/Stage Runner는 Build complete·handoff approval·non-empty stub을 검사한다. 네 canonical Work Skill과 shared references도 같은 predecessor·complete manifest 계약으로 맞췄다.

## 5. Documentation Alignment Follow-ups

Product Target v2 이행과 함께 아래 active `docs/workbench/**` 정합화 항목을 현재 구현 기준으로 반영했다.

- `docs/workbench/operating-model.md`: Stage Runner가 canonical Work Skill만 호출하는 현재 계약으로 갱신했다. **2026-07-19 반영 완료.**
- `docs/workbench/analysis-guide.md`: Analyze가 `af-discover-assets`를 직접 사용하는 현재 계약으로 갱신했다. **2026-07-19 반영 완료.**
- `docs/workbench/skill-refresh-evidence-2026-07.md`: 구 4-skill 체계를 기준으로 한 역사 원장이다. 현재 규칙으로 덮어쓰지 말고 historical evidence 표지를 유지한다.
- Handbook은 이번 단계에서 Analyze·Design shim→canonical locator, Build·Verify server-primitive/direct-manual 경계, Index/Coverage를 갱신했다. 새 commit이 생기면 `docs/handbook/README.md`와 `overview.md`의 worktree 주석을 commit snapshot으로 바꾸고 관련 stage locator를 다시 확인해야 한다.
- `docs/handbook/registers.md`에는 skill ID를 소유하는 register가 없어 이번 단계에서 수정하지 않았다. 향후 Stage Runner canonical ID migration이 일어나면 `reg.stage-run-evidence`의 producer·metadata locator를 재검증해야 한다.

## 6. Scenario Results

### Baseline

baseline은 legacy 4-skill 절차와 당시 존재하던 vNext 문서를 함께 읽을 수 있는 환경에서 실행됐다. 따라서 순수 구 skill만의 성능으로 해석할 수 없으며, **구 skill + 신 문서** 조합의 한계를 보여 준다.

| Scenario | 결과 | 관찰 |
| --- | --- | --- |
| [S01 single Agent](../../tests/skills/evidence/baseline/S01-single-agent/result-summary.md) | `PARTIAL FAIL` | 후보·missing information은 충실했지만 실행 제어 근거 없이 Workflow와 Graph/Human Input을 과잉 생성했다. |
| [S03 Agent-selected MCP](../../tests/skills/evidence/baseline/S03-agent-selected-mcp/result-summary.md) | `PASS` | Invocation Control을 Agent로 두고 OCR Tool을 고정 Tool Node로 만들지 않았다. 당시 vNext 문서의 기여 가능성이 있다. |
| [S13 raw scaffold refusal](../../tests/skills/evidence/baseline/S13-raw-scaffold-refusal/result-summary.md) | `PASS` | approved artifact 없는 raw requirement→code 요청을 거부하고 gate를 안내했다. read-only 실행이라 실제 write 차단은 관찰 범위 밖이다. |

### Historical New / Forward (2026-07-18 실행분)

아래 실행은 당시 canonical 전환 중이던 tree와 fixture를 대상으로 한 historical evidence다. 이후 legacy shim 제거, S07/S11 positive predecessor 보강, S16 canonical-direct 전환이 있었으므로 현재 five-skill tree의 완료 증거로 사용하지 않는다. 세부는 [Codex evidence](../../tests/skills/evidence/codex/forward-2026-07-18.md)와 [Claude Code evidence](../../tests/skills/evidence/claude-code/forward-2026-07-18.md)를 따른다.

| 커버 | Codex | Claude Code |
| --- | --- | --- |
| S01 단일 Agent | PASS — Workflow 미생성(baseline PARTIAL FAIL 대비 개선 입증) | PASS — af-workflow→discover 라우팅, standalone Agent 결론 |
| S03 Agent-선택 MCP | PASS(행동; 스킬 read 로그는 절단으로 부분 확인) | 미실행 |
| S13 직접 스캐폴딩 거부 | PASS — 게이트 열거·거부 | PASS — STOP 인용 거부 + shim handoff 확인(S16 증거 겸함) |
| compose 트리거(승인 루트 검토) | PASS | PASS — 조건부 패턴 카드 2/8만 로드(progressive disclosure 실증) |
| verify 트리거(runtime-stub 검증) | PASS — 계층 판정 | PASS — Level 1–5 완주, 실제 생성기 결함 발견·근본 원인 추적 |
| workflow 라우팅(상태 확인) | PASS | PASS |
| should-not(비-AF 요청) | PASS — 스킬 미사용 | PASS — 스킬 미사용 |

(2026-07-19 historical 갱신) 잔여 시나리오를 당시 fixture 기준으로 실행했다. Codex의 16/16에는 S07·S11의 승인 artifact 부족 STOP과 legacy shim을 사용한 S16이 포함되며, Claude S05 1건은 rubric/기대 파일 노출로 오염됐다. 따라서 이 수치는 현재 target의 positive-path 완료율이 아니다. S08·S10 프로토타입의 독립 실행 결과도 해당 시점 artifact 증거로만 보존한다.

### Codex

`gpt-5.6-luna` + low effort + fresh thread + read-only 규약으로 7 run 실행, 전부 PASS. Codex는 `.agents/skills`를 자체 발견해 부트스트랩 문구 없이 canonical 스킬을 직접 선택했다. Fallback 사용 없음.

### Claude Code

Claude Code는 `.agents/skills`를 자동 발견하지 않으므로(공식 문서 확인) 프롬프트에 스킬 위치만 알리는 부트스트랩(특정 스킬명 비지정)을 사용했다. model `sonnet`, per-run effort 지정은 불가능해 기본값을 사용했다(사용자 규약의 fallback 허용 적용). 6 run 전부 PASS.

### Runtime Smoke (2026-07-18)

승인 완료 루트 `req-vacation-approval`로 재생성→compile→import/pytest를 수행했다. compileall PASS, **import/pytest FAIL** — 생성기 route lowering이 같은 downstream으로 수렴하는 두 route 분기를 (from,to) 중복으로 방출해 ADK 2.3.0 `Workflow._validate_duplicate_edges`가 거부한다. 기존 runtime-stub도 동일 실패로, **이번 스킬 작업 이전부터 존재한 Current Implementation 결함**을 smoke가 최초 관찰했다. 세부·근본 원인은 [runtime smoke evidence](../../tests/skills/evidence/runtime-smoke/2026-07-18-vacation-approval.md)를 따른다.

## 7. Remaining Gap

### Product migration (2026-07-19 해결)

Product schema, Stage Runner validator, analyzer, root validator, generator, Catalog publish와 Reuse Hub가 strict Target Contract v2를 직렬화하고 소비한다. legacy field·file·reader·projection은 지원하지 않는다. 상세 범위는 [Taxonomy vNext Migration Status](taxonomy-vnext-status.md)를 따른다.

### UI integration (2026-07-19 해결)

Stage Runner metadata는 canonical skill ID를 사용하고 Reuse Hub·분석 요약·badge·주요 Build copy는 Agent/Workflow/Tool을 표시한다. Build·Verify의 실행 주체는 server primitive이며, 삭제된 shim 호출 경로는 제공하지 않는다.

### Schema (2026-07-19 해결)

JSON Schema와 TypeScript types는 Target `asset_type`, `invocation_control`, `binding`, `workflow_profile`, `reuse_status`만 저장한다. legacy projection과 old-root 해석은 없다.

### Runtime pattern

Ambient, Callback/Plugin, Event Loop, MCP, A2A, Human Input/Resume 등의 판단 규칙과 ADK cards는 skill layer에 존재한다. Product generator는 이 전체 pattern set을 지원하지 않으며, card 존재를 runnable lowering 지원으로 해석하면 안 된다.

2026-07-21 current S11은 approved async-resume stable ID, expiry, restart replay, duplicate/conflict 처리와 guarded at-most-once synthetic Tool을 installed ADK 2.3.0에서 통과했다. 다만 fresh Codex behavior 자체는 direct routing·output boundary·reference evidence 때문에 FAIL이며, 이는 Product/runtime Blocker `AFV2-031`과 분리된 Skill discipline finding `AFV2-014`다.

### Generator route-convergence 결함 (2026-07-18 smoke 발견)

승인·검토된 합법적 Graph IR(한 router의 복수 route 분기가 같은 downstream 노드로 수렴 — 예: 승인/반려 → HR 기록)을 현재 생성기가 lowering하면, `scripts/adk-source/graph/routes.mjs`·`scripts/adk-source/graph/lowering.mjs` 경로가 같은 `(from, to)` 쌍의 edge 항목을 복수 방출하고 설치된 ADK 2.3.0 `Workflow._validate_duplicate_edges`가 이를 거부해 **생성 번들이 import 불가**가 된다. `scripts/adk-source-test/`에 이 수렴 케이스 테스트가 없어 미검출 상태였다. 영향 영역: generator route lowering, adk-source-test 커버리지, 기존 생성 번들의 runtime 기동. 이 결함 수정과 회귀 테스트 추가는 Product 코드 작업이므로 이번 skill 단계에서 수행하지 않았다.

**해결 (2026-07-18 Product 코드 단계)**: static/runnable lowering이 resolved runtime target별 route case를 병합하고, reviewed route value를 정렬해 만든 canonical key 하나로 dispatch하도록 수정했다. Router function은 병합된 모든 reviewed value·alias와 default fallback을 같은 key로 매핑하면서 기존 `Event.output` payload를 유지한다. Synthetic 회귀는 `templates/regression-scenarios/scenario-l-route-convergence/analysis-result.json`과 `scripts/adk-source-test/route-convergence.test.mjs`에 추가했으며, 발견 근거는 [runtime smoke evidence](../../tests/skills/evidence/runtime-smoke/2026-07-18-vacation-approval.md)에 보존한다. Artifact·schema·validator 계약은 변경하지 않았다.

### Loader compatibility

Claude Code 공식 발견 경로에는 `.agents/skills`가 포함되지 않아 forward test는 SKILL.md 명시 경로 load를 사용한다. 가능한 adapter는 `.claude/skills` mirror, plugin, 설치 script지만 이번 migration에서는 어느 것도 채택하지 않았다.

### Unverified or not-present API surfaces

설치된 `google-adk 2.3.0` 조사에서 다음 이름 또는 import surface가 **not present**로 기록됐다. 대체 surface가 확인된 항목도 이름 그대로 사용할 수 있다는 뜻은 아니다.

- `from google.adk.events import create_request_input_response`
- `from google.adk.agents import RemoteA2aAgent`
- `from google.adk.a2a.utils import to_a2a`
- generic `HttpConnectionParams`
- declared top-level `Event.state_delta`
- `PubSubTriggerAdapter`
- optional dependency가 없는 현재 환경에서의 usable `google.adk.tools.pubsub.PubSubToolset` import
- `google.adk.ambient` module 또는 ambient-specific named API
- `State.SESSION_PREFIX`

또한 official `ResumabilityConfig` surface는 설치 package probe에 포함되지 않았으므로 scaffold code emission 전에 재확인이 필요하다.

## 8. Legacy Removal Result

2026-07-19 strict cutover에서 다음 조건을 확인하고 legacy shim을 제거했다.

- Stage Runner `STAGE_DEFINITIONS`의 `skillName`과 exact `skillPath`는 canonical ID/path만 가리킨다.
- Analyze·Design UI label, run manifest metadata, fake output과 test fixture는 canonical ID를 사용한다.
- Build·Verify의 direct/manual 안내는 canonical skill을 사용한다.
- 활성 automation과 호출 script에는 구 skill 경로가 없다. validator에 남은 구 ID 문자열은 재도입을 막는 deny-list다.
- `S16-canonical-direct`가 canonical direct 호출과 구 shim 디렉터리 부재를 검증한다.
- 사용자는 기존 run history와 rollback 호환을 요구하지 않았고, 기존 artifact는 별도 백업 후 active input에서 제외하기로 결정했다.
- skill validator는 canonical 다섯 directory와 required markers·relative references·legacy deny-list를 검사한다.

과거 ID는 이 문서의 이전→현재 표와 historical evidence에서만 볼 수 있으며 실행 가능한 호환 표면이 아니다.
