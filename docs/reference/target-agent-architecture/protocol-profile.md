# Protocol Profile

This profile explains protocol boundaries for Agent Factory classification and
runtime handoff. It does not replace the active taxonomy in
`docs/workbench/taxonomy.md`.

## Remote A2A Boundary

Treat Remote A2A as a remote interoperability boundary. Use it only when a
dependency is independently owned, discoverable, and invoked as an agent
capability across a protocol/network boundary.

Record or require:

- target agent or capability name
- purpose of the interaction
- owner and lifecycle responsibility
- Agent Card or equivalent discovery URL
- request payload shape
- response or artifact shape
- task lifecycle expectations
- authentication and authorization notes
- timeout, retry, fallback, and audit behavior

Do not use Remote A2A merely because a task has multiple steps, branches,
fan-out/fan-in, human review, or callbacks. Those are local Workflow/Graph IR
concerns unless an independent remote agent boundary is proven.

## ADK Local Boundary

Treat ADK as the local construction/runtime layer for reviewed artifacts. Agent
Factory's classification baseline is ADK 2.0: `workflow_kind` stays
`orchestration`, `graph`, `dynamic`, or `unknown`, while sequence, route,
fan-out/fan-in, loop intent, join, human input, and callback wait live in Graph
IR nodes, containers, and edges.

Runtime Handoff currently targets ADK 2.x source bundles:

- smoke mode emits TODO/runtime-wiring handoff code
- reviewed `output_mode: runnable` emits synthetic local ADK Workflow wiring
- runnable DAG, human-input, static route, reviewed loop/dynamic, connected
  Mock Lab MCP adapter, agent state-channel instruction reads, and
  contract-backed Remote A2A paths are generated only from approved artifacts
- non-connected state consumers and agent/non-connected artifact consumers stay
  explicit blockers unless a reviewed contract extends the generator

## MCP And Mock Lab Boundary

MCP is an adapter/tool invocation protocol, not a Remote A2A substitute. Mock Lab
creates synthetic local MCP test doubles for Adapter contracts. Running saved
Mock Lab specs can be re-exposed over network MCP so generated runnable ADK
bundles can call connected adapters during local smoke review.

Mock Lab does not approve catalog entries, does not edit seed `catalog/*.yaml`,
and does not create production integrations.

## Escalation Rule

Classify locally first:

1. Agent for reasoning ownership.
2. Workflow for execution topology.
3. Adapter for callable capabilities and MCP tools.
4. Remote A2A only when an independently governed remote agent contract exists.
