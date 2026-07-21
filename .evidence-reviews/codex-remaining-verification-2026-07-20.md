# Codex-only remaining verification — 2026-07-20

> 2026-07-21 closure: 이 문서의 원래 본문은 세 runtime Blocker를 발견한 pre-fix evidence다. 이후 `AFV2-031`, `AFV2-032`, `AFV2-033`은 모두 Fixed됐고 open Blocker는 0건이다. Current proof와 최종 판정은 [vNext Blocker closure](./vnext-blocker-closure-2026-07-21.md)와 `docs/reviews/2026-07-20-vnext-audit.md`를 따른다. Fresh Skill behavior의 `AFV2-014` Moderate partial만 별도 잔여 finding이다.

## 2026-07-21 closure addendum

- Fresh isolated Codex S11: deterministic evaluator 11/11, generated compile/pytest, installed ADK 2.3.0 Runner stable-ID restart/replay/expiry/at-most-once PASS. Agent behavior는 `af-workflow` 선행 routing, output-root 밖 transient probe, mandatory-reference 증거 부족으로 FAIL (`AFV2-014`).
- MCP two-tool probe: configured `tool_filter=["lookup"]`, actual discovered Tools `['lookup']`; `unapproved_admin_tool` 제외 (`AFV2-032` Fixed).
- Remote A2A full-root failure probe: generated typed failure, event 2개, terminal output/completed 없음. Final review의 input-required 추가 반례도 보완 후 interactive event를 보존하고 full root 3 events/terminal 0 + reviewed follow-up typed failure로 종료 (`AFV2-033` Fixed).
- Human Input actual Runner probe: stable ID `synthetic-approval-001`, restart resume, apply count 1, duplicate replay, conflict/wrong-ID reject, timeout/reject/abandoned no-side-effect (`AFV2-031` Fixed).
- Final regression baseline: Skills 5/0/0, artifact 30/30, generator 33/33, web integrated 63/63 + build 686 modules, Mock Lab 2/2 + build 42 modules.
- Claude Code는 사용자 지시에 따라 재실행하지 않았고 non-gating이다.

## Scope and environment

- Target: current working tree at `main` / `0cdcb829480def3c0a8ba4afdefb37913721f6d2`
- Working directory: `/home/ilmaswsl/work/Agent-Factory`
- Tool: `codex-cli 0.144.6`
- Completion criterion: Codex behavior only. Claude Code discovery or slash-loader compatibility is non-gating by user direction.
- Operating constraint: preserve the current dirty working tree, do not commit or publish, use synthetic/local runtime inputs only, and leave no test server running.

## Verification sequence

1. Run S11 Human Input/Resume from a fresh isolated Codex session with only `prompt.md` and `context/` visible.
2. Run S16 canonical-direct discovery from a separate fresh isolated Codex session with only `prompt.md` and `context/` visible.
3. Probe the installed ADK/runtime environment without recording secret values or private endpoints, then run the strongest applicable local runtime checks.
4. Update the integrated audit ledger and final report, then run final consistency checks.

## Testing contract

- Fresh-session scenario evidence is current-worktree evidence, not a reuse of the 2026-07-18/19 historical runs.
- Evaluation files (`expected-*`, `forbidden-outcomes.md`, `verification-commands.txt`, `rubric.md`) remain outside the test agent's visible harness until each run ends.
- Every skipped or unavailable runtime layer is reported as `unverified`, not `pass`.
- Runtime claims distinguish deterministic structure, compile/import, synthetic behavior, and live external interoperability.

## Progress ledger

| Step | Status | Evidence |
| --- | --- | --- |
| Scope and contract | complete | Current revision/tool captured; Codex-only criterion recorded |
| S11 fresh-session | mixed | Product/runtime PASS; agent behavior FAIL for AFV2-014 routing/output-boundary/reference evidence |
| S16 fresh-session | pass | Direct `af-discover-assets`, no write, five evaluator commands pass |
| Local runtime | complete | Live model, localhost MCP/A2A, exact MCP filter, A2A fail-closed, Human Input restart/replay pass in declared scope |
| Report reconciliation | complete | three Blockers Fixed; open Blocker 0; AFV2-014 Moderate partial retained |

## Historical pre-fix S11 Human Input / Resume

### Fresh-session setup

- Ephemeral thread: `019f7fcc-5b10-7131-96fe-6047d14cfbd3`
- Requested model: `gpt-5.6-luna`, reasoning effort `low`; no fallback was reported.
- Harness: `/tmp/af-codex-s11-20260720-c3GvG7/project`
- Visible scenario input: `scenario-input/prompt.md` and seven files under `scenario-input/context/` only.
- Hidden until completion: expected Skill, expected artifacts, forbidden outcomes, verification commands, and rubric.
- Write-boundary check: no input, Skill, source, schema, script, template, or documentation hash changed; writes stayed under `scenario-output/runtime/`.

### Observed routing and generation

- The run first selected `af-workflow`, then selected the expected `af-scaffold-runtime`. This is a direct-routing deviation because the prompt is an explicit scaffold request and the canonical routing contract says to invoke the matching Work Skill directly.
- It read the scaffold Skill, source-of-truth, lifecycle, artifact-sync, and output-mode references, validated the complete approved artifact set, and ran the canonical generator.
- It did not read the required Target Contract v2, Runtime Pattern Selection/Human Input, or Generated Output Checks references before emitting and claiming the runtime.
- The generated Tool remained an unconnected TODO stub. The test agent added an output-local dependency-free HTTP store/API to demonstrate pause, resume, duplicate, restart, and reject behavior.

### Fresh deterministic evidence

- All nine evaluator commands exited `0`.
- System-Python result: `6 passed, 1 skipped`; the skipped check was the ADK import/runtime check.
- Installed runtime (`google-adk 2.3.0`) result: `7 passed`, with four deprecation warnings.
- Host TCP smoke on `127.0.0.1:18787` proved pending pause, wrong interrupt `409`, invalid response `409`, approve, duplicate response with `apply_count=1`, reject without apply, and persisted restart recovery. The listener was stopped after the check.

### Hidden-rubric and real-runtime result

- The output-local tests cover duplicate, restart, and reject, but have no timeout or abandoned-request assertions. The implementation has no timestamp or expiry transition; an abandoned invocation remained `pending_approval` after restart.
- Installed ADK 2.3.0 converted the generated `RequestInput` into `adk_request_input`, and resume with the emitted function-call ID completed the same invocation. A duplicate completed response emitted no new events.
- The emitted interrupt ID was a random UUID, not the approved stable `synthetic-approval-001`. Resume using the approved ID failed with `Function call not found` because `scripts/adk-source/emitters/hitl.mjs` does not pass `interrupt_id` to `RequestInput`.
- The ADK Workflow and the added HTTP idempotency store are separate paths: the generated ADK Tool remains a TODO stub, so at-most-once side-effect protection is not proven on the actual ADK resume path.

### Verdict

Historical pre-fix verdict: `FAIL`. 이 결과가 `AFV2-031`을 열었다. 2026-07-21 rerun에서 approved stable correlation, expiry, restart replay와 integrated synthetic side-effect guard는 통과해 `AFV2-031`은 Fixed됐다. Full agent behavior FAIL은 direct Skill routing, mandatory reference evidence, output boundary를 묶은 `AFV2-014`로만 남는다.

## S16 canonical-direct

### Fresh-session setup

- Ephemeral thread: `019f7fd4-e1b1-70f2-aad5-46a896afd76f`
- Requested model: `gpt-5.6-luna`, reasoning effort `low`; no fallback was reported.
- Harness: `/tmp/af-codex-s16-20260720-fUJird/project`
- Visible scenario input: `scenario-input/prompt.md` and `scenario-input/context/README.md` only.
- Hidden until completion: expected Skill, expected artifacts, forbidden outcomes, verification commands, and rubric.
- Write-boundary check: all baseline hashes were unchanged and `scenario-output/` remained empty.

### Observed behavior

- The first message explicitly selected `af-discover-assets`; neither `af-workflow` nor a retired compatibility entrypoint was read.
- It read the canonical discovery Skill and its required source-of-truth, lifecycle, taxonomy, and evidence/candidate-discovery references once.
- The response produced one Agent candidate, no Workflow, no Tool, one clearly non-asset Resource candidate, separated Evidence/Assumption/Missing Information, and stopped before design because the classification taxonomy and output contract were unresolved.
- It preserved the explanation-only/no-file boundary and did not create or mutate an artifact, approval, stage status, or runtime output.

### Fresh deterministic evidence

- `node scripts/validate-skills.mjs`: exit `0`, five canonical Skills, zero errors and warnings.
- Expected-Skill JSON parse: exit `0`.
- Canonical `name: af-discover-assets` check: exit `0`.
- Four retired Skill directory absence check: exit `0`.
- Sixteen-scenario inventory check: exit `0`.

### Verdict

`PASS`. S16 proves direct canonical invocation, single-pass discovery, strict top-level asset classification, Stop behavior, and write absence on the current worktree.

## Runtime environment probe

- Installed: `google-adk 2.3.0`, `google-genai 2.9.0`, `litellm 1.89.3`, `a2a-sdk 0.3.26`, `mcp 1.28.0`.
- Configured variable names: `GOOGLE_API_KEY`, `AF_MOCK_LAB_MCP_URL`; values were not printed or copied into evidence.
- `agents-cli info` found no agents-cli project in the repository or generated S11 runtime. No project was scaffolded because this task verifies the existing Agent Factory generator/output and does not authorize a separate agents-cli project.
- All runtime payloads, IDs, endpoints, and auth values used below were localhost or explicitly synthetic.

## Level 1-5 runtime results

| Level | Result | Fresh evidence |
| --- | --- | --- |
| 1 — Skill/procedure | mixed | S16 direct discovery pass; S11 scaffold run fails full rubric |
| 2 — Artifact/contract | pass | S11, S07, standalone model, and MCP fixtures pass strict artifact validation |
| 3 — Generated code | pass | Fresh model/MCP/S07 bundles compile and each generated pytest suite passes 4/4; S11 passes 7/7 in the shared ADK venv |
| 4 — Connection/runtime | mixed | Human Input, MCP, A2A success/auth/timeout/unavailable paths executed; contract-loss findings below remain |
| 5 — Behavior/E2E | scope-qualified | Live Gemini model, model-selected localhost MCP call, and real localhost ADK A2A peer pass with synthetic input; production/external peer behavior remains unverified |

## Live model-backed generated runtime

- A fresh strict v2 standalone Agent fixture was generated under `/tmp/af-live-model-20260720-fraRhp`.
- Artifact validation, generation, compile, and generated pytest all exited `0`; pytest reported `4 passed`.
- The generated Workflow ran through `InMemoryRunner` using runtime-env auto selection and resolved `gemini-2.5-flash`.
- One live synthetic request returned the expected `CODEX_RUNTIME_OK` marker: 3 events, 2 non-empty text events, process exit `0`.
- This closes the earlier “no live model-backed invocation” gap for the generated simple-Agent path. It does not prove production quotas, deployment, private data handling, or every Graph pattern.

## Live model + localhost MCP E2E

- A fresh strict v2 Agent-selected MCP fixture was generated under `/tmp/af-live-mcp-20260720-Zl2PPR` with reviewed binding `server_ref: lookup-server`, `tool_name: lookup`.
- A temporary Mock Lab child and Streamable HTTP bridge ran on `127.0.0.1:18788`; discovery reported `running: true`, `connected: true`, Tool `lookup`.
- Artifact validation, generation, compile, and generated pytest all exited `0`; pytest reported `4 passed`.
- Generated ADK → Gemini 2.5 Flash → `lookup` function call → Mock Lab MCP → function response → final model answer completed in one run. The event stream contained one `lookup` call/response and the answer contained both `CODEX_MCP_OK` and `agent-factory-mock-lab`; the audit log recorded `tools/call`.
- Direct MCP invalid input was rejected with `-32602`; valid input returned structured synthetic content.
- With the server stopped, generated `McpToolset.get_tools()` failed closed in `0.367s`. Against a non-responsive local endpoint it returned a connection failure after `10.721s`, proving a bounded current-library default/retry window rather than a contract-specific timeout.
- Cleanup: Mock Lab child, bridge, and stall server were stopped; port `18788` had no listener.

### Historical AFV2-032 MCP contract-loss finding — Fixed 2026-07-21

The reviewed binding named exactly one Tool, but the pre-fix emitter omitted `tool_filter`; a second synthetic server exposed both Tools. Current emitter generates the exact reviewed filter, and the fresh two-tool probe discovered only `lookup`. Closure: `AFV2-032` Fixed.

## Live model + localhost ADK A2A E2E

- Fresh S07 artifacts passed strict validation, generation, compile, and generated pytest (`4 passed`).
- A real ADK 2.3 `to_a2a` provider ran on `127.0.0.1:18081`; its Agent Card resolved with JSON-RPC transport.
- Generated S07 consumer ran its local Gemini 2.5 Flash coordinator, `RemoteA2aAgent`, and provider model in one invocation. Four events were observed, no error event occurred, and the remote answer contained `Apply the fixed synthetic rule`.
- Missing `AF_A2A_SYNTHETIC_TOKEN` produced the expected explicit runtime-policy error and did not contact the remote answer path.
- A slow real ADK A2A peer produced `Client Request timed out` at `5.027s`, matching the generated `_timeout=5` contract.
- With the provider unavailable, `RemoteA2aAgent` emitted a concrete Agent Card resolution error.
- Cleanup: both normal and slow A2A providers were stopped; port `18081` had no listener.

### Historical AFV2-033 A2A terminal-state finding — Fixed 2026-07-21

The pre-fix full generated Workflow continued over the unconditional `next` edge after a Remote A2A error. Final review also found that content-bearing input-required could pass as usable. Current generated fail-closed wrapper raises a typed failure for error/failed/canceled/rejected, unsupported input/auth-required, and empty/long-running-only results. The fresh full-root probe emitted no terminal output or completed status. Input-required remains visible as an interactive event, then the wrapper raises with the reviewed follow-up before any success terminal. Closure: `AFV2-033` Fixed; remote resume/manual fallback are not automatically executed.

## Runtime residual uncertainty

- A live public model was called only with synthetic text. Provider availability, rate limits, spend controls, and production data policy were not tested.
- MCP and A2A peers were real protocol implementations on localhost, not approved external/production services.
- Production identity, secret provisioning, deployment, persistent session/task stores, TLS/mTLS, and observability remain outside this audit authority and are `unverified`, not passing.

## Final consistency and cleanup

- `node scripts/validate-skills.mjs`: 5 Skills, 0 errors, 0 warnings.
- `node scripts/validate-artifacts.mjs`: pass; `node --test scripts/validate-artifacts.test.mjs`: 30/30 pass.
- `node scripts/generate-adk-source.test.mjs`: 33/33 pass.
- `npm run test:analyzer --prefix packages/web`: exit 0, final combined suites 63/63; `npm run build --prefix packages/web`: 686 modules.
- `npm test --prefix packages/mock-lab`: 2/2; `npm run build --prefix packages/mock-lab`: 42 modules.
- Active docs: 39 Markdown files, 418 local link targets, 0 broken. Handbook: 58 locator cards, 0 missing path/anchor.
- Official S11 and S16 evidence directories each contain the required seven files. Secret signature scan found no credential value or private key pattern.
- `git diff --check`: pass. Ports `5173`, `5176`, `18081`, `18787`, `18788` have no listener and no matching temporary test process remains.
