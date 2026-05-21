# Boundary Decision Rules

Use the simplified user-facing taxonomy for `module_category`:

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

Preserve internal precision with `agent_kind`, `adapter_kind`, adapter contract metadata, `internal_workflow`, and A2A interaction details.

## Agent

Choose `module_category: "agent"` when the request owns a reasoning or decision boundary with a bounded input/output contract.

Use `agent_kind: "specialist"` when the boundary has one narrow responsibility and can hide internal tools or workflow behind one external interface.

Use `agent_kind: "shared"` when the capability is reusable across multiple specialists and needs its own policy, lifecycle, memory, or ownership.

## Workflow

Choose `module_category: "workflow"` when the requested deliverable is orchestration of known steps rather than a new reasoning owner. Internal ADK workflow inside an agent can still be recorded in `internal_workflow` without changing the top-level category away from `agent`.

Do not promote a workflow to `remote_a2a` merely because it has multiple steps.

## Adapter

Choose `module_category: "adapter"` when the reusable unit is a callable capability used by an agent or workflow rather than an independent reasoning owner. Retrieval, rule lookup, data query, template lookup, computation, and legacy API access are all adapters at the top level.

Use `adapter_kind` as follows:

- `legacy_api`: legacy API call, service binding, validation endpoint, parser, or deterministic transformation.
- `retrieval`: search, retrieval, index query, document lookup, or retrieval policy.
- `rule_registry`: declarative routing table, capability catalog, schema registry, policy metadata, or configuration. Older `metadata_registry` artifacts map here.
- `data_query`: persistent store, cache, queue, table, object store, or data access boundary.
- `template`: reusable prompt, handoff, message, scaffold, or document template collection.
- `computation`: deterministic calculation, scoring, parsing, formatting, or transformation.
- `external_service`: externally owned service capability that is not an independent remote agent boundary.
- `unknown`: evidence shows `adapter`, but the subtype is not yet safe to pick.

MCP tools, EAI routing, Legacy System access, Context Manager operations, and Callback Broker operations are adapter or runtime support contracts. Do not add them as top-level `module_category` values.

Use these quick rules:

- EAI or Legacy API access -> `module_category: "adapter"`, `adapter_kind: "legacy_api"`.
- Shared MCP tool for legacy access -> `module_category: "adapter"`, usually `adapter_kind: "legacy_api"`.
- Context Manager needed for work-item state -> runtime support contract or adapter contract note, not top-level category.
- Callback Broker needed for external callback receipt -> runtime support contract or adapter contract note, not top-level category.
- Long-running state flow -> local `workflow` or Graph IR behavior unless it crosses an independent remote agent boundary.
- Independently owned remote agent runtime -> consider `remote_a2a` only after high-friction evidence is present.

Preserve adapter contract metadata by subtype:

- Retrieval adapters should preserve `citation_required`, `source_acl_required`, `freshness_policy`, and `grounding_required`.
- Legacy API and external-service adapters should preserve `side_effect`, `idempotency`, `timeout`, `retry`, `auth_required`, and `audit_required`.
- Rule-registry adapters should preserve `managed_rule`, `owner_domain`, `versioned`, `effective_date_required`, and `audit_required`.
- Every adapter should expose explicit `input_schema` and `output_schema` when enough evidence exists.

For `legacy_api` adapters that touch customer-impacting or financial-write paths, also preserve `operation_type`, `side_effect_level`, `idempotency_required`, `correlation_id_strategy`, `callback_expected`, `context_manager_required`, masking policy, timeout/retry/fallback, audit fields, and manual review or compensation notes.

`rule_registry` is intentionally the migration subtype for older metadata-registry artifacts. Preserve the secondary `registry_kind` as `routing_table`, `capability_catalog`, `schema_registry`, `policy_metadata`, `configuration`, or `unknown`. Do not treat the shared `rule_registry` label as governance approval for production policy rules, capability catalogs, schema metadata, and routing metadata to share one implementation. If those concerns have different owners, controls, or release lifecycles, preserve the distinction in evidence, ownership notes, and implementation handoff TODOs.

## Remote A2A

Choose `module_category: "remote_a2a"` only when the interaction crosses an independent remote agent boundary. The target must be independently owned, hosted, discovered, or invoked through a protocol boundary. A local function, adapter, retrieval lookup, or local workflow is not A2A.

Do not choose `remote_a2a` merely because:

- an EAI/Legacy operation returns a callback later
- a workflow has multiple local steps
- an MCP server exposes a reusable tool
- a Context Manager or Callback Broker is required

## Legacy Mapping

Older artifacts may use `recommended_type`. Preserve that field as `legacy_recommended_type` during migration and map it as:

- `specialist_agent` -> `module_category: "agent"`, `agent_kind: "specialist"`
- `shared_agent` -> `module_category: "agent"`, `agent_kind: "shared"`
- `tool_adapter` -> `module_category: "adapter"`, usually `adapter_kind: "legacy_api"` unless evidence indicates retrieval, data, rules, templates, computation, or external service
- `knowledge_retrieval` -> `module_category: "adapter"`, `adapter_kind: "retrieval"`
- `metadata_registry` -> `module_category: "adapter"`, `adapter_kind: "rule_registry"`
- `internal_workflow` -> `module_category: "workflow"` only when it is the selected deliverable; otherwise keep it in `internal_workflow`
- `remote_a2a_contract` -> `module_category: "remote_a2a"`

## Default

Start with `module_category: "agent"` and `agent_kind: "specialist"`. Promote only when evidence shows reuse, ownership, lifecycle pressure, adapter-only shape, workflow-only shape, or an independent remote A2A boundary.
