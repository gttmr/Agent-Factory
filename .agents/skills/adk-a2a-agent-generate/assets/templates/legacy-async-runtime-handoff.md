# Legacy Async Runtime Handoff

## Reviewed Requirement Summary

TODO: Summarize reviewed requirement. Do not copy raw request into generated source.

## Module Candidates

TODO: List approved Agent, Workflow, Adapter, and Remote A2A candidates.

## Graph IR Flow

Include legacy submit, approval wait, callback wait, resume requested, manual review, and compensation nodes as Graph IR annotations or valid node metadata.

## WorkItem Lifecycle

`REGISTERED -> APPROVAL_PENDING -> APPROVED -> SUBMITTED_TO_EAI -> WAITING_LEGACY_CALLBACK -> CALLBACK_RECEIVED -> RESUME_REQUESTED -> COMPLETED`

## ADK Callback Responsibilities

Validate args, check approval/idempotency, mask tool output, persist safe state, and block unsafe continuation.

## MCP/EAI Adapter Responsibilities

Submit reviewed inputs only; return synthetic-safe summary, `eai_job_id`, and `correlation_id`.

## Callback Broker Responsibilities

Verify, deduplicate, map status, and request Context Manager transition.

## Context Manager Responsibilities

Own durable WorkItem state, audit, timeout, retry, resume, manual review, and compensation state.

## Human Approval Gate

Required for write/customer-impact work.

## Resume Behavior

Resume only after `CALLBACK_RECEIVED` or `RESUME_REQUESTED`.

## Manual Review / Compensation Path

Required for partial success, failed final, or unsafe retry state.

## TODO Runtime Wiring

- TODO: Implement Context Manager client after approved runtime endpoint is provided.
- TODO: Implement EAI client through approved MCP contract only.
- TODO: Wire callback receiver to Context Manager.

## Non-Goals

No real endpoint, credential, private deployment code, or runnable business logic.
