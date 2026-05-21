# EAI Legacy Callback Contract

## Callback Source

Synthetic EAI or Legacy completion event. No real endpoint, credential, customer identifier, or private payload.

## Callback Receiver

Callback Broker receives the event first. ADK Agent does not receive external callbacks directly.

## Payload Schema

```json
{
  "callback_id": "cb-synthetic-uuid",
  "correlation_id": "corr-synthetic-uuid",
  "work_item_id": "WI-SYNTH-000001",
  "eai_job_id": "EAI-JOB-SYNTH-123",
  "legacy_tx_id": "LEGACY-TX-SYNTH-456",
  "operation": "synthetic_operation",
  "status": "SUCCESS|FAILED|PENDING|PARTIAL_SUCCESS|NEEDS_MANUAL_REVIEW",
  "result_ref": "synthetic-result-reference",
  "error_code": null,
  "error_message_masked": null,
  "occurred_at": "2026-01-01T00:00:00Z",
  "signature": "synthetic-hmac-or-jwt"
}
```

## Signature Verification

TODO: Verify approved signature method. Reject failed verification.

## Replay Protection

Deduplicate `callback_id`; reject stale timestamps after runtime policy review.

## Idempotency Rules

Process `correlation_id + legacy_tx_id + callback_id` once.

## Status Mapping

- `SUCCESS` -> `CALLBACK_RECEIVED`, then `RESUME_REQUESTED`
- `FAILED` -> retry eligibility decision
- `PARTIAL_SUCCESS` -> `MANUAL_REVIEW_REQUIRED` or `COMPENSATION_REQUIRED`
- `NEEDS_MANUAL_REVIEW` -> `MANUAL_REVIEW_REQUIRED`

## Context Manager State Update

Callback Broker requests the transition; Context Manager owns state.

## ADK Resume Request

Register resume only after safe state and masking are complete.

## Error Handling

Reject missing `correlation_id`, mismatched WorkItem, duplicate callback, bad signature, or schema mismatch.

## Synthetic Examples

Use synthetic ids and result refs only.
