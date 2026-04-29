# Agent Working Index

## Repository Role

- This is the primary Agent Factory workbench repository.
- Treat `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active workbench source of truth.
- Do not treat this repository as only a public skill-source extract.
- Do not add private banking data, private endpoints, credentials, deployment scripts, or organization-specific runtime code.
- Do not edit `.agents/skills` during workbench taxonomy refactors unless the task explicitly asks for a separate skill-sync step.

## Source Of Truth Map

- `README.md`: human-facing workbench overview and taxonomy contract.
- `AGENTS.md`: model-facing repository index and working rules.
- `packages/web`: requirement intake, analysis review, process flow, and artifact export UI.
- `schemas`: normalized requirement, module candidate, and process-flow schemas.
- `catalog`: initial YAML catalogs for reusable capabilities, domain owners, and risk gates.
- `templates`: generic artifact and scaffold-plan templates.
- `docs`: active workbench analysis, taxonomy, workflow-decision, validation, and reference notes.

## Markdown Documentation Ownership

- `docs/README.md` indexes human-facing workbench documentation under `docs/`.
- `.agents/skills/**` Markdown is governed by the nearest `SKILL.md` and should not be moved or linked from `docs/README.md` unless the task explicitly asks for a skill-sync step.
- Historical review records belong under `docs/archive/` and must not override the canonical policy files listed above.

## Current Taxonomy

Top-level `module_category` values:

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

Adapter `adapter_kind` values:

- `legacy_api`
- `retrieval`
- `rule_registry`
- `data_query`
- `template`
- `computation`
- `external_service`
- `unknown`

Definitions:

- Agent: reasoning responsibility such as judgment, summarization, classification, or recommendation.
- Workflow: deterministic or semi-deterministic control flow such as sequential, parallel, loop, orchestration, or human review.
- Adapter: callable capability used by agents or workflows.
- Remote A2A: independent remote agent boundary with protocol-level contract.

Tool/Adapter, Knowledge Retrieval, and Metadata Registry are no longer top-level categories. Retrieval and rule registries are Adapter subtypes.

## Editing Rules

- Keep changes scoped to the requested workbench behavior.
- Do not introduce abstractions, configuration, or extensibility unless the present task requires it.
- Preserve legacy migration data with `legacy_recommended_type`; do not use it as the primary classifier.
- Remote A2A must remain high-friction and must not be inferred only because a workflow has multiple local steps.
- Scaffolding must consume approved artifacts, not raw user requests.
- Future scaffold work should use approved `scaffold-plan.json` and `implementation-handoff.md` only.

## Verification

- After TypeScript, React, analyzer, or export changes, run:

```bash
cd packages/web
npm run build
```

- If dependency installation is needed, run `npm install` in `packages/web` before the build.
- Do not call work complete without observable verification.
