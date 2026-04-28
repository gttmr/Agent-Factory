# A2A Boundary Rules

Use A2A when the interaction crosses an independent agent boundary.

Evidence that supports A2A:

- the target capability is exposed as an agent
- the target has its own lifecycle or owner
- the caller should not access the target's internal tools or state
- the interaction needs protocol-level task, message, artifact, or streaming semantics
- discovery through an Agent Card is expected

Evidence against A2A:

- the dependency is just a local function or API call
- the workflow is only a sequence of local steps
- the reusable unit is better modeled as an adapter
- the target has no independent lifecycle

When A2A is required, record:

- target capability
- purpose
- request and response shape
- task lifecycle expectations
- artifact expectations
- authentication and authorization notes
- timeout, retry, and fallback behavior
