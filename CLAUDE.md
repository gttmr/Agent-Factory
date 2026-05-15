# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Scope

This is the Agent Factory workbench — a local-first tool that turns raw requirements into reviewed planning artifacts and a review-gated ADK Runtime Handoff. It is **not** a banking deployment and must never contain private endpoints, credentials, deployment scripts, or organization-specific runtime code. Raw requirements never drive code generation; only approved scaffold-plan data from reviewed workbench artifacts may feed the runtime handoff.

`AGENTS.md` is the model-facing source of truth for working rules and overrides anything inferred from code structure alone. Read it before non-trivial edits.

For Agent Factory-specific harness rules, also read `docs/workbench/agent-factory-harness.md` before analysis, taxonomy, scaffold, export, or review-board work.

Before source-code edits, check whether the change affects active `docs/` Markdown. Taxonomy, catalog semantics, schemas, analyzer behavior, workflow/Graph IR rules, validation commands, UI behavior, and operating policy changes must update the relevant docs in the same change set. Leave `docs/archive/**` untouched unless the task explicitly asks for archival or migration work.

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

The validator enforces taxonomy, subtype presence, Remote A2A contract completeness, and the scaffold guard that raw requirements cannot generate code. After any TypeScript, React, analyzer, or export change, run `npm run build` in `packages/web` — work is not complete without that observable verification.

## Architecture

### Agent Factory harness

`docs/workbench/agent-factory-harness.md` is the project-specific operating harness for this repository. Apply it before non-trivial analysis, taxonomy, scaffold, export, or review-board work.

Core rules:

- Raw requirements must become reviewed artifacts before implementation or scaffolding.
- Classify first: `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Retrieval, rule registry, and tool/adapter concepts remain adapter subtypes, not top-level categories.
- Remote A2A is high-friction and requires explicit ownership, protocol, auth, lifecycle, timeout, retry, fallback, and audit details.
- ADK Runtime Handoff must consume approved scaffold-plan data, never raw requests or unreviewed analyzer output.
- Preserve reviewable artifacts: normalized requirements, evidence, missing-information records, module candidates, process flow, reuse/domain mapping, risk gates, validation output, and decision notes.

### Workbench flow (packages/web)

`App.tsx` is a single-page wizard backed by React state and local server middleware. There is no router; analyzer and ADK runtime actions call the Vite middleware under `packages/web/server`.

Current steps are defined in `packages/web/src/workbench/useWorkbenchState.ts`:

`intake → analysis → modules → graph → a2aContracts → catalog → saved → export`

State flows through `useWorkbenchState`: `RequirementIntakeInput` → live `AnalysisResult` (normalized requirement + evidence + module candidates + A2A contracts + Graph IR) → user-edited `ModuleCandidate[]` and `A2AContract[]` → catalog changes → review-gated `scaffoldPlan` and ADK runtime handoff. The user can mark missing-information items as accepted as part of review context, but source generation is gated by approved module status and scaffold-plan validation.

### Analyzer provider boundary

`src/analyzer/providers.ts` defines the `AnalyzerProvider` interface and `OpenAICompatibleAnalyzerProvider`, which posts to the local `/api/analyze-requirement` SSE endpoint served by `packages/web/server/codexAnalyzer.ts`. That middleware shells out to the Codex CLI to do the real analysis. `defaultAnalyzerProvider` is the single export consumed by `App.tsx` and is the live Codex CLI provider — there is no in-browser fallback analyzer.

The example requirement preloaded by `예시 불러오기` lives in `src/analyzer/exampleRequirement.ts` (`getExampleRequirement`). It exercises every category and Graph IR markers such as fan-out/fan-in, loop control, human input, and route branches when run through the live analyzer.

### Taxonomy contract (load-bearing)

Top-level `module_category`: `agent`, `workflow`, `adapter`, `remote_a2a`.

Workflow `workflow_kind`: `orchestration`, `graph`, `dynamic`, `unknown`.

Adapter `adapter_kind`: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, `unknown`.

Rules baked into the schemas, validator, and analyzer:

- ADK runtime baseline: ADK 2.0 (Beta). `graph` and `dynamic` represent 2.0 graph and dynamic workflows respectively. Sequence, fan-out/fan-in, loop, and human input are Graph IR details, not `workflow_kind` values.
- Tool/Adapter, Knowledge Retrieval, and Metadata Registry are **no longer** top-level categories. Retrieval and rule registries appear only as `adapter_kind` subtypes.
- `legacy_recommended_type` is migration metadata; never use it as the primary classifier.
- Remote A2A is high-friction. It requires `risk_level: high` and full contract fields (`owner`, `agent_card`, `auth`, `task_lifecycle`, `timeout`, `retry`, `fallback`, `audit`). Multi-step local workflow alone is **not** enough to propose it.
- Each `module_category` must carry its matching subtype (`agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`).

The enums in `src/analyzer/types.ts`, the JSON Schemas in `schemas/`, and the validator constants in `scripts/validate-artifacts.mjs` must stay aligned. Changing one without the others will break exports.

### Schemas, catalog, templates

- `schemas/`: JSON Schemas for normalized requirement, module candidate, process flow, classification, commonization, and scaffold plan.
- `catalog/`: YAML catalogs for reusable agents, workflows, adapters, Remote A2A runtime contracts, domain owners, and risk gates. Catalog entries are runtime-oriented contracts, not mocks; mock/test-double generation is a separate future workflow. Risk signals on candidates should align with `catalog/risk-gates.yaml`.
- `templates/`: artifact templates the validator smoke-checks by default, plus `scaffold-plan.template.json`.

### Missing-information gate & saved-analysis flow

Aligned with `AGENTS.md` and `docs/workbench/agent-factory-harness.md`. Apply these whenever touching the wizard, scaffold-plan validation, or `SavedAnalysisRecord` shape.

- **Two-layer missing-info gate.** Requirement-level `evidence.missing_information` is a **soft** gate — users mark each item via the per-row "수용" toggle on `AnalysisResult` and the result flows into `acceptedMissing` (reviewer attestation only, never blocks scaffold). Candidate-level `ModuleCandidate.missing_information` plus unresolved `status === "needs_info"` is a **hard** gate — Module Review generates a candidate-level Resolution Draft, the reviewer inspects expandable object schemas and smoke contract, then `반영 적용` records `resolution_applied_at`, `schema_review_state`, and `smoke_spec` before approval.
- **Scaffold-plan messaging.** `scaffoldPlan.collectBlockers` emits the actionable Korean blocker `정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.` while unresolved candidates remain. Warnings include `정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요`. The ADK Runtime Handoff screen renders an empty-state panel with a `모듈 검토로 이동` deep link whenever `can_generate_source` is false or Graph IR has errors.
- **SavedAnalysisRecord persistence.** The record stores `catalogEntries` (active entries at save time), `activeStep`, and `scaffoldReady` (`can_generate_source && graph errors empty`). `loadSavedAnalysis` chooses the landing step from these: `scaffoldReady → export`, all-non-`needs_info` → `modules`, else → `analysis`. Catalog is restored from the record snapshot, not the seed. Backfill must never auto-promote candidate status.
- **Smoke 일괄 실행 매크로.** `AdkRuntimeWorkbench` ships a macro that runs `generate → install → start-web → check-web → chat-smoke` sequentially with per-step pass/fail pills and halts on first failure. Individual buttons remain for debugging. `chat-smoke` and the macro require an approved module `smoke_spec`; source/install/web actions may remain available when only chat smoke is missing.
- **Stub-runtime banner.** When `runtimeMode === "stub"` or any returned event carries `"stubbed_runtime_contract"`, the embed panel renders a yellow banner: "스텁 런타임 — graph 구조만 검증합니다. 실제 모델/어댑터 호출은 발생하지 않습니다." Do not remove this banner; it differentiates stub output from real business logic per AGENTS.md.

### UI design system

`docs/visualization/design-system.md` is the authoritative spec for the web workbench UI: category color tokens, glyph mapping, shared components, Graph IR visualization, and CSS pitfalls. Read it before changing anything visual.

Key contracts:

- **Single source of truth for category visuals** — `packages/web/src/components/CategoryBadge.tsx` exports `CategoryBadge`, `SubtypeBadge`, `getSubtypeValue`, `categoryClass`. Never write category labels as raw `<span>` in a new view; import these instead so Module Review, Graph IR, Catalog, and A2A Contract Review stay in sync.
- **Color tokens** — `:root` in `packages/web/src/styles.css` defines `--cat-{agent,workflow,adapter,remote}-{base,soft,line}` plus `input` / `output`. New categories must add all variants together.
- **Subtype glyphs** — `subtypeGlyph` map in `CategoryBadge.tsx` covers every value in `agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`. Any new enum value added in `analyzer/types.ts` must be mirrored here or it falls back to `·`.
- **Graph Workflow markers** — `GraphCanvas.tsx` renders Graph IR through `src/graph/*`. Fan-out/fan-in, loop, human input, route, and Remote A2A are detected from `container_kind`, `node_kind`, `edge_kind`, and `execution_semantics`; update `layout.ts`, `nodeTypes.tsx`, `edgeTypes.tsx`, and `containerOverlay.tsx` together when adding a marker.

### CSS pitfall to remember

Broad descendant selectors like `.foo-table td span` will break newly added badges (the existing `.domain-map-table td span { display: block }` rule did this — it forced `.category-badge` into block layout and wrapped its text). Always scope table-/list-style rules to direct children (`>`).

### Screenshot-driven UI verification

For UI changes, run the dev server and verify visually with the chrome-devtools MCP — never claim a UI change is done without a screenshot. Standard loop:

```bash
cd packages/web
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Manual/browser testing must stay on the fixed Agent Factory port `5173`. Before starting or restarting, check `lsof -iTCP:5173 -sTCP:LISTEN`; stop a stale Agent Factory/Vite process if it owns the port, but report an unrelated owner as a blocker. Do not let Vite auto-increment to `5174` or another fallback port. Verify with `curl -I http://127.0.0.1:5173/` and report `http://127.0.0.1:5173/` as the testing URL.

Then in MCP: `new_page` → `evaluate_script` to click stepper buttons → `take_screenshot` to a known path under `/tmp/af-screens/`. If a CSS edit doesn't appear after reload, use `navigate_page` with `ignoreCache: true`. The example flow lives in `src/analyzer/exampleRequirement.ts` and exercises every category and Graph IR markers — load it with `예시 불러오기` then `요구사항 분석`.

## Editing Rules (from AGENTS.md)

- Keep changes scoped to the requested workbench behavior. No drive-by abstractions, configuration, or extensibility.
- Review documentation impact before source edits and keep active `docs/` Markdown current when behavior, taxonomy, catalog semantics, schemas, validation, or UI flow changes.
- Treat `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active source of truth.
- Do not edit `.agents/skills` during workbench taxonomy refactors unless the task explicitly asks for a separate skill-sync step.
- Preserve `legacy_recommended_type` migration data; do not promote it back into a primary classifier.
- The UI labels are in Korean (`App.tsx`, components). Preserve that when editing copy.
- Visual changes must follow `docs/visualization/design-system.md` and be verified with a chrome-devtools MCP screenshot before being reported as done.
