# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Scope

This is the Agent Factory workbench — a local-first tool that turns raw requirements into reviewed planning artifacts. It is **not** a banking deployment and must never contain private endpoints, credentials, deployment scripts, or organization-specific runtime code. Raw requirements never drive code generation; only approved `scaffold-plan.json` and `implementation-handoff.md` artifacts feed any future scaffold bridge.

`AGENTS.md` is the model-facing source of truth for working rules and overrides anything inferred from code structure alone. Read it before non-trivial edits.

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

### Workbench flow (packages/web)

`App.tsx` is a single-page wizard with seven steps held as React state — no router, no backend. Each step renders one component from `src/components/`:

`intake → analysis → modules → flow → reuse → domainMap → export`

State flows top-down from `App.tsx`: `RequirementIntakeInput` → `AnalysisResult` (normalized requirement + evidence + module candidates) → user-edited `ModuleCandidate[]` → derived `ProcessFlow` (memoized via `buildProcessFlow`) → exported artifacts. The user can mark missing-information items as accepted to unblock export.

### Analyzer provider boundary

`src/analyzer/providers.ts` defines an `AnalyzerProvider` interface with two implementations:

- `MockAnalyzerProvider` — the default; runs `analyzeRequirement` locally with rule-based logic in `mockAnalyzer.ts` and `classificationRules.ts`.
- `OpenAICompatibleAnalyzerProvider` — a **placeholder that intentionally throws**. Its error message documents the hardening required before a real backend is wired in (schema validation, policy gates, audit log, rejection of invalid `module_category`, blocking incomplete Remote A2A). Do not silently replace this with a live call.

`defaultAnalyzerProvider` is the single export consumed by `App.tsx`.

### Taxonomy contract (load-bearing)

Top-level `module_category`: `agent`, `workflow`, `adapter`, `remote_a2a`.

Adapter `adapter_kind`: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, `unknown`.

Rules baked into the schemas, validator, and analyzer:

- Tool/Adapter, Knowledge Retrieval, and Metadata Registry are **no longer** top-level categories. Retrieval and rule registries appear only as `adapter_kind` subtypes.
- `legacy_recommended_type` is migration metadata; never use it as the primary classifier.
- Remote A2A is high-friction. It requires `risk_level: high` and full contract fields (`owner`, `agent_card`, `auth`, `task_lifecycle`, `timeout`, `retry`, `fallback`, `audit`). Multi-step local workflow alone is **not** enough to propose it.
- Each `module_category` must carry its matching subtype (`agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`).

The enums in `src/analyzer/types.ts`, the JSON Schemas in `schemas/`, and the validator constants in `scripts/validate-artifacts.mjs` must stay aligned. Changing one without the others will break exports.

### Schemas, catalog, templates

- `schemas/`: JSON Schemas for normalized requirement, module candidate, process flow, classification, commonization, and scaffold plan.
- `catalog/`: YAML catalogs for reusable agents, workflows, adapters, remote A2A placeholders, domain owners, and risk gates. Risk signals on candidates should align with `catalog/risk-gates.yaml`.
- `templates/`: artifact templates the validator smoke-checks by default, plus `scaffold-plan.template.json`.

### UI design system

`docs/visualization/design-system.md` is the authoritative spec for the web workbench UI: category color tokens, glyph mapping, shared components, Process Flow stage model, and CSS pitfalls. Read it before changing anything visual.

Key contracts:

- **Single source of truth for category visuals** — `packages/web/src/components/CategoryBadge.tsx` exports `CategoryBadge`, `SubtypeBadge`, `getSubtypeValue`, `categoryClass`. Never write category labels as raw `<span>` in a new view; import these instead so all four screens (Module Review, Process Flow, Reuse Heatmap, Domain Map) stay in sync.
- **Color tokens** — `:root` in `packages/web/src/styles.css` defines `--cat-{agent,workflow,adapter,remote}-{base,soft,line}` plus `input` / `output`. New categories must add all variants together.
- **Subtype glyphs** — `subtypeGlyph` map in `CategoryBadge.tsx` covers every value in `agent_kind`, `workflow_kind`, `adapter_kind`, `remote_contract_kind`. Any new enum value added in `analyzer/types.ts` must be mirrored here or it falls back to `·`.
- **Process Flow stages and markers** — `buildFlowStages()` in `ProcessFlowView.tsx` derives stages and auto-detects `parallel` / `loop` / `human_review` / `branch` markers from `workflow_kind`, `risk_signals`, and edge data. Adding a new marker requires updating the detection logic, `markerCopy`, and the matching `.stage-marker.marker-*` CSS together.

### CSS pitfall to remember

Broad descendant selectors like `.foo-table td span` will break newly added badges (the existing `.domain-map-table td span { display: block }` rule did this — it forced `.category-badge` into block layout and wrapped its text). Always scope table-/list-style rules to direct children (`>`).

### Screenshot-driven UI verification

For UI changes, run the dev server and verify visually with the chrome-devtools MCP — never claim a UI change is done without a screenshot. Standard loop:

```bash
cd packages/web && npm run dev    # background; serves on http://localhost:5173
```

Then in MCP: `new_page` → `evaluate_script` to click stepper buttons → `take_screenshot` to a known path under `/tmp/af-screens/`. If a CSS edit doesn't appear after reload, use `navigate_page` with `ignoreCache: true`. The example flow already in `mockAnalyzer.ts` exercises every category and the parallel/loop/human_review markers — load it with `예시 불러오기` then `요구사항 분석`.

## Editing Rules (from AGENTS.md)

- Keep changes scoped to the requested workbench behavior. No drive-by abstractions, configuration, or extensibility.
- Treat `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active source of truth.
- Do not edit `.agents/skills` during workbench taxonomy refactors unless the task explicitly asks for a separate skill-sync step.
- Preserve `legacy_recommended_type` migration data; do not promote it back into a primary classifier.
- The UI labels are in Korean (`App.tsx`, components). Preserve that when editing copy.
- Visual changes must follow `docs/visualization/design-system.md` and be verified with a chrome-devtools MCP screenshot before being reported as done.
