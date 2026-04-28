# Loan Consultation Follow-Up

## Sparse Requirement

After a loan consultation, prepare a follow-up checklist, identify missing documents, and create a draft reminder message using generic public placeholders.

## Evidence Summary

- Follow-up planning is a reusable capability across multiple consultation agents.
- Document requirement rules are declarative and should be separated from the agent.
- A generic external document-review agent is available through a remote agent contract.

## Classification JSON

```json
{
  "module_category": "agent",
  "agent_kind": "shared",
  "adapter_kind": null,
  "registry_kind": null,
  "legacy_recommended_type": "shared_agent",
  "reuse_bindings": [
    {
      "name": "document-requirement-rules",
      "module_category": "adapter",
      "adapter_kind": "rule_registry",
      "registry_kind": "policy_metadata",
      "evidence": "Document requirements are declarative eligibility and checklist rules.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "managed_rule": true,
      "owner_domain": "loan",
      "versioned": true,
      "effective_date_required": true,
      "audit_required": true
    }
  ],
  "shared_registration_proposals": [
    {
      "name": "consultation-followup-agent",
      "module_category": "agent",
      "agent_kind": "shared",
      "registry_kind": null,
      "evidence": "Multiple consultation flows can reuse follow-up planning and reminder drafting."
    },
    {
      "name": "external-document-review-agent",
      "module_category": "remote_a2a",
      "agent_kind": null,
      "adapter_kind": null,
      "registry_kind": null,
      "remote_boundary_evidence": "The document review capability is independently exposed as a remote agent.",
      "protocol_profile": "A2A",
      "discovery": "Agent Card supplied by the external document review service.",
      "owner_hint": "external-review-owner",
      "evidence": "The follow-up agent should not access the remote agent internals."
    }
  ],
  "retrofit_actions": [],
  "a2a_required": true,
  "a2a_interactions": [
    {
      "target": "external-document-review-agent",
      "purpose": "Request a document completeness review before drafting follow-up.",
      "evidence": "The review capability is independently exposed as a remote agent.",
      "remote_boundary_evidence": "The target has its own owner, lifecycle, and Agent Card.",
      "protocol_profile": "A2A",
      "discovery": "Agent Card supplied by the external document review service.",
      "owner_hint": "external-review-owner",
      "request_shape": "Generic consultation id and document checklist summary.",
      "response_shape": "Missing document list and review status.",
      "task_lifecycle": "Single request/response task with failure state.",
      "artifact_expectations": "Optional checklist artifact reference.",
      "authz_notes": "Caller must be authorized to request generic document review.",
      "timeout_retry_fallback": "Timeout should fall back to manual review TODO."
    }
  ],
  "internal_workflow": {
    "required": true,
    "pattern": "sequential",
    "reason": "Normalize consultation notes, check missing documents, then draft reminder."
  },
  "reasoning_summary": "The reusable follow-up capability deserves a shared agent, while document rules remain an adapter.",
  "todo": [
    "Define generic document categories and reminder tone policy."
  ]
}
```

## Commonization Notes

```json
{
  "current_module": "consultation-followup-agent",
  "legacy_recommended_type": "shared_agent",
  "reused_boundaries": [
    {
      "name": "document-requirement-rules",
      "module_category": "adapter",
      "adapter_kind": "rule_registry",
      "registry_kind": "policy_metadata",
      "status": "reuse",
      "evidence": "Rules are reused by follow-up and intake validation modules.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "managed_rule": true,
      "owner_domain": "loan",
      "versioned": true,
      "effective_date_required": true,
      "audit_required": true
    }
  ],
  "new_boundary_proposals": [
    {
      "name": "consultation-followup-agent",
      "module_category": "agent",
      "agent_kind": "shared",
      "status": "proposed",
      "evidence": "Reusable follow-up planning has policy and message-generation behavior."
    }
  ],
  "updated_boundaries": [],
  "retrofit_actions": [],
  "a2a_interactions": [
    {
      "target": "external-document-review-agent",
      "purpose": "Request a document completeness review before drafting follow-up.",
      "evidence": "The review capability is independently exposed as a remote agent.",
      "remote_boundary_evidence": "The target has its own owner, lifecycle, and Agent Card.",
      "protocol_profile": "A2A",
      "discovery": "Agent Card supplied by the external document review service.",
      "owner_hint": "external-review-owner",
      "request_shape": "Generic consultation id and document checklist summary.",
      "response_shape": "Missing document list and review status.",
      "task_lifecycle": "Single request/response task with failure state.",
      "artifact_expectations": "Optional checklist artifact reference.",
      "authz_notes": "Caller must be authorized to request generic document review.",
      "timeout_retry_fallback": "Timeout should fall back to manual review TODO."
    }
  ],
  "todo": [
    "Confirm whether reminder sending is out of scope."
  ]
}
```

## Implementation Handoff Excerpt

```json
{
  "request_summary": "Prepare reusable follow-up checklist and reminder draft after a generic loan consultation.",
  "selected_module": {
    "name": "consultation-followup-agent",
    "module_category": "agent",
    "agent_kind": "shared",
    "adapter_kind": null,
    "registry_kind": null,
    "legacy_recommended_type": "shared_agent"
  },
  "evidence": [
    "Follow-up planning can be reused across multiple consultation flows.",
    "Document requirement rules are declarative policy and remain an adapter."
  ],
  "reuse_bindings": [
    {
      "name": "document-requirement-rules",
      "module_category": "adapter",
      "adapter_kind": "rule_registry",
      "registry_kind": "policy_metadata",
      "evidence": "Document requirements are declarative eligibility and checklist rules.",
      "side_effect": "none",
      "input_schema": {},
      "output_schema": {},
      "managed_rule": true,
      "owner_domain": "loan",
      "versioned": true,
      "effective_date_required": true,
      "audit_required": true
    }
  ],
  "shared_registration_proposals": [
    {
      "name": "consultation-followup-agent",
      "module_category": "agent",
      "agent_kind": "shared",
      "adapter_kind": null,
      "registry_kind": null,
      "evidence": "Reusable follow-up planning has policy and message-generation behavior."
    },
    {
      "name": "external-document-review-agent",
      "module_category": "remote_a2a",
      "agent_kind": null,
      "adapter_kind": null,
      "registry_kind": null,
      "remote_boundary_evidence": "The document review capability is independently exposed as a remote agent.",
      "protocol_profile": "A2A",
      "discovery": "Agent Card supplied by the external document review service.",
      "owner_hint": "external-review-owner",
      "evidence": "The follow-up agent should not access the remote agent internals."
    }
  ],
  "internal_workflow": {
    "required": true,
    "pattern": "sequential",
    "reason": "Normalize notes, check missing documents, then draft reminder."
  },
  "a2a_interactions": [
    {
      "target": "external-document-review-agent",
      "purpose": "Request a document completeness review before drafting follow-up.",
      "evidence": "The review capability is independently exposed as a remote agent.",
      "remote_boundary_evidence": "The target has its own owner, lifecycle, and Agent Card.",
      "protocol_profile": "A2A",
      "discovery": "Agent Card supplied by the external document review service.",
      "owner_hint": "external-review-owner",
      "request_shape": "Generic consultation id and document checklist summary.",
      "response_shape": "Missing document list and review status.",
      "task_lifecycle": "Single request/response task with failure state.",
      "artifact_expectations": "Optional checklist artifact reference.",
      "authz_notes": "Caller must be authorized to request generic document review.",
      "timeout_retry_fallback": "Timeout should fall back to manual review TODO."
    }
  ],
  "scaffold_files": [
    "agents/consultation_followup_agent/README.md"
  ],
  "todo_business_logic": [
    "Define generic rule labels, message constraints, and sending boundary."
  ],
  "testing_notes": [
    "Verify missing-document rules are read from the rule registry, not hardcoded into the agent."
  ]
}
```

## Why Adapter Is Not Agent

The rule registry only stores checklist policy. It should not decide how to communicate with the customer or interpret consultation context.

## remote_a2a_contract Decision

remote_a2a_contract is required for the document-review dependency because it is independently exposed as a remote agent with its own owner, lifecycle, and Agent Card. Reminder drafting remains local to the shared follow-up agent.
