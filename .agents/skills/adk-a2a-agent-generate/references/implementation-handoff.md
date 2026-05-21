# Implementation Handoff

The handoff should be short enough for the next engineer or agent to act on.

Required sections:

- Request summary
- Evidence
- Selected module category
- Module classification
- Graph IR / workflow shape
- MCP / EAI / Legacy adapter decision
- Context Manager decision
- Callback Broker decision
- ADK callback responsibilities
- Human approval gate
- Idempotency / correlation strategy
- Timeout / retry / fallback
- Manual review / compensation path
- LLM exposure and masking policy
- Remote A2A decision
- Reuse bindings
- Shared registration proposals
- Internal ADK workflow
- A2A interactions
- Catalog reuse / registration notes
- Scaffold files
- TODO runtime wiring
- TODO business logic
- Non-goals
- Open questions
- Testing notes

The selected category section must show `module_category`. Include `agent_kind` for agents and `adapter_kind` for adapters. Include `registry_kind` only when `adapter_kind` is `rule_registry`. If the handoff was migrated from an older artifact, include `legacy_recommended_type` but do not use it as the active category.

A2A interactions must remain protocol-boundary notes only. Do not describe local workflow composition, API adapters, retrieval, or rule registries as A2A unless an independent remote agent boundary exists.

For EAI/Legacy handoffs, record:

- whether access is synchronous read, synchronous write, async job, approval, batch, or notification
- whether an MCP Legacy Adapter is recommended and why
- whether Context Manager is required and which WorkItem identifiers and states are needed
- whether Callback Broker is required and how callback status maps to Context Manager state
- whether ADK callbacks are used for validation, masking, audit summaries, tool blocking, or safe resume
- approval, idempotency, correlation, audit, timeout, retry, fallback, manual review, and compensation decisions
- that raw legacy payloads and private identifiers are not exposed to the LLM

TODO runtime wiring examples:

- TODO: Implement Context Manager client after an approved runtime endpoint is provided.
- TODO: Implement EAI client through an approved MCP contract only.
- TODO: Wire callback receiver to Context Manager; do not route EAI callback directly to an Agent or LLM.
- TODO: Add approval token verification for write/customer-impact operations.
- TODO: Add synthetic smoke contract before enabling chat-smoke.

Do not claim production readiness when the scaffold contains TODO logic.
