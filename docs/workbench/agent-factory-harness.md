# Agent Factory Harness

This document is the project-specific operating harness for Agent Factory work. It is separate from the user-level global development constitution and applies only inside this repository.

## Purpose

Agent Factory should turn vague requirements into reviewed, reusable planning artifacts before any implementation step begins.
The preferred operating path is skill-led: `.agents/skills/af-analyze-requirement`, `af-design-boundaries`, `af-build-runtime-stub`, and `af-verify-feedback` produce and verify schema artifacts, while the web workbench visualizes and supports guided partial edits.

The goal is repeatable agent design review, not one-off code generation. Coding agents working in this repository must preserve a controlled pipeline:

```text
raw requirement
  -> af-analyze-requirement
  -> normalized requirement
  -> evidence and missing-information review
  -> module candidates
  -> workflow/process flow
  -> af-design-boundaries
  -> runtime contract review for callback, legacy, Context Manager, and async resume behavior
  -> catalog reuse and registration review
  -> reviewed catalog and Graph IR decisions
  -> approved scaffold-plan and ADK Runtime Handoff
  -> af-build-runtime-stub
  -> af-verify-feedback
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

Before building implementation plans, classify each requested capability into the active taxonomy. For skill-led runs, `af-analyze-requirement` creates first-pass candidates and `af-design-boundaries` performs the review/approval pass.

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

ADK Runtime Handoff is part of the current workbench, but it is review-gated. Scaffold-plan generation and source handoff must consume only approved artifacts:

- reviewed `AnalysisResult`
- approved module candidates
- approved required runtime contracts in `AnalysisResult.runtimeContracts`
- reviewed A2A contracts where Remote A2A is involved
- reviewed catalog decisions
- `scaffold-plan` data with `source: approved_workbench_artifact`

Do not scaffold directly from:

- raw user requests
- unreviewed analyzer output
- incomplete module candidates
- missing Remote A2A contract details
- private or organization-specific runtime assumptions

A scaffold plan should make boundaries explicit before code exists. Generated source remains a TODO/runtime wiring handoff unless a separate task explicitly approves runnable business logic. It must not include private banking endpoints, credentials, deployment scripts, or organization-specific runtime code. The default stub output location for skill-led runs is `artifacts/af/<req-id>/runtime-stub/`.

### Missing-information two-layer gate

Triage of missing information after analysis follows a two-layer rule.

- Requirement-level `evidence.missing_information` is a soft gate. AnalysisResult exposes a per-row "수용" toggle that writes to `acceptedMissing`. This is reviewer attestation only and does not block scaffold-plan generation. The accepted set is preserved in `SavedAnalysisRecord` and surfaced in the ADK Runtime Handoff header as a "요구사항 누락 수용 N건" chip.
- Candidate-level `ModuleCandidate.missing_information` and unresolved `status === "needs_info"` are hard gates. A candidate cannot transition to `approved` until its Resolution Draft has been reviewed and applied.
- Module Review generates the Resolution Draft per candidate through the LLM endpoint. The draft is not applied automatically; the reviewer inspects the missing-item answers, expandable input/output object schemas, patch preview, and smoke contract before pressing `반영 적용`.
- `반영 적용` copies the current `missing_information` array into `resolved_missing_information`, clears `missing_information`, stores the reviewer note in `missing_information_resolution`, records `resolution_applied_at`, marks `schema_review_state: applied`, and stores `smoke_spec`. The reviewer then uses `검토 승인` or the status select to set `approved`.
- `buildScaffoldPlan` surfaces unresolved candidates as an actionable blocker ("정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.") and appends "정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요" to warnings.

The ADK Runtime Handoff screen renders an empty-state panel with a `모듈 검토로 이동` deep link whenever `can_generate_source` is false or Graph IR errors are present.

### Artifact root persistence

There is no in-browser save record any more. The artifact root directory `artifacts/af/<req-id>/` is the single store: `af-run-manifest.json` (stage status + approval gates + last validation result), `analysis-result.json` plus its split conveniences, `commonization-notes.json`, `boundary-design.md`, `a2a-contracts.json`, `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`, `validation-report.md`, `catalog-delta.yaml`, and `collaboration/{comments,highlights}.json`. The workbench reads and writes those paths through `/api/af/*` and `/api/af-collab/*`; `localStorage` only caches the recent-artifact-root list and the comment-composer author identity.

Saved-analysis fixtures under `templates/saved-analysis-fixtures/` are now only consumed by `scripts/validate-artifacts.mjs` regression smoke. They should still mirror the canonical `analysis-result.json` shape.

### Graph IR regeneration from Module Review

Module Review regeneration preserves reviewed edge metadata from the previous Graph IR when it can map edge endpoints back to active module candidates. If the previous graph contains only partial edges, regeneration must not leave active module candidates isolated. The workbench adds fallback `event_output` edges in module review order for candidates that lack incoming or outgoing connections, while `rejected` candidates remain excluded.

Graph IR validation treats any module-bound node without at least one incoming edge and one outgoing edge as an error. A graph that merely renders disconnected nodes is not scaffold-ready.

### Catalog contract registry

Catalog entries remain runtime contracts. For local smoke, a seed contract may include deterministic synthetic `runtime_mock` output that is carried into generated ADK source as a test double. Rich MCP/A2A contract bodies are still driven by registry files under `catalog/contracts/`.

- MCP registry files define the `mcp_schema_ref` contract body: `inputSchema`, `outputSchema`, success/error examples, and a deterministic `mock_response.structuredContent`.
- A2A registry files define Agent Card, supported interfaces, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy, and synthetic task examples.

The registry must use synthetic data only. Do not add private banking endpoints, credentials, deployment scripts, or real customer data.

### Smoke 일괄 실행 매크로 and stub banner

The Runtime Handoff screen ships a `Smoke 일괄 실행` macro that runs `generate → install → start-web → check-web → chat-smoke` sequentially, surfacing per-step pass/fail pills and halting on the first failure. Individual buttons stay available for debugging.

Chat smoke requires an approved module `smoke_spec` from Module Review. If source generation is ready but no smoke contract is ready, source/install/web actions remain available, while `chat-smoke` and the smoke macro stay disabled and link back to Module Review.

When `runtimeMode === "stub"` or any returned event carries `"stubbed_runtime_contract"`, the embed panel shows a yellow stub-runtime banner so reviewers do not mistake stub output for real business logic.

## Workbench surface

The workbench is a router-driven, artifact-root-first React app (`packages/web/src/routes/router.tsx`) — skill-scoped routes: `/` Landing, `/af/:reqId/analyze`, `/af/:reqId/design`, `/af/:reqId/build`, `/af/:reqId/verify`, `/catalog` Reuse Hub. State sits on `@tanstack/react-query`; `manifest.approvals.*` from `af-run-manifest.json` is the single source of truth for gate UI. All reads/writes go through Vite middleware (`/api/af/*`, `/api/af-collab/*`, `/api/catalog`) against `artifacts/af/<req-id>/` on the local file system. There is no in-browser analyzer or fallback path — analysis is produced by the `af-analyze-requirement` skill (or an equivalent producer) and imported through Landing or the per-stage import button.

Active stages:
- Landing creates `artifacts/af/<req-id>/` plus an empty `af-run-manifest.json`, or imports `analysis-result.json`.
- `/af/:reqId/analyze` renders the imported analysis through the existing `AnalysisResult` component and toggles `analysis_reviewed`.
- `/af/:reqId/design` mounts a 3-pane Design workbench (left tabs `모듈 / Graph IR / Comments`, center `GraphCanvas`, right inspector with node/edge-anchored comment thread). The `boundaries_approved` gate enables only when `analysis_reviewed === true`, every module candidate is `status === "approved"`, and Graph IR validation errors are zero. `runtime_contracts_approved` is currently flipped via direct manifest PATCH until a dedicated contract review UI ships.
- `/af/:reqId/build` mounts a BuildWorkbench that derives a scaffold-plan client-side from the analysis + seed catalog, PUTs it to `scaffold-plan.json`, then POSTs `runtime-stub/build` to spawn `scripts/generate-adk-source.mjs` against the artifact root. Generated files are listed and previewed (text only, < 500KB). `implementation-handoff.md` is edited inline. The `stub_ready_for_followup` toggle is reviewer-driven and gated on the stub directory being non-empty.
- `/af/:reqId/verify` mounts a VerifyWorkbench that runs a hard-coded allow-list of three commands (`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) via child_process, captures stdout/stderr, and writes `manifest.validation.{commands,last_result}`. `validation-report.md` and `catalog-delta.yaml` are edited inline; **catalog/*.yaml is never edited directly** — only the per-run `catalog-delta.yaml` proposal.
- `/catalog` mounts a Reuse Hub that surfaces the catalog YAML index (`GET /api/catalog`) as searchable category-tabbed cards. Two write paths exist, both targeting the active artifact root (selected via dropdown or `?req=` query param):
  * "현재 root 에 핀" opens a dialog listing the root's module candidates filtered to the same `module_category` as the catalog entry; on save the workbench PUTs `analysis-result.json` with `catalog_entry_id`, `reuse_candidate=true`, the catalog name, and (when the candidate has empty I/O) the catalog's inputs/outputs.
  * "신규 등록 제안" opens a drawer that appends a `proposed_additions[]` entry to the root's `catalog-delta.yaml`. The Reuse Hub never writes to `catalog/*.yaml` — that remains a manual reviewer merge from the delta proposal.

Stage status mirroring: when `PATCH /api/af/:id/manifest/approvals` flips an approval, the server also marks the matching `stages.<stage>.status = "complete"` (analyze ↔ `analysis_reviewed`, design ↔ `boundaries_approved && runtime_contracts_approved`, build ↔ `stub_ready_for_followup`). `scripts/generate-adk-source.mjs` reads `stages.design.status === "complete"` as a hard precondition, so the design gate must be flipped before runtime-stub generation will succeed.

Collaboration layer (`/api/af-collab/:reqId/{comments,highlights}`) writes `artifacts/af/<req-id>/collaboration/{comments,highlights}.json`. Comments are entry-anchored (`node` / `edge` / `container` / `path` / `section`), keyed by `created_at` order on disk, with `merge=union` configured in `.gitattributes` to keep PR diffs clean. Author identity is held in `localStorage(agent-factory:author-name|role)` only — there is no auth, and comments must never carry secrets, real customer data, or private endpoints. Highlights follow the same shape (`path` / `node_group` / `edge_group` / `container_focus`) but the canvas-overlay rendering is deferred to a follow-up; the current shell ships only persistence and CRUD.

When adding a stage workbench, do not bypass approval gates derived from the manifest, do not invent new artifact files outside the write whitelist in `packages/web/server/artifactRootStore.ts`, and do not persist stage state to `localStorage` — `localStorage` is reserved for the recent-artifact-roots cache and the author-identity preferences only.

## Required artifact posture

For Agent Factory work, produce or preserve reviewable artifacts rather than only code.

Expected artifact families:

- normalized requirements
- evidence and assumptions
- missing-information records
- module candidates with category and subtype
- process flow nodes and edges
- runtime contracts for MCP/EAI/Legacy adapters, Context Manager, Callback Broker, ADK callback, and async resume when applicable
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
- produce `artifacts/af/<req-id>/` skill artifacts and `af-run-manifest.json`
- propose `catalog-delta.yaml` feedback without directly editing runtime catalogs

Human-governed decisions:

- final architecture classification
- high-risk automation approval
- Remote A2A dependency approval
- customer-impacting or money-impacting behavior
- compliance-sensitive decision rules
- private deployment/runtime integration

## Repository source-of-truth boundaries

Active source-of-truth areas:

- `.agents/skills`: AF DLC operating skills and shared stage references
- `packages/web`: live workbench UI, artifact visualization, guided edits, and analyzer flow
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
