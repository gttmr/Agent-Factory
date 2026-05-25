# Boundary Rules

## Taxonomy

Use only these top-level `module_category` values:

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

Preserve subtype precision with `agent_kind`, `workflow_kind`, `adapter_kind`, and `remote_contract_kind`.

## Agent

Use `agent` when the boundary owns reasoning, judgment, summarization, classification, recommendation, or policy interpretation.
Use `agent_kind: specialist` for one narrow responsibility and `agent_kind: shared` for reusable reasoning with its own lifecycle or ownership.

## Workflow

Use `workflow` when the deliverable is orchestration of known steps.
`workflow_kind` must be `orchestration`, `graph`, `dynamic`, or `unknown`.
Represent sequence, fan-out/fan-in, loop, route, join, human input, approval wait, callback wait, resume, manual review, and compensation as Graph IR details.

## Adapter

Use `adapter` when the unit is callable by an Agent or Workflow and does not reason independently.
Valid `adapter_kind` values are `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, and `unknown`.

MCP tools, EAI routing, Legacy System access, retrieval, grounding, Context Manager operations, and Callback Broker operations are adapter or runtime support contracts, not new top-level categories.

## Remote A2A

Use `remote_a2a` only for an independent remote agent boundary with protocol-level contract evidence:

- independent owner
- Agent Card or discovery method
- request and response shape
- task lifecycle
- auth
- timeout
- retry
- fallback
- audit
- data policy

Do not infer Remote A2A from a multi-step workflow, MCP tool, legacy callback, or local adapter.
