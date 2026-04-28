# Risk Summary Reuse

## Sparse Requirement

Define a reusable public risk indicator adapter that can feed case review workflows.

## Evidence Summary

- The request is primarily a deterministic public-data adapter.
- Case review workflows can reuse the adapter and a summary template.
- No production business rules, private endpoints, or remote agent protocol are supplied.

## Classification JSON

```json
{
  "module_category": "adapter",
  "agent_kind": null,
  "adapter_kind": "legacy_api",
  "registry_kind": null,
  "legacy_recommended_type": null,
  "reuse_bindings": [
    {
      "name": "public-risk-indicator-adapter",
      "module_category": "adapter",
      "adapter_kind": "legacy_api",
      "evidence": "Risk indicators are fetched through a deterministic public-data adapter.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "auth_required": true,
      "audit_required": true,
      "idempotency": "read-only",
      "timeout": "short bounded timeout",
      "retry": "bounded retry with fallback wording"
    },
    {
      "name": "risk-summary-template",
      "module_category": "adapter",
      "adapter_kind": "template",
      "evidence": "The output format is reusable template text.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {}
    }
  ],
  "shared_registration_proposals": [],
  "retrofit_actions": [],
  "a2a_required": false,
  "a2a_interactions": [],
  "internal_workflow": null,
  "reasoning_summary": "The selected module is a deterministic legacy API adapter, not a new reasoning owner.",
  "todo": [
    "Define accepted public indicator sources and failure fallback wording."
  ],
  "side_effect": "none",
  "input_schema": {},
  "output_schema": {},
  "auth_required": true,
  "audit_required": true,
  "idempotency": "read-only",
  "timeout": "short bounded timeout",
  "retry": "bounded retry with fallback wording"
}
```

## Commonization Notes

```json
{
  "current_module": "public-risk-indicator-adapter",
  "reused_boundaries": [
    {
      "name": "public-risk-indicator-adapter",
      "module_category": "adapter",
      "adapter_kind": "legacy_api",
      "status": "reuse",
      "evidence": "Adapter can serve multiple summary workflows.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "auth_required": true,
      "audit_required": true,
      "idempotency": "read-only",
      "timeout": "short bounded timeout",
      "retry": "bounded retry with fallback wording"
    },
    {
      "name": "risk-summary-template",
      "module_category": "adapter",
      "adapter_kind": "template",
      "status": "reuse",
      "evidence": "Template is formatting guidance, not business logic.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {}
    }
  ],
  "new_boundary_proposals": [],
  "updated_boundaries": [],
  "retrofit_actions": [],
  "a2a_interactions": [],
  "todo": [
    "Review adapter error handling."
  ]
}
```

## Implementation Handoff Excerpt

```json
{
  "request_summary": "Orchestrate public risk indicator lookup and summary template reuse for a case-review workflow.",
  "selected_module": {
    "name": "public-risk-indicator-adapter",
    "module_category": "adapter",
    "agent_kind": null,
    "adapter_kind": "legacy_api",
    "registry_kind": null,
    "side_effect": "none",
    "input_schema": {},
    "output_schema": {},
    "auth_required": true,
    "audit_required": true,
    "idempotency": "read-only",
    "timeout": "short bounded timeout",
    "retry": "bounded retry with fallback wording"
  },
  "evidence": [
    "The request is a deterministic public indicator lookup adapter.",
    "The adapter and template are adapters, not reasoning owners."
  ],
  "reuse_bindings": [
    {
      "name": "public-risk-indicator-adapter",
      "module_category": "adapter",
      "adapter_kind": "legacy_api",
      "evidence": "Risk indicators are fetched through a deterministic public-data adapter.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "auth_required": true,
      "audit_required": true,
      "idempotency": "read-only",
      "timeout": "short bounded timeout",
      "retry": "bounded retry with fallback wording"
    },
    {
      "name": "risk-summary-template",
      "module_category": "adapter",
      "adapter_kind": "template",
      "evidence": "The output format is reusable template text.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {}
    }
  ],
  "shared_registration_proposals": [],
  "internal_workflow": null,
  "a2a_interactions": [],
  "scaffold_files": [
    "adapters/public_risk_indicator_adapter.md"
  ],
  "todo_business_logic": [
    "Define public source allowlist and fallback wording."
  ],
  "testing_notes": [
    "Verify adapter failure produces fallback wording without inventing unavailable indicators."
  ]
}
```

## Why Adapter Is Not Agent

The adapter fetches public indicators and the template formats output. Neither has independent reasoning ownership or a lifecycle that justifies an agent boundary.

## Remote A2A Decision

Remote A2A is not required because this module is a local adapter. If a separately hosted risk-analysis agent later exposes an Agent Card and protocol contract, this decision should be revisited.
