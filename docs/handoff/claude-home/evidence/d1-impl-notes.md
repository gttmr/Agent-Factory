# PR-A dynamic edge-driven implementation notes

Date: 2026-07-12  
Worktree: `/home/ilmaswsl/work/af-wt-d1`  
Branch: `codex/dynamic-edge-driven`  
Design authority: `.d0-design.md` (APPROVED D1-D12)

## Scope and stop-gates

- PR-A only: A1 edge-topological dynamic planning, A2 dynamic join barriers/result maps, A3 plan-authoritative coverage, the exact §4.4 touch list, §6 PR-A test layers, and requested active-doc updates.
- No commits, no HTTP servers, no schema/catalog/template/static/smoke production changes.
- D8 is a hard stop: production work proceeds only after a real ADK 2.3 `InMemoryRunner` RED/GREEN proof shows a loop-body `RequestInput` resumes correctly when the dynamic parent reruns with deterministic explicit child run IDs.
- Documentation impact: yes. Dynamic execution order, loop membership, fan-in, reachability, and cycle rejection are active runtime contracts, so the designated harness/validation/CLAUDE/decision-log files must change.

## Pre-change environment and byte baselines

- Shared runtime: `google-adk 2.3.0`, Python at `../Agent-Factory/.agent-factory/runtime/.venv/bin/python` (also reachable through the worktree runtime symlink).
- Canonical generator-test smoke fixture: 23 files, normalized relative-path/SHA-256 manifest digest `ceba23d0fdab057671191cc7328fd59654250a82b8a54f7124d272bfc81cd747`.
- Canonical generator-test static-runnable fixture: 26 files, normalized relative-path/SHA-256 manifest digest `f448e684ed58825d9bef426f8534eb1e8f09e1f99c176d308d48efe997ade794`.
- D11 implementation will keep per-file SHA-256 rows as the authoritative baseline and report mismatched relative paths; the two digests above are compact evidence only.

## Current dynamic byte-diff exposure

Before implementation, the existing regression scenarios were enumerated against their reviewed edges:

| Scenario / fixture | Before PR-A | After PR-A byte result and rationale |
| --- | --- | --- |
| `scenario-d-graph-workflow` | Forward order happens to be topological, but `join-001` is dropped and `mod-005` + `human_input_001` sit outside the loop walk. | Dynamic `agent.py` changes: the join becomes a barrier and edge-path closure puts the complete human-review path inside each iteration. |
| `dynamic-loop-lowering.test.mjs` fixture | Mutable payload chain in draft → review → control → terminal order. | Dynamic `agent.py` changes: order stays the same, while result maps, encoded deterministic run IDs, and iteration-local state change bytes. |
| `dynamic-loop-decisions.test.mjs` fixture | Mutable payload chain in parameter check → human input → control → fixed adapter → terminal order. | Dynamic `agent.py` changes: order stays the same, while result maps, encoded deterministic run IDs, and bounded iteration bookkeeping change bytes. |
| Dynamic-module fixture in `dynamic-loop-guards.test.mjs` | Non-loop dynamic mutable payload chain. | Dynamic `agent.py` changes without call reorder: edge-derived result maps and deterministic run IDs are emitted. |
| Missing-decision rejection fixture | Rejects before bundle write. | Still no generated bundle; truthful guard ordering/message details may change. |
| `scenario-g-human-input-review` | Static runnable. | No byte change; protected by the pre-change static SHA-256 baseline. |
| `scenario-i-remote-a2a` | Static runnable. | No byte change; protected by the pre-change static SHA-256 baseline. |
| `wf-page-recommendation-required` | Static runnable with an intentionally non-topological declaration array. | No byte change; PR-A does not route it through dynamic lowering. |
| Canonical smoke fixture | Smoke builder output. | No byte change; protected by the pre-change smoke SHA-256 baseline. |

No existing dynamic fixture has a shuffled forward node array, so PR-A must add an intentionally shuffled dynamic regression to make edge-derived ordering observable.

## D4 artifact scan before rejection enforcement

Command shape: tracked `*.json` files from `git ls-files`, parsed for root or embedded `processFlow`, grouped by incoming target edge. Result: 47 tracked JSON files scanned; nine multi-predecessor convergence points found.

- Reviewed explicit fan-in joins: scenario B `join-001`, scenario D `join-001`, scenario G `join-001`, scenario H `join-001`.
- Reviewed implicit fan-in: `wf-page-recommendation-required` targets `node-select-initial-page` and `node-synthesize-analysis`.
- Mixed control/route convergence, not repeated normal execution: scenario D `mod-004` receives explicit-join output plus `loop_back`; `wf-page-recommendation-required` `node-confirm-final-selection` receives conditional/normal route convergence.
- The only all-normal multi-predecessor target is scenario K `node-output`, a static runnable terminal fed by two notification nodes. It is not a dynamic regression and does not establish repeated execution semantics for the dynamic one-run-per-node plan.

Conclusion: no current dynamic artifact intentionally models multiple normal incoming edges as repeated execution. Enforcing D4's clear rejection for ambiguous dynamic normal convergence is consistent with the scanned artifact set.

## Progress ledger

- [x] Read approved design, relevant local AGENTS files, ADK dynamic/HITL references, and runtime-handoff checks.
- [x] Confirm branch/worktree boundary and record pre-existing untracked paths without modifying them.
- [x] Record pre-change smoke/static SHA-256 manifest digests.
- [x] Rerun and record the D4 artifact scan.
- [x] Add RED plan/runtime regressions and D11 per-file manifest baseline mechanism.
- [x] Prove D8 RED/GREEN with real ADK `InMemoryRunner`; stop here if the proof fails.
- [x] Implement A1/A2/A3 production lowering.
- [x] Update active docs and decision log.
- [x] Run and record all requested verification gates, separating sandbox-blocked aggregate commands from passing direct checks.

## D8 real ADK RED/GREEN gate

Runtime: shared venv `google-adk 2.3.0`; no HTTP server, model call, MCP call, or socket used. The gate uses the generated `dynamic_workflow` and generated loop-body HITL function under a real `Workflow` + `InMemoryRunner`, with deterministic local `FunctionNode` replacements for unrelated LLM nodes.

RED (`/tmp/af-d8-red-pr-a-20260712`):

- First turn reached one `adk_request_input`; the valid resume payload used the same function-call ID and `FunctionResponse.response={"result":"done"}` because ADK 2.3 unwraps the single `result` key before applying `response_schema=str`.
- Resume completed, but every generated child path used only implicit numeric IDs: `Pre@1`, `human@1`, `After@1`, `loop_control@1`, `out1@1`.
- The gate failed on the approved D8 identity contract, proving the pre-change generator did not emit deterministic node/region/iteration IDs.

GREEN (`/tmp/af-d8-green-pr-a-20260712`):

- First turn paused in the loop-body `human` node; the second turn resumed the same interrupt and reached terminal output with response `done`.
- Final post-review rerun used base64url-encoded raw ID components so distinct reviewed IDs cannot collapse after identifier normalization. Observed paths: `Pre@run-loop-bG9vcC1yZWdpb24-iteration-0-cHJl`, `human@run-loop-bG9vcC1yZWdpb24-iteration-0-aHVtYW4` (pause and resumed output), `After@run-loop-bG9vcC1yZWdpb24-iteration-0-YWZ0ZXI`, `loop_control@run-loop-bG9vcC1yZWdpb24-iteration-0-bG9vcC1jb250cm9s`, and `out1@run-node-b3V0MQ`.
- Execution counts were exactly `pre=1`, `after=1`, `terminal=1`: the parent reran, the interrupted HITL child resumed, and already completed child output replayed from ADK's cached dynamic run rather than executing twice.
- Final output was the generated HITL payload with `response: "done"`.

Conclusion: ADK 2.3 supports the approved explicit non-numeric deterministic run IDs and correctly reconstructs the loop-body result chain across parent rerun. D8 is proven and implementation may proceed.

Final current-byte rerun: `node scripts/adk-source-test/real-adk-runtime.mjs --prepare-only /tmp/af-qa-d8-final-20260712`, followed by direct shared-venv execution of `real-adk-gate.py`, exited 0 with `google-adk 2.3.0`, `pre=1`, `after=1`, `terminal=1`, matching pause/resume child identity, and final response `done`.

## Implemented behavior

- A1: the dynamic plan now normalizes IDs/endpoints/modules, removes only reviewed `loop_back` edges for residual-cycle checks, derives loop operational membership from forward edge closure, rejects nested/overlapping closures and illegal boundaries, collapses loop units, stable-topologically orders outer/body graphs by original node index, and rejects every active node unreachable from Graph IR inputs. No START repair is generated.
- A2: explicit joins and reviewed implicit `fan_in` become result-map barriers. Fan-out siblings read the same predecessor result, join maps use runtime node names, loop maps reset each iteration, and ambiguous normal convergence rejects. All child calls are sequential direct awaits; no `create_task`/`gather` is emitted.
- A3: the same analysis function owns guard validation and plan construction. Coverage records each Graph IR node as `seed`, `run`, `join`, `loop_control`, `terminal`, or `toolset_exclusion`; every accepted edge key is in the consumption ledger.
- D8: outer run IDs derive from node ID; loop run IDs derive from region, iteration, and node ID. The real ADK gate proves cached replay across parent rerun.
- D11: canonical smoke/static test bundles have checked-in per-relative-path SHA-256 baselines with mismatch-path reporting; behavior tests remain trace-based.

## Focused behavioral evidence

- Shuffled explicit fan-in fixture: observed trace `branch B → branch A → sink → output`, matching edges plus stable original-index tie-break. Both branches received `{request: "shared"}`. Sink input was `{Branch_B: {branch: "b"}, Branch_A: {branch: "a"}}`; run IDs were `run-node-Yg`, `run-node-YQ`, `run-node-c2luaw`, `run-node-b3V0MQ`.
- Loop-local explicit join fixture: two iterations produced control inputs containing only that iteration's `Loop_A`/`Loop_B` outputs. Control run IDs were `run-loop-bG9vcA-iteration-0-Y29udHJvbA` and `run-loop-bG9vcA-iteration-1-Y29udHJvbA`; terminal received the reviewed `done` loop-exit result.
- Scenario D plan: `mod-002`, `mod-003`, explicit `join-001`, then one loop containing `mod-004`, `mod-005`, `human_input_001`, `mod-006`, and `loop_control_001`, then `drafted_response`. All 11 reviewed edge IDs were consumed.
- Guard suite: cycle, self-loop, unreachable active nodes, residual body cycle, overlapping/nested closures, illegal mid-body entry, unsupported node/schema/edge contracts, run-ID identity, and join-key collisions are covered; the direct guard file passed 9/9.
- Generator neutrality passed 12/12; no scenario vocabulary or new neutrality allowlist entry was added.

## Verification and sandbox diagnosis

Three hypotheses were distinguished while sandbox-sensitive aggregate suites were being diagnosed:

1. Generated Python or dynamic scheduling was hanging — falsified by direct `py_compile`, fake-context trace execution, and the final real `InMemoryRunner` gate, all of which exit promptly and pass.
2. Node child-process creation is blocked by the Codex sandbox — confirmed: focused tests report `spawnSync .agent-factory/runtime/.venv/bin/python EPERM` or `spawnSync .../node EPERM`; moving the identical Python harness to a shell-direct venv process toggles failure to PASS.
3. Analyzer behavior regressed — falsified for compilation and earlier analyzer cases; the command stops at the existing streaming test's `listen EPERM: operation not permitted 127.0.0.1`, while `npx tsc --noEmit` passes separately.

This is an environment boundary, not a production workaround: host-capable suites retain their child-process/runtime checks. Sandbox-local failures and direct runtime evidence are reported separately.

| Gate | Result |
| --- | --- |
| `node scripts/validate-artifacts.test.mjs` | PASS, 34/34 |
| `node scripts/validate-artifacts.mjs` | PASS (`Artifact validation OK`) |
| `node scripts/validate-artifacts.mjs templates/regression-scenarios` | PASS; expected scenario A2A `needs_info` notices, then `Artifact validation OK` |
| `node scripts/adk-source-test/generator-neutrality.test.mjs` | PASS, 12/12 |
| `node scripts/adk-source-test/dynamic-loop-guards.test.mjs` | PASS, 9/9 |
| Smoke SHA-256 manifest | PASS, 23 files, digest `ceba23d0fdab057671191cc7328fd59654250a82b8a54f7124d272bfc81cd747` |
| Static runnable SHA-256 manifest | PASS, 26 files, digest `f448e684ed58825d9bef426f8534eb1e8f09e1f99c176d308d48efe997ade794` |
| Final D8 real ADK gate | PASS, `google-adk 2.3.0`, pause/resume/terminal + cached child replay |
| `cd packages/web && npx tsc --noEmit` | PASS |
| `cd packages/web && npm run test:analyzer && npx tsc --noEmit` | PASS on the final frozen rerun; analyzer aggregate 127/127 and TypeScript clean |
| `node scripts/generate-adk-source.test.mjs` | PASS on the final frozen rerun, 93/93 |
| `cd packages/web && npm run build -- --configLoader runner` | PASS, 686 modules transformed |
| `git diff --check` | PASS on the final frozen tree |

## Independent review disposition

- Goal/constraint, code-quality, PR-A delta-security, runtime QA, and history/context lanes passed after their blocking findings were fixed.
- A separate pre-existing high-severity finding remains outside the approved §4.4 touch list: `scripts/adk-source/emitters/terminal-output.mjs` embeds a raw output node ID inside generated Python f-string text. Git history confirms PR-A did not introduce or worsen it. It requires a separate literal-safe emitter fix and adversarial-ID regression rather than an unapproved PR-A scope expansion.
- No HTTP server or full scenario matrix was started. The main session retains the requested full real-ADK scenario matrix gate.
