# ADK 2.3 Routes And Joins

Use this reference to review generated route and join lowering. Do not hand-write ADK code from it.

## Graph IR Inputs

Relevant fields:

- node `node_kind`: `router`, `join`, `agent`, `workflow_call`, `adapter_call`, `remote_agent_call`
- edge `edge_kind: "route"`
- edge `route_condition`
- edge `route_aliases`
- edge `is_default_route`
- edge `execution_semantics: "fan_in"` for fan-in

## Generator Mapping

| Graph IR | Generated concept |
| --- | --- |
| route edges from a router | `Workflow` edge tuple with a route dictionary |
| `route_condition` | canonical route value |
| `route_aliases` | accepted lower-case aliases for generated router matching |
| missing explicit join on fan-in | generator may synthesize a `JoinNode` |
| explicit `join` node | emitted `JoinNode` |

ADK docs show `Workflow(edges=[("START", node), (router, {"value": next_node})])`; the generator builds that shape from reviewed Graph IR.

## Current Limits

- Route edges require non-empty `route_condition`.
- Static runnable graphs must be reachable from `START`.
- Static runnable graphs must be acyclic; loop/back-edge shapes route to the dynamic builder.
- Graph workflow LLM nodes are single-turn/task-oriented. The generator projects unsupported static task-mode cases to safer output or blocks them.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop on route validation errors, unreachable generated graph errors, or generator failures.

## Grounding

- `https://adk.dev/graphs/routes/ (captured 2026-07-08)`
- `scripts/adk-source/graph/routes.mjs`
- `scripts/adk-source/graph/lowering.mjs`
- `scripts/adk-source/emitters/router.mjs`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_workflow.py`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_join_node.py`
