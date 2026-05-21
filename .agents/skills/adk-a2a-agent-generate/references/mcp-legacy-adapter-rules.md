# MCP Legacy Adapter Rules

Use an MCP Legacy Adapter when legacy access should be reusable, standardized, and controlled outside a single Agent.

## Prefer MCP Legacy Adapter When

- multiple agents reuse the same EAI/Legacy capability
- tool schema must be stable and cataloged
- legacy access logic should stay outside agent ownership
- timeout, retry, auth, error mapping, masking, or audit should be centralized
- the capability belongs in an MCP registry or catalog contract

## Prefer ADK Local Tool When

- the function is small and agent-specific
- there is no external system call
- the tool is a test stub or synthetic mock
- reuse pressure is not high enough to justify an MCP server boundary

## Required Contract Fields

```yaml
adapter_name:
module_category: adapter
adapter_kind: legacy_api
operation_type: read|write|approval|batch|notification
input_schema:
output_schema:
auth_policy:
timeout_ms:
retry_policy:
fallback_policy:
idempotency_required:
side_effect_level: none|read_only|write|financial_write|customer_notification
callback_expected:
correlation_id_strategy:
audit_fields:
masking_policy:
context_manager_required:
```

## Classification

MCP is an access protocol and runtime binding, not a top-level module category. The module remains an `adapter` with the correct `adapter_kind`, often `legacy_api`, `data_query`, `retrieval`, or `rule_registry`.
