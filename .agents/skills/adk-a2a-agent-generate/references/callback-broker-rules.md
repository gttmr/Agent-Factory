# Callback Broker Rules

Callback Broker is the HTTP or event boundary that receives EAI/Legacy callbacks. An ADK Agent does not receive EAI callbacks directly.

The broker validates a callback and asks Context Manager to update work-item state.

## Responsibilities

- verify callback signature
- prevent replay attacks
- validate payload schema
- find the WorkItem by `correlation_id`
- reject mismatched `work_item_id` and `correlation_id`
- deduplicate callbacks
- map external status to Context Manager state
- request ADK resume when a safe continuation is available
- keep raw payloads out of LLM context

## Payload Shape

```json
{
  "callback_id": "cb-synthetic-uuid",
  "correlation_id": "corr-synthetic-uuid",
  "work_item_id": "WI-SYNTH-000001",
  "eai_job_id": "EAI-JOB-SYNTH-123",
  "legacy_tx_id": "LEGACY-TX-SYNTH-456",
  "operation": "loan_limit_change",
  "status": "SUCCESS|FAILED|PENDING|PARTIAL_SUCCESS|NEEDS_MANUAL_REVIEW",
  "result_ref": "synthetic-result-reference",
  "error_code": null,
  "error_message_masked": null,
  "occurred_at": "2026-01-01T00:00:00Z",
  "signature": "synthetic-hmac-or-jwt"
}
```

## Processing Rules

- Reject when signature verification fails.
- Reject when `correlation_id` is missing.
- Reject when `work_item_id` and `correlation_id` do not match an existing WorkItem.
- Do not process the same `callback_id` twice.
- `SUCCESS` -> `CALLBACK_RECEIVED` then `RESUME_REQUESTED`.
- `FAILED` -> decide retry eligibility.
- `PARTIAL_SUCCESS` -> `MANUAL_REVIEW_REQUIRED` or `COMPENSATION_REQUIRED`.
- `NEEDS_MANUAL_REVIEW` -> `MANUAL_REVIEW_REQUIRED`.
- Never forward raw callback payloads to an Agent or LLM.

## Boundary Classification

Callback Broker is runtime support or an adapter contract. It is not a top-level `module_category`, and it is not Remote A2A unless the callback source is an independently operated remote agent with a full A2A contract.
