# Agent Factory vNext 통합 점검 완료 보고

> 2026-07-21 closure 결론: **감사에서 새로 연 세 Blocker `AFV2-031`, `AFV2-032`, `AFV2-033`은 모두 수정·재검증됐고 open Blocker는 0건이다.** 현재 Product/runtime support matrix는 검증한 local/synthetic 범위에서 review-ready다. 다만 fresh Skill behavior의 `AFV2-014` Moderate partial과 production/external-runtime 불확실성은 남아 있어 전체 migration campaign 완료로 확대 해석하지 않는다. 상세 closure evidence는 [2026-07-21 Blocker closure](../../.evidence-reviews/vnext-blocker-closure-2026-07-21.md)를 따른다.

## 1. Snapshot

- Repository: `/home/ilmaswsl/work/Agent-Factory`
- Branch: `main`
- BASE_REF: `0cdcb829480def3c0a8ba4afdefb37913721f6d2` (`origin/main`, ahead 0 / behind 0)
- Worktree HEAD: `0cdcb829480def3c0a8ba4afdefb37913721f6d2`
- Committed local changes after BASE_REF: 없음
- Staged changes: 0
- Current unstaged tracked changes: 488 files, `+14,938 / -53,933`
- Current untracked inventory: 81 status entries / 124 files
- Audit-start baseline: tracked 463 files, staged 0, untracked 55 entries, `+12,751 / -53,708`
- Audit date: 2026-07-20 (Asia/Seoul)
- Blocker closure date: 2026-07-21 (Asia/Seoul)
- Reviewer environment: Codex, bash, WSL/Linux, Node 24.13.0, installed Google ADK 2.3.0
- Worktree rule: 감사 시작 전에 존재한 대규모 dirty state를 최신 통합 산출물로 간주했으며 reset·cleanup·commit·push하지 않았다.

## 2. Review scope

- Documents: active `docs/**`, canonical Taxonomy·Graph IR·Operating Model, migration status, decision log
- Skills: `.agents/skills`의 five-skill canonical tree와 필요한 direct references
- Schemas/types: analysis, Asset, Graph, A2A, scaffold plan, run manifest와 TypeScript strict readers
- UI/API: Analyze import, Design Graph/A2A review, approvals, Build/Verify readiness, Catalog publish
- Scaffold/generator: strict input gate, Graph lowering, MCP/A2A emission, ADK dependency, generated runtime validation
- Runtime patterns: MCP, A2A, Callback, Event Loop, Ambient, Human Input, Dynamic
- Tests: static/schema, unit, server integration, generated ADK compile/import/pytest, MCP/A2A behavior seams, browser review
- Handbook: L1/L2/Register/L3 source map, 58 active locators
- Excluded: `docs/archive/**`, `docs/handoff/**`, production endpoint/credential, external production service, deployment, remote push

상세 Finding과 명령 ledger는 [증분 감사 기록](../../.evidence-reviews/vnext-integrated-audit-2026-07-20.md)에 보존했다.

## 3. Source of Truth

| Concept | Canonical source | Compatibility / operational source | Status |
| --- | --- | --- | --- |
| Agent / Workflow / Tool | `docs/workbench/taxonomy.md` | `.agents/skills/_shared/taxonomy.md`, strict schemas/types | Aligned |
| Graph Node / Edge / Invocation Control | `docs/workbench/graph-ir.md` | `.agents/skills/_shared/graph-ir.md`, `schemas/graph.schema.json`, UI model | Aligned |
| Stage / approval / artifact lifecycle | `docs/workbench/operating-model.md` | lifecycle reference, manifest schema, server gates | Aligned |
| Runtime pattern selection | selected `.agents/skills/_shared/adk/*.md` card | installed ADK 2.3.0, generator and runtime tests | Scope-qualified |
| Current behavior navigation | current source code | Handbook locator | 58/58 active locators resolved |

## 4. Support matrix

| Pattern | Unsupported | Design-only | Scaffold-only | Smoke-tested | E2E (local) | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| MCP (HTTP) |  |  |  | ✓ | ✓ exact allow-list | Pass in local scope |
| A2A consuming/exposure |  |  |  | ✓ | ✓ success/failure | Pass in local scope |
| Callback / Plugin |  | ✓ |  |  |  | Pass in declared scope |
| Event Loop |  | ✓ |  |  |  | Pass in declared scope |
| Ambient |  | ✓ |  |  |  | Pass in declared scope |
| Human Input / Resume |  |  |  | ✓ | ✓ Runner restart/replay | Pass in structured contract scope |
| Dynamic (acyclic, non-loop) |  |  |  | ✓ |  | Pass in declared scope |

범위 해석:

- MCP는 Agent-selected HTTP Tool scaffold/import와 live model이 선택한 실제 Mock Lab Streamable HTTP tool call을 통과했다. 같은 server가 `lookup`과 `unapproved_admin_tool`을 광고한 fresh probe에서 generated `McpToolset`의 configured filter와 실제 discovery가 모두 `lookup` 하나였고, stdio/unknown transport는 계속 거부한다.
- A2A는 consuming/exposure bundle import와 실제 localhost ADK A2A peer 호출을 통과했다. Generated fail-closed wrapper는 remote error, failed/canceled/rejected task, unsupported input-required/auth-required와 usable result 없는 stream을 typed failure로 중단하며 full Workflow에서 success terminal을 emit하지 않았다. Reviewed input/auth follow-up과 fallback handoff는 failure context에만 남고 자동 resume/fallback으로 실행되지 않는다.
- Callback, Ambient, Event Loop는 Skill에서 계약을 설계할 수 있지만 Current generator의 runnable 지원으로 주장하지 않는다. S08/S10은 explicit Not Ready/Stop fixture다.
- Human Input은 approved `async_resume` 계약의 stable interrupt ID, expiry, restart replay, duplicate/conflict 처리와 session-state at-most-once synthetic Tool guard를 actual ADK 2.3.0 Runner에서 통과했다. 별도 `resume|timeout|cancel` control Edge 지원이나 production durable ledger를 뜻하지 않는다. Fresh S11 전체 behavior run은 Skill discipline `AFV2-014` 때문에 별도로 실패다.
- Dynamic은 acyclic non-loop Workflow만 실제 ADK 2.3.0에서 실행했다. loop와 의미가 구현되지 않은 control edge는 fail-closed한다.
- E2E 표시는 synthetic input, live Gemini model, localhost 실제 protocol peer를 한 흐름으로 실행했다는 뜻이다. production credential, 외부 승인 peer, 배포 readiness를 뜻하지 않는다.

## 5. Findings

- Blocker: 10건
- Major: 12건
- Moderate: 10건
- Minor: 1건
- Resolved: 32건
- Open / partially resolved: 1건 (`AFV2-014`, Moderate partial)
- Open Blocker: 0건
- Accepted risk:
  - `AFV2-025`: process crash 또는 rollback 중 storage failure까지 byte-atomic recovery를 보장하지 않는다. approval을 먼저 취소해 fail-closed한다.
  - localhost E2E는 synthetic input과 configured live model만 사용했다. production identity, credential provisioning, 외부 승인 MCP/A2A peer, 배포는 검증하지 않았다.

주요 해결 내용은 다음과 같다.

- 승인 Asset·typed Graph ownership·required Runtime Contract·unresolved semantic readiness를 shared fail-closed gate로 통합했다.
- manifest stale-write race와 multi-file partial apply를 lock, approval-first invalidation, reverse rollback으로 보완했다.
- Verify를 단일 command 성공에서 artifact + generated-runtime required evidence 집합으로 변경했다.
- generator는 HTTP transport, unsupported control, bound 없는 loop, default 없는 route를 fail-closed한다. Agent-owned MCP exact Tool allow-list와 Remote A2A typed failure terminal도 generated runtime 경계에 포함한다.
- structured async-resume 계약은 exact Human Input/Tool binding, stable ID, expiry, replay/conflict 처리와 session-state at-most-once synthetic Tool로 lowering한다.
- UI의 Verify readiness, Build direct-write copy, Analyze cache invalidation, Invocation Control label, A2A scope readiness를 server/schema와 맞췄다.
- strict v2가 아니던 S08/S10/S15 active fixture를 complete artifact set과 명시적 Stop으로 교체했다.

## 6. Vertical slice results

| Slice | Skill / contract | Artifact | UI | Generator | Runtime | Verify | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A: standalone Agent | canonical Discover→Compose→Scaffold gate를 반영한 strict fixture | root validation pass | 별도 UI 불필요 | pass | compile, pytest 4 passed, live model marker pass | generated-runtime pass | Pass at local live-model E2E |
| B: Agent + MCP Tool | Agent Invocation Control + approved `mcp_connection` | root validation pass | 실제 Design에서 `tool.retrieval · Agent` 확인 | pass | generated pytest 4 passed + live model/MCP call + two-tool exact-filter pass | generated-runtime pass | Pass in local scope |
| C: S07 A2A consuming | approved A2A contract + required `external_connection` | root validation pass | 실제 import, A2A contract review, 두 Design approval 통과 | pass | generated pytest 4 passed + real localhost ADK A2A + full-root failure pass | missing contract negative gate pass | Pass in local scope |

Path C의 필수 `external_connection`을 제거한 음성 case는 generator가 `Missing required runtime contract boundaries`로 종료 코드 1을 반환했다. UI 증거는 [Agent Invocation Control](../../.evidence-reviews/screenshots/vnext-design-agent-invocation-control.png), [Verify readiness](../../.evidence-reviews/screenshots/vnext-verify-readiness-gate.png), [A2A 승인 완료](../../.evidence-reviews/screenshots/vnext-a2a-design-approved.png)에 있다.

## 7. Fresh-session Skill results

세부 prompt/output은 [fresh-session evidence](../../.evidence-reviews/fresh-session-skill-routing-2026-07-20.md)에 기록했다.

### Codex

- Version: `codex-cli 0.144.6`
- Trigger: 5개 lifecycle prompt가 각각 `af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime`, `af-workflow`를 선택했다.
- Explicit invocation: `$af-discover-assets` pass
- Non-trigger: README 오탈자 요청에서 Agent Factory Skill을 선택하지 않았다.
- Outputs: predecessor gate와 Stop condition을 보존했고 파일 write는 없었다.
- Current isolated S16: direct `af-discover-assets`, no write, evaluator 5/5 pass.
- Current isolated S11 rerun: evaluator 11/11과 installed ADK Runner의 stable ID/restart/replay/expiry/at-most-once runtime은 pass했다. 다만 explicit scaffold 요청에서 `af-workflow`를 먼저 읽은 routing deviation, output root 밖 transient probe, mandatory reference read 증거 부족 때문에 전체 fresh behavior run은 `AFV2-014`로 fail이다. Product/runtime `AFV2-031` sub-verdict는 pass다.
- Evidence: [current S11 result](../../tests/skills/evidence/codex/S11-human-input-resume/fresh-20260720T165321Z/result-summary.md), [S16 result](../../tests/skills/evidence/codex/S16-canonical-direct/fresh-20260720T135900Z/result-summary.md), [Blocker closure](../../.evidence-reviews/vnext-blocker-closure-2026-07-21.md), [Codex 후속 runtime 기록](../../.evidence-reviews/codex-remaining-verification-2026-07-20.md).

### Claude Code — 비게이팅 참고

- Version: `2.1.215`
- Trigger: 같은 5개 lifecycle prompt가 올바른 canonical Skill과 Stop condition을 선택했다.
- Non-trigger: README 오탈자 요청에서 Agent Factory Skill을 선택하지 않았다.
- Explicit load: 승인된 test-only `.agents/skills/af-discover-assets/SKILL.md` load pass
- Native slash invocation: `/af-discover-assets`는 `Unknown command`; 공식 loader 경로 한계로 Passed 처리하지 않는다.
- Outputs: 파일 write 없이 routing/Stop을 보고했다.
- 이 결과는 기존 감사 중 수집한 참고 evidence다. 사용자 지시에 따라 Claude Code를 후속 완료 조건에서 제외했고, S11/S16 및 runtime 재검증은 Codex만 사용했다.

Legacy shim은 현재 canonical tree에서 제거됐고 current isolated S16 canonical-direct는 통과했다. `_shared`는 Skill로 노출되지 않았으며 deterministic validator는 canonical Skill 5개만 인식한다. S11 실패 때문에 current 16-scenario 완료 claim은 복원하지 않는다.

## 8. Commands and evidence

| Command | Exit | Evidence path / observed result | Claim supported |
| --- | ---: | --- | --- |
| `node scripts/validate-skills.mjs` | 0 | 5 skills, 0 errors, 0 warnings | Skill structure, links, retired shim absence |
| `node --test scripts/validate-artifacts.test.mjs` | 0 | 30/30 | schema/root validator parity and negative gates |
| `node scripts/validate-artifacts.mjs` | 0 | `Artifact validation OK` | active artifact/template set |
| `node scripts/generate-adk-source.test.mjs` | 0 | 33/33, actual ADK 2.3.0 runtime cases | generator support/fail-closed scope |
| `npm run test:analyzer --prefix packages/web` | 0 | full chain pass; final combined suites 63/63 | analyzer/server/UI/generator integration |
| `npm run build --prefix packages/web` | 0 | TypeScript + Vite, 686 modules | web build |
| `npm test --prefix packages/mock-lab` | 0 | real Streamable HTTP MCP bridge tests 2/2 | MCP mock behavior |
| `npm run build --prefix packages/mock-lab` | 0 | TypeScript + Vite, 42 modules | Mock Lab build |
| `node scripts/validate-generated-runtime.mjs <A/B/C-root>` | 0 each | compile 13 files + generated pytest 4 passed per slice | fresh generated runtime evidence |
| A2A missing `external_connection` generation | 1 expected | explicit missing-boundary error | negative fail-closed behavior |
| isolated Codex S11 evaluator commands | 0 each | 11/11 deterministic + actual ADK runtime pass; full agent behavior fail | AFV2-031 fixed, AFV2-014 partial |
| isolated Codex S16 evaluator commands | 0 each | 5/5, direct canonical Skill, no writes | current canonical-direct evidence; AFV2-014 |
| generated standalone Agent live-model run | 0 | Gemini 2.5 Flash, `CODEX_RUNTIME_OK`, 3 events | local live-model E2E for simple Agent |
| generated Agent + Mock Lab MCP live run | 0 | model-selected `lookup`, function call/response, `CODEX_MCP_OK` | localhost MCP success path |
| MCP two-tool allow-list probe | 0 | configured filter `lookup`; actual discovery `lookup` only | AFV2-032 fixed |
| generated S07 + real localhost ADK A2A run | 0 | 4 events, remote answer, auth/timeout/unavailable branches observed | localhost A2A success and connection behavior |
| A2A non-success full-Workflow/wrapper probes | expected typed failure | unavailable: 2 events/no terminal; input-required: interactive event preserved, full root 3 events/no terminal + reviewed follow-up failure | AFV2-033 fixed |
| Playwright CLI review | 0 | prior three screenshots + structured resume editor screenshot | real UI display/gate behavior |
| active docs relative-link check | 0 | 39 active Markdown files, 418 local targets, 0 broken | active docs navigation |
| Handbook path/anchor check | 0 | 58 active cards | locator path and stable anchor resolution |
| `git diff --check` | 0 | no output | patch whitespace integrity |

## 9. Handbook

- Snapshot: baseline `0cdcb82` + 2026-07-21 integrated worktree
- Active locator counts: `4 + 6 + 7 + 11 + 6 + 8 + 8 + 8 = 58`
- Updated stages: `runtime-handoff-build`, `verify-feedback`; Build locator now records async-resume/MCP/A2A failure boundaries
- Updated registers: Verify stage aggregate status, Catalog delta apply eligibility, Stage Runner evidence
- Active locators: 58/58 path exists and stable anchor resolves in current source
- Needs-review: 0
- Frozen: 0
- Unmapped in audited active scope: 0
- Source authority: Handbook은 locator이며 현재 source가 최종 권위다.

## 10. Remaining gaps

- 후속 작업의 권장 순서와 완료 기준은 [2026-07-21 vNext 후속 작업 인계](./2026-07-21-vnext-remaining-work.md)에 정리했다.
- Product: Callback, Ambient, Event Loop, dynamic loop와 명시적 callback/retry/fallback/error/resume/cancel/timeout control Edge의 runnable lowering은 지원하지 않는다.
- Open Blocker: 없음. `AFV2-031`, `AFV2-032`, `AFV2-033`은 [closure evidence](../../.evidence-reviews/vnext-blocker-closure-2026-07-21.md) 기준 Fixed다.
- Runtime: live model과 localhost 실제 MCP/A2A success path는 검증했다. 외부 승인 peer, production auth/deployment, persistent production store, TLS/mTLS, observability는 미검증이다.
- Migration: current isolated S16은 완료했고 S11 Product/runtime는 통과했지만, S11 agent routing/output boundary/reference evidence가 실패해 `AFV2-014`와 historical 16-scenario 완료 claim은 열려 있다.
- Documentation: active docs의 알려진 broken link 또는 stale locator는 없다. archive/handoff는 범위 밖이다.

## 11. Changed files

현재 전체 `git diff --name-status`는 감사 시작 전 통합 산출물을 포함해 487 tracked files이므로 이 보고서에서 사용자 소유 baseline을 감사 수정으로 오표기하지 않는다. 감사가 직접 보완한 핵심 surface는 다음과 같다.

- validator/generator/runtime evidence: `scripts/validate-artifacts.mjs`, tests, `scripts/adk-source/**`, `scripts/validate-generated-runtime.mjs`, `requirements/adk-runtime.txt`
- schema/analyzer/readiness: `schemas/**`, `packages/web/src/analyzer/**`, strict scaffold/runtime contract validators
- server safety/Verify/Catalog: `artifactRootStore.ts`, `stageRunner.ts`, `manifestValidation.ts`, `afVerifyRunApi.ts`, Catalog publish validation과 tests
- UI: Analyze import, Design Graph/A2A validator, structured Runtime Contract editor, Build narrative, Verify readiness, Invocation Control label과 tests
- Skills: Compose/Verify canonical SKILL과 direct references
- active fixtures: S07/S08/S10/S11/S15 strict context, evaluator 및 manifest template
- docs: Operating Model, Decision Log, migration status, Handbook Build/Verify/Register, 본 보고서
- audit evidence: `.evidence-reviews/vnext-integrated-audit-2026-07-20.md`, `.evidence-reviews/codex-remaining-verification-2026-07-20.md`, `.evidence-reviews/vnext-blocker-closure-2026-07-21.md`, fresh-session evidence, current official Codex S11 evidence와 Runtime Contract editor screenshot

감사 closure snapshot에는 staged file이 없고 remote push도 수행하지 않았다. 이후 게시 상태는 Git history와 [후속 작업 인계](./2026-07-21-vnext-remaining-work.md)가 가리키는 closure PR을 따른다.

## 12. Explicit confirmations

- Raw requirement direct code path: None; scaffold/generator predecessor gates와 negative tests로 차단
- Approval bypass: **Closed for audited MCP path** — exact approved `tool_name` filter와 two-tool discovery probe로 `AFV2-032` 수정 확인
- Private endpoint or credential added: No; localhost/synthetic identifiers와 environment-variable name만 사용
- Unsupported feature claimed as supported: No — structured async-resume만 supported로 한정하고 명시적 resume/timeout/cancel Edge와 Callback/Ambient/Event Loop/dynamic loop는 계속 unsupported로 표기
- Fresh runtime evidence available: Yes, live-model + localhost protocol success path, MCP exact allow-list, A2A fail-closed, actual ADK Runner resume/replay level; not production E2E
- Handbook source verification complete: Yes for 58 active locators; dynamic external behavior remains runtime evidence 영역
- Remote push performed during audit: No. 감사 종료 뒤의 게시 작업은 판정 범위와 분리한다.
