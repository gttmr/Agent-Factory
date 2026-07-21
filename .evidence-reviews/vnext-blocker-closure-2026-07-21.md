# Agent Factory vNext Blocker closure — 2026-07-21

> 판정: 통합 감사에서 새로 연 `AFV2-031`, `AFV2-032`, `AFV2-033`은 현재 작업트리에서 모두 수정되고 Codex/installed ADK 2.3.0 기준으로 재검증됐다. **Open Blocker는 0건**이다. Fresh Skill behavior의 `AFV2-014` Moderate partial과 production/external-runtime 불확실성은 별도 잔여 항목이다.

## Scope

- Repository: `/home/ilmaswsl/work/Agent-Factory`
- Baseline revision: `0cdcb829480def3c0a8ba4afdefb37913721f6d2` plus the current dirty-worktree snapshot
- Runtime: Node 24.13.0, `google-adk 2.3.0`, `mcp 1.28.0`, `a2a-sdk 0.3.26`
- Agent criterion: Codex only. 사용자 지시에 따라 Claude Code는 재실행하지 않았고 gate로 사용하지 않았다.
- Data/network boundary: synthetic input과 localhost protocol peer만 사용했다. credential value, private endpoint, production deployment는 사용하지 않았다.
- Worktree boundary: existing dirty state를 최신 산출물로 보존했고 reset, commit, push를 수행하지 않았다.

## Closure summary

| Finding | 이전 반례 | 수정된 경계 | Fresh result |
| --- | --- | --- | --- |
| `AFV2-031` Human Input resume | approved stable ID·expiry·idempotency가 generated ADK path에서 소실 | typed `resume_policy`/`side_effect_guard`, exact Node/Tool binding, stable ID, invocation record, expiry, replay/conflict guard, session-state at-most-once synthetic Tool | **Fixed / PASS** |
| `AFV2-032` MCP allow-list | reviewed `lookup`과 같은 server의 `unapproved_admin_tool`이 모두 Agent surface에 노출 | Agent-owned `McpToolset(tool_filter=[approved tool_name])`; Workflow-owned exact Tool call 유지 | **Fixed / PASS** |
| `AFV2-033` Remote A2A terminal | remote error 또는 interactive non-success 뒤 ordinary edge가 success terminal `completed`까지 진행 가능 | error/failed/canceled/rejected, unsupported input/auth-required, empty/long-running-only result를 typed failure로 중단; reviewed follow-up/fallback은 context-only | **Fixed / PASS** |

Recorded finding 총수는 Blocker 10, Major 12, Moderate 10, Minor 1이다. 이번 closure 뒤 resolved는 32건이고 open/partial은 `AFV2-014` 한 건이다. 즉 recorded Blocker 수는 10이지만 **현재 open Blocker 수는 0**이다.

## Level 1 — Skill and procedure

- `node scripts/validate-skills.mjs`: 42 files, 37 Markdown, canonical Skills 5, errors 0, warnings 0.
- Fresh isolated Codex S11은 hidden evaluator를 노출하지 않은 상태에서 Runtime Handoff를 생성했고 deterministic evaluator 11/11과 installed ADK runtime을 통과했다.
- 다만 S11 agent behavior는 `af-workflow`를 먼저 읽은 뒤 `af-scaffold-runtime`으로 이동했고, transient `/tmp/s11_runtime_probe.py`를 output root 밖에 썼으며, 모든 mandatory reference read를 보존된 로그로 인증하지 못했다. 따라서 전체 run은 `AFV2-014` 때문에 FAIL이고 Product/runtime sub-verdict만 PASS다.
- Official seven-file evidence: `tests/skills/evidence/codex/S11-human-input-resume/fresh-20260720T165321Z/`.

## Level 2 — Artifact and contract

- `analysis-result.schema.json`, `scaffold-plan.schema.json`, TypeScript runtime contract types와 target validator가 `async_resume`의 typed `resume_policy`와 `side_effect_guard`를 요구한다.
- Duplicate interrupt ID, dangling Human Input/Tool annotation, idempotency input mismatch, unsafe side-effect route는 validator/generator에서 fail-closed한다.
- S11 strict artifact root와 repository root artifact validation이 통과했다.
- Design Runtime Contract editor에서 policy/guard 전체를 표시하고 수정·revert가 동작했다. 60초를 90초로 바꾸면 save/revert가 활성화되고 revert가 60초를 복원했다. Screenshot: [AFV2-031 Runtime Contract editor](./afv2-031-runtime-contract-editor-2026-07-21.png).

## Level 3 — Generated code

- `node scripts/generate-adk-source.test.mjs`: 33/33 pass. 이 집합은 exact MCP filter, async-resume lowering/actual ADK restart behavior, Remote A2A typed failure, 기존 graph/dynamic fail-closed 범위를 함께 검사한다.
- Fresh S11 bundle: Python compile 13 files, generated pytest 4 passed.
- Fresh S07 bundle: Python compile 13 files, generated pytest 4 passed.
- Generated contract test는 plain `Workflow`뿐 아니라 contract-backed `_AsyncResumeWorkflow` root도 허용하도록 갱신됐다.

## Level 4 — Connection and runtime

### AFV2-031 Human Input / Resume

Installed ADK 2.3.0 `Runner`로 새 invocation을 pause한 뒤 새 Runner instance에서 같은 invocation과 approved stable ID를 resume했다.

```json
{"google_adk_version":"2.3.0","interrupt_id":"synthetic-approval-001","apply_count":1,"duplicate_apply_count":1,"restarted_apply_count":1,"conflict":"rejected","timeout":"expired_without_side_effect","wrong_id":"rejected"}
```

관찰한 invariant:

- abandoned pending request는 side-effect ledger를 만들지 않았다.
- approve는 한 번만 apply됐고 duplicate response 및 같은 idempotency key의 두 번째 invocation은 recorded result를 replay했다.
- conflicting response와 wrong interrupt ID는 거부됐다.
- reject와 expiry는 side effect 없이 cancel path로 끝났다.
- ledger는 reviewed `session_state` local/synthetic 경계다. process-independent production durable store는 검증하지 않았다.

### AFV2-032 MCP exact allow-list

Local FastMCP server가 `lookup`과 `unapproved_admin_tool`을 함께 광고하도록 한 뒤 fresh generated Agent의 실제 `McpToolset.get_tools()`를 실행했다.

```json
{"configured_filter":["lookup"],"discovered_tools":["lookup"]}
```

처음 probe는 generated URL `/mcp/audit-mcp`와 test server `/mcp` path가 달라 실패했다. Server path를 approved connection과 일치시켜 재실행한 결과 위 exact filter가 관찰됐다. 미승인 Tool은 discovery/call surface에 포함되지 않았다.

### AFV2-033 Remote A2A fail-closed

- Actual ADK `RemoteA2aAgent._run_async_impl` seam에서 success, error event, failed task, input-required, auth-required, long-running-only, working-only, empty stream을 실행했다.
- error/failed/input-required/auth-required/long-running-only/working-only/empty는 generated `_RemoteA2aFailure_*`로 종료했고 reviewed input/auth follow-up과 `fallback_handoff=manual_review`가 failure context에 포함됐다.
- Fresh generated S07 full root에서 local LlmAgent success 뒤 Remote A2A error를 발생시켰다. 결과는 typed failure, event 2개, terminal output 없음이었다. 과거 반례의 `{status: "completed"}`는 재현되지 않았다.
- Final review 중 pre-fix generated wrapper가 content를 가진 `TASK_STATE_INPUT_REQUIRED`를 1 event, failure 없음으로 통과시키는 추가 반례를 재현했다. Wrapper를 보완한 뒤 interactive event는 Workbench 관찰을 위해 그대로 유지됐고, 같은 actual ADK seam은 그 다음 typed failure를 반환했다. Full generated root는 3 events 중 input-required 1개를 보존하고 terminal output 없이 끝났으며 S07의 reviewed `input_required_followup`을 failure message에 포함했다.
- Existing localhost actual ADK A2A success/auth/timeout/unavailable connection evidence도 유지된다. 이번 closure는 failure terminal 의미를 별도로 재검증했다.

## Level 5 — Behavior and UI

- MCP: 같은 server에 추가 Tool이 있어도 approved Tool 하나만 Agent surface에 노출된다.
- A2A: remote failure와 현재 consumer가 이어갈 수 없는 input/auth-required가 success completion으로 뒤집히지 않는다. 자동 remote resume/fallback은 생성하지 않고 reviewed follow-up/manual handoff context만 전달한다.
- Human Input: approved stable correlation과 at-most-once synthetic side effect가 actual ADK Runner restart 경로에서 유지된다.
- Design UI: structured resume policy와 side-effect guard가 편집 가능하고 readiness issue 0인 상태를 real browser로 확인했다.
- Fresh Codex S11 behavior 전체는 Product 결과와 분리해 FAIL로 기록했다. Runtime correctness를 Skill routing/output-boundary correctness로 오표기하지 않는다.

## Regression ledger

| Command/check | Result |
| --- | --- |
| `node scripts/validate-skills.mjs` | pass — 5 Skills, 0 errors/warnings |
| `node --test scripts/validate-artifacts.test.mjs` | pass — 30/30 |
| `node scripts/validate-artifacts.mjs` | pass |
| S11 `verification-commands.txt` | pass — 11/11; actual ADK Runner evidence above |
| `node scripts/generate-adk-source.test.mjs` | pass — 33/33 |
| `npm run test:analyzer --prefix packages/web` | pass — final combined 63/63 |
| `npm run build --prefix packages/web` | pass — 686 modules |
| `npm test --prefix packages/mock-lab` | pass — 2/2 actual Streamable HTTP MCP |
| `npm run build --prefix packages/mock-lab` | pass — 42 modules |
| fresh S11/S07 generated-runtime validator | pass — compile 13 + pytest 4 each |
| Playwright fixed-port Design editor check | pass — screenshot linked above |
| active docs relative-link check | pass — 39 Markdown, 418 local targets, 0 broken |
| Handbook path/anchor check | pass — 58 active cards, 0 missing |
| `git diff --check` and cleanup sweep | pass — no whitespace error; ports 5173/5176/9222/18081/18787/18788 clear; owned `/tmp/af-*` harnesses removed |

## Residual findings and uncertainty

1. `AFV2-014` — **Moderate, partial**. Fresh explicit S11 scaffold request still routed through `af-workflow` first, wrote one transient probe outside the output root, and did not retain enough evidence to certify all required reference reads. Historical 16-scenario completion claim remains un-restored.
2. Callback/Plugin, Ambient, Event Loop, dynamic loop and explicit callback/retry/fallback/error/resume/cancel/timeout Graph control Edge lowering remain unsupported and fail-closed. Contract-backed Human Input support does not change that boundary.
3. External approved MCP/A2A peers, production identity/secrets, persistent production session/idempotency store, TLS/mTLS, deployment, quotas and observability were not tested.
4. Claude Code was not rerun by explicit user direction and is non-gating.

## Final disposition

- Three newly opened Blockers: **all fixed**.
- Open Blockers: **0**.
- Product/runtime support claimed by the current matrix: **review-ready for the verified local/synthetic scope**.
- Full Skills behavior campaign: **not complete** because `AFV2-014` remains partial.
- Commit/push: not performed.
