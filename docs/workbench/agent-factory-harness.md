# Agent Factory Harness

This document is the project-specific operating harness for Agent Factory work. It is separate from the user-level global development constitution and applies only inside this repository.

## Purpose

Agent Factory should turn vague requirements into reviewed, reusable planning artifacts before any implementation step begins.

The goal is repeatable agent design review, not one-off code generation. Coding agents working in this repository must preserve a controlled pipeline:

```text
raw requirement
  -> normalized requirement
  -> evidence and missing-information review
  -> module candidates
  -> workflow/process flow
  -> catalog reuse and registration review
  -> reviewed catalog and Graph IR decisions
  -> approved scaffold-plan and ADK Runtime Handoff
```

Raw requirements must not directly generate code.

## Documentation impact comes first

Before changing source code, check whether the change affects active `docs/` Markdown.

Update docs in the same change set when a change affects:

- taxonomy or enum meaning
- catalog semantics or runtime binding
- schemas, validator behavior, or required verification commands
- analyzer prompts, output shape, or review flow
- Workflow/Graph IR rules
- UI behavior that users or future agents rely on
- operating policy in `AGENTS.md` or `CLAUDE.md`

Do not update `docs/archive/**` for current behavior unless the task explicitly asks for archival or migration work.

## Classification first

Before building implementation plans, classify each requested capability into the active taxonomy.

Top-level categories:

- `agent`: reasoning responsibility such as judgment, summarization, classification, recommendation, or policy interpretation.
- `workflow`: broad Workflow Agent boundary, classified as `orchestration`, `graph`, `dynamic`, or `unknown`; sequence, fan-out/fan-in, loop, and human input live inside Graph IR.
- `adapter`: callable capability used by agents or workflows; includes legacy APIs, retrieval, rule registries, data queries, templates, computation, and external services.
- `remote_a2a`: independent remote agent boundary with protocol-level contract.

Do not promote retrieval, rule registry, or tool/adapter back into top-level categories. They remain adapter subtypes.

## Remote A2A is high-friction

Remote A2A must not be inferred merely because a process has multiple steps or multiple local modules.

Use `remote_a2a` only when there is an independent remote agent boundary with explicit ownership and protocol responsibility.

A Remote A2A candidate must include:

- `risk_level: high`
- owner
- agent card or equivalent discovery metadata
- auth model
- task lifecycle
- timeout policy
- retry policy
- fallback behavior
- audit requirements

If those fields are unknown, mark the candidate as needing review instead of inventing them.

## Scaffold and runtime handoff gate

ADK Runtime Handoff is part of the current workbench, but it is review-gated. Scaffold-plan generation and source handoff must consume only approved workbench artifacts:

- reviewed `AnalysisResult`
- approved module candidates
- reviewed A2A contracts where Remote A2A is involved
- reviewed catalog decisions
- `scaffold-plan` data with `source: approved_workbench_artifact`

Do not scaffold directly from:

- raw user requests
- unreviewed analyzer output
- incomplete module candidates
- missing Remote A2A contract details
- private or organization-specific runtime assumptions

A scaffold plan should make boundaries explicit before code exists. Generated source remains a TODO/runtime wiring handoff unless a separate task explicitly approves runnable business logic. It must not include private banking endpoints, credentials, deployment scripts, or organization-specific runtime code.

## Required artifact posture

For Agent Factory work, produce or preserve reviewable artifacts rather than only code.

Expected artifact families:

- normalized requirements
- evidence and assumptions
- missing-information records
- module candidates with category and subtype
- process flow nodes and edges
- catalog reuse decisions and registration changes
- documentation impact decisions
- risk gates
- catalog change decisions
- scaffold-plan fixture and runtime handoff validation when schema work touches them
- validation output
- decision notes when taxonomy or boundary choices change

Live analyzer note: Codex CLI may return a compact draft artifact first. That draft is an internal transport contract only; the workbench must hydrate and validate the existing review artifacts before presenting or saving results.

## Local/offline-friendly assistant behavior

Assume restricted-internet or enterprise environments may exist downstream.

Good assistant tasks:

- normalize intake text
- extract capabilities
- classify module candidates
- draft adapter, agent, workflow, and Remote A2A specs
- maintain scaffold-plan validation fixtures and runtime handoff checks when schema work touches them
- generate validation cases
- update catalogs and documentation
- produce review checklists

Human-governed decisions:

- final architecture classification
- high-risk automation approval
- Remote A2A dependency approval
- customer-impacting or money-impacting behavior
- compliance-sensitive decision rules
- private deployment/runtime integration

## Repository source-of-truth boundaries

Active source-of-truth areas:

- `packages/web`: live workbench UI and analyzer flow
- `schemas`: artifact contracts
- `catalog`: reusable capability, domain-owner, and risk-gate catalogs
- `templates`: reviewed artifact templates and scaffold-plan fixtures
- `docs/workbench`: active operating guidance
- `docs/visualization`: visual design and graph/display guidance

Archive material under `docs/archive` is historical. Do not revive old taxonomy or scaffold assumptions from archive notes unless the task explicitly asks for migration analysis.

For live analyzer work, keep `schemas/analysis-draft.schema.json` aligned with the server hydration logic and keep `schemas/analysis-result.schema.json` as the final artifact contract.

## Verification expectations

After TypeScript, React, analyzer, schema, or validator changes, run the relevant verification.

Minimum build check for web changes:

```bash
cd packages/web
npm run build
```

Artifact validation from repo root:

```bash
node scripts/validate-artifacts.mjs
node scripts/validate-artifacts.mjs path/to/artifacts
```

UI changes require visual verification. Use the example requirement flow because it exercises all major categories and markers.

## Done means for Agent Factory work

Work is done only if:

- raw requirements are not used as scaffold inputs
- module classification follows the active taxonomy
- subtype fields are present where required
- Remote A2A remains high-friction and contract-backed
- schemas, validator, analyzer types, and UI labels remain aligned when any enum changes
- review artifacts and deferred fixtures pass validation where applicable
- changed UI behavior is visually checked when applicable
- no private banking data, credentials, endpoints, deployment scripts, or organization-specific runtime code were added
