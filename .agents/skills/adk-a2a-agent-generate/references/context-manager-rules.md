# Context Manager Rules

Context Manager is not ADK memory. It is a separate runtime support service or contract for banking work execution state.

## ADK Session State vs Context Manager

ADK session state is for:

- agent run reasoning context
- tool call result summaries
- user conversation flow
- lightweight state needed by the next agent step

Context Manager is for:

- work item status
- EAI `job_id`, `legacy_tx_id`, and `correlation_id` mapping
- callback receipt state
- approval state
- retry, timeout, and compensation state
- audit trail
- idempotency management

Do not classify Context Manager as a top-level `module_category`. Represent it as runtime support or as an adapter/catalog contract note.

## Why It Is Needed

Use Context Manager when:

- legacy work can run longer than the agent session
- EAI returns only a `job_id` and later sends a callback
- callbacks can be duplicated or replayed
- an agent server or user session can end while work continues
- approval can happen after initial submission
- retry, manual review, or compensation may be needed
- audit logs must survive beyond LLM context
- raw legacy payloads must not enter LLM context

## WorkItem Shape

```json
{
  "work_item_id": "WI-SYNTH-000001",
  "agent_session_id": "adk-session-id",
  "agent_run_id": "adk-run-id",
  "user_ref": "masked-or-tokenized-user-ref",
  "business_domain": "customer|deposit|loan|card|risk",
  "operation": "loan_limit_change",
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

Use synthetic ids only. Do not store customer names, account numbers, resident registration numbers, phone numbers, credentials, or private endpoints.

## State Model

Nominal path:

```text
REGISTERED
-> VALIDATED
-> APPROVAL_REQUIRED
-> APPROVAL_PENDING
-> APPROVED
-> SUBMITTED_TO_EAI
-> WAITING_LEGACY_CALLBACK
-> CALLBACK_RECEIVED
-> RESUME_REQUESTED
-> COMPLETED
```

Exception and failure states:

```text
FAILED_RETRYABLE
-> RETRY_SCHEDULED
FAILED_FINAL
COMPENSATION_REQUIRED
COMPENSATED
MANUAL_REVIEW_REQUIRED
CANCELED
EXPIRED
```

## Transition Rules

- Write/customer-impact operations must not transition to `SUBMITTED_TO_EAI` without approval.
- If `callback_expected=true`, do not mark the work item `COMPLETED` immediately after EAI submit.
- Treat the same `correlation_id` + `legacy_tx_id` + `callback_id` idempotently.
- On timeout, decide whether retry is allowed before scheduling retry.
- If retry is not allowed, transition to `MANUAL_REVIEW_REQUIRED` or `FAILED_FINAL`.
- Partial success is a candidate for `MANUAL_REVIEW_REQUIRED` or `COMPENSATION_REQUIRED`.
- Never pass raw legacy payloads into LLM context; expose safe summaries or result references only.

## API Contract Placeholder

These are contract placeholders, not real endpoints:

```text
POST /work-items
GET /work-items/{work_item_id}
POST /work-items/{work_item_id}/validate
POST /work-items/{work_item_id}/approval
POST /work-items/{work_item_id}/submit-eai
POST /callbacks/eai
POST /work-items/{work_item_id}/resume-request
POST /work-items/{work_item_id}/audit-events
POST /work-items/{work_item_id}/compensate
```

## Graph IR / Handoff Shape

Use handoff metadata instead of a new module category:

```yaml
runtime_support:
  context_manager:
    required: true
    reason: "EAI returns async job_id and legacy callback completes later."
    work_item_statuses:
      - REGISTERED
      - SUBMITTED_TO_EAI
      - WAITING_LEGACY_CALLBACK
      - CALLBACK_RECEIVED
      - RESUME_REQUESTED
      - COMPLETED
    identifiers:
      - work_item_id
      - agent_session_id
      - correlation_id
      - idempotency_key
      - eai_job_id
      - legacy_tx_id
    llm_exposure: "safe_summary_only"
```
