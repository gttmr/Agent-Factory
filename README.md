# Agent Factory Workbench

Agent Factory is a local-first skill-led workbench for turning raw requirements into reviewed Agent/Workflow/Adapter/Remote A2A design artifacts. The repo-local `.agents/skills` DLC workflow produces schema-first artifacts; the web workbench visualizes, reviews, and helps partially edit those artifacts before ADK Runtime Handoff.

The current MVP uses banking-domain language so reviewers can test realistic boundaries for customer, deposit, loan, card, and risk workflows. That domain is a review scaffold, not a banking deployment. This repository contains the workbench application and shared schemas, does not include private endpoints or credentials, and does not generate runnable business logic directly from raw user requests.

## Repository Scope

- `.agents/skills`: Agent Factory DLC skills for analysis, boundary design, runtime stub generation, and verification feedback.
- `packages/web`: React/Vite artifact visualization, review, Graph IR, catalog review, and guided-edit workbench.
- `schemas`: JSON Schemas for normalized requirements, module candidates, process flow, classification, commonization, and scaffold-plan validation artifacts.
- `catalog`: MVP YAML catalogs for reusable agents, workflows, adapters, Remote A2A runtime contracts, domain owners, and risk gates.
- `templates`: generic reviewed artifact templates and scaffold-plan validation fixtures.
- `docs`: workbench analysis, taxonomy, workflow-decision, validation, and reference documentation.

## Reviewer Journey

The intended first user is a development leader who needs to turn an ambiguous business request into reviewable architecture artifacts before implementation starts.

1. Use `af-analyze-requirement` to produce schema-first analysis artifacts under `artifacts/af/<req-id>/`.
2. Use `af-design-boundaries` to review candidate modules, runtime contracts, Graph IR, Remote A2A, and reuse decisions.
3. Use the workbench (`packages/web`) to open the `artifacts/af/<req-id>/` root from Landing or a recent-root pick. The workbench reads and writes the root through `/api/af/*` and `/api/af-collab/*`, mirroring `analysis-result.json`, `af-run-manifest.json`, scaffold plan, runtime stub, validation report, collaboration comments, and catalog delta directly to disk.
4. Use `af-build-runtime-stub` only after approved artifacts exist; generated source remains TODO/runtime wiring handoff.
5. Use `af-verify-feedback` to record command evidence and propose catalog deltas without silently editing runtime catalogs.

ADK Runtime Handoff is therefore a review gate and source-bundle handoff, not a deployment step. Its generated files keep runtime wiring, private configuration, and business logic as explicit TODO boundaries while allowing structural smoke checks. After the PR6 migration the workbench surface is split into BuildWorkbench (`/af/:reqId/build`) and VerifyWorkbench (`/af/:reqId/verify`); the previous in-UI `adk web` embed, `/run` chat smoke, and Smoke 일괄 실행 macro were removed and equivalent dependency-install / compileall / pytest / ADK Web smoke is performed from a separate terminal against the generated `runtime-stub/`.

## Workbench Flow

1. `af-analyze-requirement`: normalize the raw requirement, evidence, module candidates, and first Graph IR into schema artifacts.
2. `af-design-boundaries`: resolve candidate-level `needs_info`, approve boundaries, review runtime contracts, and confirm catalog reuse decisions.
3. Workbench review: open the artifact root from Landing (or recent-root pick) and walk `/af/:reqId/analyze` → `/af/:reqId/design` → `/af/:reqId/build` → `/af/:reqId/verify`. The workbench reads/writes the root in place, mirrors approval state into `manifest.approvals.*` and `stages.*.status`, and never bypasses schema and review gates.
4. `af-build-runtime-stub`: generate TODO-only runtime stubs from approved scaffold-plan data.
5. `af-verify-feedback`: validate artifacts/stubs and write verification evidence plus catalog delta proposals.

Raw requirements must never create code directly. Runtime Handoff and stub generation consume only reviewed `AnalysisResult` data, approved module candidates, approved required runtime contracts, reviewed catalog decisions, and `scaffold-plan` validation. Generated source remains a TODO/runtime wiring handoff: it must not include runnable business logic, private banking endpoints, credentials, or organization-specific deployment code.

Runtime contracts are reviewed artifacts inside `AnalysisResult.runtimeContracts`. They capture MCP/EAI/Legacy adapter contracts, Context Manager state contracts, Callback Broker contracts, ADK callback responsibilities, and async resume behavior. Required runtime contracts must be reviewed and approved before scaffold-plan generation can proceed.

## Taxonomy

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
- Workflow: broad Workflow Agent boundary, classified as orchestration, graph, dynamic, or unknown. Smaller sequence, fan-out/fan-in, loop, and human-input flows live inside Graph IR.
- Adapter: callable capability used by agents or workflows, including legacy API, retrieval, rule registry, data query, template, computation, or external service.
- Remote A2A: independent remote agent boundary with protocol-level contract.

Tool/Adapter, Knowledge Retrieval, and Metadata Registry are no longer top-level categories. Retrieval and managed rule registries remain visible as Adapter subtypes through `adapter_kind`.

Catalog entries are runtime-oriented contracts. For the local MVP they may also carry deterministic synthetic `runtime_mock` payloads so the generated ADK source can run smoke tests without private systems. These mocks are test doubles for local review only: they must use synthetic data, must not contain private banking endpoints or credentials, and must not be treated as deployed business logic.

## Remote A2A Policy

Remote A2A is separate from Adapter. It should be proposed only when the requirement indicates an independent remote agent boundary with its own owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. Multi-step workflow alone is not enough to create Remote A2A.

## Development

```bash
cd packages/web
npm install
npm run build
```

The web package build runs `tsc --noEmit && vite build`.
