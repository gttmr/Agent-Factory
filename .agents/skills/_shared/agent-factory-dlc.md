# Agent Factory DLC Model

Agent Factory uses skills as the primary execution layer and the workbench as the visualization, review, and guided-edit companion.

## Four Stages

1. `af-analyze-requirement`: raw requirement -> schema-first analysis artifacts.
2. `af-design-boundaries`: analysis artifacts -> approved boundaries, runtime contracts, Graph IR, and reuse decisions.
3. `af-build-runtime-stub`: approved scaffold-plan -> TODO-only runtime stub and implementation handoff.
4. `af-verify-feedback`: validation evidence -> report and catalog delta proposal.

Each stage must read the previous stage artifact from `artifacts/af/<req-id>/` unless the user explicitly supplies another path.

## Operating Rules

- Produce reviewable artifacts before implementation.
- Classify first with `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Keep retrieval, rule registry, tool, MCP, EAI, Context Manager, and Callback Broker out of top-level category lists unless the schema already defines them there.
- Require human approval before advancing from design to runtime stub generation.
- Keep generated source as TODO/runtime wiring handoff unless a separate implementation task approves real business logic.
- Use synthetic data only; never add private banking data, private endpoints, credentials, deployment scripts, or organization-specific runtime code.

## Workbench Role

The web workbench should consume and display these artifacts, help reviewers understand them, and support structured partial edits.
It is not the only source of analysis truth when a skill has produced valid schema artifacts.
