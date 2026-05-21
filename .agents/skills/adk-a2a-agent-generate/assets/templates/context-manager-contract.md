# Context Manager Contract

## Purpose

Describe the durable WorkItem state contract for EAI/Legacy work. This is not ADK memory and is not a top-level module category unless a separate workbench taxonomy change explicitly approves that.

## WorkItem Schema

```json
{
  "work_item_id": "WI-SYNTH-000001",
  "agent_session_id": "adk-session-id",
  "agent_run_id": "adk-run-id",
  "user_ref": "masked-or-tokenized-user-ref",
  "business_domain": "customer|deposit|loan|card|risk",
  "operation": "synthetic_operation",
  "operation_type": "read|write|approval|batch|notification",
  "risk_level": "low|medium|high|critical",
  "status": "REGISTERED",
  "correlation_id": "corr-synthetic-uuid",
  "idempotency_key": "idem-synthetic-uuid",
  "eai_job_id": null,
  "legacy_tx_id": null,
  "requires_human_approval": true,
  "approval_status": "not_requested|pending|approved|rejected",
  "callback_expected": true,
  "callback_received": false,
  "retry_count": 0,
  "max_retry": 3,
  "timeout_at": "2026-01-01T00:00:00Z",
  "result_ref": null,
  "error_code": null,
  "error_message_masked": null,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

## State Model

`REGISTERED -> VALIDATED -> APPROVAL_REQUIRED -> APPROVAL_PENDING -> APPROVED -> SUBMITTED_TO_EAI -> WAITING_LEGACY_CALLBACK -> CALLBACK_RECEIVED -> RESUME_REQUESTED -> COMPLETED`

Failure states: `FAILED_RETRYABLE`, `RETRY_SCHEDULED`, `FAILED_FINAL`, `COMPENSATION_REQUIRED`, `COMPENSATED`, `MANUAL_REVIEW_REQUIRED`, `CANCELED`, `EXPIRED`.

## State Transition Rules

- Write/customer-impact work must not reach `SUBMITTED_TO_EAI` without approval.
- If `callback_expected=true`, do not mark complete until callback handling finishes.
- Deduplicate by `correlation_id`, `legacy_tx_id`, and `callback_id`.
- Partial success requires manual review or compensation review.
- Raw legacy payloads stay outside LLM context.

## API Contract

Placeholder only: `POST /work-items`, `GET /work-items/{work_item_id}`, `POST /work-items/{work_item_id}/approval`, `POST /work-items/{work_item_id}/submit-eai`, `POST /callbacks/eai`, `POST /work-items/{work_item_id}/resume-request`, `POST /work-items/{work_item_id}/audit-events`, `POST /work-items/{work_item_id}/compensate`.

## Idempotency Strategy

Use synthetic `idempotency_key` and `correlation_id` in examples. Do not include real account, customer, or transaction identifiers.

## Timeout / Retry Strategy

TODO: Fill timeout window, max retry, retryable error codes, and final fallback after runtime owner review.

## Audit Event Schema

Record state transition, masked actor reference, policy result, correlation id, and synthetic result reference.

## ADK Session Mapping

ADK session state may hold `work_item_id` and safe status hints only. Context Manager stores durable execution state.

## EAI Job / Legacy Transaction Mapping

Map `eai_job_id` and `legacy_tx_id` to WorkItem after the adapter returns them.

## LLM Exposure Rules

Expose safe summaries and synthetic references only.

## Open Questions

- Who owns the runtime support contract?
- Which approval source is authoritative?
- Which statuses trigger manual review or compensation?
