# C5 Generator Review

Scope: `scripts/generate-adk-source.mjs`, `scripts/adk-source/**`, `scripts/adk-source-test/**`.

Status: complete.

Verification command: `node scripts/generate-adk-source.test.mjs` passed with 56 tests, 0 failures, duration 2166.164204 ms. Post-run scoped status check showed only `?? .evidence-reviews/c5-generator.md` under `.evidence-reviews/c5-generator.md`, `scripts/generate-adk-source.mjs`, `scripts/adk-source`, `scripts/adk-source-test`, and `artifacts/af`.

## Dead or unused

1. Demote several exported helpers to module-private functions/constants; this should be a source API cleanup, not an emitted bundle semantics change, and should be gated by `node scripts/generate-adk-source.test.mjs`.
   Evidence: repo-wide `rg -n "orderedGraphModules|edgeDataChannel|moduleDataChannels|outgoingArtifactChannelKeys|a2aContractForModule|a2aAgentCardUrl|DEFAULT_A2A_PROVIDER_URL|ADK_A2A_EXTENSION_URI|firstSmokeSample\\(|agentExecutionMode\\(|defaultAgentInstruction\\(|runtimePairs\\(|assertAcyclic\\(" . -g '*.mjs' -g '*.ts' -g '*.tsx' -g '*.js'` found the candidate symbols only at their definitions and same-file uses, except unrelated test-local constants in web tests.
   Candidate lines:
   - `scripts/adk-source/channels.mjs:6`, `scripts/adk-source/channels.mjs:28`, `scripts/adk-source/channels.mjs:88` export `edgeDataChannel`, `moduleDataChannels`, and `outgoingArtifactChannelKeys`; same-file uses are at `scripts/adk-source/channels.mjs:46`, `scripts/adk-source/channels.mjs:59`, `scripts/adk-source/channels.mjs:69`, `scripts/adk-source/channels.mjs:91`, `scripts/adk-source/channels.mjs:111`, `scripts/adk-source/channels.mjs:116`, and `scripts/adk-source/channels.mjs:150`.
   - `scripts/adk-source/emitters/agent-node.mjs:104` and `scripts/adk-source/emitters/agent-node.mjs:130` export `agentExecutionMode` and `defaultAgentInstruction`; same-file uses are `scripts/adk-source/emitters/agent-node.mjs:13` and `scripts/adk-source/emitters/agent-node.mjs:39`.
   - `scripts/adk-source/graph/indexes.mjs:109` exports `orderedGraphModules`; the repo-wide `rg` command found no use outside that definition.
   - `scripts/adk-source/graph/lowering.mjs:141` and `scripts/adk-source/graph/lowering.mjs:167` export `runtimePairs` and `assertAcyclic`; same-file uses are `scripts/adk-source/graph/lowering.mjs:117`, `scripts/adk-source/graph/lowering.mjs:131`, and `scripts/adk-source/graph/lowering.mjs:137`.
   - `scripts/adk-source/remote-a2a.mjs:6` and `scripts/adk-source/remote-a2a.mjs:17` export `a2aContractForModule` and `a2aAgentCardUrl`; same-file uses are `scripts/adk-source/remote-a2a.mjs:44`, `scripts/adk-source/remote-a2a.mjs:51`, `scripts/adk-source/remote-a2a.mjs:67`, `scripts/adk-source/remote-a2a.mjs:69`, `scripts/adk-source/remote-a2a.mjs:89`, `scripts/adk-source/remote-a2a.mjs:90`, `scripts/adk-source/remote-a2a.mjs:114`, and `scripts/adk-source/remote-a2a.mjs:116`.
   - `scripts/adk-source/support/agent-card.mjs:1` and `scripts/adk-source/support/agent-card.mjs:2` export constants only used by `buildAgentCard` at `scripts/adk-source/support/agent-card.mjs:4` and `scripts/adk-source/support/agent-card.mjs:17`.
   - `scripts/adk-source/support/samples.mjs:47` exports `firstSmokeSample`; same-file uses are `scripts/adk-source/support/samples.mjs:23`, `scripts/adk-source/support/samples.mjs:29`, `scripts/adk-source/support/samples.mjs:64`, `scripts/adk-source/support/samples.mjs:106`, `scripts/adk-source/support/samples.mjs:149`, and `scripts/adk-source/support/samples.mjs:166`.

2. Delete or inline the four-line A2A test aggregator if test entry imports are kept explicit.
   Evidence: `scripts/adk-source-test/cdp-a2a-super-agent-simplification.test.mjs:1` to `scripts/adk-source-test/cdp-a2a-super-agent-simplification.test.mjs:4` only import four other test files and declare no tests; `scripts/generate-adk-source.test.mjs:20` imports that aggregator. Output-equivalence evidence is test-only: `node scripts/generate-adk-source.test.mjs` currently passes all 56 tests.

3. `scripts/adk-source/emitters/runtime-helpers.mjs` is a six-line pass-through wrapper.
   Evidence: it only imports `buildRuntimeConfigSection` and `buildRuntimeToolInputsSection`, then concatenates them at `scripts/adk-source/emitters/runtime-helpers.mjs:1` to `scripts/adk-source/emitters/runtime-helpers.mjs:5`; it is imported only by the two runnable builders at `scripts/adk-source/agent-runnable.mjs:12` and `scripts/adk-source/agent-dynamic.mjs:14`. This is a small simplify candidate, not a priority deletion, because it still names a useful emitted-Python seam.

## Duplication & drift (incl. smoke-runnable-dynamic matrix)

Smoke/runnable/dynamic matrix:

| Surface | Smoke | Static runnable | Dynamic runnable | Drift/delete signal |
| --- | --- | --- | --- | --- |
| Builder selection | `buildAgentPy()` maps only `smoke` and `runnable` at `scripts/adk-source/agent.mjs:9` to `scripts/adk-source/agent.mjs:13`. | `buildRunnableAgentPy()` handles runnable unless dynamic shape is detected at `scripts/adk-source/agent-runnable.mjs:15` to `scripts/adk-source/agent-runnable.mjs:20`. | Dynamic is not a distinct output mode; `hasDynamicRunnableShape()` diverts inside runnable at `scripts/adk-source/agent-runnable.mjs:18` to `scripts/adk-source/agent-runnable.mjs:19`. | Mode dispatch is present, but dynamic is hidden as a sub-branch rather than a handler strategy. |
| Guarding | Smoke only uses graph coverage via `buildFiles()` at `scripts/adk-source/file-builder.mjs:42` to `scripts/adk-source/file-builder.mjs:44`. | Static runnable runs graph, data-channel, and Remote A2A guards at `scripts/adk-source/agent-runnable.mjs:21` to `scripts/adk-source/agent-runnable.mjs:23`. | Dynamic repeats data-channel/Remote A2A guards and uses a separate graph guard at `scripts/adk-source/agent-dynamic.mjs:20` to `scripts/adk-source/agent-dynamic.mjs:22`. | Common guard prelude is duplicated; graph-specific guard should become strategy data. |
| Node collection | Smoke builds its own TODO and node functions at `scripts/adk-source/agent-smoke.mjs:8` to `scripts/adk-source/agent-smoke.mjs:10` and `scripts/adk-source/agent-smoke.mjs:124` to `scripts/adk-source/agent-smoke.mjs:138`. | Static runnable collects graph, toolsets, module specs, human input, routers, outputs, joins at `scripts/adk-source/agent-runnable.mjs:24` to `scripts/adk-source/agent-runnable.mjs:39`. | Dynamic repeats graph/toolset/module/human/output collection and collision checks, but omits routers and joins, at `scripts/adk-source/agent-dynamic.mjs:24` to `scripts/adk-source/agent-dynamic.mjs:36`. | The common module/human/output setup belongs in one collector keyed by node kind. Dynamic join omission is a correctness risk below. |
| Node emission | Smoke does not use `emitters/node-registry.mjs`; it has local `buildTodoFunction()` / `buildNodeFunction()` at `scripts/adk-source/agent-smoke.mjs:124` to `scripts/adk-source/agent-smoke.mjs:138`. | Uses `emitRunnableNodeBlocks()` at `scripts/adk-source/agent-runnable.mjs:40` to `scripts/adk-source/agent-runnable.mjs:45`. | Uses the same `emitRunnableNodeBlocks()` at `scripts/adk-source/agent-dynamic.mjs:31` to `scripts/adk-source/agent-dynamic.mjs:36`. | Runnable emission has a handler registry; smoke still has a parallel node-function emitter. This is acceptable for smoke output, but it is another place reused-module naming drift can reappear. |
| Graph lowering | Smoke uses `buildGraphWorkflowEdges()` at `scripts/adk-source/agent-smoke.mjs:10`; the endpoint resolver is separate at `scripts/adk-source/graph/indexes.mjs:40` to `scripts/adk-source/graph/indexes.mjs:82`. | Static uses `buildRunnableGraph()` at `scripts/adk-source/agent-runnable.mjs:24`; its endpoint resolver is at `scripts/adk-source/graph/lowering.mjs:13` to `scripts/adk-source/graph/lowering.mjs:30`. | Dynamic uses `buildDynamicRunnablePlan()` at `scripts/adk-source/agent-dynamic.mjs:29`; runtime symbol resolution is separate at `scripts/adk-source/graph/dynamic.mjs:197` to `scripts/adk-source/graph/dynamic.mjs:207`. | Three endpoint/runtime-symbol resolvers exist. This is the biggest gap to edge/node-kind dispatch. |
| Python imports/helpers | Smoke has a separate BaseAgent template at `scripts/adk-source/agent-smoke.mjs:12` to `scripts/adk-source/agent-smoke.mjs:121`. | Static runnable builds imports and helper section at `scripts/adk-source/agent-runnable.mjs:54` to `scripts/adk-source/agent-runnable.mjs:90`. | Dynamic repeats most import/helper decisions at `scripts/adk-source/agent-dynamic.mjs:42` to `scripts/adk-source/agent-dynamic.mjs:75`. | Static/dynamic import prelude and helper assembly can be shared, but output parity must be checked against the `scripts/adk-source-test` fixtures because many tests pin import lines. |
| Warnings/projection notes | Smoke has no projection-note path. | Static emits process-flow validation warnings as comments via `runtimeProjectionNotes()` at `scripts/adk-source/agent-runnable.mjs:47` and `scripts/adk-source/agent-runnable.mjs:106` to `scripts/adk-source/agent-runnable.mjs:113`. | Dynamic has no equivalent projection-note call in `scripts/adk-source/agent-dynamic.mjs:59` to `scripts/adk-source/agent-dynamic.mjs:87`. | Copy-paste drift: dynamic loses static runnable's warning comments. HYPOTHESIS: output behavior is unaffected, but generated source explainability differs. |

High-value duplication:

1. Router helper definitions are emitted once per router function.
   Evidence: `emitRouteFunc()` returns shared helper definitions and the node-specific route function in one template at `scripts/adk-source/emitters/router.mjs:31` to `scripts/adk-source/emitters/router.mjs:158`; `emitRunnableNodeBlocks()` calls the router handler for every router node at `scripts/adk-source/emitters/node-registry.mjs:46`. Command evidence from `generateSuperAgentRouteBundle()` counted `def _route_decision_text(node_input): 2`, `def _route_state_text(ctx: Context, state_key: str) -> str: 2`, and `_ROUTE_CONTROL_SYNTAX_MARKERS = ( 2` in a two-router generated bundle. The two-router fixture is `scripts/adk-source-test/cdp-a2a-super-agent-fixture.mjs:37` and `scripts/adk-source-test/cdp-a2a-super-agent-fixture.mjs:40`.
   Delete/simplify: emit route helpers once per bundle and keep only per-router cases in each route function. Behavioral-equivalence fixture: the current A2A route runtime tests execute extracted generated Python, not only string checks, via `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:32` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:116`.

2. Static/dynamic runnable Python prelude is copied.
   Evidence: both builders compute `usesArtifacts`, `usesRemoteAuth`, `jsonStdlibImport`, `artifactGenaiImport`, `remoteImport`, `remoteConfigImport`, `mcpToolsetImport`, `eventImport`, and then emit the same core imports/helpers at `scripts/adk-source/agent-runnable.mjs:54` to `scripts/adk-source/agent-runnable.mjs:90` and `scripts/adk-source/agent-dynamic.mjs:42` to `scripts/adk-source/agent-dynamic.mjs:75`.
   Simplify: a shared `buildRunnablePrelude({ usesRoutes, usesTerminalOutputs, workflowImport })` would reduce drift while keeping `agent-runnable` and `agent-dynamic` strategy-specific graph assembly separate.

3. Remote A2A shape logic is split across node emission, runtime manifest, registry snapshot, guard, env vars, and route guard.
   Evidence: `remote-a2a.mjs` owns contract lookup/runtime rows/env/node/guard at `scripts/adk-source/remote-a2a.mjs:6` to `scripts/adk-source/remote-a2a.mjs:130`; `node-registry` maps `remote_a2a` to `emitRemoteA2aNode()` at `scripts/adk-source/emitters/node-registry.mjs:31` to `scripts/adk-source/emitters/node-registry.mjs:34`; router has a remote-route text guard at `scripts/adk-source/emitters/router.mjs:16` to `scripts/adk-source/emitters/router.mjs:19` and `scripts/adk-source/emitters/router.mjs:127` to `scripts/adk-source/emitters/router.mjs:152`.
   Simplify: keep protocol details in a remote-A2A handler object rather than leaking them into router/global helper code.

## Dispatch-readiness assessment (gap to edge/node-kind handler architecture, smallest moves)

Verdict: partially ready at the emitter layer, not ready at the graph/guard/import layer.

What is already close:

- `emitters/node-registry.mjs` has a real role-to-handler table: `NODE_LOWERING` maps `agent`, `connected_adapter`, `stub_function`, `human_input`, `router`, `terminal_output`, and `remote_a2a` at `scripts/adk-source/emitters/node-registry.mjs:21` to `scripts/adk-source/emitters/node-registry.mjs:35`, and missing roles fail explicitly at `scripts/adk-source/emitters/node-registry.mjs:36` to `scripts/adk-source/emitters/node-registry.mjs:41`.
- The public mode switch is tiny: `buildAgentPy()` selects `smoke` or `runnable` through `AGENT_PY_BUILDERS` at `scripts/adk-source/agent.mjs:4` to `scripts/adk-source/agent.mjs:14`.

Where dispatch is still scattered:

- Node-kind support is duplicated in static and dynamic guards. Static allowed/bad node logic is `scripts/adk-source/graph/guards.mjs:13` to `scripts/adk-source/graph/guards.mjs:45`; dynamic allowed/bad node logic is `scripts/adk-source/graph/dynamic.mjs:18` to `scripts/adk-source/graph/dynamic.mjs:38`.
- Edge-kind support is duplicated in static and dynamic guards. Static route/remote/boundary logic is `scripts/adk-source/graph/guards.mjs:69` to `scripts/adk-source/graph/guards.mjs:123`; dynamic edge logic is `scripts/adk-source/graph/dynamic.mjs:40` to `scripts/adk-source/graph/dynamic.mjs:79`.
- Runtime symbol resolution is duplicated in static and dynamic graph lowering. Static `resolve()` is `scripts/adk-source/graph/lowering.mjs:13` to `scripts/adk-source/graph/lowering.mjs:30`; dynamic `runtimeSymbolFor()` is `scripts/adk-source/graph/dynamic.mjs:197` to `scripts/adk-source/graph/dynamic.mjs:207`; smoke has a third endpoint resolver at `scripts/adk-source/graph/indexes.mjs:73` to `scripts/adk-source/graph/indexes.mjs:82`.
- Import requirements are feature-detected in static/dynamic builder bodies rather than declared by handlers. Static import flags are at `scripts/adk-source/agent-runnable.mjs:54` to `scripts/adk-source/agent-runnable.mjs:72`; dynamic import flags are at `scripts/adk-source/agent-dynamic.mjs:42` to `scripts/adk-source/agent-dynamic.mjs:56`.
- Dynamic lowering is node-array driven, not edge-dispatch driven. `buildDynamicRunnablePlan()` iterates `nodes` directly at `scripts/adk-source/graph/dynamic.mjs:96` to `scripts/adk-source/graph/dynamic.mjs:112`, while loop bodies also come from `nodes.filter(...)` at `scripts/adk-source/graph/dynamic.mjs:130` to `scripts/adk-source/graph/dynamic.mjs:133`. It only consults edges for loop-control aliases/defaults at `scripts/adk-source/graph/dynamic.mjs:137` to `scripts/adk-source/graph/dynamic.mjs:147`. Scenario D's fixture has real edge ordering and loop semantics at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:632` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:817`.

Correctness risks:

- Dynamic `join` is accepted by guard but not lowered into a runtime symbol. Evidence: dynamic guard includes `"join"` in `allowedBareKinds` at `scripts/adk-source/graph/dynamic.mjs:20`; `runtimeSymbolFor()` returns symbols only for module-bound nodes plus `human_input`, `loop_control`, and `output` at `scripts/adk-source/graph/dynamic.mjs:197` to `scripts/adk-source/graph/dynamic.mjs:207`; loop bodies filter joins out at `scripts/adk-source/graph/dynamic.mjs:130` to `scripts/adk-source/graph/dynamic.mjs:133`. Scenario D includes fan-in to `join-001` at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:665` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:700`. HYPOTHESIS: current dynamic output may still pass because joins are treated as visual/grouping in the fixture path, but the guard wording overstates support.
- Dynamic execution order can diverge from Graph IR if `processFlow.nodes` is not topological. Evidence: dynamic execution steps follow node array order at `scripts/adk-source/graph/dynamic.mjs:98` to `scripts/adk-source/graph/dynamic.mjs:112`; emitted Python runs `steps` in order at `scripts/adk-source/agent-dynamic.mjs:104` to `scripts/adk-source/agent-dynamic.mjs:131`. Static runnable does a reachability/acyclic pass over runtime pairs at `scripts/adk-source/graph/lowering.mjs:116` to `scripts/adk-source/graph/lowering.mjs:138`; dynamic has no equivalent reachability/edge-order validation in `scripts/adk-source/graph/dynamic.mjs:81` to `scripts/adk-source/graph/dynamic.mjs:120`.
- Repeated global route helpers are safe only while their bodies are identical. Evidence: generated multi-router bundles duplicate helper names, and route functions call global helpers at `scripts/adk-source/emitters/router.mjs:155` to `scripts/adk-source/emitters/router.mjs:158`. If a later handler makes helper behavior per-router, earlier route functions will resolve the last global definition at call time.

Smallest moves toward edge/node-kind dispatch:

1. Extract a `nodeHandlers` metadata table that includes `allowedInStatic`, `allowedInDynamic`, `runtimeSymbol`, `emit`, and `imports`. Initial rows can wrap existing functions from `emitters/node-registry.mjs:21` to `scripts/adk-source/emitters/node-registry.mjs:35`.
2. Replace the three endpoint resolvers (`graph/indexes.mjs`, `graph/lowering.mjs`, `graph/dynamic.mjs`) with one `runtimeSymbolForNode(node, { mode, side })` wrapper. Start with static/dynamic only; leave smoke as a follow-up if output parity risk is high.
3. Extract shared runnable builder setup: graph index, toolset exclusion, ordered module targets, human/router/output collections, collision inputs, and import prelude. Evidence for shared setup is `scripts/adk-source/agent-runnable.mjs:24` to `scripts/adk-source/agent-runnable.mjs:45` and `scripts/adk-source/agent-dynamic.mjs:24` to `scripts/adk-source/agent-dynamic.mjs:36`.
4. Move router helper emission out of each router node. This is the smallest high-confidence DELETE candidate; behavior parity should be checked with the A2A route runtime fixture at `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:32` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:116`, while current source-shape extraction would need adjustment because `generatedRouteBlock()` assumes helper text precedes each route function at `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:18` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:27`.
5. For the later dynamic rewrite, make `buildDynamicRunnablePlan()` consume edges/containers through handlers (`run`, `route`, `join`, `loop`, `terminal`) instead of walking the raw node list.

## Neutrality violations (hard-coded domain literals)

1. `analysis_input_bundle` is a workflow-specific literal in generator runtime input traversal.
   Evidence: `PAYLOAD_WRAPPER_KEYS` hard-codes `"analysis_input_bundle"` at `scripts/adk-source/emitters/runtime-tool-inputs.mjs:25` to `scripts/adk-source/emitters/runtime-tool-inputs.mjs:38`. The literal belongs to the page-recommendation regression artifact: `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:230` to `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:235` declares the output name, and `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:253` to `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:255` uses it as an expected marker. The test pins this leak at `scripts/adk-source-test/basic-bundle.test.mjs:163` to `scripts/adk-source-test/basic-bundle.test.mjs:170`.
   Impact: every generated runnable bundle gets this scenario wrapper key whether or not its reviewed artifacts contain that name.
   Simplify: remove it from generator defaults and rely on reviewed `input_mapping`, reviewed state/artifact channels, or the generic wrapper keys already present at `scripts/adk-source/emitters/runtime-tool-inputs.mjs:25` to `scripts/adk-source/emitters/runtime-tool-inputs.mjs:36`.

2. `agent_registry_snapshot` is hard-coded as a special adapter-output trigger for Remote A2A registry projection.
   Evidence: `emitsRegistrySnapshot()` returns true if module outputs include `"agent_registry_snapshot"` or outgoing state channels include it at `scripts/adk-source/emitters/function-node.mjs:63` to `scripts/adk-source/emitters/function-node.mjs:75`; the emitted registry projection then calls `remoteA2aRegistrySnapshotRows()` at `scripts/adk-source/emitters/function-node.mjs:41` to `scripts/adk-source/emitters/function-node.mjs:61`. The test fixture creates exactly that output/state key at `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:7` to `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:14` and `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:37` to `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:40`; tests assert it at `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:34` to `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:52`.
   Impact: this is not a product domain term, but it is a workflow-specific contract name embedded in generator behavior. A reviewed artifact should request a registry snapshot through a generic capability or runtime contract field.

3. The route instruction text says "Super Agent" even when applied to any agent with downstream route cases.
   Evidence: `agentInstruction()` appends route guidance at `scripts/adk-source/emitters/agent-node.mjs:65` to `scripts/adk-source/emitters/agent-node.mjs:73`; the message specifically says "Super Agent" at `scripts/adk-source/emitters/agent-node.mjs:71`. The Super Agent fixture is test data at `scripts/adk-source-test/cdp-a2a-super-agent-fixture.mjs:11` to `scripts/adk-source-test/cdp-a2a-super-agent-fixture.mjs:26`, but the generator line is unconditional for any route-decision agent.
   Simplify: replace the role name with "이 Agent" or `${module.name}` from the reviewed module.

4. Existing neutrality tests do not catch the current leaks.
   Evidence: the source-neutrality token list is `scripts/adk-source-test/assertions.mjs:13` to `scripts/adk-source-test/assertions.mjs:24`; it does not include `analysis_input_bundle`, `agent_registry_snapshot`, or "Super Agent". The neutrality test calls only `assertGeneratorSourcesStayDomainNeutral()` at `scripts/adk-source-test/basic-bundle.test.mjs:176` to `scripts/adk-source-test/basic-bundle.test.mjs:178`, and the full generator test still passed 56/56.

Not counted as violations:

- `remote_a2a`, `agent_card_url`, `rpc_url`, `a2a:task_id`, and `a2a:context_id` are protocol/control terms, not business domain terms. They are still dispatch-readiness concerns because they live in the generic router helper at `scripts/adk-source/emitters/router.mjs:127` to `scripts/adk-source/emitters/router.mjs:138`.

## Manifest side-effect options

Current behavior:

- The CLI shim loads artifacts, builds files, writes the bundle, and then mutates `af-run-manifest.json` at `scripts/generate-adk-source.mjs:11` to `scripts/generate-adk-source.mjs:16`.
- `updateRunManifest()` writes only when `outputRoot` is inside `artifactRoot`, based on the relative-path guard at `scripts/adk-source/run-manifest.mjs:4` to `scripts/adk-source/run-manifest.mjs:9`.
- When it writes, it sets `current_stage: "build"` at `scripts/adk-source/run-manifest.mjs:11` to `scripts/adk-source/run-manifest.mjs:13`, replaces the build stage with `status: "complete"` and outputs at `scripts/adk-source/run-manifest.mjs:17` to `scripts/adk-source/run-manifest.mjs:25`, and sets `approvals.stub_ready_for_followup: true` at `scripts/adk-source/run-manifest.mjs:28` to `scripts/adk-source/run-manifest.mjs:33`.
- It also appends validation command strings while preserving `last_result` at `scripts/adk-source/run-manifest.mjs:34` to `scripts/adk-source/run-manifest.mjs:41`, then writes `af-run-manifest.json` at `scripts/adk-source/run-manifest.mjs:43`.
- Tests currently assert this side effect as generator behavior at `scripts/adk-source-test/assertions.mjs:191` to `scripts/adk-source-test/assertions.mjs:198`; fixture generation calls the same updater at `scripts/adk-source-test/fixtures.mjs:162` to `scripts/adk-source-test/fixtures.mjs:168`.

Assessment:

- This is a layering smell, not an immediate generator correctness failure. The source generator can prove "files were emitted"; deciding that the Build stage is complete and that the stub is ready for follow-up is orchestration state.
- Correctness risk: `normalizeRunStage()` preserves only `status` and string `outputs` at `scripts/adk-source/run-manifest.mjs:46` to `scripts/adk-source/run-manifest.mjs:50`, so any future per-stage metadata under `analyze`, `design`, or `verify` would be dropped during generation.

Options, no decision:

1. Keep as-is but rename the API: treat `generate-adk-source.mjs` as the Build-stage command, not a pure source generator. Update tests to keep asserting stage mutation.
2. Split pure generation from orchestration: `buildFiles()` plus `writeBundleFiles()` remain generator; Stage Runner or the calling API updates `af-run-manifest.json` after command success. Existing side-effect tests at `scripts/adk-source-test/assertions.mjs:191` to `scripts/adk-source-test/assertions.mjs:198` move to the calling-layer tests.
3. Add an explicit CLI flag such as `--update-run-manifest` or `--stage-build-complete`; default pure generation for local CLI, enabled by Stage Runner. This is more surface area than option 2 but preserves backward compatibility.
4. Make `updateRunManifest()` return the next manifest object and let the caller write it. That keeps tests simple and removes hidden filesystem mutation from the generator module.

## Test brittleness

Current shape:

- `scripts/generate-adk-source.test.mjs` is the stable entrypoint and imports 17 test files at `scripts/generate-adk-source.test.mjs:7` to `scripts/generate-adk-source.test.mjs:23`; it can optionally validate a pre-generated output root at `scripts/generate-adk-source.test.mjs:25` to `scripts/generate-adk-source.test.mjs:31`.
- Fixture helpers generate artifacts through the actual generator modules at `scripts/adk-source-test/fixtures.mjs:149` to `scripts/adk-source-test/fixtures.mjs:168`; this is good coverage because it avoids hand-built generated source.
- Full command evidence: `node scripts/generate-adk-source.test.mjs` passed 56 tests, 0 failures.

Brittle exact-string/source-shape assertions:

1. Core runnable/smoke bundle assertions pin many emitted source strings and config strings.
   Evidence: `assertRunnableBundle()` checks exact imports, env names, Python function names, Korean fixture names, default URLs, README snippets, and node-helper files at `scripts/adk-source-test/assertions.mjs:51` to `scripts/adk-source-test/assertions.mjs:123`; `assertPregeneratedRunnableBundle()` repeats a similar set at `scripts/adk-source-test/assertions.mjs:126` to `scripts/adk-source-test/assertions.mjs:170`.
   Harmless refactor that would break: changing import order, helper placement, generated function names, README wording, or fixture module names without changing runtime behavior.

2. Route tests pin exact generated helper text and exact RequestInput one-line formatting.
   Evidence: `scripts/adk-source-test/route-choices.test.mjs:70` to `scripts/adk-source-test/route-choices.test.mjs:93` and `scripts/adk-source-test/route-choices.test.mjs:165` to `scripts/adk-source-test/route-choices.test.mjs:172` assert specific Python source snippets, alias array order, and full prompt strings.
   Harmless refactor that would break: extracting route helpers once per bundle, formatting `RequestInput()` over multiple lines, or sorting aliases differently while preserving accepted choices.

3. Dynamic lowering tests pin exact emitted Python layout.
   Evidence: `scripts/adk-source-test/dynamic-loop-lowering.test.mjs:59` to `scripts/adk-source-test/dynamic-loop-lowering.test.mjs:77` asserts exact import lines, `@node(...)`, `while True`, specific `ctx.run_node(...)` order, state key string, terminal output block, and root `Workflow(...)` shape.
   Harmless refactor that would break: extracting dynamic helpers, changing loop variable names, or making edge-driven lowering produce equivalent behavior with different text.

4. Terminal output tests pin exact event text and yielded dict layout.
   Evidence: `scripts/adk-source-test/terminal-output.test.mjs:10` to `scripts/adk-source-test/terminal-output.test.mjs:24` asserts import lines, function name, author string, text prefix, yielded dict shape, edge text, and README transcript text.
   Harmless refactor that would break: localizing the terminal message, moving the summary helper, or formatting the yielded dict differently.

5. A2A registry/provider tests pin generated function blocks and exact provider fields.
   Evidence: `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:34` to `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:52` extracts `_fn_mod_registry_discovery` by regex and checks exact JSON fragment strings plus `ctx.state["agent_registry_snapshot"]`.
   Harmless refactor that would break: replacing `agent_registry_snapshot` with a generic reviewed capability field or changing the function body structure.

6. Route runtime tests are better, but their extraction still depends on helper placement.
   Evidence: `evaluateGeneratedRoute()` executes generated Python for route decisions at `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:32` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:116`; however `generatedRouteBlock()` finds helper text by `lastIndexOf(helperMarker, routeStart)` at `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:18` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:27`.
   Harmless refactor that would break: emitting route helpers once at file top, because the extraction contract expects helper text before each route function.

7. The neutrality test is over-fitted to old leaks and under-fitted to generic neutrality.
   Evidence: `generatorAuthoredLeaks` contains a short fixed list at `scripts/adk-source-test/assertions.mjs:13` to `scripts/adk-source-test/assertions.mjs:22`; legacy route aliases have a special allowlist at `scripts/adk-source-test/assertions.mjs:23` to `scripts/adk-source-test/assertions.mjs:24`; the checker only scans those tokens at `scripts/adk-source-test/assertions.mjs:25` to `scripts/adk-source-test/assertions.mjs:33`. It missed `analysis_input_bundle` and `agent_registry_snapshot` even though the full suite passed.

Behavioral checks worth preserving/expanding:

- `dynamic-loop-decisions.test.mjs` parses generated Python with `ast`, extracts dynamic helper functions, executes them, and checks behavior at `scripts/adk-source-test/dynamic-loop-decisions.test.mjs:8` to `scripts/adk-source-test/dynamic-loop-decisions.test.mjs:38`.
- A2A route tests execute generated route code through `evaluateGeneratedRoute()` at `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:32` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:116`.
- Generated contract tests include an import-time runtime check when `google.adk` is installed at `scripts/adk-source/support/tests.mjs:41` to `scripts/adk-source/support/tests.mjs:47`, but most contract-test assertions are still string checks at `scripts/adk-source/support/tests.mjs:12` to `scripts/adk-source/support/tests.mjs:39` and `scripts/adk-source/support/tests.mjs:55` to `scripts/adk-source/support/tests.mjs:78`.

Recommended test direction:

- Keep exact-source assertions only for intentionally stable public file names, guardrail strings, and package manifest fields.
- For router/dynamic/terminal behavior, prefer generated Python AST checks, `python -m py_compile`/`compileall`, and small runtime simulations like `evaluateGeneratedRoute()`.
- Add regression fixture checks against `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json` for dynamic edge ordering and join semantics, because that fixture contains fan-in joins at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:665` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:700` and loop edges at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:777` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:817`.

## Ranked action list (top 10)

1. Move or explicitly gate `updateRunManifest()` side effects outside the pure generator.
   Evidence: generator calls the mutator at `scripts/generate-adk-source.mjs:15` to `scripts/generate-adk-source.mjs:16`; the mutator sets build complete and `stub_ready_for_followup` at `scripts/adk-source/run-manifest.mjs:11` to `scripts/adk-source/run-manifest.mjs:33`.

2. Remove `analysis_input_bundle` from generator runtime defaults.
   Evidence: hard-coded at `scripts/adk-source/emitters/runtime-tool-inputs.mjs:25` to `scripts/adk-source/emitters/runtime-tool-inputs.mjs:38`; fixture-owned at `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:230` to `templates/regression-scenarios/wf-page-recommendation-required/scaffold-plan.json:255`; test-pinned at `scripts/adk-source-test/basic-bundle.test.mjs:163` to `scripts/adk-source-test/basic-bundle.test.mjs:170`.

3. Replace `agent_registry_snapshot` special-casing with a reviewed generic capability/runtime-contract flag.
   Evidence: source trigger at `scripts/adk-source/emitters/function-node.mjs:63` to `scripts/adk-source/emitters/function-node.mjs:75`; tests and fixtures at `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:7` to `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs:14` and `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:34` to `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:52`.

4. Emit router helper functions once per bundle.
   Evidence: helper block is returned per router at `scripts/adk-source/emitters/router.mjs:31` to `scripts/adk-source/emitters/router.mjs:158`; multi-router command evidence counted two copies of `_route_decision_text`, `_route_state_text`, and `_ROUTE_CONTROL_SYNTAX_MARKERS` from the Super Agent fixture.

5. Extract shared runnable/dynamic builder prelude and node collection.
   Evidence: static setup/imports at `scripts/adk-source/agent-runnable.mjs:24` to `scripts/adk-source/agent-runnable.mjs:90`; dynamic setup/imports at `scripts/adk-source/agent-dynamic.mjs:24` to `scripts/adk-source/agent-dynamic.mjs:75`.

6. Make dynamic lowering edge-driven before the large rewrite grows.
   Evidence: current dynamic plan walks raw node order at `scripts/adk-source/graph/dynamic.mjs:96` to `scripts/adk-source/graph/dynamic.mjs:112`; loop body order is also node-order based at `scripts/adk-source/graph/dynamic.mjs:130` to `scripts/adk-source/graph/dynamic.mjs:133`; scenario D has explicit edges and loop regions at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:632` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:898`.

7. Align dynamic `join` support: either reject joins or lower them through a handler.
   Evidence: dynamic guard allows join at `scripts/adk-source/graph/dynamic.mjs:20`, but runtime symbol resolution omits join at `scripts/adk-source/graph/dynamic.mjs:197` to `scripts/adk-source/graph/dynamic.mjs:207`; scenario D has join fan-in at `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:665` to `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:700`.

8. Demote unused exports to reduce API surface.
   Evidence: repo-wide `rg` command found export-only/same-file-use candidates in `channels.mjs`, `agent-node.mjs`, `graph/indexes.mjs`, `graph/lowering.mjs`, `remote-a2a.mjs`, `support/agent-card.mjs`, and `support/samples.mjs`; specific lines are listed under "Dead or unused".

9. Replace exact-string tests around router/dynamic/terminal source with behavior checks.
   Evidence: brittle route assertions at `scripts/adk-source-test/route-choices.test.mjs:70` to `scripts/adk-source-test/route-choices.test.mjs:93`, dynamic assertions at `scripts/adk-source-test/dynamic-loop-lowering.test.mjs:59` to `scripts/adk-source-test/dynamic-loop-lowering.test.mjs:77`, terminal assertions at `scripts/adk-source-test/terminal-output.test.mjs:10` to `scripts/adk-source-test/terminal-output.test.mjs:24`; better behavioral patterns exist at `scripts/adk-source-test/dynamic-loop-decisions.test.mjs:8` to `scripts/adk-source-test/dynamic-loop-decisions.test.mjs:38` and `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:32` to `scripts/adk-source-test/cdp-a2a-route-runtime.mjs:116`.

10. Delete or inline the A2A test aggregator and keep test imports explicit.
    Evidence: `scripts/adk-source-test/cdp-a2a-super-agent-simplification.test.mjs:1` to `scripts/adk-source-test/cdp-a2a-super-agent-simplification.test.mjs:4` only import other tests; `scripts/generate-adk-source.test.mjs:20` imports that aggregator.
