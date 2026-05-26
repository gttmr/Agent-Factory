# Runtime Support Rules

Runtime support is reviewed as `AnalysisResult.runtimeContracts`, not as new top-level module categories.

## Context Manager

Use a Context Manager contract when work execution state must survive beyond an agent turn:

- EAI `job_id`, `legacy_tx_id`, or `correlation_id` mapping
- callback receipt state
- approval state
- retry, timeout, and compensation state
- audit trail
- idempotency management

Do not treat Context Manager as ADK memory. Expose safe summaries or result references to the LLM, never raw legacy payloads.

## Callback Broker

Use a Callback Broker contract for the HTTP or event boundary that receives EAI/Legacy callbacks.
The broker validates signature, schema, correlation, deduplication, and status mapping before a safe resume can happen.
An ADK Agent does not receive EAI callbacks directly.

## ADK Callbacks

Use ADK callbacks for lifecycle controls such as validation, masking, audit summaries, tool blocking, and safe resume checks.
Do not use ADK callbacks as an external EAI callback endpoint.

## Async Resume

When a legacy operation returns only a `job_id`, record async resume behavior:

```text
submit -> WAITING_LEGACY_CALLBACK -> CALLBACK_RECEIVED -> RESUME_REQUESTED -> continue
```

Represent wait/resume behavior in Graph IR metadata or handoff annotations using existing schema fields.

## Required Policies

For write, customer-impact, or financial operations, record approval, idempotency, correlation, audit, timeout, retry, fallback, manual review, and compensation decisions.
