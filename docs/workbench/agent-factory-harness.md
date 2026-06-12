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

When a change alters a design decision (interface, schema, gate, or UX contract), also append an entry to `docs/decision-log.md` (date · PR · decision · rationale · impact). The decision log records history only; behavior specs stay in the active docs.

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

A scaffold plan should make boundaries explicit before code exists. Generated source defaults to a TODO/runtime-wiring smoke handoff. A reviewed `output_mode: runnable` scaffold plan (this approved capability) instead emits a runnable ADK 2.1 `Workflow` graph — `LlmAgent` nodes calling Gemini and adapter nodes calling synthetic Mock Lab MCP servers — but it is still generated only from approved workbench artifacts (`raw_requirement_to_code` stays `false`), never from raw requirements. In either mode it must not include private banking endpoints, credentials, deployment scripts, real customer data, or organization-specific runtime code. The default stub output location for skill-led runs is `artifacts/af/<req-id>/runtime-stub/`.

### Missing-information two-layer gate

Triage of missing information after analysis follows a two-layer rule.

- Requirement-level `evidence.missing_information` is a soft gate. `/af/:reqId/analyze` (AnalyzeWorkbench) exposes a per-row "수용" toggle persisted to `evidence.accepted_missing_information` in `analysis-result.json` (the artifact root is the canonical store, so acceptance survives reloads). This is reviewer attestation only and does not block scaffold-plan generation; the `analysis_reviewed` approval becomes enable-able once every item is accepted.
- Candidate-level `ModuleCandidate.missing_information` and unresolved `status === "needs_info"` are hard gates. In `/af/:reqId/design`, candidates are approved in the 하단 `모듈` 탭: each missing item must be resolved, optionally with a reviewer note, before the `승인` action becomes available.
- Applied state copies resolved items into `resolved_missing_information`, clears `missing_information`, stores the reviewer note or default resolution in `missing_information_resolution`, records `resolution_applied_at`, marks `schema_review_state: applied`, and stores `smoke_spec`. Candidate `status` is then set to `approved`, and matching Graph IR node `review_status` values mirror the candidate status so DesignWorkbench can flip `boundaries_approved`.
- `buildScaffoldPlan` (called from BuildWorkbench) surfaces unresolved candidates as an actionable blocker ("정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.") and appends "정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요" to warnings.

BuildWorkbench refuses to spawn `scripts/generate-adk-source.mjs` while these blockers remain — the operator must update the analysis artifact, typically by applying a reviewed Design Stage Runner proposal, before retrying.

### Artifact root persistence

There is no in-browser save record any more. The artifact root directory `artifacts/af/<req-id>/` is the single store: `af-run-manifest.json` (stage status + approval gates + last validation result), `analysis-result.json` plus its split conveniences, `commonization-notes.json`, `boundary-design.md`, `a2a-contracts.json`, `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`, `validation-report.md`, `catalog-delta.yaml`, and `collaboration/{comments,highlights}.json`. The workbench reads and writes those paths through `/api/af/*` and `/api/af-collab/*`; `localStorage` only caches the recent-artifact-root list and the comment-composer author identity. The `artifacts/` tree is local-only and ignored by Git, including generated runtime bundles and per-run `catalog-delta.yaml` proposals.

Saved-analysis fixtures under `templates/saved-analysis-fixtures/` are now only consumed by `scripts/validate-artifacts.mjs` regression smoke. They should still mirror the canonical `analysis-result.json` shape.

### Graph IR regeneration from module review

When the module review surface (currently the DesignWorkbench module tab plus any upstream `af-design-boundaries` run) regenerates Graph IR, it preserves reviewed edge metadata from the previous Graph IR whenever edge endpoints can be mapped back to active module candidates. If the previous graph contains only partial edges, regeneration must not leave active module candidates isolated. The workbench adds fallback `event_output` edges in module review order for candidates that lack incoming or outgoing connections, while `rejected` candidates remain excluded.

Graph IR validation treats any module-bound node without at least one incoming edge and one outgoing edge as an error. A graph that merely renders disconnected nodes is not scaffold-ready.

### Catalog contract registry

Catalog entries remain runtime contracts. Canonical seed catalog files under `catalog/` stay versioned because the workbench and Mock Lab read them as source inputs. Generated catalog proposals must stay under ignored artifact roots such as `artifacts/af/<req-id>/catalog-delta.yaml`; they are not written back into `catalog/*.yaml` by Workbench generation. For local smoke, a seed contract may include deterministic synthetic `runtime_mock` output that is carried into generated ADK source as a test double. Rich MCP/A2A contract bodies are still driven by registry files under `catalog/contracts/`.

- MCP registry files define the `mcp_schema_ref` contract body: `inputSchema`, `outputSchema`, success/error examples, and a deterministic `mock_response.structuredContent`.
- A2A registry files define Agent Card, supported interfaces, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy, and synthetic task examples.

The registry must use synthetic data only. Do not add private banking endpoints, credentials, deployment scripts, or real customer data.

### Runtime stub smoke bridge

The pre-PR6 Runtime Handoff screen used to ship a `Smoke 일괄 실행` macro (`generate → install → start-web → check-web → chat-smoke`) plus an in-iframe `adk web` embedding. Do not reintroduce that macro or iframe surface. PR6 split the flow into BuildWorkbench (`/af/:reqId/build`) and VerifyWorkbench (`/af/:reqId/verify`), and VerifyWorkbench still only runs the fixed `validate-artifacts.mjs` / `npm run build` / `npm run test:analyzer` allow-list.

The ADK runtime connection bridge now lives on the gate-less `실행` screen (`/af/:reqId/run`, `RunSandbox`), not BuildWorkbench. After `runtime-stub/` exists it installs dependencies only into `runtime-stub/.venv`, starts local `adk api_server --with_ui` on the runtime-smoke port (8765), records the launched PID under the stub's local `.adk/` runtime registry so a Workbench restart can re-adopt/stop the same process, and **links to ADK's own official dev UI (`web_url`) — it does not re-implement chat.** Because `--with_ui` already serves ADK's polished chat/session/event/trace UI, the previous AF home-grown chat (client session/message hooks + transcript surface) was removed; the screen surfaces install/start/stop + status and an "ADK 웹 UI 열기" link (a new browser tab, never an iframe embed). The generated app runs over synthetic inputs only: in smoke mode it surfaces reviewed `runtime_mock` test doubles and TODO metadata; in `runnable` mode it executes a real ADK `Workflow` (Gemini `LlmAgent` nodes plus synthetic Mock Lab MCP adapters). In both modes it must not include private endpoints, credentials, deployment scripts, or real customer data.

## Workbench surface

The workbench is a router-driven, artifact-root-first React app (`packages/web/src/routes/router.tsx`) — skill-scoped routes: `/` Landing, `/af/:reqId/analyze`, `/af/:reqId/design`, `/af/:reqId/build`, `/af/:reqId/verify`, the gate-less tool route `/af/:reqId/run` (ADK runtime), `/catalog` Reuse Hub, and `/mock-lab` Adapter runtime lab. The four skill stages render through the shared `StageShell` (left step rail 실행·검토·승인, always-visible summary strip, "다음에 할 일" guide, next-action CTA); the active step is a shallow `?step=` query param and never recomputes the gates. `실행` and `Mock Lab` are auxiliary nav entries only — they are **not** in `afRunStageIds` (which defines the manifest stage schema and the four gate chips). State sits on `@tanstack/react-query`; `manifest.approvals.*` from `af-run-manifest.json` is the single source of truth for gate UI. All reads/writes go through Vite middleware (`/api/af/*`, `/api/af-collab/*`, `/api/catalog`, `/api/mock-lab/*`) against local `artifacts/` on the file system. Analyze and Design now start from Stage Runner panels that call `/api/af/:reqId/stages/:stage/run`; the server runs Codex through the `@openai/codex-sdk` TypeScript SDK with workspace-write sandboxing, approval policy `never`, and network access disabled. Run outputs are proposed artifacts first and canonical files change only after explicit diff/preview apply. Browser import of an `analysis-result.json` produced by `af-analyze-requirement` or an equivalent producer remains valid.

Active stages:
- Landing creates `artifacts/af/<req-id>/` plus an empty `af-run-manifest.json`, or imports `analysis-result.json`.
- `/af/:reqId/analyze` accepts raw requirement text and seed catalog payload for the `af-analyze-requirement` Stage Runner, supports `analysis-result.json` import, renders the applied analysis through the existing `AnalysisResult` component, and toggles `analysis_reviewed`.
- `/af/:reqId/design` runs `af-design-boundaries` only when `analysis_reviewed === true`, then mounts the Design workbench with module review, Graph IR, Runtime contract review, and comments. The review step is currently 2-pane (left selection/editor panel + a wide graph canvas) with a bottom tab strip; the `모듈` tab resolves candidate missing-information items, approves/defers/rejects candidates, and mirrors status to matching Graph IR node `review_status`. The right Inspector pane (contract editing + anchored-comment composing) is parked via `INSPECTOR_ENABLED=false` to give the graph full width — the sidebar tabs still list/select and the gates still toggle. The Graph canvas exposes an explicit edit mode for reviewed Graph IR shape edits: node/edge add, selected delete, handle or sequential-click edge creation, dragged node positions persisted as optional `node.position`, and selected node/edge field editing in the left panel. New local nodes default into the root `graph_workflow`/`dynamic_workflow` container and update its `contains_node_ids`; `remote_a2a` nodes stay outside that local root by default. Saving edit mode updates only `analysis-result.json.processFlow`; it must not auto-toggle `manifest.approvals.*`. Graph IR soft validation includes `node_missing_module_id` for `agent`/`workflow`/`adapter`/`remote_a2a` nodes without `module_id`. The `boundaries_approved` gate enables only when every module candidate is `status === "approved"` and Graph IR validation errors are zero; the review next-action hint enumerates only the unmet conditions such as 미승인 모듈, Graph IR errors, or Runtime/A2A readiness issues. `runtime_contracts_approved` is reviewer-driven from the Runtime contract readiness UI and still stored only in `manifest.approvals.*`.
- `/af/:reqId/build` mounts a BuildWorkbench that derives a scaffold-plan client-side from the analysis + seed catalog, lets the reviewer explicitly bind adapter modules to running Mock Lab MCP tools in runnable mode, PUTs the plan to `scaffold-plan.json`, then POSTs `runtime-stub/build` to spawn `scripts/generate-adk-source.mjs` against the artifact root. Generated files are listed and previewed (text only, < 500KB). `implementation-handoff.md` is edited inline. The `stub_ready_for_followup` toggle is reviewer-driven and gated on the stub directory being non-empty. ADK runtime connection + the dev-UI link live on the separate gate-less `실행` screen (see "Runtime stub smoke bridge"), not on BuildWorkbench.
- `/af/:reqId/run` mounts `RunSandbox`, a gate-less tool screen. After `runtime-stub/` exists it installs ADK dependencies into `runtime-stub/.venv`, starts/stops `adk api_server --with_ui` (8765), re-adopts the recorded runtime PID when the Workbench process restarts, polls status, and links to ADK's official dev UI (`web_url`) in a new tab. No approval gate, no AF home-grown chat.
- `/af/:reqId/verify` mounts a VerifyWorkbench that runs a hard-coded allow-list of three commands (`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) via child_process, captures stdout/stderr, and writes `manifest.validation.{commands,last_result}`. `validation-report.md` and `catalog-delta.yaml` are edited inline; **catalog/*.yaml is never edited directly** — only the per-run `catalog-delta.yaml` proposal.
- `/catalog` mounts a Reuse Hub that surfaces the catalog YAML index (`GET /api/catalog`) as searchable category-tabbed cards. Two write paths exist, both targeting the active artifact root (selected via dropdown or `?req=` query param):
  * "현재 root 에 핀" opens a dialog listing the root's module candidates filtered to the same `module_category` as the catalog entry; on save the workbench PUTs `analysis-result.json` with `catalog_entry_id`, `reuse_candidate=true`, the catalog name, and (when the candidate has empty I/O) the catalog's inputs/outputs.
  * "신규 등록 제안" opens a drawer that appends a `proposed_additions[]` entry to the root's `catalog-delta.yaml`. The Reuse Hub never writes to `catalog/*.yaml` — that remains a manual reviewer merge from the delta proposal.
  * Adapter cards link to `/mock-lab?adapter=<catalog-name>&req=<reqId>` so runtime mock work starts from the selected catalog contract without moving Reuse Hub's catalog-governance responsibility into Mock Lab.
- `/mock-lab` mounts the Mock Lab UI inside the same Workbench shell. It owns Adapter MCP mock spec editing, Codex generation/apply, server start/stop/status, smoke helpers, audit log, and network MCP discovery under `/api/mock-lab/*`. The standalone `packages/mock-lab` 5176 app remains available for package-local development only.

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

Stage Runner pipeline note: Analyze/Design runs write `runs/<stage>/<run-id>/request.json`, `events.jsonl`, `result-summary.json`, `diff-summary.json`, proposed artifacts, and failure diagnostics. `af-run-manifest.json.stage_runs` is optional execution metadata and never replaces `manifest.approvals.*`. Proposed `analysis-result.json` files are validated with `validateAnalysisResult`; apply is blocked on validation failure or canonical ETag conflict. The legacy `/api/analyze-requirement` compact-draft analyzer remains available as an internal/direct primitive, but reviewable Stage Runner output is the default workbench path.

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
