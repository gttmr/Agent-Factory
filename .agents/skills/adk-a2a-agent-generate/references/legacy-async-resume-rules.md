# Legacy Async Resume Rules

Use async resume when EAI does not return the final result immediately.

## Async Flow

When EAI returns only a `job_id`:

```text
ADK Agent/Workflow submits request
-> MCP/EAI Adapter returns eai_job_id and correlation_id
-> Context Manager stores SUBMITTED_TO_EAI
-> Context Manager stores WAITING_LEGACY_CALLBACK
-> Agent stops or returns a safe pending summary
```

When the EAI/Legacy callback arrives:

```text
Callback Broker receives callback
-> validates signature and schema
-> Context Manager transitions to CALLBACK_RECEIVED
-> Context Manager records RESUME_REQUESTED
-> ADK Runtime Handoff or runner reads the state on the next execution
-> Workflow continues from the resume point
```

## Graph IR Representation

Use existing Graph IR node/container/edge shapes and put async semantics in labels and metadata.

Recommended nodes:

- legacy submit node
- callback wait node
- approval wait node
- resume requested node
- manual review node
- compensation required node

Example:

```json
{
  "id": "wait_legacy_callback",
  "type": "workflow_step",
  "label": "Wait for EAI Legacy Callback",
  "metadata": {
    "callback_expected": true,
    "context_manager_status": "WAITING_LEGACY_CALLBACK",
    "resume_condition": "CALLBACK_RECEIVED"
  }
}
```

If the repository schema does not allow arbitrary `type` or `metadata` fields in Graph IR, express this as handoff annotations and map to the closest valid Graph IR node and edge enums during implementation.

## Required Decisions

- `async_resume_decision`: required, optional, or not required
- callback receiver: Callback Broker, Context Manager, or none
- resume trigger: `CALLBACK_RECEIVED`, approval, timeout, or manual review
- timeout behavior: retry, expire, manual review, or final failure
- compensation behavior: required, candidate, or not applicable
