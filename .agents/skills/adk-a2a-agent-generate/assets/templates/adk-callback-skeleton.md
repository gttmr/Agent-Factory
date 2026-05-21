# ADK Callback Skeleton

```python
# TODO skeleton only. Do not include real banking endpoints or credentials.

def before_agent_callback(callback_context):
    """
    TODO:
    - Read work_item_id from session state when present.
    - Query Context Manager contract/client placeholder.
    - If status is CALLBACK_RECEIVED or RESUME_REQUESTED, set next-step hint.
    - If status is FAILED_FINAL, MANUAL_REVIEW_REQUIRED, or EXPIRED, block unsafe continuation.
    """
    return None


def before_tool_callback(tool, args, tool_context):
    """
    TODO:
    - Validate args against reviewed input schema.
    - Classify operation_type.
    - Require approval token for write/customer-impact operations.
    - Generate or reuse idempotency_key and correlation_id.
    - Register/update WorkItem in Context Manager.
    - Block tool execution when approval/context is missing.
    """
    return None


def after_tool_callback(tool, args, tool_context, tool_response):
    """
    TODO:
    - Normalize MCP/EAI response.
    - Mask raw legacy payload.
    - Store eai_job_id, legacy_tx_id, correlation_id.
    - If callback_expected, mark WAITING_LEGACY_CALLBACK.
    - Return safe summary only.
    """
    return None


def after_agent_callback(callback_context):
    """
    TODO:
    - Mask final response.
    - Add audit summary.
    - Express pending work item as submitted/approval-pending/result-waiting.
    """
    return None
```
