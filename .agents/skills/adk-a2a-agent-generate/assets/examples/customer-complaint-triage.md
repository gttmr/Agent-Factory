# Customer Complaint Triage

## Sparse Requirement

Define a deterministic complaint triage workflow that summarizes a customer complaint, retrieves a relevant public FAQ excerpt when available, and routes the case to a follow-up owner.

## Evidence Summary

- The requested module is deterministic orchestration across known steps, not a new reasoning owner.
- Product FAQ lookup is deterministic retrieval, not an independent decision owner.
- No independent remote agent endpoint or Agent Card is provided.

## Classification JSON

```json
{
  "module_category": "workflow",
  "agent_kind": null,
  "adapter_kind": null,
  "registry_kind": null,
  "legacy_recommended_type": null,
  "reuse_bindings": [
    {
      "name": "product-faq-retrieval",
      "module_category": "adapter",
      "adapter_kind": "retrieval",
      "evidence": "FAQ lookup returns excerpts for the triage agent to cite.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "citation_required": true,
      "source_acl_required": true,
      "freshness_policy": "Use the current approved public FAQ source snapshot.",
      "grounding_required": true
    }
  ],
  "shared_registration_proposals": [],
  "retrofit_actions": [],
  "a2a_required": false,
  "a2a_interactions": [],
  "internal_workflow": {
    "required": true,
    "pattern": "sequential",
    "reason": "Summarize, classify severity, then retrieve FAQ support."
  },
  "reasoning_summary": "This is a workflow boundary because the deliverable is deterministic orchestration of summary, retrieval, and routing steps.",
  "todo": [
    "Define public severity labels and escalation owners."
  ]
}
```

## Commonization Notes

```json
{
  "current_module": "customer-complaint-triage-workflow",
  "reused_boundaries": [
    {
      "name": "product-faq-retrieval",
      "module_category": "adapter",
      "adapter_kind": "retrieval",
      "status": "reuse",
      "evidence": "FAQ lookup is shared across complaint and support response modules.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "citation_required": true,
      "source_acl_required": true,
      "freshness_policy": "Use the current approved public FAQ source snapshot.",
      "grounding_required": true
    }
  ],
  "new_boundary_proposals": [],
  "updated_boundaries": [],
  "retrofit_actions": [],
  "a2a_interactions": [],
  "todo": [
    "Confirm allowed FAQ source path."
  ]
}
```

## Implementation Handoff Excerpt

```json
{
  "request_summary": "Run a deterministic customer complaint triage workflow with supporting FAQ evidence.",
  "selected_module": {
    "name": "customer-complaint-triage-workflow",
    "module_category": "workflow",
    "agent_kind": null,
    "adapter_kind": null,
    "registry_kind": null,
    "workflow_pattern": "sequential",
    "workflow_reason": "Summarize, classify severity, retrieve FAQ support, then route owner."
  },
  "evidence": [
    "The module orchestrates known triage steps rather than owning an independent reasoning policy.",
    "FAQ lookup is retrieval support rather than an agent boundary."
  ],
  "reuse_bindings": [
    {
      "name": "product-faq-retrieval",
      "module_category": "adapter",
      "adapter_kind": "retrieval",
      "evidence": "FAQ lookup returns excerpts for the triage agent to cite.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "citation_required": true,
      "source_acl_required": true,
      "freshness_policy": "Use the current approved public FAQ source snapshot.",
      "grounding_required": true
    }
  ],
  "shared_registration_proposals": [],
  "internal_workflow": {
    "required": true,
    "pattern": "sequential",
    "reason": "Summarize, classify severity, then retrieve FAQ support."
  },
  "a2a_interactions": [],
  "scaffold_files": [
    "workflows/customer_complaint_triage.md"
  ],
  "todo_business_logic": [
    "Define severity labels, allowed FAQ source, and owner routing table."
  ],
  "testing_notes": [
    "Check that FAQ retrieval failure leaves triage output usable."
  ]
}
```

## Why Adapter Is Not Agent

The FAQ lookup does not own judgment, memory, lifecycle, or policy. It retrieves supporting evidence for the triage workflow.

## remote_a2a_contract Decision

remote_a2a_contract is not required because the dependency is a local retrieval adapter, and no independent remote agent boundary is identified.
