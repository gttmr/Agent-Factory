# Dynamic edge-driven generator rewrite design

> Status: **APPROVED 2026-07-12 (main session)** — all twelve §7 decisions resolved to the recommended options (D1 sequential awaits, D2 edge-path closure, D3 reject unreachable, D4 reviewed-fan-in-only aggregation, D5 runtime-name join keys, D6 node-index tie-break, D7 reject nested loops, D8 deterministic run IDs gated by a RED/GREEN real-runtime resume proof, D9 plan-authoritative coverage ledger, D10 per-kind registry rows, D11 SHA-256 manifests + behavioral tests, D12 InMemoryRunner + host-capable A2A). The §7 open questions are implementation stop-gates: prove or re-escalate before finalizing the affected decision.

Status: design only; no production implementation is included in this worktree change.

Decision owner: main implementation session. Approved delivery framing: **two staged PRs** — PR-A correctness first, PR-B structure second.

## 1. Scope, evidence, and non-goals

This design starts from `.evidence-c5-generator.md`, especially the `Node collection` and `Graph lowering` comparison rows and lines 68–76. The current dynamic path accepts more graph shape than it faithfully lowers: it walks `processFlow.nodes` order, drops `join`, and has no dynamic equivalent of the static runnable reachability/acyclic checks. The current checkout also confirms the recent prerequisites: reviewed template selectors and compatibility checks live under `scripts/artifact-validation/`, and `scripts/generate-adk-source.mjs` is now a pure bundle-file generator.

The target remains the approved public contract:

- `output_mode` stays `smoke | runnable`; dynamic remains an internal runnable strategy, not a third public mode.
- Graph IR edges, reviewed containers, and reviewed node kinds are the execution contract. Array position is only a deterministic tie-breaker between independent nodes.
- Raw requirements never reach code generation; approval, runtime-contract, Remote A2A, and artifact-sync gates remain unchanged.
- No new domain literal, route alias, selector, or workflow-specific heuristic enters generator source.
- PR-A fixes dynamic correctness without attempting the general dispatch refactor. PR-B changes ownership/structure without adding another behavior change.

Out of scope for both PRs: a new public output mode, schema/taxonomy expansion, catalog changes, unreviewed automatic graph repair, parallel `ctx.run_node()` scheduling, retry/fallback runtime wrappers, and generator-owned manifest mutation.

## 2. Design invariants and local ADK facts

The implementation must preserve these invariants:

1. Every active Graph IR node is either lowered exactly once into an execution role (`seed`, `run`, `join barrier`, `loop control`, or `terminal`) or rejected with a truthful error. Agent-owned MCP toolset adapters are the only deliberate non-executing exclusion and remain accounted for explicitly.
2. Every accepted edge is consumed by ordering, routing, loop control, or data-flow construction. No accepted edge kind or execution semantic may be silently ignored.
3. Ordinary execution order comes from edges. Original node-array order is used only as the stable Kahn-queue tie-breaker for simultaneously ready nodes, preserving deterministic output where the array was already topological.
4. Cycles are legal only as reviewed `loop_back` edges inside a valid `loop_region`; removing those sanctioned back-edges must leave both the loop body and collapsed outer graph acyclic.
5. A join successor cannot run until all incoming predecessor executions for the current outer run or current loop iteration have completed, and its input is the complete predecessor-output map.
6. Valid smoke output is byte-identical across both PRs. PR-B must not introduce any new generated-output delta after the intentional PR-A dynamic correction.

Local source verification used for the runtime design:

- The shared runtime currently has `google-adk` 2.3.0.
- `Context.run_node()` says to await it directly; wrapping it in `asyncio.create_task()` leaves it unsupervised and breaks parent interruption/cancellation semantics.
- Static `Workflow` scheduling provides concurrency and makes `JoinNode` wait for all predecessors. A dynamically invoked `JoinNode` has no registered predecessor graph of its own; calling it with `ctx.run_node()` would only pass through caller-assembled input and would not itself create a barrier.
- Therefore PR-A uses direct awaited child runs plus an explicit generated result map/barrier. It does not use `asyncio.gather()` or `create_task()` around `ctx.run_node()`.

## 3. Delivery and compatibility contract

| PR | Purpose | Valid generated-output contract |
| --- | --- | --- |
| PR-A | Make dynamic execution edge-driven, preserve fan-in, and make guards truthful. | Smoke and static runnable stay byte-identical. Dynamic `agent.py` may change only for edge-derived call ordering, result-map/join-barrier lowering, and the corresponding loop-body lowering. Invalid graphs now fail before writing a bundle. Other generated files remain byte-identical unless they embed `agent.py` bytes by an existing documented mechanism. |
| PR-B | Centralize node/edge dispatch and common collection. | Smoke stays byte-identical to pre-PR-A. Static runnable stays byte-identical to pre-PR-A. Dynamic stays byte-identical to the accepted PR-A output. Valid-bundle import order, declarations, helper text, README, manifests, env examples, and contract tests do not change. Guard error wording may become centrally produced, but valid output may not. |

PR-B begins only after PR-A's behavioral tests and real-ADK gate pass. This prevents a correctness failure from being hidden inside a large movement/refactor diff.

## 4. PR-A — correctness first

### 4.1 A1: edge-based dynamic execution order and graph guards

Replace the current raw-node walk with a validated two-level execution plan. The plan is derived once and is the source for both guard coverage and Python emission.

#### Normalization and ordering algorithm

1. Build indexed nodes/edges and reject duplicate/missing node IDs, dangling endpoints, and module-bound nodes whose module is absent. Preserve the original node index as `stableIndex`; it is never treated as a dependency.
2. Mark agent-owned MCP toolset adapter nodes as explicit `toolset_exclusion` records. They are not execution nodes, but their incident edges must already be legal under existing toolset/channel rules; they are not silently erased from validation accounting.
3. Identify every reviewed `loop_back`/`loop_exit` family by its `loop_control` source. Each control must be anchored by exactly one `loop_region`, have at least one reviewed back and exit edge, and use reviewed aliases/conditions/default rules already required today.
4. Remove only those validated `loop_back` edges and assert that the remaining execution graph is acyclic. Any self-loop or residual cycle is a cycle outside the sanctioned loop contract and is rejected. A cycle cannot be made legal merely by placing nodes in a `loop_region`.
5. Derive each **operational loop body from edges**, not from raw container membership: for every loop-back target, take nodes reachable from that target that can also reach the loop control in the forward graph (with loop-back/exit edges excluded), then union the paths for that control. The loop container remains the reviewed anchor and must contain the control and declared entry/exit anchors, but other reviewed subregions on the actual path are included operationally.
6. This edge-derived operational scope is required for `scenario-d`: its loop-back is `loop_control_001 -> mod-004`, but the forward path to the control is `mod-004 -> mod-005 -> human_input_001 -> mod-006 -> loop_control_001`. The current container list contains only `mod-004`, `mod-006`, and the control; using that list as execution membership incorrectly moves the human-review path after the loop. PR-A must put all five path nodes in the iteration.
7. Reject overlapping operational loop bodies, nested loop controls, a back-edge target outside the derived body, an exit target inside it, or an operational body with no unique forward path to its control. Nested/overlapping dynamic regions remain unsupported rather than being guessed.
8. Collapse each operational loop body to one outer execution unit. Preserve incoming edges to a body entry and exit edges from its control; reject any other boundary crossing that would enter mid-body or leave before the control.
9. Run stable Kahn topological sorting on the collapsed outer graph and independently on every loop body's forward graph. The ready queue is ordered by the minimum original `stableIndex` represented by each unit. Thus edges impose all constraints while already-valid independent-branch ordering remains deterministic.
10. Seed reachability from Graph IR `input` nodes. Reject every active lowerable node, explicit/synthetic join, loop control, loop unit, or output that is not reachable from an input through accepted edges. Do not copy static runnable's historical `START` backfill for orphan modules into dynamic mode. Also require at least one reachable terminal/output path.

The plan shape becomes explicit and testable:

```text
DynamicPlan
  seeds: [{ nodeId }]
  steps: RunStep | JoinBarrierStep | LoopStep | TerminalStep
  coverage: Map<nodeId, seed|run|join|loop_control|terminal|toolset_exclusion>

LoopStep
  entryNodeIds
  bodySteps              # edge-topological, includes joins
  controlNodeId
  backAliases / exitAliases / defaultAction
  exitTargetIds
```

The builder fails unless `coverage` contains every graph node that the dynamic guard claims to support. That postcondition prevents a future accepted kind from becoming another dropped `join`.

#### Current byte-diff exposure

The current fixtures were checked rather than assumed:

Today, any non-topological forward array is emitted in that wrong array order because the dynamic builder never consults ordinary edges for scheduling. None of the checked dynamic fixtures currently exposes that failure; the table identifies why an intentional shuffled regression is required.

| Fixture/scenario | Dynamic? | Node-array order versus edges | PR-A consequence |
| --- | --- | --- | --- |
| `scenario-d-graph-workflow` | Yes | Topological for all ten forward edges; the only backward edge is the reviewed `loop_control_001 -> mod-004` `loop_back`. | No reorder caused merely by Kahn sorting. Output still changes intentionally because `join-001` becomes a barrier and the edge-derived loop scope correctly moves `mod-005` + `human_input_001` into the loop body. |
| `dynamic-loop-lowering.test.mjs` fixture | Yes | Topological except its reviewed loop-back. Container already contains the whole forward body. | Call order remains draft → review → control → terminal; generated bookkeeping/barrier helpers may change bytes. |
| `dynamic-loop-decisions.test.mjs` fixture | Yes | Topological except its reviewed loop-back; the fixed adapter follows the loop exit. | Existing behavioral order is preserved. |
| Dynamic-module fixture in `dynamic-loop-guards.test.mjs` | Yes | `input -> dynamic workflow -> output`, already topological. | No call reorder; it proves the non-loop dynamic strategy still works. |
| Missing-decision rejection fixture | Yes | Topological except loop-back. | Still rejects, before output. |
| `scenario-g-human-input-review` | No (static runnable) | Topological. | No PR-A generated-byte change. Used later as a static/HITL regression. |
| `scenario-i-remote-a2a` | No (static runnable) | Topological. | No PR-A generated-byte change. Used later as a remote dispatch regression. |
| `wf-page-recommendation-required` | No (static runnable) | Not topological: `node-classify-objective -> node-confirm-purpose` and `node-search-page-products -> node-select-initial-page` point backward in the array. | This is the proof that PR-B must preserve static edge lowering and declaration order independently. PR-A does not reroute it through dynamic lowering. |

No existing dynamic regression fixture depends on a non-topological forward node array. Add one deliberately shuffled dynamic fixture so the correction is observable rather than only inferred.

### 4.2 A2: dynamic join lowering

Dynamic fan-in is represented as a plan barrier plus an execution-result map; it is not emitted as an unconnected `JoinNode` call.

The generated dynamic function changes from one mutable `payload` chain to per-node results:

```python
results = {"intake_request": node_input}
results["mod-002"] = await ctx.run_node(node_mod_002, results["intake_request"])
results["mod-003"] = await ctx.run_node(node_mod_003, results["intake_request"])
results["join-001"] = {
    "evidence_lookup_a": results["mod-002"],
    "evidence_lookup_b": results["mod-003"],
}
results["mod-004"] = await ctx.run_node(agent_mod_004, results["join-001"])
```

Names above are illustrative; emitted keys use the same runtime node-name resolver as static runnable so the aggregate matches ADK `JoinNode`'s `{predecessor runtime name: output}` shape. Predecessor ordering is deterministic by the edge-topological/stable order, but behavioral tests compare the mapping rather than dict source formatting.

Barrier rules:

- An explicit `join` produces `JoinBarrierStep { nodeId, predecessorIds, predecessorRuntimeNames }`. It has no `ctx.run_node` symbol. Its presence in the ordered plan proves all predecessor `await`s have completed before aggregation and before successors execute.
- A multi-predecessor target with reviewed `fan_in` semantics but no explicit join gets the same deterministic synthetic-barrier normalization already provided by static runnable. The synthetic identifier is generator-internal and stable.
- Multiple incoming edges without an explicit join and without reviewed `fan_in` semantics are rejected in PR-A. Static graph scheduling may trigger a node multiple times, but the current dynamic one-run-per-node plan cannot truthfully claim that behavior.
- Fan-out branches receive the same upstream result; one branch's result must not become the next branch's input merely because direct awaits are sequential.
- Join aggregation includes `None`/empty outputs under their predecessor key, matching ADK's all-predecessor barrier shape rather than treating falsey output as “not complete.”
- Inside a loop, `iteration_results` is recreated on every iteration. Join completion from iteration N cannot satisfy a barrier in iteration N+1. Values needed after loop exit are copied deliberately to the outer result for the collapsed loop unit.
- The loop control consumes the result of its actual forward predecessor/barrier, not whichever node happened to be last in the source array.
- Every generated child call uses a deterministic, non-numeric explicit `run_id`: outer calls derive it from the Graph IR node ID; loop calls derive it from region ID + iteration + node ID. When `rerun_on_resume=True` restarts the dynamic parent after HITL, the same call sequence reconstructs the result map from ADK's cached child runs instead of accidentally allocating different child identities.

This design is intentionally sequential for sibling dynamic runs. The barrier guarantee is “all direct-awaited incoming branches completed before the successor,” not “branches ran concurrently.” ADK 2.3 explicitly warns against wrapping `ctx.run_node()` in `create_task()`. If true dynamic parallelism is later required, the recommended separate design is an edge-derived nested static `Workflow` segment with real graph scheduling + `JoinNode`, invoked once from the dynamic parent. It is not bundled into PR-A because interruption/resume, branch isolation, and loop-iteration identity need their own runtime proof.

For `scenario-d`, the exact fan-in is:

```text
intake_request
  -> mod-002 ─┐
              ├─> join-001 barrier -> operational loop unit
  -> mod-003 ─┘
```

The barrier aggregates both adapter outputs before `mod-004`; the operational loop then runs `mod-004 -> mod-005 -> human_input_001 -> mod-006 -> loop_control_001` on each iteration.

### 4.3 A3: guard truthfulness

Keep the PR-A guard local to `graph/dynamic.mjs`, but make plan construction authoritative:

- `assertDynamicRunnableGraphSupported()` validates node/edge/container contracts and then delegates to the same analysis used by `buildDynamicRunnablePlan()`; it no longer maintains a permissive set unrelated to the lowerer.
- Supported node wording lists the actual roles: module-bound executable nodes, input seeds, output terminals, `human_input`, explicit/synthetic `join` barriers, and exactly-one-per-region `loop_control`. `router`, `callback_wait`, unknown module-less intermediary nodes, nested loops, and structured HITL responses remain rejected unless a lowerer exists.
- Supported edge wording lists actual behavior: ordinary event/state/artifact/valid Remote A2A transitions already accepted by existing channel/A2A guards; reviewed fan-out/fan-in; and validated loop-back/loop-exit control edges. Conditional/route edges remain a static runnable capability and are rejected in dynamic mode.
- After planning, compare the accepted-node set and accepted-edge IDs with plan coverage/consumption records. Any difference is an internal generator error naming the unconsumed IDs, not a successful bundle.
- Error messages distinguish artifact invalidity (dangling, cycle, unreachable, incoherent loop boundary), unsupported capability (router, nested loop, repeated-trigger convergence), and internal handler coverage failure.
- A valid `join` can no longer be accepted and dropped. If a future implementation chooses not to support a location such as a nested-loop join, the guard must reject that location explicitly before generation.

### 4.4 PR-A exact touch list

Production/docs files:

- `scripts/adk-source/graph/dynamic.mjs` — validated graph analysis, edge-derived loop scope, stable topological sort, reachability/cycle checks, join/barrier plan, coverage accounting, truthful errors.
- `scripts/adk-source/agent-dynamic.mjs` — result-map emission, run/join/loop/terminal renderers, per-iteration result reset, no unsupervised concurrency.
- `docs/workbench/agent-factory-harness.md` — replace the current broad “bounded while” description with the edge-order, loop-scope, join-barrier, and sequential-dynamic guarantees.
- `docs/workbench/validation.md` — update the active runnable-lowering contract for edge-derived dynamic order, sanctioned-loop cycle checks, explicit/implicit fan-in barriers, and unreachable-node rejection.
- `CLAUDE.md` — keep the model-facing dynamic runnable summary aligned with the harness.
- `docs/decision-log.md` — record that edges, not node-array/container-list order, own dynamic execution and that dynamic fan-in is an explicit barrier.

Test files:

- `scripts/adk-source-test/generated-python-runtime.mjs` — add a reusable async generated-function runner/fake `Context.run_node` trace harness; do not add source-string extraction coupled to helper placement.
- `scripts/adk-source-test/real-adk-runtime.mjs` (new, separately invoked gate) — package the campaign-2 `InMemoryRunner` pattern for generated bundles, deterministic child traces, HITL resume, and optional configured model/MCP/A2A integration. It is not imported by the fast unit entrypoint.
- `scripts/adk-source-test/dynamic-loop-lowering.test.mjs` — execute the generated dynamic plan behaviorally, including the real `scenario-d` shape and the loop-body human-input placement.
- `scripts/adk-source-test/dynamic-loop-decisions.test.mjs` — retain alias/default behavior and add iteration-local result/barrier assertions.
- `scripts/adk-source-test/dynamic-loop-guards.test.mjs` — add cycle, unreachable, illegal loop boundary, nested/overlapping loop, and accepted-kind coverage failures.
- `scripts/adk-source-test/dynamic-edge-ordering.test.mjs` (new) — shuffled node array, fan-out shared input, explicit join aggregation, implicit reviewed fan-in barrier, and ambiguous multi-trigger rejection.
- `scripts/generate-adk-source.test.mjs` — import the new behavioral test file.

No schema, catalog, template fixture, artifact-validation selector/compatibility helper, static lowering, smoke builder, or public CLI file changes belong in PR-A. The committed `scenario-d` artifact remains unchanged; tests consume its reviewed graph rather than rewriting it to fit the generator.

## 5. PR-B — structure second

### 5.1 B1: single node/edge dispatch layer

Create one dispatch facade with one registered handler per Graph IR `node_kind` and one per `edge_kind`. A “new kind = one handler” means a new kind is added in one registry row; mode builders may assemble the handler result but may not add another kind switch.

This completes, rather than replaces, the 2026-06-17 decision-log direction. That earlier change centralized runnable **emission roles** and public output-mode selection, but the current C5 evidence shows endpoint resolution, guard capability, and edge lowering still remain in three/duplicated paths. PR-B extends the same standing decision through the graph layer.

#### Proposed module layout

```text
scripts/adk-source/
  dispatch/
    node-kinds.mjs       # NODE_KIND_HANDLERS keyed by node_kind
    edge-kinds.mjs       # EDGE_KIND_HANDLERS keyed by edge_kind
    modes.mjs            # kind-agnostic smoke/static/dynamic assemblers
    index.mjs            # lookup/fail-fast facade used by graph + emitters
  graph/
    collector.mjs        # one declaration/feature/collision collector
```

`node-kinds.mjs` contains explicit rows for every schema node kind, including rows whose support is currently `false` in a mode (`callback_wait`, unsupported bare `function`/`tool`, router in dynamic, etc.). Each row owns:

- module-binding rule and shape validation;
- supported modes and truthful unsupported reason;
- collection bucket/feature declarations;
- runtime endpoint resolution by mode and edge side;
- runnable emission role or synthetic declaration policy;
- collision symbols contributed by that kind.

Module-bound variants still delegate implementation selection to the reviewed module contract (agent, connected adapter, local stub, workflow call, Remote A2A). That compatibility decision remains data-driven and may reuse `moduleLoweringRole`; it is called from the node-kind handler rather than becoming a second graph-kind registry.

`edge-kinds.mjs` has one row for each current edge kind: `event_output`, `event_message`, four state kinds, `artifact`, `route`, `control`, and `remote_a2a`. Each handler owns:

- endpoint legality and boundary checks;
- allowed `execution_semantics` by mode;
- required metadata (`state_key`, `artifact_key`, route metadata, A2A contract/boundary data);
- feature/import flags;
- a lowering callback for smoke projection, static edge specs, or dynamic dependency/control records;
- an explicit consumed-edge record used by coverage assertions.

Execution semantics remain attributes validated inside the owning edge-kind handler. For example, the `control` handler is the only owner of `loop_back`/`loop_exit`, and the `route` handler is the only owner of conditional route lowering. Adding an execution semantic to an existing kind edits that handler, not both static and dynamic guards.

`dispatch/index.mjs` exposes only fail-fast operations such as:

```text
handlerForNode(node)
handlerForEdge(edge)
resolveRuntimeEndpoint(nodeId, { mode, side, graph, counts, exclusions })
validateAndLowerEdge(edge, modeContext)
collectNodeTarget(node, collectionContext)
```

This facade replaces the three current endpoint/runtime-symbol resolvers:

- smoke `graph/indexes.mjs:graphEndpoint()`;
- static `graph/lowering.mjs:resolve()`;
- dynamic `graph/dynamic.mjs:runtimeSymbolFor()`.

It also replaces the duplicated kind/edge acceptance switches in static `graph/guards.mjs` and dynamic `graph/dynamic.mjs`. Guards may still own graph-wide invariants—reachability, cycles, duplicate route defaults, loop-region coherence—but they ask handlers whether each individual node/edge is supported and consumed.

#### Mode-specific behavior that stays outside kind handlers

`dispatch/modes.mjs` and the existing mode builders keep orchestration that is not a kind decision:

- **Smoke adapter:** `START`/`emit_workflow_result` fallback projection, TODO function layout, `GRAPH_EDGES`, and BaseAgent template.
- **Static runnable adapter:** static `Workflow` edge assembly, route-map grouping, explicit/automatic `JoinNode` declarations, static reachability/acyclic checks, and projection-note placement.
- **Dynamic runnable adapter:** PR-A's stable topological planning, operational loop collapse, bounded-while rendering, per-iteration result maps, and join barriers.
- **Builder templates:** import ordering, helper placement, function/declaration ordering, descriptions, manifests, README, env output, and package files.

Mode adapters operate on handler-produced semantic records; they contain no `switch (node_kind)` or `switch (edge_kind)`. Cross-node and cross-edge invariants naturally remain graph-wide.

#### Byte-identity boundary

PR-B is a movement/ownership change only:

- Smoke output must match the pre-PR-A baseline byte-for-byte for every generated file.
- Static runnable output must match the pre-PR-A baseline byte-for-byte, including declaration order for the intentionally non-topological `wf-page-recommendation-required` array.
- Dynamic output must match the accepted PR-A baseline byte-for-byte. PR-B may not reorder helpers/imports/declarations, rename symbols, or further change result-map formatting.
- Invalid-graph errors may be reworded to name the centralized handler and actual unsupported capability; that is not a generated bundle delta.

Router-helper consolidation, shared runnable prelude extraction, import cleanup, and unused-export cleanup from the C5 review are explicitly separate follow-ups. Combining them with PR-B would make byte identity harder to prove and is unnecessary for “one kind = one handler.”

### 5.2 B2: common node collection

Add `collectGenerationNodes(context, { mode })` in `graph/collector.mjs`. It uses the node handlers to classify the graph once while preserving original declaration order.

Returned data:

```text
GenerationNodeCollection
  graph
  counts
  toolsetAdapterIds
  moduleSpecsInDeclarationOrder
  humanInputNodes
  routerNodes
  terminalOutputNodes
  explicitJoinNodes
  loopControlNodes
  unsupportedNodes
  collisionTargets
  featureFlags
  coverage
```

What unifies:

- one `graphIndexes()` result and one `moduleNodeCounts()` result;
- agent-owned toolset exclusion;
- ordered module-node specs;
- human-input/router/output/join/loop-control grouping;
- collision-target assembly;
- handler feature aggregation used by later import decisions;
- explicit accounting for unsupported or deliberately excluded nodes.

How each existing builder consumes it:

- `agent-smoke.mjs` uses `context.modules` for the existing module TODO functions and `moduleSpecsInDeclarationOrder` for existing per-node smoke functions. Its local `buildTodoFunction()`/`buildNodeFunction()` and emitted order remain unchanged.
- `agent-runnable.mjs` uses module specs plus human/router/output/join buckets and static join results. Existing `emitRunnableNodeBlocks()` ordering remains module → human input → router → terminal.
- `agent-dynamic.mjs` uses the same module/human/output/join/loop buckets. It no longer passes hard-coded empty router arrays or builds a partial collision list; an unsupported collected router is rejected by the dynamic handler/guard, not omitted.

What deliberately does **not** unify:

- smoke TODO/node function text versus runnable emitters;
- static join declarations versus dynamic join barriers;
- static router collection use versus dynamic router rejection;
- mode-specific graph assembly, import/template emission, and runtime helper text;
- execution order. Collection preserves declaration order; PR-A's dynamic execution plan separately derives edge order.

This boundary removes copy/paste collection drift without turning the collector into a second lowering engine.

### 5.3 PR-B exact touch list

New production modules:

- `scripts/adk-source/dispatch/node-kinds.mjs`
- `scripts/adk-source/dispatch/edge-kinds.mjs`
- `scripts/adk-source/dispatch/modes.mjs`
- `scripts/adk-source/dispatch/index.mjs`
- `scripts/adk-source/graph/collector.mjs`

Existing production modules:

- `scripts/adk-source/graph/indexes.mjs` — retain indexing/public projection helpers; remove the smoke-only endpoint resolver after smoke uses dispatch.
- `scripts/adk-source/graph/lowering.mjs` — use dispatch endpoints/edge records; remove local `resolve()` and kind-specific edge decisions while retaining static graph-wide lowering.
- `scripts/adk-source/graph/guards.mjs` — use handler capability checks; retain static graph-wide invariants and symbol-collision implementation.
- `scripts/adk-source/graph/dynamic.mjs` — use dispatch endpoints/edge records and common collection; retain PR-A plan/loop/reachability logic; remove local runtime-symbol and per-kind/per-edge switches.
- `scripts/adk-source/agent-smoke.mjs`
- `scripts/adk-source/agent-runnable.mjs`
- `scripts/adk-source/agent-dynamic.mjs` — all three consume `GenerationNodeCollection` without template reorder.
- `scripts/adk-source/emitters/node-registry.mjs` — consume the node handler's emission role/emit callbacks instead of owning an independent graph-kind support table.
- `scripts/adk-source/emitters/agent-node.mjs` — keep or narrow `moduleLoweringRole()` as the module-contract compatibility helper called by the relevant node handlers; no graph-kind dispatch remains here.
- `docs/decision-log.md` — append a PR-B entry stating that the existing emission-level dispatch decision is now completed across node endpoints, edge semantics, capability checks, and collection, with valid generated bytes unchanged.

Test modules:

- `scripts/adk-source-test/graph-dispatch.test.mjs` (new) — table completeness against current schema constants, one handler per kind, unsupported-mode truthfulness, endpoint parity, and edge-consumption parity.
- `scripts/adk-source-test/node-collector.test.mjs` (new) — smoke/static/dynamic buckets, declaration order, toolset exclusions, joins/routers/loop controls, collision coverage.
- `scripts/adk-source-test/output-byte-identity.test.mjs` (new) — relative-path + SHA-256 bundle snapshots: pre-PR-A smoke/static baselines and post-PR-A dynamic baseline.
- `scripts/adk-source-test/cdp-a2a-route-runtime.mjs` and route behavior tests — make any extraction adjustment necessary to execute centralized dispatch output, but do not change route behavior or helper placement.
- `scripts/adk-source-test/dynamic-edge-ordering.test.mjs`, `dynamic-loop-lowering.test.mjs`, and `dynamic-loop-guards.test.mjs` — prove PR-A behavior survives structural migration.
- `scripts/adk-source-test/remote-a2a.test.mjs`, `state-channels-lowering.test.mjs`, `artifact-channels.test.mjs`, `terminal-output.test.mjs`, and `toolsets.test.mjs` — extend behavior/AST coverage only where the moved handler makes an existing assertion implementation-shaped.
- `scripts/generate-adk-source.test.mjs` — import the new dispatch/collector/byte-identity tests.

No schema, validator, catalog, template artifact, CLI, web UI, or active behavior-doc edit belongs in PR-B. The decision-log entry records structure/history, not a runtime contract change; PR-A already updates active behavior docs. If implementation discovers that a schema or active behavior doc must change, stop and return that expansion to the main session instead of hiding it in the structure PR.

## 6. Test and regression strategy

The test direction is behavioral. Exact-source assertions are retained only where bytes are the explicit compatibility product (the PR-B byte snapshots) or where a public guardrail string is itself contractual.

### 6.1 PR-A test layers

1. **Plan-level graph tests**
   - Shuffle a valid dynamic graph's node array while preserving edges; assert the plan order follows dependencies and stable-ties independent siblings by original index.
   - Add an unsanctioned cycle and self-loop; assert rejection.
   - Add an isolated executable node and isolated output; assert unreachable-node rejection with IDs.
   - Prove a reviewed loop-back is the only removed edge and that any second residual cycle still rejects.
   - Prove `scenario-d` operational loop membership includes the human-review path found through edges even though those nodes are not all in `loop_region.contains_node_ids`.

2. **Generated-Python behavioral tests**
   - Extend `generated-python-runtime.mjs` to AST-select the generated async dynamic function and run it against a fake context whose directly awaited `run_node()` records `(symbol, input, run_id)` and returns distinguishable JSON-safe outputs.
   - Assert both fan-out children receive the same upstream input, both complete before the join result is assembled, the join mapping contains both runtime names, and the successor receives the mapping.
   - Assert loop iteration results reset, deterministic run IDs include the iteration, and the terminal receives the loop exit result.
   - Convert the implementation-shaped `ctx.run_node(...)` ordering checks in `dynamic-loop-lowering.test.mjs` to trace assertions. Keep `py_compile` and AST validity checks; do not replace them with a new block of exact generated strings.
   - Keep `dynamic-loop-decisions.test.mjs`'s executed alias/default behavior and extend it to unknown/exit/back choices across multiple iterations.

3. **Guard tests**
   - Table-test every currently accepted dynamic kind and edge semantic: either a plan coverage record exists or generation rejects before write.
   - Add explicit `join` outside and inside a loop; neither may disappear.
   - Add ambiguous multiple normal predecessors; assert the truthful unsupported error. Add reviewed fan-in without explicit join; assert a synthetic barrier.

4. **Fast suite and build**

```bash
AF_TEST_PYTHON=.agent-factory/runtime/.venv/bin/python node scripts/generate-adk-source.test.mjs
node scripts/validate-artifacts.mjs
npm run build --prefix packages/web
```

The validator command is a regression gate, not evidence that generator-only graph guards ran; the behavioral tests provide that evidence.

### 6.2 PR-B test layers

1. **Dispatch completeness and one-owner rule**
   - Compare handler keys with the canonical node/edge kind constants already duplicated for the dependency-light validator. Missing and extra handlers fail.
   - For each handler/mode, assert `supported` implies an endpoint/lowering/collection result and `unsupported` supplies a non-empty reason.
   - Assert each accepted edge ID is returned once in the consumed-edge ledger.

2. **Collector behavior**
   - Feed one mixed graph through smoke/static/dynamic collection and assert declaration order and all buckets, including joins/routers/loop controls, toolset exclusions, feature flags, and collision targets.
   - Assert dynamic sees then rejects a router; it must not get an empty array injected by the builder.

3. **Behavioral parity harnesses**
   - Continue using `evaluateGeneratedRoute()` for route choice, default route, state-context, and Remote A2A owner-route behavior. If dispatch movement forces extraction changes, make extraction AST/function-name based; do not pin helper placement.
   - Continue using `generated-python-runtime.mjs` for function/terminal/channel/provider behavior and the PR-A async dynamic trace.
   - Run the existing dynamic-loop decision/lowering/guard suites, Remote A2A tests, channel tests, terminal tests, toolset tests, workflow-call tests, and neutrality source scan.

4. **Byte identity**
   - Before PR-A, record normalized relative-path/SHA-256 manifests for canonical smoke and static runnable test bundles.
   - After PR-A acceptance, record the canonical dynamic bundle manifest.
   - PR-B generates the same inputs and compares every relative path and file byte hash. A mismatch prints the paths and fails; it is not “fixed” by updating hashes unless the main session reclassifies the PR as a behavior change.
   - Hash snapshots are intentional only for this compatibility gate. Route/dynamic semantics stay behavior-tested rather than reverting to broad exact-string assertions.

5. **Fast suite/build**

Run the same three commands as PR-A, plus focused route/remote tests during development. `git diff --check` and a scoped status review confirm no artifact/runtime output was committed.

### 6.3 Required regression scenarios and real-ADK gates

Scenarios with only `analysis-result.json` are staged into temporary artifact roots and derived through the existing artifact-sync/scaffold-plan path with `output_mode: runnable`; committed fixtures are not edited merely to make generator tests convenient. Any candidate approval adjustments needed for a runtime test occur only in the temporary test copy and are listed in the evidence. Generation then uses the pure CLI/module path.

| Scenario | PR-A expectation | PR-B expectation | REAL ADK runtime gate? |
| --- | --- | --- | --- |
| `scenario-d-graph-workflow` | Primary correctness fixture: edge order, explicit `join-001`, full operational loop path, HITL resume, loop exit, terminal. | Must remain byte-identical to PR-A and behaviorally identical through centralized dispatch/collection. | **Required for both PRs.** Use real ADK 2.3 `InMemoryRunner`; run first turn through `adk_request_input`, resume with matching `functionResponse`, and observe both fan-in inputs before the loop successor plus terminal completion. |
| Dedicated loop fixtures (`dynamic-loop-lowering`, decisions, guards) | Shuffled order, bounded retries, default/back/exit choices, per-iteration barrier reset, max-iteration behavior. | Same traces after movement. | **Required for PR-A; rerun focused deterministic gate in PR-B.** A small generated workflow with controlled node outputs isolates scheduler/resume behavior without a server. |
| `scenario-g-human-input-review` | Static output must stay byte-identical; fast generation/compile regression only. | Exercises static node handler, explicit `JoinNode`, parallel fan-out, `RequestInput`, and collector order. | **Required for PR-B.** Use `InMemoryRunner` pause/resume and assert both parallel inputs reach the static join before the review/terminal path. |
| `scenario-i-remote-a2a` | Static output must stay byte-identical; existing contract/guard tests stay green. | Exercises remote node + `remote_a2a` edge handlers and collection/import features. | **Required for PR-B.** Run the documented synthetic local A2A provider plus generated consumer under real ADK. If sandbox sockets are blocked, run this gate in the host-capable environment; `py_compile` is not a substitute. |
| `wf-page-recommendation-required` | Static output must stay byte-identical despite its non-topological declaration array. | Highest-value route/state/tool/workflow-call dispatch regression; declaration bytes remain unchanged. | **Required for PR-B.** Reuse the campaign-2 `InMemoryRunner + configured Gemini + Mock Lab MCP` pattern and JSON-safe initial `types.Content`; capture the multi-turn event trace. |

The real-ADK harness must use the shared `.agent-factory/runtime/.venv`, report the installed `google-adk` version, never print secret values, and separate an external Gemini/provider failure from generator failure. A green unit suite plus `py_compile` alone is insufficient for PR-A or PR-B completion.

## 7. Risks and open decisions for the main session

The following are decision-ready. “Recommended” is the default implementation choice unless new runtime evidence contradicts it.

| ID | Decision | Options | Recommended | Why / acceptance consequence |
| --- | --- | --- | --- | --- |
| D1 | Dynamic sibling concurrency | (a) sequential direct awaits; (b) `asyncio.gather/create_task`; (c) nested static `Workflow` segments | **(a) for PR-A** | ADK 2.3 explicitly warns against unsupervised tasks. Sequential execution still provides correct fan-out input and fan-in completion. Treat true concurrency as a separately proven nested-workflow feature. |
| D2 | Operational loop membership | (a) strict `contains_node_ids`; (b) edge path closure anchored by reviewed loop container; (c) silently union both | **(b)** | `scenario-d` proves container membership alone is execution-wrong. Edge closure is deterministic; the container remains an approval anchor, not an alternate ordering source. |
| D3 | Orphan dynamic nodes | (a) synthesize `START` edges like static; (b) reject unreachable; (c) drop | **(b)** | The request explicitly requires unreachable guards and reviewed edges own execution. Auto-repair would hide artifact defects. |
| D4 | Multi-predecessor without explicit join | (a) run once with arbitrary last payload; (b) always aggregate; (c) aggregate only reviewed fan-in, reject ambiguous normal convergence | **(c)** | It matches reviewed intent and static auto-join behavior without inventing repeated-trigger semantics. |
| D5 | Join aggregate keys | (a) Graph IR IDs; (b) runtime node names; (c) array | **(b)** | ADK static `JoinNode` supplies `{predecessor runtime name: output}`. Matching it reduces mode drift; tests should not depend on dict source order. |
| D6 | Topological tie-breaker | (a) lexical node ID; (b) original node index; (c) edge-file order | **(b)** | It minimizes byte diffs for already-topological fixtures and preserves reviewer-visible independent-branch order while edges remain authoritative. |
| D7 | Nested/overlapping loops | (a) recursively lower now; (b) flatten; (c) reject truthfully | **(c)** | Current builder and fixtures do not prove nested resume/barrier semantics. Flattening changes behavior silently. |
| D8 | Dynamic child run identity | (a) implicit counters; (b) deterministic explicit run IDs by node/region/iteration | **(b)** | Parent rerun after HITL must replay the same child identities and rebuild result maps from cached outputs. Real-ADK resume tests are the gate. |
| D9 | PR-A guard/plan relationship | (a) separate duplicated support list; (b) plan is authoritative with coverage ledger | **(b)** | Prevents another accepted-but-dropped kind. PR-B later moves the per-kind facts without changing the ledger invariant. |
| D10 | PR-B handler granularity | (a) one mega mode switch; (b) one registry row per node/edge kind plus kind-agnostic mode assemblers; (c) one file per mode | **(b)** | It directly satisfies “new kind = one handler” while keeping graph-wide algorithms out of handler rows. |
| D11 | Byte identity proof | (a) reviewer visual diff only; (b) full golden source fixtures; (c) relative-path SHA-256 manifests plus behavioral tests | **(c)** | Hash manifests prove exact bytes compactly; behavioral tests explain correctness. Hash updates require an explicit behavior-scope decision. |
| D12 | Real runtime environment | (a) unit/compile only; (b) InMemoryRunner for all, host-capable synthetic A2A/MCP where required; (c) always start HTTP servers | **(b)** | It follows campaign-2 evidence and survives socket-restricted sandboxes while still requiring the host-capable A2A gate for scenario-i. |

Open questions that should stop implementation if evidence disagrees with the recommendation:

- Does ADK 2.3 `InMemoryRunner` with deterministic explicit `run_id` replay a loop-body `RequestInput` exactly as expected when the dynamic parent reruns? Prove this RED/GREEN before finalizing D8.
- Do any current artifacts intentionally model multiple normal incoming edges as repeated execution rather than fan-in? Repo-wide artifact inspection found no dynamic regression that requires it, but the PR-A implementation should rerun the scan and report exceptions before adopting D4.
- Is there a reviewed graph where two loop-back controls produce overlapping edge-path closures? If yes, do not flatten it; return for a nested-loop contract decision.
- Does the downstream consumer contract rely on Graph IR IDs rather than ADK runtime names in a join payload? If a real runtime trace shows that, record a mode-neutral mapping contract before changing D5.
- Can the scenario-i host-capable A2A gate be run in the implementation session? If not, PR-B remains unverified for remote dispatch and must not be called complete.

## 8. Acceptance checklist

- [ ] PR-A and PR-B remain separate; PR-B starts from a green, runtime-proven PR-A.
- [ ] Dynamic forward execution and loop-body execution are edge-topological with stable independent-node tie-breaking.
- [ ] All non-sanctioned cycles and all active unreachable nodes reject before bundle write.
- [ ] `scenario-d` join and complete edge-derived loop path execute in the correct order; no human/join node is dropped.
- [ ] Every accepted dynamic node and edge appears in the coverage/consumption ledger.
- [ ] Direct-awaited `ctx.run_node()` calls use deterministic outer/iteration run IDs; no `create_task()`/`gather()` workaround is generated.
- [ ] Smoke and static byte baselines do not move; PR-B dynamic bytes equal PR-A.
- [ ] One node-kind registry and one edge-kind registry replace all three endpoint resolvers and duplicated static/dynamic kind guards.
- [ ] The common collector accounts for joins, routers, outputs, loop controls, toolset exclusions, and collisions without changing declaration order.
- [ ] Behavioral generator suite, artifact validation, web build, and scoped diff checks pass.
- [ ] Required real-ADK gates pass for the PR-specific scenario matrix, with version and event evidence recorded.
- [ ] Active harness/validation/CLAUDE updates land with PR-A's behavior change; PR-A and PR-B each append the appropriate decision-log entry, and PR-B introduces no active-doc behavior or schema change.
