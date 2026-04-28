# Agent Factory Workbench

Agent Factory is a local-first workbench for turning raw requirements into reviewed planning artifacts. It is the source of truth for requirement intake, normalized requirement structure, module classification, process-flow review, reuse/commonization notes, export artifacts, and a later scaffold bridge.

This repository contains the workbench application and shared schemas. It is not a banking deployment, does not include private endpoints or credentials, and does not generate runnable business logic directly from raw user requests.

## Repository Scope

- `packages/web`: React/Vite requirement intake workbench.
- `schemas`: JSON Schemas for normalized requirements, module candidates, and process flow artifacts.
- `templates`: generic artifact templates for reviewed handoff and scaffold planning.
- `docs`: workbench design notes, validation guidance, and scaffold bridge documentation.
- `.agents/skills`: skill material that may be synchronized later, but is not the primary edit target for this workbench refactor.

## Workbench Flow

1. Capture a raw requirement with requester and system context.
2. Normalize the requirement into reviewable structured data.
3. Classify module candidates with the approved taxonomy.
4. Review process flow and remote-boundary friction.
5. Mark modules as approved, deferred, rejected, or needing review.
6. Export approved artifacts for downstream implementation planning.
7. Feed only approved `scaffold-plan.json` and `implementation-handoff.md` into any future scaffold bridge.

Raw requirements must never create code directly. Scaffolding consumes approved artifacts only.

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
- Workflow: deterministic or semi-deterministic control flow such as sequential, parallel, loop, orchestration, or human review.
- Adapter: callable capability used by agents or workflows, including legacy API, retrieval, rule registry, data query, template, computation, or external service.
- Remote A2A: independent remote agent boundary with protocol-level contract.

Tool/Adapter, Knowledge Retrieval, and Metadata Registry are no longer top-level categories. Retrieval and managed rule registries remain visible as Adapter subtypes through `adapter_kind`.

## Remote A2A Policy

Remote A2A is separate from Adapter. It should be proposed only when the requirement indicates an independent remote agent boundary with its own owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details. Multi-step workflow alone is not enough to create Remote A2A.

## Development

```bash
cd packages/web
npm install
npm run build
```

The web package build runs `tsc --noEmit && vite build`.
