# Agent Factory Workbench

Agent Factory is a local-first workbench for turning raw requirements into reviewed Agent/Workflow/Adapter/Remote A2A design artifacts. It is the source of truth for requirement intake, normalized requirement structure, module classification, process-flow review, catalog reuse decisions, Graph IR validation, and reviewed ADK Runtime Handoff.

The current MVP uses banking-domain language so reviewers can test realistic boundaries for customer, deposit, loan, card, and risk workflows. That domain is a review scaffold, not a banking deployment. This repository contains the workbench application and shared schemas, does not include private endpoints or credentials, and does not generate runnable business logic directly from raw user requests.

## Repository Scope

- `packages/web`: React/Vite requirement intake, review, Graph IR, and catalog review workbench.
- `schemas`: JSON Schemas for normalized requirements, module candidates, process flow, classification, commonization, and scaffold-plan validation artifacts.
- `catalog`: MVP YAML catalogs for reusable agents, workflows, adapters, Remote A2A runtime contracts, domain owners, and risk gates.
- `templates`: generic reviewed artifact templates and scaffold-plan validation fixtures.
- `docs`: workbench analysis, taxonomy, workflow-decision, validation, and reference documentation.
- `.agents/skills`: skill material that may be synchronized later, but is not the primary edit target for this workbench refactor.

## Reviewer Journey

The intended first user is a development leader who needs to turn an ambiguous business request into reviewable architecture artifacts before implementation starts.

1. Confirm the normalized goal, domain, inputs, outputs, and systems in the analysis result.
2. Review candidate modules and resolve `needs_info` items before approval.
3. Inspect the process flow as Graph IR, including local workflow edges and any high-friction Remote A2A boundary.
4. Review runtime contracts for MCP/EAI/Legacy adapters, Context Manager, Callback Broker, ADK callbacks, and async resume when the requirement implies callback or legacy execution state.
5. Decide which catalog contracts are reused, registered, or excluded.
6. Generate an ADK Runtime Handoff only from approved workbench artifacts.

ADK Runtime Handoff is therefore a review gate and source-bundle handoff, not a deployment step. Its generated files keep runtime wiring, private configuration, and business logic as explicit TODO boundaries while allowing structural smoke checks such as dependency install, compile, pytest, ADK Web launch, and chat smoke.

## Workbench Flow

1. Capture a raw requirement with requester and system context.
2. Normalize the requirement into reviewable structured data.
3. Classify module candidates with the approved taxonomy.
4. Review process flow and remote-boundary friction.
5. Resolve `needs_info` module candidates through candidate-level Resolution Draft review, object schema inspection, and smoke-contract application.
6. Mark modules as approved, deferred, rejected, or `needs_info`.
7. Review catalog reuse decisions and register/exclude analysis candidates.
8. Validate the reviewed process flow as Graph IR.
9. Review and approve required runtime contracts for legacy, callback, Context Manager, and async resume behavior.
10. Generate a review-gated scaffold plan and ADK Runtime Handoff when modules and runtime contracts are approved.

Raw requirements must never create code directly. The current ADK Runtime Handoff consumes only reviewed `AnalysisResult` data, approved module candidates, applied Resolution Draft state, catalog decisions, and `scaffold-plan` validation. Generated source remains a TODO/runtime wiring handoff: it must not include runnable business logic, private banking endpoints, credentials, or organization-specific deployment code.

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
