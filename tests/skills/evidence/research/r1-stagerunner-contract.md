# Phase 0-1 Stage Runner to skill invocation contract

Status: research complete for the requested source set. This is an investigation record, not a skill implementation.

## Scope and source snapshot

- Repository commit inspected: `7deea452e73f63828fc14402b7e16dcf40e753ac` on `main`.
- Primary source is `packages/web/server/stageRunner.ts`; UI naming/readiness is in `packages/web/src/routes/stageRunnerScreenConfig.ts` (not `src/components/`).
- The requested manifest test exists at `packages/web/src/analyzer/afRunManifest.test.ts` (not under `server/`).
- Current behavior is proposed-first for Analyze/Design, a canonical server primitive for Build, and a server-side allow-list primitive producing proposals for Verify.

## Invocation contract

### What `skillName` does

`StageDefinition` declares both `skillName` and `skillPath` at `stageRunner.ts:40-51`, but they have different jobs.

- `skillName` is a label/ledger value. It is copied into `request.json` (`stageRunner.ts:773-793`), start/error messages (`:328-334`, `:409-418`), `result-summary.json` (`:471-490`), and `af-run-manifest.json.stage_runs[*].skill_name` (`:1341-1372`).
- The screen config independently repeats the display labels for Analyze and Design at `stageRunnerScreenConfig.ts:112-145`.
- No Stage Runner code invokes `$af-analyze-requirement`, `$af-design-boundaries`, or any skill by name. `skillName` is not passed to the SDK runner input (`stageRunner.ts:220-229`, `:383-393`).

### What `skillPath` does

- Analyze and Design are the only `runnerKind: "codex"` stages. Their legacy paths are registered at `stageRunner.ts:56-82` and passed to the SDK runner at `:378-393`.
- Build and Verify do not read their skill directories: Build uses the runtime-stub server primitive and Verify uses the allow-listed verification primitive (`stageRunner.ts:84-108`, `:348-395`, `:496-575`). Their `skillPath` values identify implementation source but are never sent to Codex.
- Prompt construction is exactly `stageRunner.ts:904-915`. The decisive region is:

  > `Read ${input.skillPath} and execute the ${input.stage} stage for this artifact root.`

  It then supplies the artifact root, run folder, request snapshot, stage-specific output instruction, taxonomy/review constraints, and secret/deployment restrictions.
- The SDK receives only that prompt string at `stageRunner.ts:970-981`. Stage Runner does **not** open `SKILL.md`, inline its contents, or use a skill-loader invocation syntax. The agent is instructed in plain text to read the path itself.

### Run ledger and canonical-write behavior

- Every run creates `runs/<stage>/<run-id>/proposed-artifacts/`, writes `request.json`, appends `events.jsonl`, and later writes `diff-summary.json` and `result-summary.json` (`stageRunner.ts:294-340`, `:469-492`, `:1375-1378`). Failures also write `diagnostics.md` (`:405-424`).
- Analyze/Design proposals do not alter canonical artifacts until `applyStageRun`. Apply requires run status `completed` or `applied`, rejects an invalid listed proposal, uses ETag conflict checks, and writes each listed file to the canonical artifact root (`stageRunner.ts:628-676`).
- Apply only changes artifacts and the run ledger. It does not toggle `manifest.approvals.*` or canonical stage-status gates. Tests preserve `boundaries_approved=false` after Analyze apply and preserve both Design approval gates after a Design run (`stageRunner.test.ts:72-125`).
- `stage_runs` is execution metadata only; the manifest update projects run ID/status/timestamps/skill/model/output/error and bounded Codex metadata (`stageRunner.ts:1341-1372`; `afRunManifest.test.ts:25-45`, `:75-79`).

## Required proposal outputs and validators

| Stage | Execution path | Registered required output | Actual validation/application behavior |
| --- | --- | --- | --- |
| Analyze | Codex SDK, or fake test path | `proposed-artifacts/analysis-result.json` | JSON is parsed and passed to `validateAnalysisResult`; invalid output fails the run. Canonical write requires explicit apply. |
| Design | Codex SDK, or fake test path | `proposed-artifacts/analysis-result.json` and `proposed-artifacts/boundary-design.md` | `analysis-result.json` gets the same schema validator; Markdown gets no semantic validator. Canonical writes require explicit apply. Design is blocked unless canonical analysis exists and `analysis_reviewed=true`. |
| Build | `runtime_stub` server primitive | No proposal files | Generates canonical `runtime-stub/` directly. `diffAvailable=false` and apply is unavailable. A failed primitive throws and fails the run. |
| Verify | `verify` server primitive | `proposed-artifacts/validation-report.md` and `proposed-artifacts/catalog-delta.yaml` | Server writes both templates from command output. Neither Markdown nor YAML receives semantic/schema validation. They are proposal/apply files. |

Evidence: registry/output instructions are `stageRunner.ts:56-108`; dispatch is `:342-395`; Design precondition is `:1176-1186`; proposal enumeration and validation are `:1267-1304`; server-generated Verify files are `:918-967`. Tests assert Analyze output at `stageRunner.test.ts:36-66`, Design's two outputs at `:101-125`, Build's canonical runtime-stub output at `:282-296`, and Verify's two proposals at `:298-320`.

The validator boundary has two important exact limitations:

1. `buildDiffSummary` loops only over the registered allow-list and validates only a file whose name is exactly `analysis-result.json` (`stageRunner.ts:1277-1299`). It does not discover or reject extra files elsewhere.
2. A diff-capable stage fails only when **zero** registered files exist (`stageRunner.ts:1301-1303`). Therefore the registry/prompt says Design must produce both files, but current enforcement accepts either one by itself. A shim must preserve the stronger two-file contract.

Verify command keys are `validate_artifact_root`, `build_web`, and `test_analyzer`, mapped to server-built argv at `packages/web/server/afVerifyRunApi.ts:7-20`, `:91-116`. A non-zero Verify command is recorded as `validation.ok=false`, but the run status remains `completed` unless artifact validation itself fails (`stageRunner.ts:363-375`, `:427-490`; test at `stageRunner.test.ts:298-320`). Consequently current `applyStageRun` can apply the generated Verify templates despite a failed command because it checks run status and per-file diff validity, not `summary.validation.ok` (`stageRunner.ts:643-666`).

## Sandbox and repository-read capability

The real SDK thread configuration is at `stageRunner.ts:970-981`:

- `workingDirectory: input.repoRoot`
- `sandboxMode: "workspace-write"`
- `approvalPolicy: "never"`
- `networkAccessEnabled: false`

Yes: the SDK agent can read other repository files during the run. Its working directory is the repository root, and workspace-write permits repository reads plus writes allowed by that sandbox. Thus a legacy-path `SKILL.md` can direct the agent to a canonical skill elsewhere under `.agents/skills/` and that file can direct further repo reads. No network lookup or approval escalation is available.

This sandbox is broader than the proposal folder: it does not technically confine writes to `proposed-artifacts/`. Since the diff builder ignores unexpected files, prompt/skill instructions are part of the safety contract, not merely documentation.

## Exact legacy-path shim guarantee

Only the two Codex-backed legacy paths are required for current Stage Runner compatibility:

- `.agents/skills/af-analyze-requirement/SKILL.md`
- `.agents/skills/af-design-boundaries/SKILL.md`

Until `STAGE_DEFINITIONS` is migrated, each shim must guarantee all of the following:

1. The exact legacy `SKILL.md` path remains present and readable; directory discovery or frontmatter `name` cannot substitute for it.
2. Its first executable instruction immediately reads the corresponding canonical vNext `SKILL.md` by repo-relative path and follows that procedure for the named stage. No `$skill-name` trigger is relied on because Stage Runner never invokes one.
3. It contains no duplicated workflow, reference tree, output contract, or independent trigger language, and creates no legacy-to-canonical-to-legacy cycle.
4. Analyze writes exactly `runs/analyze/<run-id>/proposed-artifacts/analysis-result.json`; Design writes exactly both `runs/design/<run-id>/proposed-artifacts/analysis-result.json` and `boundary-design.md`. Neither writes canonical artifacts directly.
5. The proposed `analysis-result.json` remains parseable and valid under `validateAnalysisResult`. Design also preserves the `analysis_reviewed=true` precondition.
6. It never toggles approvals or stage statuses and never writes catalog seeds, credentials, private endpoints, deployment scripts, or production business logic.
7. It restates the narrow write boundary because the SDK's workspace-write sandbox technically permits writes elsewhere and Stage Runner does not scan for extras.

The old Build and Verify directories are not needed to keep **current Stage Runner execution** working: those stages are server primitives. They may still need migration treatment for direct/manual skill consumers, which is a separate compatibility concern.

The legacy `skill_name` values will continue to appear in request/result/manifest history until the hardcoded Stage Runner registry and UI/test expectations are changed. A shim cannot change that metadata.

## Hardcoded legacy skill-ID locations

### Runtime, UI, and tests

- `packages/web/server/stageRunner.ts:58-59` — Analyze `skillName` and exact `skillPath`.
- `packages/web/server/stageRunner.ts:71-72` — Design `skillName` and exact `skillPath`.
- `packages/web/server/stageRunner.ts:885` — fake Design proposal text.
- `packages/web/src/routes/stageRunnerScreenConfig.ts:115` — Analyze UI label.
- `packages/web/src/routes/stageRunnerScreenConfig.ts:145` — Design UI label.
- `packages/web/server/stageRunner.test.ts:121` — fake Design output assertion.
- `packages/web/src/analyzer/afRunManifest.test.ts:31,78` — serialized Analyze `skill_name` fixture/assertion.

### Legacy skill self-metadata and governance

- `.agents/skills/AGENTS.md:10-13,48-51,56`.
- `.agents/skills/af-analyze-requirement/SKILL.md:2`; `.agents/skills/af-analyze-requirement/agents/openai.yaml:4`.
- `.agents/skills/af-design-boundaries/SKILL.md:2`; `.agents/skills/af-design-boundaries/agents/openai.yaml:4`.
- `.agents/skills/af-build-runtime-stub/SKILL.md:2`; `.agents/skills/af-build-runtime-stub/agents/openai.yaml:4`.
- `.agents/skills/af-verify-feedback/SKILL.md:2`; `.agents/skills/af-verify-feedback/agents/openai.yaml:4`.

### Active documentation and governing work order

- `docs/workbench/operating-model.md:42-45`.
- `docs/workbench/analysis-guide.md:123`.
- `docs/workbench/skill-refresh-evidence-2026-07.md:61`.
- `docs/handbook/stages/analyze-review-gate.md:122`.
- `agent-factory-skills-vnext-work-order.md:36-39,483,573-576,2466-2469`.

### Investigation records found by the same repository-wide search

These are evidence records, not invocation hardcodes, but they still contain the literal IDs: `.evidence-reviews/b4-skills-rewrite-notes.md:18,32-35`; `.evidence-reviews/b2-skills-gap-analysis.md:10-18,50-57,67-69,73,84`; `.evidence-reviews/c6-docs-audit.md:59`.

Checked date: 2026-07-18

Exact paths verified: `agent-factory-skills-vnext-work-order.md`; `packages/web/AGENTS.md`; `packages/web/server/AGENTS.md`; `packages/web/server/stageRunner.ts`; `packages/web/src/routes/stageRunnerScreenConfig.ts`; `packages/web/server/stageRunner.test.ts`; `packages/web/src/analyzer/afRunManifest.test.ts`; `packages/web/server/afVerifyRunApi.ts`; `.agents/skills/AGENTS.md`; `.agents/skills/af-analyze-requirement/SKILL.md`; `.agents/skills/af-design-boundaries/SKILL.md`; `.agents/skills/af-build-runtime-stub/SKILL.md`; `.agents/skills/af-verify-feedback/SKILL.md`; `.agents/skills/af-analyze-requirement/agents/openai.yaml`; `.agents/skills/af-design-boundaries/agents/openai.yaml`; `.agents/skills/af-build-runtime-stub/agents/openai.yaml`; `.agents/skills/af-verify-feedback/agents/openai.yaml`; `docs/workbench/operating-model.md`; `docs/workbench/analysis-guide.md`; `docs/workbench/skill-refresh-evidence-2026-07.md`; `docs/handbook/stages/analyze-review-gate.md`; `.evidence-reviews/b4-skills-rewrite-notes.md`; `.evidence-reviews/b2-skills-gap-analysis.md`; `.evidence-reviews/c6-docs-audit.md`.
