# Requirement Intake Workbench Playbook

Use this playbook when reviewing a raw requirement in the Agent Factory workbench.

## Review Order

1. Capture the raw requirement and requester context.
2. Normalize the requirement into explicit goal, inputs, outputs, systems, risks, missing information, contradictions, and assumptions.
3. Classify module candidates with `module_category`.
4. Add subtype fields for the selected category.
5. Review process-flow edges.
6. Approve, defer, reject, or keep each module in review.
7. Export artifacts only after review.

## Taxonomy

Top-level `module_category`:

- `agent`: reasoning responsibility such as judgment, summarization, classification, recommendation, or triage.
- `workflow`: deterministic or semi-deterministic control flow such as sequential, parallel, loop, orchestration, or human review.
- `adapter`: callable capability used by agents or workflows.
- `remote_a2a`: independent remote agent boundary with protocol-level contract.

Adapter `adapter_kind`:

- `legacy_api`
- `retrieval`
- `rule_registry`
- `data_query`
- `template`
- `computation`
- `external_service`
- `unknown`

Retrieval and managed rule registries are Adapter subtypes, not separate top-level categories.

## Remote A2A

Remote A2A requires independent remote owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. A local workflow with multiple steps remains a Workflow unless the text proves an independent remote agent boundary.

## Artifacts

Exports should include:

- `normalized-requirement.json`
- `evidence-summary.json`
- `module-candidates.json`
- `process-flow.json`
- `classification.json`
- `commonization-notes.json`
- `implementation-handoff.md`
- `scaffold-plan.json`

`legacy_recommended_type` may appear only as migration metadata. It is not the primary classifier.
