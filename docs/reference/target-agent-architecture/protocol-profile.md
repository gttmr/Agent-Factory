# Protocol Profile

## A2A Boundary

Treat A2A as a remote interoperability boundary. A request should mark `a2a_required=true` only when a dependency is independently exposed as an agent capability.

Record:

- target agent or capability name
- purpose of the interaction
- request payload shape
- response or artifact shape
- task lifecycle expectations
- authentication and authorization notes
- failure and timeout behavior

## ADK Boundary

Treat ADK as the local construction layer for an agent. Internal composition may use:

- LLM agents for flexible language reasoning
- workflow agents for deterministic sequence, parallel, or loop control
- custom agents for specialized control logic
- tools for deterministic external actions

Use the stable workflow-agent model for active workbench documentation.

## Escalation Rule

Do not use A2A merely because a task has multiple steps. First decide whether the steps can remain local ADK workflow or local tool calls.
