# Agent Factory Workbench

Agent Factory is a local-first skill-led workbench for turning raw requirements into reviewed Agent/Workflow/Adapter/Remote A2A design artifacts. The Workbench is a Workflow-first Graph Model: workflows own the graph, agents are judgment nodes inside that graph, adapters are call nodes, and Remote A2A stays a high-friction protocol boundary. The repo-local `.agents/skills` DLC workflow produces schema-first artifacts; the web workbench visualizes, reviews, and helps partially edit those artifacts before ADK Runtime Handoff.

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

1. Use the Analyze Stage Runner in the workbench, or run `af-analyze-requirement` externally, to produce schema-first analysis artifacts under `artifacts/af/<req-id>/`.
2. Use the Design Stage Runner, or run `af-design-boundaries` externally, to review candidate modules, runtime contracts, Graph IR, Remote A2A, and reuse decisions.
3. Use the workbench (`packages/web`) to open the `artifacts/af/<req-id>/` root from Landing or a recent-root pick. The workbench reads and writes the root through `/api/af/*` and `/api/af-collab/*`, mirroring `analysis-result.json`, `af-run-manifest.json`, Stage Runner evidence, scaffold plan, runtime stub, validation report, collaboration comments, and catalog delta directly to disk.
4. Use `af-build-runtime-stub` only after approved artifacts exist. Generated source is an ADK Web smoke skeleton handoff, not production code: it keeps real system integration behind TODO boundaries and, when approved as `output_mode: runnable`, emits only reviewed synthetic ADK 2.x Workflow wiring for local smoke review.
5. Use `af-verify-feedback` to record command evidence and propose catalog deltas without silently editing runtime catalogs.

ADK Runtime Handoff is therefore a review gate and ADK Web smoke source-bundle handoff, not a deployment step or production generator. In smoke mode the generated files keep runtime wiring and business logic as explicit TODO boundaries; in `runnable` mode they wire a reviewed synthetic ADK Workflow for local ADK Web review — still generated only from approved artifacts (`raw_requirement_to_code` stays false) and free of private endpoints, credentials, and real data. The workbench surface includes BuildWorkbench (`/af/:reqId/build`), VerifyWorkbench (`/af/:reqId/verify`), the ADK runtime link screen (`/af/:reqId/run`), Reuse Hub (`/catalog`), and integrated Mock Lab (`/mock-lab`) for Adapter MCP mock generation and discovery. The old in-UI `adk web` iframe embed and `Smoke 일괄 실행` macro remain removed.

## Workbench Flow

1. Analyze Stage Runner / `af-analyze-requirement`: normalize the raw requirement, evidence, module candidates, and first Graph IR into schema artifacts.
2. Design Stage Runner / `af-design-boundaries`: resolve candidate-level `needs_info`, propose boundary/runtime/catalog updates, and preserve those results as diffable run output before canonical artifacts change.
3. Workbench review: open the artifact root from Landing (or recent-root pick) and walk `/af/:reqId/analyze` → `/af/:reqId/design` → `/af/:reqId/build` → `/af/:reqId/verify`. The workbench reads/writes the root in place, records Stage Runner evidence under `runs/<stage>/<run-id>/`, mirrors approval state into `manifest.approvals.*` and `stages.*.status`, and never bypasses schema and review gates.
4. `af-build-runtime-stub`: generate runtime stubs from approved scaffold-plan data — smoke TODO stubs by default, or a runnable ADK Workflow when `output_mode` is `runnable`.
5. `af-verify-feedback`: validate artifacts/stubs and write verification evidence plus catalog delta proposals.

Raw requirements must never create code directly. Runtime Handoff and stub generation consume only reviewed `AnalysisResult` data, approved module candidates, approved required runtime contracts, reviewed catalog decisions, and `scaffold-plan` validation. Generated source is an ADK Web smoke skeleton handoff by default; an approved `runnable` mode emits synthetic ADK Workflow wiring for smoke review rather than production code. In both modes it is generated only from reviewed artifacts (never raw requests) and must not include private banking endpoints, credentials, real customer data, or organization-specific deployment code.

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

- Workflow: the first-class graph boundary. It owns order, routing, fan-out/fan-in, loop intent, callback wait/resume, and subworkflow calls through Graph IR.
- Agent: a judgment node inside a workflow, responsible for reasoning such as summarization, classification, recommendation, triage, or toolset selection.
- Adapter: a callable capability used by workflows or agents. Fixed calls are represented as `node_kind: adapter_call`, not as a new category.
- Remote A2A: independent remote agent boundary with protocol-level contract.

Tool/Adapter, Knowledge Retrieval, Metadata Registry, and MCP are not top-level categories. Retrieval and managed rule registries remain visible as Adapter subtypes through `adapter_kind`. MCP is an invocation/binding detail: deterministic workflow-owned MCP calls use `invoke_binding: mcp_tool`, `call_control: fixed_by_workflow`, and `mock_binding` for Mock Lab smoke wiring; LLM-selected MCP toolsets use `invoke_binding: mcp_toolset` with `call_control: selected_by_llm` on the agent/toolset path.

Catalog entries are runtime-oriented contracts. For the local MVP they may also carry deterministic synthetic `runtime_mock` payloads so the generated ADK source can run smoke tests without private systems. These mocks are test doubles for local review only: they must use synthetic data, must not contain private banking endpoints or credentials, and must not be treated as deployed business logic.

## Remote A2A Policy

Remote A2A is separate from Adapter. It should be proposed only when the requirement indicates an independent remote agent boundary with its own owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. Multi-step workflow alone is not enough to create Remote A2A.

Reviewed Remote A2A contracts carry structured `adk_runtime_policy`. Runnable handoff maps only ADK-supported timeout and env-backed auth interceptor behavior into generated source; retry and fallback remain reviewed handoff policy, not generated retry wrappers.

## Development

```bash
cd packages/web
npm install
npm run build
```

The web package build runs `tsc --noEmit && vite build`.
