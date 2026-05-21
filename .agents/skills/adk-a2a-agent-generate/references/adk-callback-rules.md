# ADK Callback Rules

ADK callbacks and external callbacks are different mechanisms.

## Distinctions

ADK callback:

- runs before or after agent, tool, or model execution
- supports authorization, input validation, masking, audit summaries, and tool blocking
- is not an endpoint for EAI/Legacy completion callbacks

EAI/Legacy callback:

- is an external event about legacy completion, failure, pending state, or partial success
- is received by Callback Broker or Context Manager first
- updates durable WorkItem state before an Agent sees a safe summary

A2A push notification:

- reports task state changes from an independent Remote Agent
- is not the default wrapper for EAI API completion

## ADK Callback Use

`before_agent_callback`:

- query Context Manager when `work_item_id` is present
- detect suspended work that can resume
- continue only when status is `CALLBACK_RECEIVED` or `RESUME_REQUESTED`
- block unsafe continuation for `FAILED_FINAL`, `MANUAL_REVIEW_REQUIRED`, or `EXPIRED`

`before_tool_callback`:

- validate tool arguments against reviewed input schema
- classify `operation_type`
- check access authority
- require approval token for write/customer-impact operations
- create or reuse `idempotency_key` and `correlation_id`
- register or update WorkItem in Context Manager
- block risky tool execution when approval or context is missing

`after_tool_callback`:

- normalize MCP/EAI responses
- mask raw legacy payloads
- store `eai_job_id`, `legacy_tx_id`, and `correlation_id`
- record `WAITING_LEGACY_CALLBACK` when `callback_expected=true`
- return safe summary only

`after_agent_callback`:

- mask final response
- express pending work as submitted, approval-pending, or result-waiting
- append audit summary

## Skeleton Rules

Keep callback skeletons TODO-only. Do not add real endpoints, credentials, Gemini keys, or runnable banking logic. Use ADK callback parameter names from the relevant ADK version documentation when turning the skeleton into actual code.
