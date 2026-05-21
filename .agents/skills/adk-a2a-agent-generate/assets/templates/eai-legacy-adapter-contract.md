# EAI Legacy Adapter Contract

## Adapter Identity

`adapter_name`: `synthetic_legacy_capability`

## module_category / adapter_kind

```yaml
module_category: adapter
adapter_kind: legacy_api
```

## Operation Type

`read|write|approval|batch|notification`

## Input Schema

TODO: Reference reviewed input schema only.

## Output Schema

TODO: Reference reviewed output schema only.

## Auth Policy

TODO: Fill approved auth policy. Do not include credentials.

## Timeout / Retry / Fallback

TODO: Fill reviewed timeout, retry, and fallback.

## Side Effect Level

`none|read_only|write|financial_write|customer_notification`

## Idempotency Requirement

Required for write/customer-impact work.

## Callback Expected

Set true when EAI returns job id or async result.

## Correlation Strategy

Use synthetic `correlation_id` and `idempotency_key`.

## Audit Fields

Record masked actor, operation, correlation id, decision, and result ref.

## Masking Policy

Raw legacy payload must not enter LLM context.

## Context Manager Integration

Required for async job/callback or approval-gated write work.

## Test Double Guidance

Use deterministic synthetic `mock_response.structuredContent`; do not include private data or endpoints.
