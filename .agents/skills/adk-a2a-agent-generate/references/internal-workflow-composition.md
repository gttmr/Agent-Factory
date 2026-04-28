# Internal Workflow Composition

Use workflow fields when the selected boundary needs deterministic control flow.

Patterns:

- `sequential`: ordered steps where each step depends on previous output
- `parallel`: independent branches that can run concurrently and be joined
- `loop`: bounded retry, review, revision, or convergence pattern

Rules:

- If `module_category` is `agent`, keep deterministic workflow inside the selected agent boundary and record it in `classification.internal_workflow`.
- If `module_category` is `workflow`, the workflow itself is the selected deliverable. Record its pattern and reuse bindings without inventing a new reasoning owner.
- Do not convert workflow into remote A2A unless the dependency is independently owned or hosted.
- Preserve TODOs for business logic that is not implemented yet.
