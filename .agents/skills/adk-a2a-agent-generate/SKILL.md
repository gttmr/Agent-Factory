---
name: adk-a2a-agent-generate
description: Plan one Google ADK-based module boundary from a requirement, classify shared reuse and A2A boundaries, and produce evidence, classification, commonization notes, and an implementation handoff with TODO business logic. Use when Codex should help design agent boundaries, workflow composition, adapter reuse, or A2A interactions without assuming private deployment infrastructure.
---

# ADK A2A Agent Generate

## Overview

Use this skill when the user wants Codex to prepare one module implementation step inside a larger incremental agent buildout.

The skill is a unit workflow. It handles one request at a time and produces planning artifacts for a future implementation. It does not default to finished business logic, deployment, or publication.

The important work is:

- collect compact evidence before designing code
- classify the requested boundary with top-level `module_category`: `agent`, `workflow`, `adapter`, or `remote_a2a`
- preserve internal precision with `agent_kind` and `adapter_kind`
- decide whether local same-runtime reuse is enough
- decide whether internal ADK workflow composition is needed
- mark A2A only when a remote independent agent boundary is required
- produce a handoff and scaffold shape with explicit TODOs

## Required Inputs

- Default `repo_path` to the current git repository root.
- Collect a `boundary_request` with `goal` or `spec_path`.
- Accept `specialist_agent_request` as a legacy alias for older callers.
- Accept sparse first-pass inputs:
  - `goal`
  - optional `domain_key`
  - optional `agent_name`
  - optional `module_name`
  - optional `specialist_role`
  - optional `specialist_input_contract`
  - optional `specialist_output_contract`
  - optional `specialist_parent_context`
  - optional `additional_context_paths`
- Accept optional reuse-analysis inputs:
  - `prior_delta_paths`
  - `shared_boundary_catalog_paths`
  - `incremental_context_template_id`

Do not require JSONL files as direct skill input. An external orchestrator may invoke this skill once per request.

## Workflow

1. Resolve the request context.
   Infer `module_name` or `agent_name` from the requirement when it is missing. Keep it as a stable ASCII package identifier. If the request identity is still unknown after reading the requirement text, ask for the smallest missing identifier.

2. Load the standards that control the decision.
   Read only the references needed for the request:
   - `references/spec-driven-execution.md`
   - `references/minimal-input-contract.md`
   - `references/incremental-commonization.md`
   - `references/boundary-decision-rules.md`
   - `references/internal-workflow-composition.md`
   - `references/a2a-boundary-rules.md`
   - `references/implementation-handoff.md`
   - `references/question-rules.md`
   - `references/target-shape.md`
   - `references/specialist-agent-template.md`

3. Build evidence first.
   Summarize the requirement, inputs, outputs, ownership hints, existing shared candidates, and any prior decisions. Keep the evidence compact enough to review in one screen.

4. Build incremental shared context.
   Summarize prior commonization notes and shared boundary catalogs. Distinguish confirmed reuse from speculative reuse.

5. Classify with the main model.
   Capture structured classification JSON with:
   - `module_category`
   - `agent_kind`
   - `adapter_kind`
   - `registry_kind`
   - `legacy_recommended_type`
   - `reuse_bindings`
   - `shared_registration_proposals`
   - `retrofit_actions`
   - `a2a_required`
   - `a2a_interactions`
   - `internal_workflow`
   - `reasoning_summary`
   - `todo`
   Use `registry_kind` only when `adapter_kind` is `rule_registry`; otherwise set it to `null`.

6. Build commonization notes.
   Record which agents, workflows, adapters, or remote A2A boundaries should be reused, added, updated, or revisited later.

7. Generate the implementation handoff.
   Produce a machine-validatable JSON handoff and a human-readable markdown handoff that explain the selected boundary, ADK composition pattern, A2A interactions, TODO business logic, and testing notes.

8. Prepare scaffold bridge inputs only when requested.
   If the user asks for files, produce reviewed `scaffold-plan.json` and `implementation-handoff.md` content for the selected module shape. Do not write implementation files directly from the raw request; actual file generation must go through the target repository's approved scaffold bridge.

## Ask The User Only When Required

- The request lacks a stable identity after reading the requirement.
- The owner or domain boundary is required for a safe A2A/shared-boundary decision and cannot be inferred.
- The user asks for runnable code but the target runtime, language, or model configuration is unspecified.

Do not ask for prior delta paths when the user intentionally wants a cold-start run.

## Output Contract

Start with the resolved `repo_path`, `request_unit`, and `module_name` or `agent_name`.

Produce:

- evidence summary JSON
- incremental shared-context summary JSON
- classification JSON
- commonization notes JSON
- implementation handoff JSON for workbench validation
- implementation handoff markdown for human review
- optional scaffold-plan content only when requested

Portable JSON schemas live in `assets/schemas/`. External workbenches should validate LLM-produced classification, commonization notes, shared-boundary catalogs, and implementation handoff JSON against those schemas before consuming or storing the artifacts. The markdown handoff is a human-readable rendering of the same selected module, evidence, reuse, A2A, scaffold, TODO, and test information.

When A2A is required, show the remote interaction boundary explicitly. When workflow is required, distinguish a top-level `module_category: "workflow"` deliverable from `internal_workflow` that stays inside a selected ADK agent boundary. Do not automatically promote either workflow form to remote A2A.

## Defaults

- Default to `module_category: "agent"` with `agent_kind: "specialist"`.
- Default to local tool or local sub-agent reuse when the dependency is in the same runtime.
- Default to A2A only for independent remote agents with their own capability boundary.
- Default to ADK `SequentialAgent`, `ParallelAgent`, or `LoopAgent` only when deterministic internal control flow is needed.
- Default to TODO business logic rather than pretending an incomplete scaffold is production-ready.
