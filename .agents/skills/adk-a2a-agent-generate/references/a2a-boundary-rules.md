# A2A Boundary Rules

Use A2A when the interaction crosses an independent agent boundary.

Evidence that supports A2A:

- the target capability is exposed as an agent
- the target has its own lifecycle or owner
- the caller should not access the target's internal tools or state
- the interaction needs protocol-level task, message, artifact, or streaming semantics
- discovery through an Agent Card is expected
- auth, timeout, retry, fallback, audit, and data policy can be stated for the remote agent task lifecycle

Evidence against A2A:

- the dependency is just a local function or API call
- the workflow is only a sequence of local steps
- the reusable unit is better modeled as an adapter
- the target has no independent lifecycle
- the dependency is an MCP tool or EAI/Legacy API rather than an independently operated agent runtime
- a legacy callback is expected but no independent remote agent owner or Agent Card exists
- Context Manager or Callback Broker support is needed for local async state

When A2A is required, record:

- independent remote owner
- Agent Card or discovery method
- target capability
- purpose
- request and response shape
- task lifecycle expectations
- artifact expectations
- authentication and authorization notes
- timeout, retry, and fallback behavior
- audit requirement
- data policy

If any of the required remote boundary fields are missing, mark the candidate as `needs_info`, `deferred`, or `rejected`. Do not invent a complete Remote A2A contract from a callback, multi-step workflow, or MCP adapter requirement.
