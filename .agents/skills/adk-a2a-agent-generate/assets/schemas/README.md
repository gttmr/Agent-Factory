# Schema Assets

These JSON Schemas define portable output artifacts for external workbenches.

An external workbench should validate LLM outputs before storing them, merging them into a shared catalog, or using them to generate scaffold files:

1. Validate classification output with `classification.schema.json`.
2. Validate commonization notes with `commonization-notes.schema.json`.
3. Validate implementation handoff JSON with `implementation-handoff.schema.json`; render markdown from the same fields for human review.
4. Validate shared boundary catalogs with `shared-boundary-catalog.schema.json`.
5. Validate skill-local runtime support contract examples with `context-manager-contract.schema.json`, `eai-callback-contract.schema.json`, and `eai-legacy-adapter-contract.schema.json` when the handoff includes Context Manager, Callback Broker, MCP, EAI, or Legacy boundaries.

Validation failure should block scaffold generation until the output is repaired or reviewed. The schemas are contract checks only; they do not add runtime code.

The schemas use `registry_kind` as a secondary discriminator only for `adapter_kind: "rule_registry"` so workbenches can keep routing tables, capability catalogs, schema registries, policy metadata, and configuration evidence separate during migration.

The runtime support schemas are skill-local assets. They do not add new global `module_category` values and should not be treated as production endpoint contracts. They exist to keep callback, Context Manager, and EAI/Legacy handoff examples synthetic, masked, and reviewable.
