# Implementation Handoff

The handoff should be short enough for the next engineer or agent to act on.

Required sections:

- Request summary
- Selected module category
- Evidence
- Reuse bindings
- Shared registration proposals
- Internal ADK workflow
- A2A interactions
- Scaffold files
- TODO business logic
- Testing notes

The selected category section must show `module_category`. Include `agent_kind` for agents and `adapter_kind` for adapters. Include `registry_kind` only when `adapter_kind` is `rule_registry`. If the handoff was migrated from an older artifact, include `legacy_recommended_type` but do not use it as the active category.

A2A interactions must remain protocol-boundary notes only. Do not describe local workflow composition, API adapters, retrieval, or rule registries as A2A unless an independent remote agent boundary exists.

Do not claim production readiness when the scaffold contains TODO logic.
