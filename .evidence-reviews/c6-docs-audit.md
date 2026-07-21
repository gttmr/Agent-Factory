# C6 Documentation Currency Audit

Date: 2026-07-09
Target: merged main `98830b7` (local checkout `7074cb5` adds only excluded `docs/handoff/**` mirror files)
Scope: active Markdown only: `CLAUDE.md`, root/per-directory `AGENTS.md`, and `docs/**` excluding `docs/archive/**` and `docs/handoff/**`.

## Method

- Compared active docs against current source, package scripts, schemas, and skill files.
- Kept changes docs-only; no source, schema, template, catalog, or generated artifact edits.
- Recorded confirmed drift with code evidence before patching.

## Findings And Fixes

### F1 — Stage Runner proposed-artifact wording overstates Build

- Status: fixed in active docs.
- Evidence: `packages/web/server/stageRunner.ts:29-51` defines four stages but maps Build to `runtime-stub/build` and Verify to `verify/run`, not DLC skill output paths.
- Evidence: `packages/web/server/stageRunner.ts:289-313` routes Build through `runBuildPrimitiveStage` and Verify through `runVerifyPrimitiveStage`; Verify writes proposed artifacts, while Build records runtime-stub files.
- Evidence: `packages/web/server/stageRunner.ts:358-413` skips `buildDiffSummary` for Build and reports Build outputs as `runtime-stub/<file>`, while non-Build stages report `runs/<stage>/<run-id>/<proposed_path>`.
- Evidence: `packages/web/server/stageRunner.ts:825-841` limits Codex proposed-artifact output instructions to Analyze/Design; Build/Verify are server-side primitives.
- Drift: `CLAUDE.md`, `docs/workbench/agent-factory-harness.md`, and `docs/workbench/validation.md` still contained broad wording that every Stage Runner result is a proposed artifact requiring diff/apply.

### F2 — Enum alignment is now machine-enforced, not only a convention

- Status: fixed in active docs.
- Evidence: `scripts/validate-artifacts.test.mjs:39-47` tests analyzer, validator, and schema enum alignment directly.
- Evidence: `scripts/validate-artifacts.test.mjs:52-173` covers module categories, subtypes, graph enums, A2A enums, and runtime contract enums.
- Evidence: `packages/web/package.json:6-9` includes `../../scripts/validate-artifacts.test.mjs` in `npm run test:analyzer`.
- Drift: `CLAUDE.md`, `packages/web/src/analyzer/AGENTS.md`, `schemas/AGENTS.md`, `scripts/AGENTS.md`, and `docs/workbench/validation.md` described enum alignment mainly as a manual/update-together rule.

### F3 — StageRunnerPanel and server AGENTS descriptions lag the four-stage runner

- Status: fixed in per-directory AGENTS files.
- Evidence: `packages/web/server/stageRunner.ts:35-51` maps Analyze/Design skill runs plus Build/Verify primitive run history.
- Evidence: `packages/web/server/stageRunner.ts:896-907` invokes the Codex SDK only for SDK stage prompts; Build/Verify use server primitives before that path.
- Drift: `packages/web/server/AGENTS.md` named only Analyze/Design Stage Runner, and `packages/web/src/components/AGENTS.md` described `StageRunnerPanel.tsx` as an Analyze/Design-only surface.

### F4 — Category/subtype glyph documentation missed runtime contract coverage and typed exhaustiveness

- Status: fixed in visual docs and root agent guide.
- Evidence: `packages/web/src/components/CategoryBadge.tsx:21-51` makes `subtypeGlyph` exhaustive for `AdapterKind | AgentKind | WorkflowKind | RemoteContractKind | RuntimeContractKind` using `satisfies Record<SubtypeGlyphKey, string>`.
- Evidence: `packages/web/src/components/CategoryBadge.tsx:95-103` falls back to `·` only for unknown runtime strings passed to `SubtypeBadge`, not for known enum values omitted from the map.
- Drift: `CLAUDE.md` and `docs/visualization/design-system.md` still implied runtime contract kinds were outside the glyph coverage or that omitted known enum values would silently fall back.

### F5 — Graph node and inspector rendering docs overstated the execution-mode de-dup behavior

- Status: fixed in `docs/visualization/design-system.md` and `docs/workbench/adk-agent-execution-modes.md`.
- Evidence: `packages/web/src/components/graph/nodeTypes.tsx:40-63` shows module node cards render only category/subtype, label, module id, and review status.
- Evidence: `packages/web/src/components/graph/nodeTypes.tsx:199-211` shows input/output pill nodes render only the variable label, without `INPUT`/`OUTPUT` eyebrow text.
- Evidence: `packages/web/src/components/GraphInspector.tsx:160-178` shows summary rows with category/subtype chips and core node identity.
- Evidence: `packages/web/src/components/GraphInspector.tsx:247-264` still renders raw `execution_kind` in the runtime group when present, followed by normalized `agent mode`.
- Drift: `docs/visualization/design-system.md` claimed the Inspector hides raw `execution_kind`, mentioned an agent `chat` badge that does not exist in node cards, and referenced stateful-warning copy that is not rendered by the current inspector. `docs/workbench/adk-agent-execution-modes.md` used the same stronger UI wording; it now points to explicit session-history context in the current agent mode surfaces.

### F6 — PR59 skill refresh checked; no active-doc fix needed for old shared-reference names

- Status: checked; no fix needed.
- Evidence: `.agents/skills/AGENTS.md:16-30` lists the current `_shared` files, including `adk-2.3-*` topic files and no `_shared/adk-2.md` or `artifact-contracts.md`.
- Evidence: `.agents/skills/af-analyze-requirement/SKILL.md:10-16`, `.agents/skills/af-design-boundaries/SKILL.md:10-16`, `.agents/skills/af-build-runtime-stub/SKILL.md:10-20`, and `.agents/skills/af-verify-feedback/SKILL.md:10-16` use the new step-router style, not old Required Reading blocks.
- Search result: active guide references to `_shared/adk-2.md` are historical evidence/decision-log entries, not current instructions; past `docs/decision-log.md` entries are append-only and were intentionally left unchanged.

### F7 — PR60/61 deleted surfaces checked; no active-doc fix needed beyond enum/test wording

- Status: checked; no direct stale-file or runtime-install fix needed.
- Evidence: `packages/web/src/analyzer/AGENTS.md` already lists `analysisArtifactImport.ts` and no deleted `analysisArtifactExport.ts`, `commonization.ts`, or `localA2aGraph.ts` file.
- Evidence: current active runtime docs already state the web UI does not install Python dependencies and links to ADK's official dev UI instead of reimplementing chat.
- Drift found from these areas is covered by F2 and the minor AGENTS wording fix from `import/export` to import normalization.

### F8 — State hook AGENTS omitted Runtime A2A

- Status: fixed in `packages/web/src/state/AGENTS.md`.
- Evidence: `packages/web/src/state/useRuntimeA2a.ts:12-45` defines the Runtime A2A status hook contract, including ADK A2A server, Agent Card, readiness, prerequisites, and stale fingerprint fields.
- Evidence: `packages/web/package.json:6-9` includes `src/state/useRuntimeA2a.test.ts` in `npm run test:analyzer`.
- Drift: `packages/web/src/state/AGENTS.md` listed runtime chat and Mock Lab discovery hooks but omitted `useRuntimeA2a.ts`.

## Post-Fix Checks

- Stale-term scan: no active instructional matches remain for deleted analyzer files (`analysisArtifactExport`, `commonization.ts`, `localA2aGraph`), runtime-chat install surface wording, `artifact-contracts.md`, old `Required Reading` skill blocks, `chat badge`, or the old `import/export` analyzer wording.
- Remaining `_shared/adk-2.md` matches are historical evidence or append-only decision-log text: `docs/workbench/skill-refresh-evidence-2026-07.md` and `docs/decision-log.md`.
- Documentation impact: current active docs updated; no `docs/archive/**`, `docs/handoff/**`, source, schema JSON, template, catalog, or generated artifact file was edited.

## Verification

- `git diff --check` — passed with no output.
- `node scripts/validate-artifacts.mjs` — passed: `Artifact validation OK`.
- `git status --short --untracked-files=all` — tracked changes are only active Markdown docs and per-directory `AGENTS.md` files. Untracked `.evidence-reviews/b2-*` through `c5-*` files were already present in the evidence directory; this task added `.evidence-reviews/c6-docs-audit.md`.

## Edited Files

- `.evidence-reviews/c6-docs-audit.md` — recorded findings, code evidence, verification output, and edited-file summary.
- `CLAUDE.md` — corrected Stage Runner Build/Verify output behavior, enum alignment enforcement, and subtype glyph coverage.
- `docs/visualization/design-system.md` — aligned glyph exhaustiveness and Graph node/Inspector execution-mode rendering with current components.
- `docs/workbench/adk-agent-execution-modes.md` — softened stale chat-warning UI wording to current agent mode/helper-copy surfaces.
- `docs/workbench/agent-factory-harness.md` — corrected the four-stage run ledger note for Build canonical runtime-stub output and Verify proposals.
- `docs/workbench/analysis-guide.md` — corrected `runs/<stage>/<run-id>/` artifact meaning across Analyze/Design, Build, and Verify.
- `docs/workbench/validation.md` — clarified Stage Runner output modes and documented `test:analyzer` enum-alignment coverage.
- `packages/web/server/AGENTS.md` — updated Stage Runner ownership and proposed-first scope for Analyze/Design versus Build/Verify.
- `packages/web/src/analyzer/AGENTS.md` — replaced stale import/export scope and documented machine-enforced enum alignment.
- `packages/web/src/components/AGENTS.md` — updated `StageRunnerPanel.tsx` from Analyze/Design-only to the shared four-stage surface.
- `packages/web/src/state/AGENTS.md` — added the current Runtime A2A state hook.
- `schemas/AGENTS.md` — documented enum-alignment enforcement and added `test:analyzer` to schema verification guidance.
- `scripts/AGENTS.md` — documented `validate-artifacts.test.mjs` enum-alignment coverage.
