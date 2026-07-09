---
name: af-build-runtime-stub
description: Use when approved Agent Factory scaffold-plan artifacts need a smoke TODO or runnable ADK Runtime Handoff bundle, including artifact-sync, runtime-stub generation, generated-output checks, and handoff non-goal review.
---

# AF Build Runtime Stub

Use this third DLC stage only after Analyze and Design artifacts are reviewed. The primary path is Workbench artifact-sync from canonical artifacts; standalone direct generation is secondary and manual. Never build from raw requirements, unreviewed analyzer output, unresolved candidate missing information, or unapproved runtime/A2A contracts.

1. Read `../_shared/artifact-root-stage-runner.md` -> choose Stage Runner/Workbench artifact-sync mode or standalone canonical mode -> verify with `test -f <artifact-root>/analysis-result.json` -> stop if canonical analysis is absent.
2. Read `../_shared/runtime-contracts.md` -> check manifest approvals, `runtimeContracts`, embedded `a2aContracts`, and approved module source -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop if approvals or required contracts are missing.
3. Read `references/artifact-sync-build.md` -> run artifact sync before generation, using `POST /api/af/:reqId/artifact-sync/run` in Workbench or the documented manual equivalent -> verify with `test -f <artifact-root>/scaffold-plan.json` -> stop if sync reports drift errors.
4. If route or join features are present, read `../_shared/adk-2.3-routes.md` -> inspect route/join Graph IR and scaffold plan fields -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on route or reachability errors.
5. If state or artifact channels are present, read `../_shared/adk-2.3-data-handling.md` -> inspect `state_key` and `artifact_key` channels -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on unsupported data-channel lowering.
6. If `human_input` nodes are present, read `../_shared/adk-2.3-human-input.md` -> inspect prompt, resume, choice, and response schema fields -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on unsupported `response_schema_ref`.
7. If dynamic or loop shapes are present, read `../_shared/adk-2.3-dynamic.md` -> inspect loop containers, `loop_control`, `loop_back`, and `loop_exit` metadata -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on unsupported dynamic lowering.
8. If Remote A2A is present, read `../_shared/adk-2.3-remote-a2a.md` -> inspect embedded A2A contracts and runtime policy fields -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on missing approved contract, Agent Card URL, or invalid auth env var.
9. Read `references/runtime-generation.md` -> generate or inspect `runtime-stub/` from synced artifacts -> verify with `test -d <artifact-root>/runtime-stub` -> stop on generation failure.
10. Read `references/runtime-output-checks.md` -> compile generated Python and run generated tests only when dependencies exist -> verify with `python3 -m compileall <artifact-root>/runtime-stub` -> stop on compile/test failure.
11. Read `references/handoff-non-goals.md` -> update or inspect `implementation-handoff.md` for smoke/runnable status and TODOs -> verify with `test -f <artifact-root>/runtime-stub/implementation-handoff.md` -> stop if `raw_requirement_to_code=false`, no-private-data, no-deploy, or no-production-business-logic invariants are violated.
