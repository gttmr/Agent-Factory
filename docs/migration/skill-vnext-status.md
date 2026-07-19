# Skills vNext Migration Status

이 문서는 Agent Factory coding-agent skill 재편의 현재 상태를 기록한다. 새 skill은 Target Contract로 판단하지만 현재 Product artifact를 쓸 때는 Compatibility Layer를 거쳐 `legacy` 직렬화 계약을 지킨다. 따라서 이번 상태는 Full Integration이 아니라 **Partial migration**이다.

## 1. Source Snapshot

- Repository: `gttmr/Agent-Factory`
- Branch: `main`
- Base commit: `7deea452e73f63828fc14402b7e16dcf40e753ac`
- Date: `2026-07-18~19`
- Skill tree state: 승격 완료 — docs `0ee7784` → skills `b3911fd` → code `a4f55a0` 순서로 `main`에 반영
- Codex 실행 기록: `codex-companion 1.0.6`, 기본 모델 `gpt-5.6`; 문서 갱신 시 로컬 `codex --version`은 `codex-cli 0.144.5`
- Claude Code 실행 기록: Fable 기반 5 sessions; 문서 갱신 시 로컬 `claude --version`은 `2.1.214`
- ADK: `.agent-factory/runtime/.venv`의 `google-adk 2.3.0` 설치를 `pip show`와 설치 소스로 확인
- Google Agents CLI reference: `~/.agents/skills/google-agents-cli-*` 로컬 사본을 구조 참고 자료로 사용했다. 이 사본이 어느 upstream repository commit에서 왔는지는 확인되지 않았다.

이 문서의 line locator는 base commit에서 시작해 docs `0ee7784`, skills `b3911fd`, code `a4f55a0`까지 검증한 시점의 snapshot hint다. 실제 동작의 최종 권위는 현재 source다.

## 2. Migration Mode

판정은 **Partial**이다.

- Skill layer는 `af-workflow`와 네 canonical Work Skill, Compatibility Layer, version-neutral shared references, legacy shim으로 재편됐다.
- Product Contract는 여전히 `legacy` `module_category`, 현재 Graph enum, runtime/A2A contract shape만 직렬화·검증한다.
- 새 skill은 Target의 Agent·Workflow·Tool, Invocation Control, Binding, Workflow Profile, Reuse 판단을 먼저 수행하지만 current proposed/canonical artifact에는 Compatibility Layer를 적용한다.
- Product schema, validator, analyzer, generator, Catalog, UI가 Target 직렬화를 지원하지 않으므로 Full Integration으로 판정할 수 없다. 영향 영역은 [Taxonomy vNext Migration Status](taxonomy-vnext-status.md)의 구현 gap과 함께 본다.

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
| `_shared/compatibility-current-schema.md` | `taxonomy-boundaries.md`의 current serialization과 `runtime-contracts.md`의 current contract 경계 | 통합·신규 |
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

구 `runtime-contracts.md`는 독립 파일로 유지하지 않았다. Target pattern 계약은 Compose와 ADK cards로, current artifact 표현은 Compatibility Layer로 분산했다.

### Artifact, Stage Runner, Trigger, Compatibility

| 항목 | vNext 상태 |
| --- | --- |
| Artifact | 산출물 계약과 approval semantics는 현행을 유지한다. Stage Runner 또는 current canonical write는 Compatibility Layer를 거쳐 `legacy` artifact를 생산·검증한다. |
| Stage Runner | (2026-07-18 코드 단계에서 갱신) `STAGE_DEFINITIONS`의 `skillName`·`skillPath`가 canonical ID/경로(`af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime`)로 이행됐다. Analyze·Design은 canonical SKILL.md를 직접 읽는다. Build·Verify는 여전히 server primitive가 실행 주체다. 기존 manifest의 구 `skill_name` 이력은 자유형 문자열로 그대로 읽힌다. |
| Trigger | canonical 5개 skill은 frontmatter `description`에 should-trigger와 should-not-trigger 경계를 둔다. `_shared`는 trigger 대상이 아니다. |
| Compatibility | 전략 B의 legacy shim 4개는 유지하되, Stage Runner는 더 이상 shim 경로를 읽지 않는다. shim은 direct/manual legacy 호출 호환 전용이 됐다. 제거는 §8 기준으로 별도 판정한다. |

## 4. Product Contract Compatibility

### Supported

- current `legacy` `analysis-result.json`과 Stage Runner proposal path의 생산·parse·validator 적용
- Analyze 한 파일, Design 두 파일, Build server-owned canonical `runtime-stub/`, Verify 두 proposal이라는 현행 artifact 계약
- 현행 approval 불변, proposed-first apply, Catalog delta proposal-only 경계
- canonical skill의 Target rationale를 current artifact의 rationale/notes에 보존하는 Compatibility Output

### Unsupported

- Target `asset_type`, `invocation_control`, `binding`, `workflow_profile`, `reuse_status`의 Product 직렬화
- 위 Target 필드를 직접 소비하는 schema, validator, analyzer types, generator dispatch, Catalog projection, Workbench UI
- skill migration만으로 새로운 Product enum이나 canonical Target artifact를 도입하는 것

### Partial

- canonical skill은 Target Contract로 분류·설계하고, current proposed/canonical artifact를 쓸 때만 Compatibility Layer로 `legacy` 값을 직렬화한다.
- Standalone validator 비대상 design note는 Target 어휘를 사용할 수 있지만, 이것이 Product 지원을 뜻하지 않는다.

### Blockers

1. **Target Product schema 부재**: Target `asset_type`, `invocation_control`, `binding`, `workflow_profile`, `reuse_status`를 저장·검증할 Product schema가 없다. 영향 영역은 schema, analyzer, validator, generator, Catalog, UI다.
2. **~~Stage Runner legacy ID 하드코딩~~ (2026-07-18 해결)**: `STAGE_DEFINITIONS`·UI label·fake output·테스트 fixture가 canonical ID/경로로 이행됐다. `packages/web/src`·`server` 전역 rg에서 legacy ID 0건, 구 manifest `skill_name` 이력은 자유형 문자열로 하위 호환 유지(왕복 회귀 테스트 포함). 잔여: 시각적 라벨 확인은 텍스트 치환 수준으로 테스트가 커버하며 스크린샷 검증은 미수행(WSL debug endpoint 부재 — 정직 기록).
3. **~~Design 두 파일 계약의 약한 강제~~ (2026-07-18 해결)**: 등록된 필수 proposed artifact가 하나라도 누락되면 run이 `failed`가 되고 누락 파일 목록 진단과 `diagnostics.md`를 남긴다(RED→GREEN 회귀 포함). Analyze(1파일) 행동은 불변.
4. **실패한 Verify command의 proposal apply 가능성**: `packages/web/server/stageRunner.ts:643-666`의 apply gate는 run status와 diff validity를 보지만 command-level `validation.ok`를 gate로 사용하지 않는다. 영향 영역은 validation report/Catalog delta의 적용 의미와 UI 완료 해석이다.
5. **넓은 SDK sandbox write 범위**: Stage Runner SDK는 `workspace-write`라 `proposed-artifacts/` 밖 쓰기를 기술적으로 허용하고 diff builder는 extra file을 탐지하지 않는다. 영향 영역은 repository write safety와 run evidence completeness다.

## 5. Documentation Alignment Follow-ups

이번 단계에서 허용되지 않은 `docs/workbench/**`는 수정하지 않고 다음 정합화 입력으로 남긴다.

- `docs/workbench/operating-model.md:42-45`: legacy `af-analyze-requirement`·`af-design-boundaries`가 shim 경유 Current Implementation이라는 설명과 canonical `af-discover-assets`·`af-compose-solution` 병기가 필요하다. **2026-07-19 반영 완료.**
- `docs/workbench/analysis-guide.md:123`: legacy Analyze skill ID 옆에 canonical discovery skill과 Compatibility Layer 관계를 병기해야 한다. **2026-07-19 반영 완료.**
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

### New / Forward (2026-07-18 실행분)

canonical 5-skill tree 대상 forward 실행은 시나리오 16종 중 대표 집합을 두 도구에서 수행했다. 세부는 [Codex evidence](../../tests/skills/evidence/codex/forward-2026-07-18.md)와 [Claude Code evidence](../../tests/skills/evidence/claude-code/forward-2026-07-18.md)를 따른다.

| 커버 | Codex | Claude Code |
| --- | --- | --- |
| S01 단일 Agent | PASS — Workflow 미생성(baseline PARTIAL FAIL 대비 개선 입증) | PASS — af-workflow→discover 라우팅, standalone Agent 결론 |
| S03 Agent-선택 MCP | PASS(행동; 스킬 read 로그는 절단으로 부분 확인) | 미실행 |
| S13 직접 스캐폴딩 거부 | PASS — 게이트 열거·거부 | PASS — STOP 인용 거부 + shim handoff 확인(S16 증거 겸함) |
| compose 트리거(승인 루트 검토) | PASS | PASS — 조건부 패턴 카드 2/8만 로드(progressive disclosure 실증) |
| verify 트리거(runtime-stub 검증) | PASS — 계층 판정 | PASS — Level 1–5 완주, 실제 생성기 결함 발견·근본 원인 추적 |
| workflow 라우팅(상태 확인) | PASS | PASS |
| should-not(비-AF 요청) | PASS — 스킬 미사용 | PASS — 스킬 미사용 |

(2026-07-19 갱신) 잔여 시나리오 forward run을 완료했다: Codex는 S01–S16 전수(16/16, 전부 PASS — S07·S11은 fixture의 승인 artifact 불충분에 대한 게이트 STOP이 정답 경로), Claude Code는 10종(S01, S03 상당, S04, S05, S13, S14, S16 + 라우팅·should-not·verify) 전부 행동 PASS. 단 Claude S05 1건은 에이전트가 시나리오 fixture(rubric·기대 파일)를 자체 열람해 참조 누설로 오염 — 클린 증거에서 제외(클린 증거는 Codex S05). 상세와 fixture 보강 후속(S07·S11 완전 승인 artifact 세트, fixture 격리 worktree 실행 규약)은 [Codex evidence](../../tests/skills/evidence/codex/forward-2026-07-18.md)와 [Claude Code evidence](../../tests/skills/evidence/claude-code/forward-2026-07-18.md)에 기록했다. S08·S10 프로토타입은 오케스트레이터가 독립 재실행으로 테스트 통과를 확인했다(S08 pytest 2 passed, S10 unittest OK + 중복 전달 멱등성).

### Codex

`gpt-5.6-luna` + low effort + fresh thread + read-only 규약으로 7 run 실행, 전부 PASS. Codex는 `.agents/skills`를 자체 발견해 부트스트랩 문구 없이 canonical 스킬을 직접 선택했다. Fallback 사용 없음.

### Claude Code

Claude Code는 `.agents/skills`를 자동 발견하지 않으므로(공식 문서 확인) 프롬프트에 스킬 위치만 알리는 부트스트랩(특정 스킬명 비지정)을 사용했다. model `sonnet`, per-run effort 지정은 불가능해 기본값을 사용했다(사용자 규약의 fallback 허용 적용). 6 run 전부 PASS.

### Runtime Smoke (2026-07-18)

승인 완료 루트 `req-vacation-approval`로 재생성→compile→import/pytest를 수행했다. compileall PASS, **import/pytest FAIL** — 생성기 route lowering이 같은 downstream으로 수렴하는 두 route 분기를 (from,to) 중복으로 방출해 ADK 2.3.0 `Workflow._validate_duplicate_edges`가 거부한다. 기존 runtime-stub도 동일 실패로, **이번 스킬 작업 이전부터 존재한 Current Implementation 결함**을 smoke가 최초 관찰했다. 세부·근본 원인은 [runtime smoke evidence](../../tests/skills/evidence/runtime-smoke/2026-07-18-vacation-approval.md)를 따른다.

## 7. Remaining Gap

### Product migration

Product schema와 Stage Runner·validator·generator·Catalog·UI가 Target Contract를 직렬화하고 소비하지 않는다. 상세 영향은 §4 Blockers와 [Taxonomy vNext Migration Status](taxonomy-vnext-status.md)를 따른다.

### UI integration

Workbench는 새 canonical skill 이름을 표시하지 않고 Stage Runner Analyze·Design metadata와 화면 label에 legacy ID를 유지한다. Build·Verify는 server primitive이므로 canonical direct/manual skill 이름이 Stage Runner 실행 surface에 나타나지 않는다.

### Schema

current JSON Schema와 TypeScript types에는 Target `asset_type`, `invocation_control`, `binding`, `workflow_profile`, `reuse_status`를 독립적으로 저장할 계약이 없다. Compatibility Layer가 이 부재를 해결하는 것은 아니다.

### Runtime pattern

Ambient, Callback/Plugin, Event Loop, MCP, A2A, Human Input/Resume 등의 판단 규칙과 ADK cards는 skill layer에 존재한다. Product generator는 이 전체 pattern set을 지원하지 않으며, card 존재를 runnable lowering 지원으로 해석하면 안 된다.

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

## 8. Legacy Removal Criteria

legacy shim은 다음 조건이 모두 충족된 뒤에만 제거할 수 있다.

- Stage Runner `STAGE_DEFINITIONS`의 `skillName`과 exact `skillPath`가 canonical ID/path를 가리킨다.
- Analyze·Design UI label, run manifest metadata, fake output과 test fixture가 canonical ID로 이행됐다.
- Build·Verify의 direct/manual legacy caller가 canonical skill로 이행됐다.
- 활성 외부 문서, automation, 호출 script에서 legacy skill ID 참조가 소거됐다.
- canonical path로 Stage Runner artifact 계약, trigger matrix와 S16 legacy-shim 전환 결과가 검증됐다.
- 기존 run history를 읽는 호환 요구와 rollback 조건이 별도로 판정됐다.

이 목록은 제거 가능 조건만 기록하며 코드 수정 절차를 정의하지 않는다.
