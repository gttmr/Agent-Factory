# Agent Factory Workbench

Agent Factory is a local-first workbench for turning raw requirements into reviewed Agent/Workflow/Adapter/Remote A2A design artifacts. It is the source of truth for requirement intake, normalized requirement structure, module classification, process-flow review, catalog reuse decisions, and Graph IR validation.

This repository contains the workbench application and shared schemas. It is not a banking deployment, does not include private endpoints or credentials, and does not generate runnable business logic directly from raw user requests.

## Repository Scope

- `packages/web`: React/Vite requirement intake, review, Graph IR, and catalog review workbench.
- `schemas`: JSON Schemas for normalized requirements, module candidates, process flow, classification, commonization, and scaffold-plan validation artifacts.
- `catalog`: MVP YAML catalogs for reusable agents, workflows, adapters, Remote A2A runtime contracts, domain owners, and risk gates.
- `templates`: generic reviewed artifact templates and scaffold-plan validation fixtures.
- `docs`: workbench analysis, taxonomy, workflow-decision, validation, and reference documentation.
- `.agents/skills`: skill material that may be synchronized later, but is not the primary edit target for this workbench refactor.

## Workbench Flow

1. Capture a raw requirement with requester and system context.
2. Normalize the requirement into reviewable structured data.
3. Classify module candidates with the approved taxonomy.
4. Review process flow and remote-boundary friction.
5. Mark modules as approved, deferred, rejected, or `needs_info`.
6. Review catalog reuse decisions and register/exclude analysis candidates.
7. Validate the reviewed process flow as Graph IR.
8. Generate a review-gated scaffold plan and ADK Runtime Handoff when modules are approved.

Raw requirements must never create code directly. The current ADK Runtime Handoff consumes only reviewed `AnalysisResult` data, approved module candidates, catalog decisions, and `scaffold-plan` validation. Generated source remains a TODO/runtime wiring handoff: it must not include runnable business logic, private banking endpoints, credentials, or organization-specific deployment code.

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

Catalog entries are runtime-oriented contracts, not mocks. Mock generation is a separate future workflow that may read these contracts to create local test doubles, but the catalog itself should describe the intended MCP, Remote A2A, or implementation binding.

## Remote A2A Policy

Remote A2A is separate from Adapter. It should be proposed only when the requirement indicates an independent remote agent boundary with its own owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. Multi-step workflow alone is not enough to create Remote A2A.

## Development

```bash
cd packages/web
npm install
npm run build
```

The web package build runs `tsc --noEmit && vite build`.
