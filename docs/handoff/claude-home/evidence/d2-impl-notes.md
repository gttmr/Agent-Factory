# Campaign 3 Phase D PR-B implementation notes

## Scope and initial state

- Worktree: `/home/ilmaswsl/work/af-wt-d2`
- Branch: `codex/dynamic-dispatch`
- Starting HEAD: `579c200806929a7bd046d73610d59358e10929c3`
- Contract: implement approved design §5 (B1 dispatch + B2 collector), exact §5.3 touch list and §6.2 tests; movement/ownership only; no commit.
- Hard exclusions: do not touch `.agent-factory/runtime`, `artifacts`, either `node_modules` symlink, schemas, artifact-validation constants, catalogs, templates, CLI, or web UI.
- Initial status: no tracked changes; pre-existing untracked symlinks at `.agent-factory/runtime`, `artifacts`, `packages/mock-lab/node_modules`, and `packages/web/node_modules`.
- Skill/process note: the existing ADK project is already scaffolded; this task changes generator ownership, not agent behavior. Applied the ADK workflow's surgical-preservation and observable-verification rules. Per the explicit request, real-ADK/runtime/network gates are deferred to the main session.

## Step 0 audit

Status: complete; no §5.3 stop-gate conflict found.

Design reviewed in full: `docs/handoff/claude-home/evidence/d0-dynamic-design.md` (465 lines), including D5, D9, D10, D11, §5.3, and §6.2.

Known post-design facts to verify against current source:

- PR #72 terminal output must retain `toPyStr(node id)` binding into generated `_node_id`.
- Byte identity must use shared `assertBundleSha256Manifest()` and continue excluding `README.md` and `<package>/README.md`; those two paths must not be re-pinned.
- PR #73 is web-only; the final analyzer suite is expected to report 132 subtests.

Audit findings:

- `graph/indexes.mjs` still owns smoke-only `graphEndpoint()` and `buildGraphWorkflowEdges()` calls it directly.
- `graph/lowering.mjs` still owns a local static `resolve()` plus direct `edge_kind === "route"`/fan-in decisions.
- `graph/guards.mjs` still owns static node/edge kind acceptance. Its graph-wide container, route-default, reachability/cycle, and collision responsibilities can remain as designed.
- `graph/dynamic.mjs` contains the landed PR-A plan in full: edge-topological ordering, edge-path loop closure, D5 runtime-name join keys, D9 node/edge coverage ledger, unreachable/cycle checks, and deterministic run IDs. It also still owns the separate dynamic node/edge support sets and `runtimeSymbolFor()` resolver that PR-B is meant to move.
- `emitters/node-registry.mjs` is only the earlier emission-role registry; its own comment explicitly says endpoint/guard/graph support is still separate. This matches §5.1's extension premise.
- `emitters/agent-node.mjs` owns only module-contract compatibility through `moduleLoweringRole()`; no graph-kind dispatch needs to remain there.
- `agent-smoke.mjs`, `agent-runnable.mjs`, and `agent-dynamic.mjs` independently collect module/synthetic buckets. Dynamic still injects `routerNodes: []`, exactly the B2 drift called out by the design.
- Current validator/schema constants are 17 node kinds and 10 edge kinds. They can be imported read-only by completeness tests; no constants/schema edit is needed.
- PR #72 is present: terminal output binds `_node_id = toPyStr(node.id)`. The shared SHA helper excludes only `README.md` and `req_gen_test_adk/README.md`, with comments explaining environment-dependent runtime-env paths.
- PR #73 is web-only and does not change the generator assumptions. Final analyzer expectation remains 132 subtests.
- Conclusion: the exact §5.3 production/test/doc boundary can be followed without schema, validator, committed artifact fixture, CLI, web, or active behavior-doc expansion.

Pre-refactor byte evidence captured from unmodified HEAD:

- Focused existing smoke/static manifest gate: PASS (`node --test --test-name-pattern='PR-A keeps canonical smoke and static runnable bundles byte-identical' scripts/adk-source-test/dynamic-edge-ordering.test.mjs`; 1/1 pass).
- Existing canonical smoke `agent.py`: `26e21298b7d209dff08633ebba3e7f35546ed51bff55e56a9fd262a9fb3fe5b8`.
- Existing canonical static runnable `agent.py` after PR #72: `f3ed9bf59989a9fd698d49b31a6b059f02e9996e8739533fc80caacfcae8609e`.
- Canonical dynamic fixture uses requirement/package `req-gen-test`/`req_gen_test_adk`, shuffled fan-out branches, explicit join, sink, and terminal. README paths were excluded through the same two-path contract. Captured full manifest:

```text
.env.example 2aba4cb829bbc08355f2fdf4cf252d21bc20b4cc1fa9099c2ee45e52480547f4
.gitignore 52a9121ac2c9f227e8faa7f74af1d8bdd96302521cd708f986ac4fe574bcf7d9
af_adk_a2a_server.py 7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0
agents.config.yaml 695ccf0de1bea13fca6a3924aa5911dd4ad65b9a3eafc8376677dbc043b472c6
implementation-handoff.md bea19cf720dcbe455345b403801f81d23b806faf1a08f3df3a9424ec8ef45e73
req_gen_test_adk/__init__.py 5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1
req_gen_test_adk/agent.json f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff
req_gen_test_adk/agent.py 46fd5309d4cbf2ad877d03bc1c0f829dacac8421d7597ad3ccd8b82e5a908334
req_gen_test_adk/mock_config.yaml 7632c7a19cf1c7d3ba7f90c504fb01df4d85700369bdb523d9c83bb1ce1c8340
req_gen_test_adk/nodes/__init__.py e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
req_gen_test_adk/nodes/adapters.py 3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1
req_gen_test_adk/nodes/agents.py a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115
req_gen_test_adk/nodes/gates.py 0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad
req_gen_test_adk/nodes/human_inputs.py 85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677
req_gen_test_adk/nodes/routers.py 16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe
req_gen_test_adk/nodes/workflow_calls.py 8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8
req_gen_test_adk/sample_inputs.yaml 07826f35e787d0495c74fe45c820d0bf6c8961187cf663f983380d8b8b2e7443
req_gen_test_adk/schemas.py cc62cf4e28bc57c96794a559670d0c0d54eb11995eab7df0b6fc1d59ef31f1a9
req_gen_test_adk/tests/__init__.py e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
req_gen_test_adk/tests/test_workflow_contract.py ebcf6869ded821ed386eafb4bfea54de9ff12a52bc7d8e35338e876481f5b347
req_gen_test_adk/workflow_manifest.json 07d4b051a3586874e4a2d6d2f2da225aa2b4c67eaf3acba4afdf6a189255846c
req_gen_test_adk/workflow.py 70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704
runtime-chat-smoke.json fb74638bb8cb017786be6ceebd552e90cf383816a239568fcfe579d1dc6d728f
scaffold-plan.json 08fe8f5b54719c89228fbee04be06957809d1f2eea71c7563442dc88f5961782
```

## Design deviations / stop-gates

- None. §5.3 can be implemented as written.

## Progress checklist

- [x] Confirm branch, HEAD, initial status, and excluded symlinks.
- [x] Read the approved design in full.
- [x] Complete and record the fresh Step 0 source audit.
- [x] Capture pristine HEAD byte manifests before refactoring.
- [x] Add centralized node/edge dispatch and mode facade.
- [x] Add common node collector and migrate the three builders.
- [x] Migrate graph lowering/guards/dynamic and node emission ownership.
- [x] Add/wire dispatch, collector, and byte-identity tests.
- [x] Append the 2026-07-17 decision-log entry.
- [x] Run and record all six requested verification groups.
- [x] Review final scope and generated-byte identity.

## Verification ledger

Focused pre-suite checks:

- `node scripts/adk-source-test/generator-neutrality.test.mjs`: PASS, 12/12.
- `node scripts/adk-source-test/graph-dispatch.test.mjs`: PASS, 4/4. Registries cover all 17 node kinds and 10 edge kinds, with one unique handler per row. Every node/edge handler-mode combination is exercised: supported nodes produce a real collection/endpoint/plan result, unsupported modes retain a reason, and every accepted edge record has one unique consumption ID.
- `node scripts/adk-source-test/node-collector.test.mjs`: PASS, 3/3. Declaration order, mode-specific toolset exclusion, all synthetic buckets/features/collision owners, and dynamic router visibility are covered.
- `node scripts/adk-source-test/output-byte-identity.test.mjs`: PASS, 2/2. Canonical smoke/static manifests and the pre-refactor PR-A dynamic manifest are byte-identical through the shared SHA helper.
- `node scripts/adk-source-test/dynamic-loop-guards.test.mjs`: PASS, 12/12. The support-matrix fixtures now supply the already-required reviewed state/artifact/A2A metadata; assertions were not weakened.

Requested verification groups:

1. `node scripts/generate-adk-source.test.mjs`: PASS, 106/106 (final rerun 3.72 s). This exact full suite includes neutrality, registry completeness, collector coverage, all three byte manifests, PR-A edge ordering/fan-in/loop/reachability and generated-Python traces, state/artifact/A2A behavior, toolsets, and terminal-output coverage.
   - During an earlier focused `dynamic-edge-ordering` invocation, the sandbox temporarily stalled at Node 24 `execFileSync(..., { input, stdio: pipe })`; a source-independent minimal `cat`/system-Python reproduction also stalled while direct Python worked. No repository helper was changed. The exact full command was rerun without a workaround and passed, so this was an intermittent sandbox child-pipe condition rather than a generator delta.
2. `node scripts/validate-artifacts.test.mjs`: PASS, 34/34 (final rerun 1.08 s).
3. `node scripts/validate-artifacts.mjs`: PASS, `Artifact validation OK`.
   - `node scripts/validate-artifacts.mjs templates/regression-scenarios`: PASS, `Artifact validation OK`; expected `needs_info` notices for the intentionally incomplete `a2a-001` review fields were emitted.
4. `cd packages/web && npm run test:analyzer`: PASS on final rerun. The final combined validator/generator runner reports 140/140: the known post-PR-#73 count of 132 plus the net 8 PR-B tests (9 new dispatch/collector/identity tests, 1 prior identity test moved out of `dynamic-edge-ordering`).
5. `cd packages/web && npm run build`: TypeScript passed, then Vite failed at the known symlink sandbox boundary with `EROFS` writing `packages/web/node_modules/.vite-temp/...`.
   - Required fallback `npm run build -- --configLoader runner`: PASS on final rerun; 693 modules transformed, production build completed in 2.03 s.
6. `git diff --check`: PASS. Additional trailing-whitespace scans and `node --check` over all new production/test modules also passed.

Final structure/scope review:

- No `switch (...)` remains in `dispatch/modes.mjs` or any smoke/static/dynamic mode assembler.
- Registry completeness tests prove one unique handler object for each of the 17 node kinds and 10 edge kinds; no quoted-key or constant-extraction scan evasion was introduced.
- Graph-wide static guards remain in `graph/guards.mjs`; per-node/per-edge capability and required metadata are delegated to handlers.
- PR-A plan ordering, operational loop closure, reachability/cycle rejection, runtime-name fan-in keys, and node/edge coverage ledgers remain behaviorally covered.
- PR #72 terminal `_node_id` binding remains owned by the unchanged terminal emitter, and the byte helper still excludes exactly `README.md` and `req_gen_test_adk/README.md`; neither path is pinned in the new manifests.
- Scope contains only §5.3 production/test files, the explicitly permitted neutrality allowlist, the mandatory implementation notes, and `docs/decision-log.md`. Excluded runtime/artifact/node_modules symlinks remain the same pre-existing untracked entries and were not touched.

## Main-session real-ADK / scenario gates (2026-07-17)

Run by the main session after the sandbox implementation, per the task split.

- **D8 dynamic resume gate rerun** (`node scripts/adk-source-test/real-adk-runtime.mjs`): **PASS** on `google-adk 2.3.0` (shared `.agent-factory/runtime/.venv`). PR-B code generated the bundle fresh and ran it under real ADK `InMemoryRunner`: loop-body `RequestInput` paused, resumed with matching `functionResponse`, deterministic run IDs observed in `node_info.path`, completed children replayed from cache (`{"pre": 1, "after": 1, "terminal": 1}`), terminal output reached.
- **Scenario matrix (scenario-g / scenario-i / wf-page-recommendation-required)**: staged each fixture into a temporary artifact root through the real server `artifact-sync/run` path (`outputMode: "runnable"`) on both unmodified main (`26b295b`+handoff) and the PR-B worktree, with identical temp-copy-only adjustments allowed by design §6.3 (all candidates `approved`, candidate `missing_information` cleared, embedded requirement id rebased to the temp root id). Resulting runnable bundles — 81 files including scenario-g `RequestInput`/`JoinNode` HITL output and scenario-i `RemoteA2aAgent` output — are **byte-identical between main and PR-B** (`diff -r` clean). Main's bundles carry the prior campaigns' real-runtime provenance (scenario-g HITL runnable example, scenario-i mock A2A example, wf-page campaign-2 InMemoryRunner+Gemini+MockLab gate), so identical bytes give runtime equivalence without re-running Gemini/A2A servers on unchanged code. Temp roots and dev servers removed afterward.
- Full local gates rerun outside the sandbox: generator 106/106, validator 34/34, both artifact validations OK, analyzer 140/140, `npm run build` (no EROFS outside sandbox) OK, `git diff --check` clean.

## Open questions

- None.
