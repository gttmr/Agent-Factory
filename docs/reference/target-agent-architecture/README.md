# Target Agent Architecture

The workbench does not assume every requirement becomes one deployable agent. It decomposes reviewed requirements into explicit module categories.

## Categories

- `agent`: reasoning responsibility such as judgment, summarization, classification, recommendation, or triage.
- `workflow`: deterministic or semi-deterministic control flow such as sequential, parallel, loop, orchestration, or human review.
- `adapter`: callable capability used by agents or workflows.
- `remote_a2a`: independent remote agent boundary with protocol-level contract.

## Adapter Subtypes

Adapters preserve the kind of callable capability through `adapter_kind`:

- `legacy_api`
- `retrieval`
- `rule_registry`
- `data_query`
- `template`
- `computation`
- `external_service`
- `unknown`

## Remote A2A Boundary

Remote A2A requires independent owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. Local orchestration or fan-out/fan-in alone remains Workflow.
