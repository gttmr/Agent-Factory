# Phase 1 Requirement Intake Workbench Plan

Phase 1 establishes the local-first workbench for turning raw requirements into reviewed artifacts. It does not implement scaffold generation or live LLM calls.

## Scope

- Requirement intake form.
- Normalized requirement draft.
- Evidence and missing-information review.
- Module candidate review.
- Process-flow visualization.
- Exported implementation handoff artifacts.
- Lightweight validation path.

## Taxonomy

Primary classifier: `module_category`.

Allowed values:

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

Subtype fields:

- `agent_kind`: `specialist` or `shared`.
- `workflow_kind`: `sequential`, `parallel`, `loop`, `human_review`, `orchestration`, or `unknown`.
- `adapter_kind`: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, or `unknown`.
- `remote_contract_kind`: `a2a` or `unknown`.

`legacy_recommended_type` is retained only as migration metadata for older artifacts.

## Review Board

The module review board should show:

- name
- module_category
- subtype
- confidence
- reuse_candidate
- risk_level
- status
- rationale
- next_action

## Process Flow

Node type values are `input`, `output`, `agent`, `workflow`, `adapter`, and `remote_a2a`. Node labels should include subtype when present, for example `Adapter: retrieval` or `Workflow: sequential`.

Remote edges are used only when crossing a `remote_a2a` node.

## Exports

Exports must be scaffold-ready but not executable. Raw requirements must not become code. Only approved modules should appear in `scaffold-plan.json`.
