# Internal Workflow Composition

Use workflow fields when the selected boundary needs deterministic control flow.

Patterns:

- ordered sequence: ordered steps where each step depends on previous output
- fan-out/fan-in: independent branches that can run concurrently and be joined
- loop: bounded retry, review, revision, or convergence pattern
- route/join: conditional branch and merge behavior
- human input: approval or reviewer intervention point
- callback wait: external EAI/Legacy result is expected later
- resume requested: Context Manager says a previously suspended work item can continue

Rules:

- If `module_category` is `agent`, keep deterministic workflow inside the selected agent boundary and record it in `classification.internal_workflow`.
- If `module_category` is `workflow`, the workflow itself is the selected deliverable. Use `workflow_kind: "orchestration"`, `"graph"`, `"dynamic"`, or `"unknown"` only. Record the detailed pattern and reuse bindings without inventing a new reasoning owner.
- Represent sequence, fan-out/fan-in, loop, route, join, human input, callback wait, approval wait, resume requested, manual review, and compensation as Graph IR node, container, edge, or metadata details. Do not add `sequential`, `parallel`, `loop`, `human_review`, or callback-specific values to `workflow_kind`.
- Use `container_kind: "graph_workflow"` or existing Graph IR containers such as `parallel_region`, `loop_region`, and `human_review_region` when available.
- Use adapter or workflow nodes with metadata for legacy submit, callback wait, approval wait, resume requested, manual review, and compensation. Keep the exact node type within the repository schema; put new semantics in labels and metadata when the schema has no dedicated enum.
- Do not convert workflow into remote A2A unless the dependency is independently owned or hosted.
- Preserve TODOs for business logic that is not implemented yet.

Graph IR metadata examples:

```yaml
graph_ir_annotations:
  callback_wait:
    context_manager_status: WAITING_LEGACY_CALLBACK
    resume_condition: CALLBACK_RECEIVED
  approval_wait:
    context_manager_status: APPROVAL_PENDING
    resume_condition: APPROVED
  resume_requested:
    context_manager_status: RESUME_REQUESTED
  manual_review:
    context_manager_status: MANUAL_REVIEW_REQUIRED
  compensation:
    context_manager_status: COMPENSATION_REQUIRED
```
