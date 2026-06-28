# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Scope

This is the Agent Factory workbench — a local-first, skill-led tool that turns raw requirements into reviewed planning artifacts and a review-gated ADK Runtime Handoff. It is **not** a banking deployment and must never contain private endpoints, credentials, deployment scripts, or organization-specific runtime code. Raw requirements never drive code generation; only approved scaffold-plan data from reviewed artifacts may feed the runtime handoff.

`AGENTS.md` is the model-facing source of truth for working rules and overrides anything inferred from code structure alone. Read it before non-trivial edits.

For Agent Factory-specific harness rules, also read `docs/workbench/agent-factory-harness.md` before analysis, taxonomy, scaffold, Stage Runner, or review-board work.

Before source-code edits, check whether the change affects active `docs/` Markdown. Taxonomy, catalog semantics, schemas, analyzer behavior, workflow/Graph IR rules, validation commands, UI behavior, and operating policy changes must update the relevant docs in the same change set. When a change alters a design decision (interface, schema, gate, or UX contract), also append an entry to `docs/decision-log.md` (date · PR · decision · rationale · impact). Leave `docs/archive/**` untouched unless the task explicitly asks for archival or migration work.

## Common Commands

The web package is the only buildable artifact. All commands run from `packages/web` unless noted.

```bash
cd packages/web
npm install              # first-time or after dep changes
npm run build            # tsc --noEmit && vite build — REQUIRED verification step
npm run dev              # Vite dev server
npm run preview          # preview built bundle
```

Artifact validator (lightweight, dependency-free, run from repo root):

```bash
node scripts/validate-artifacts.mjs                       # smoke-checks templates/
node scripts/validate-artifacts.mjs path/to/artifacts     # check exported artifacts
```

The validator enforces taxonomy, subtype presence, Remote A2A contract completeness, Stage Runner manifest metadata, and the scaffold guard that raw requirements cannot generate code. After any TypeScript, React, analyzer, Stage Runner, or handoff change, run `npm run build` in `packages/web` — work is not complete without that observable verification.

## Architecture

### Agent Factory harness

`docs/workbench/agent-factory-harness.md` is the project-specific operating harness for this repository. Apply it before non-trivial analysis, taxonomy, scaffold, Stage Runner, handoff, or review-board work.

Core rules:

- Raw requirements must become reviewed artifacts before implementation or scaffolding.
- Classify first: `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Retrieval, rule registry, and tool/adapter concepts remain adapter subtypes, not top-level categories.
- Remote A2A is high-friction and requires explicit ownership, protocol, auth, lifecycle, timeout, retry, fallback, and audit details.
- ADK Runtime Handoff must consume approved scaffold-plan data, never raw requests or unreviewed analyzer output.
- Preserve reviewable artifacts: normalized requirements, evidence, missing-information records, module candidates, process flow, reuse/domain mapping, risk gates, validation output, and decision notes.
- Preserve runtime contract review artifacts for MCP/EAI/Legacy adapters, Context Manager, Callback Broker, ADK callback, and async resume behavior when those boundaries are involved.

### Workbench flow (packages/web)

The workbench is a router-driven, artifact-root-first React app. `App.tsx` mounts `AppRouter` (`src/routes/router.tsx`) inside `BrowserRouter` + `QueryClientProvider`. All routes are skill-scoped and read/write the local file system via Vite middleware under `packages/web/server`. The four skill stages render through the shared `StageShell` (`src/layout/StageShell.tsx`): a left step rail splits each stage into 실행→검토→승인 (Verify has no gate, so 실행→기록), only the active step's content shows, the active step is a shallow `?step=` query param (`useStageStep`, lands on the first incomplete step), and step status is derived read-only from `manifest.approvals.*` + artifact presence — never recomputed into the gates.

- `/` Landing — list / create artifact roots (`POST /api/af`), import an `analysis-result.json` produced by the `af-analyze-requirement` skill.
- `/af/:reqId/analyze` — run `af-analyze-requirement` through the Stage Runner panel or import an existing `analysis-result.json`, review the resulting `AnalysisResult`, mark `missing_information` as accepted (persisted to `evidence.accepted_missing_information` so acceptance survives reloads), toggle `analysis_reviewed` on `af-run-manifest.json`.
- `/af/:reqId/design` — run `af-design-boundaries` through the Stage Runner panel, then use the Graph IR review. The review step is a top/bottom split (`af-design-split`): the **top** row is `[선택 노드/엣지 정보 패널 | wide canvas]` — outside edit mode the left panel shows the selected node/edge detail via the read-only `GraphInspector`; in the canvas `편집 모드` it switches to the editable `GraphElementEditor` (field-level node/edge editing, module-candidate link picker, and a grouped `데이터 전달 방식` edge_kind picker — 내부 event/state×4/artifact · 제어 route/control · 원격 A2A — that shows only the chosen kind's required field and reflects the mechanism into generated code). The canvas edit mode supports node add (default-assigned into the root `graph_workflow` container), selected delete, handle-drag or sequential-click edge creation, and node drag with positions persisted as optional `node.position`. The **bottom** full-width panel (`af-design-bottom`) holds the module(모듈) / Runtime 계약 / Remote A2A / 검토 메모 tabs (path highlights are a section inside the 검토 메모 tab, alongside comments); the `모듈` tab is the module review surface — resolve `missing_information` items per row (optional note), then 승인/보류/반려, with candidate status mirrored onto matching Graph IR node `review_status`. The separate right Inspector pane for contract editing / anchored-comment composing stays parked via `INSPECTOR_ENABLED=false` in `DesignWorkbench`; comments still persist under `collaboration/comments.json`. Toggles `boundaries_approved` when every module candidate is `status === "approved"` and Graph IR validation errors are zero (soft validation includes `node_missing_module_id` for module-kind nodes).
- `/af/:reqId/build` — derive `scaffold-plan.json` client-side from the analysis + the hydrated `/api/catalog` index (so approved/published catalog entries feed scaffolding), choose `output_mode` (smoke default / runnable) via the Scaffold plan toggle, spawn `scripts/generate-adk-source.mjs` to populate `runtime-stub/`, edit `implementation-handoff.md`, and toggle `stub_ready_for_followup`. Runnable mode emits a real ADK 2.x graph `Workflow` (Gemini `LlmAgent` nodes + Mock Lab MCP adapters) from the same approved artifacts; it also lowers parallel fan-out/`JoinNode` and `human_input` nodes (ADK 2.x `RequestInput` — paused at runtime via a long-running `adk_request_input` call, resumed with a matching `functionResponse`). Per-edge internal data passing is lowered for `session_state`/`temp_state`/`user_state`/`app_state` edges: the edge's `state_key` (a bare key — scope comes from `edge_kind`; the validator accepts bare and rejects only a conflicting prefix) becomes the producer's `output_key` (agent, single channel) or an extra `ctx.state[key]` mirror (function node) and the **connected-adapter** consumer's named read in `_collect_tool_inputs` (only connected MCP adapters auto-read named channels), falling back to the `{module_id}_output` convention when no channel is set; an agent with conflicting outgoing state keys — or a `state_key` written by more than one producer — is rejected. `artifact` edges lower via a function node's `save_artifact` (JSON `types.Part`) + the connected consumer's `load_artifact` (merged into `_collect_tool_inputs` via `extra_payloads`); agent-produced artifacts are rejected and agent-consumer named reads remain a follow-up. A `remote_a2a` node lowers to an ADK `RemoteA2aAgent` (agent card URL from the approved A2A contract resolved via `analysisResult.a2aContracts`; rejected if the contract is missing or has no `agent_card.agent_card_url`); `remote_a2a` edges may carry `boundary_crossing`, the `[a2a]` extra + `RemoteA2aAgent` import appear only when a remote node is present. Loop/router and dynamic graphs stay smoke-only (loops are an ADK dynamic-workflow follow-up). `raw_requirement_to_code` stays `false` in both modes. `templates/regression-scenarios/scenario-g-human-input-review` is the runnable human-in-the-loop example; `scenario-i-remote-a2a` is the runnable remote-A2A example (with a local mock A2A server under `mock_remote/`).
- `/af/:reqId/verify` — run an allow-list of three commands (`validate-artifacts.mjs`, `npm run build`, `npm run test:analyzer`), edit `validation-report.md` and `catalog-delta.yaml`. No approval gate.
- `/af/:reqId/run` — gate-less ADK runtime tool screen (`RunSandbox`). After `runtime-stub/` exists, use the shared ADK venv (`.agent-factory/runtime/.venv`, or `AF_ADK_VENV_DIR`) to start/stop `adk api_server --with_ui` (8765), and open ADK's official dev UI (`web_url`) in a new tab. The web UI does not install Python dependencies; prepare the venv manually from `requirements/adk-runtime.txt`. The AF home-grown chat was removed (ADK's `--with_ui` already serves a full chat/trace UI); this route is an auxiliary nav entry and is **not** part of `afRunStageIds` or the gate model.
- `/catalog` — Reuse Hub: search Agent/Workflow/Adapter/Remote A2A catalog cards, pin one to a candidate in the active root (`PUT analysis-result.json`), propose a new entry by appending to `catalog-delta.yaml`, or publish approved proposals through the approval-gated `POST /api/catalog/publish` flow. `catalog/*.yaml` is never edited directly; this publish API is the only app write path.

Analyze and Design use the common Stage Runner API under `/api/af/:reqId/stages/:stage/*`. Runs write evidence under `artifacts/af/<req-id>/runs/<stage>/<run-id>/`, save proposed artifacts first, and require explicit diff/preview apply before canonical artifacts change. `manifest.stage_runs` is optional execution metadata; approval gates remain `manifest.approvals.*`.

State sits on top of `@tanstack/react-query`. Manifest, analysis-result, catalog, collaboration, scaffold-plan, and runtime-stub data are fetched/mutated through `packages/web/src/state/*` hooks (`useArtifactRoot`, `useAnalysisArtifact`, `useApprovalGate`, `useCollaboration`, `useCatalog`, `useCatalogPublish`, `useScaffoldPlan`, `useTextArtifact`, `useVerify`, `useRecentRoots`). `manifest.approvals.*` is the single source of truth for gate UI; the server mirrors approval state onto `stages.<stage>.status` so external tooling (`scripts/generate-adk-source.mjs`) reads a consistent stage progression. Do not rebuild gate state from derived candidate status.

`localStorage` is reserved for two read-only caches: `agent-factory:recent-artifact-roots` and `agent-factory:author-{name,role}` for the comment composer. No stage state is persisted to `localStorage` — the artifact root is the canonical store.

`AnalysisResult.runtimeContracts` carries the review artifact for callback/runtime-support boundaries: MCP/EAI/Legacy adapter contracts, Context Manager, Callback Broker, ADK callback, and async resume. DesignWorkbench exposes a Runtime contract sidebar tab with readiness details (the inline contract-editing inspector is currently parked with `INSPECTOR_ENABLED=false`; contract changes land via Stage Runner proposals or external editing) and keeps `runtime_contracts_approved` as a reviewer-driven manifest gate; Stage Runner output never toggles it automatically.

### Analyzer pipeline

`packages/web/server/stageRunner.ts` is the Analyze/Design execution contract. It creates sortable run ids, writes `request.json`, `events.jsonl`, `result-summary.json`, `diff-summary.json`, `proposed-artifacts/*`, and optional `diagnostics.md`, then updates optional `manifest.stage_runs`. The legacy `/api/analyze-requirement` analyzer endpoint remains available as an internal/direct analysis primitive, but Stage Runner apply is the path that preserves diff-before-canonical behavior.

### Taxonomy contract (load-bearing)

Top-level `module_category`: `agent`, `workflow`, `adapter`, `remote_a2a`.

Workflow `workflow_kind`: `orchestration`, `graph`, `dynamic`, `unknown`.

Adapter `adapter_kind`: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, `unknown`.

Rules baked into the schemas, validator, and analyzer:

- ADK runtime baseline: ADK 2.0. ADK Python 2.0 is GA as of May 19, 2026. `graph` and `dynamic` represent 2.0 graph and dynamic workflows respectively. Sequence, fan-out/fan-in, loop, and human input are Graph IR details, not `workflow_kind` values.
- Tool/Adapter, Knowledge Retrieval, and Metadata Registry are **no longer** top-level categories. Retrieval and rule registries appear only as `adapter_kind` subtypes.
- `legacy_recommended_type` is migration metadata; never use it as the primary classifier.
- Remote A2A is high-friction. It requires `risk_level: high` and full contract fields (`owner`, `agent_card`, `auth`, `task_lifecycle`, `timeout`, `retry`, `fallback`, `audit`). Multi-step local workflow alone is **not** enough to propose it.
- Each `module_category` must carry its matching subtype (`agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`).

The enums in `src/analyzer/types.ts`, the JSON Schemas in `schemas/`, and the validator constants in `scripts/validate-artifacts.mjs` must stay aligned. Changing one without the others will break exports.

### Schemas, catalog, templates

- `schemas/`: JSON Schemas for normalized requirement, module candidate, process flow, classification, commonization, and scaffold plan.
- `catalog/`: YAML catalogs for reusable agents, workflows, adapters, Remote A2A runtime contracts, domain owners, and risk gates. Catalog entries are runtime-oriented contracts and may include deterministic synthetic `runtime_mock` payloads for local smoke only; they must not include private data, endpoints, credentials, deployment scripts, or real business logic. Risk signals on candidates should align with `catalog/risk-gates.yaml`.
- `templates/`: artifact templates the validator smoke-checks by default, plus `scaffold-plan.template.json`.

### Missing-information gate & saved-analysis flow

Aligned with `AGENTS.md` and `docs/workbench/agent-factory-harness.md`. Apply these whenever touching analysis import, scaffold-plan validation, or approval gate logic.

- **Two-layer missing-info gate.** Requirement-level `evidence.missing_information` is a **soft** gate — `AnalyzeWorkbench` exposes a per-row "수용" toggle and only enables `analysis_reviewed` once every item is accepted (acceptance is persisted to `evidence.accepted_missing_information` in `analysis-result.json` so it survives reloads; the gate fires immediately on each toggle save). Candidate-level `ModuleCandidate.missing_information` plus unresolved `status === "needs_info"` is a **hard** gate — `scaffoldPlan.collectBlockers` keeps the scaffold-plan unbuildable until the producer (skill or external editor) clears them.
- **Scaffold-plan messaging.** `scaffoldPlan.collectBlockers` emits the actionable Korean blocker `정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.` while unresolved candidates remain. Warnings include `정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요`. `BuildWorkbench` renders these inline and refuses to spawn `generate-adk-source.mjs` until `can_generate_source` flips to true.
- **Stage status mirroring.** `PATCH /api/af/:id/manifest/approvals` writes both the approval boolean and the matching `stages.<stage>.status = "complete"` (analyze ↔ `analysis_reviewed`, design ↔ `boundaries_approved && runtime_contracts_approved`, build ↔ `stub_ready_for_followup`). External scripts read stage status, not just approvals.
- **Catalog feedback and publish are approval-gated.** `catalog/*.yaml` is never edited directly; the approval-gated `POST /api/catalog/publish` path in Reuse Hub `등록 승인` is the only app write path, publishing versioned entries from active-root `catalog-delta.yaml` proposals. Human PR merge remains valid for bulk or seed changes.

### UI design system

`docs/visualization/design-system.md` is the authoritative spec for the web workbench UI: category color tokens, glyph mapping, shared components, Graph IR visualization, and CSS pitfalls. Read it before changing anything visual.

Key contracts:

- **Single source of truth for category visuals** — `packages/web/src/components/CategoryBadge.tsx` exports `CategoryBadge`, `SubtypeBadge`, `getSubtypeValue`, `categoryClass`. Never write category labels as raw `<span>` in a new view; import these instead so Module Review, Graph IR, Catalog, and A2A Contract Review stay in sync.
- **Design tokens** — `:root` in `packages/web/src/styles/tokens.css` is the single source for color (`--cat-{agent,workflow,adapter,remote}-{base,soft,line}` plus `input` / `output`, chrome palette), the type scale (`--fs-*`), spacing (`--space-*`), weight (`--fw-*`), radius, and `--z-overlay`. New categories must add all three color variants together. Stylesheets are split under `styles/` and composed through CSS cascade layers in `styles/index.css` (`@layer tokens, base, primitives, components, features, router, utilities`) — see `docs/visualization/design-system.md`.
- **Subtype glyphs** — `subtypeGlyph` map in `CategoryBadge.tsx` covers every value in `agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`. Any new enum value added in `analyzer/types.ts` must be mirrored here or it falls back to `·`.
- **Graph Workflow markers** — `GraphCanvas.tsx` renders Graph IR through `src/components/graph/*` (the rendering layer: `layout.ts`, `nodeTypes.tsx`, `edgeTypes.tsx`, `containerOverlay.tsx`, `validationBanner.tsx`); `src/graph/` keeps only the pure graph-IR engine helper (`containerMembership.ts`). Fan-out/fan-in, loop, human input, route, and Remote A2A are detected from `container_kind`, `node_kind`, `edge_kind`, and `execution_semantics`; update `layout.ts`, `nodeTypes.tsx`, `edgeTypes.tsx`, and `containerOverlay.tsx` together when adding a marker.

### CSS pitfall to remember

Broad descendant selectors like `.foo-table td span` will break newly added badges (the existing `.domain-map-table td span { display: block }` rule did this — it forced `.category-badge` into block layout and wrapped its text). Always scope table-/list-style rules to direct children (`>`).

### Screenshot-driven UI verification

For UI changes, run the dev server and verify visually with the chrome-devtools MCP — never claim a UI change is done without a screenshot. Standard loop:

```bash
cd packages/web
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Manual/browser testing must stay on the fixed Agent Factory port `5173`. Before starting or restarting, check `lsof -iTCP:5173 -sTCP:LISTEN`; stop a stale Agent Factory/Vite process if it owns the port, but report an unrelated owner as a blocker. Do not let Vite auto-increment to `5174` or another fallback port. Verify with `curl -I http://127.0.0.1:5173/` and report `http://127.0.0.1:5173/` as the testing URL.

Then in MCP or Playwright: drive route navigation / button clicks and save screenshots to a known path under `/tmp/af-screens/`. If a CSS edit doesn't appear after reload, force a fresh navigation. Smoke seeding pattern: `POST /api/af { requirement_id: "req-docs-smoke" }` then `PUT /api/af/req-docs-smoke/analysis-result.json` with a fixture from `templates/regression-scenarios/scenario-a-simple-local-specialist/`. After the smoke, delete the temporary artifact root under `artifacts/af/<id>/` so it doesn't pollute the repo.

## Editing Rules (from AGENTS.md)

- Keep changes scoped to the requested workbench behavior. No drive-by abstractions, configuration, or extensibility.
- Review documentation impact before source edits and keep active `docs/` Markdown current when behavior, taxonomy, catalog semantics, schemas, validation, or UI flow changes.
- Treat `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active source of truth.
- When the user asks to modify an artifact or generated ADK behavior, do not solve it by hard-coding domain terms, route aliases, product names, scenario names, or workflow-specific literals into `scripts/generate-adk-source.mjs` or another generator. First decide whether the Graph IR/scaffold-plan/schema can express the needed behavior; if not, add a reviewed generic contract field across schema/types/validator/UI/generator as needed, then update artifact data to use that field.
- Generator defaults must stay framework/runtime-neutral. Workflow-specific choices such as router labels, human choice aliases, adapter argument hints, prompt rules, and business terms belong in reviewed artifacts or catalog/mock specs, not in generator code.
- Edit `.agents/skills` only when the task explicitly asks for skill, DLC workflow, or skill-sync work.
- Preserve `legacy_recommended_type` migration data; do not promote it back into a primary classifier.
- The UI labels are in Korean (`App.tsx`, components). Preserve that when editing copy.
- Visual changes must follow `docs/visualization/design-system.md` and be verified with a chrome-devtools MCP screenshot before being reported as done.
- Worktree hygiene: when a worktree's branch lands (PR merged, or commits already on `main`), remove the worktree and delete its local branch (`git worktree remove` + `git branch -d`), and `git worktree prune` dead registrations. Verify merged + clean before deleting; keep and surface anything unmerged, and never remove the primary checkout. See AGENTS.md "Worktree Hygiene".
