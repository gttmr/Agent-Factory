# ADK 2.0 Notes

Use ADK 2.0 as the active baseline.
Official docs checked for this skill set:

- `https://adk.dev/2.0/index.md`
- `https://adk.dev/graphs/index.md`
- `https://adk.dev/workflows/index.md`
- `https://adk.dev/a2a/index.md`

## Current Source-Grounded Points

- ADK Python 2.0 is generally available as of May 19, 2026.
- ADK 2.0 introduces graph-based workflows, dynamic workflows, and collaborative workflows.
- In ADK 2.0, Agents, Tools, and Functions are evaluated as nodes in the Workflow Graph engine.
- Graph-based workflows define execution nodes and edges for deterministic routing, branching, state management, and function/tool/agent composition.
- Workflow docs distinguish graph-based, dynamic, collaborative, and template workflows.
- ADK with A2A covers interaction with remote A2A agents and should not be collapsed into local sub-agent or adapter calls.

## Implementation Guidance

- Verify exact API signatures against official docs or local generated source before writing runnable ADK code.
- Prefer Graph IR for sequence, fan-out/fan-in, loop, route, join, and human input details.
- Preserve TODOs where runtime wiring, real model config, credentials, deployment, or business logic are unknown.
- Let standard exceptions propagate in real ADK 2.0 tools unless a reviewed retry/error policy says otherwise.
