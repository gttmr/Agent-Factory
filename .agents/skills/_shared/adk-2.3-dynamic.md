# ADK 2.3 Dynamic Workflow

Use this reference to review generated dynamic workflow lowering for loops and dynamic shapes.

## Dynamic Selection

The generator selects dynamic runnable output when reviewed artifacts include:

- a workflow module with `workflow_kind: "dynamic"`
- a `loop_control` node
- an edge with `execution_semantics: "loop_back"` or `"loop_exit"`
- a container with `container_kind: "loop_region"` or `"dynamic_workflow"`

## Loop Requirements

Each loop region needs:

- exactly one `loop_control` node
- at least one lowerable body node
- at least one `loop_back` edge
- at least one `loop_exit` edge
- reviewed `route_condition` or `route_aliases` on loop decision edges, unless an exit/back edge is explicitly default

## Generator Mapping

Generated dynamic output uses:

- `@node(...)` wrappers
- an async dynamic workflow node
- `await ctx.run_node(...)`
- loop decision state under `ctx.state[...]`
- a bounded loop counter

ADK runtime source confirms `@node` and `ctx.run_node(...)` exist. The generator, not freehand agent code, owns the emitted Python.

## Current Limits

- Dynamic runnable mode supports module-bound nodes plus `input`, `output`, `human_input`, `join`, and `loop_control`.
- Conditional/route edges other than reviewed loop edges are blocked in dynamic mode.
- Use static route lowering for non-loop routing.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop if loop edges lack reviewed decision metadata or if dynamic runnable mode reports unsupported nodes/edges.

## Grounding

- `https://adk.dev/graphs/dynamic/ (captured 2026-07-08)`
- `scripts/adk-source/graph/dynamic.mjs`
- `scripts/adk-source/agent-dynamic.mjs`
- `packages/web/src/analyzer/scaffoldPlan.ts`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/workflow/_node.py`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/context.py`
