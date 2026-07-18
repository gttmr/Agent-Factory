# Agent Working Index

## Repository Role

- This is the primary Agent Factory workbench repository.
- Treat `.agents/skills`, `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active Agent Factory source of truth.
- Do not treat this repository as only a public skill-source extract.
- Do not add private banking data, private endpoints, credentials, deployment scripts, or organization-specific runtime code.
- Edit `.agents/skills` only when the task explicitly asks for skill, DLC workflow, or skill-sync work.

## Source Of Truth Map

- `README.md`: human-facing workbench overview and taxonomy contract.
- `AGENTS.md`: model-facing repository index and working rules.
- `CLAUDE.md`: Claude Code-facing repository guide; keep it aligned with this file on load-bearing rules.
- `docs/workbench/agent-factory-harness.md`: project-specific Agent Factory operating harness for intake, classification, scaffold gating, review artifacts, and verification.
- `.agents/skills`: Agent Factory DLC skills. The active stage skills are `af-analyze-requirement`, `af-design-boundaries`, `af-build-runtime-stub`, and `af-verify-feedback`; `_shared` contains shared references, not a triggerable skill.
- `packages/web`: artifact visualization, review, guided partial edits, process flow, Graph IR, and ADK runtime handoff UI.
- `schemas`: normalized requirement, module candidate, and process-flow schemas.
- `catalog`: YAML catalogs for reusable runtime contracts, domain owners, and risk gates.
- `templates`: generic artifact and scaffold-plan templates.
- `docs`: active workbench analysis, taxonomy, workflow-decision, validation, and reference notes.

## Local AGENTS.md Hierarchy

This root file carries repository-wide policy. More specific guidance now lives
near the active ownership boundaries:

- `.agents/skills/AGENTS.md`: DLC skill authoring and shared references.
- `packages/web/AGENTS.md`: web workbench package, routes, UI, server middleware,
  and verification entrypoints.
- `packages/mock-lab/AGENTS.md`: standalone Mock Lab package and MCP runtime.
- `docs/AGENTS.md`: active docs versus historical/status snapshots.
- `schemas/AGENTS.md`, `catalog/AGENTS.md`, `templates/AGENTS.md`,
  `scripts/AGENTS.md`: artifact contracts, seed catalogs, fixtures, and root
  generators/validators.

When editing inside one of those trees, read the nearest child `AGENTS.md`
after this root file. Child files specialize this policy; they do not relax it.

## Markdown Documentation Ownership

- `docs/README.md` indexes human-facing workbench documentation under `docs/`.
- `.agents/skills/**` Markdown is governed by the nearest `SKILL.md`. The stage skills may be linked from `docs/README.md` because Agent Factory now treats them as the DLC operating entrypoints.
- Historical review records belong under `docs/archive/` and must not override the canonical policy files listed above.

## Documentation Impact Discipline

- Before starting any source-code change, explicitly check whether the change affects `docs/` Markdown: taxonomy, catalog semantics, schemas, analyzer behavior, workflow/Graph IR rules, validation commands, UI behavior, or operating policy.
- If the source change affects active docs, update the relevant `docs/` Markdown in the same change set.
- If the change alters a design decision (interface, schema, gate, or UX contract), append an entry to `docs/decision-log.md` (date · PR · decision · rationale · impact) in the same change set.
- If no doc update is needed, be prepared to state why in the finish report.
- Do not update `docs/archive/**` for current behavior unless the task explicitly asks for archival or migration work.

## Current Taxonomy

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
- Adapter: callable capability used by agents or workflows.
- Remote A2A: independent remote agent boundary with protocol-level contract.

Tool/Adapter, Knowledge Retrieval, and Metadata Registry are no longer top-level categories. Retrieval and rule registries are Adapter subtypes.

Catalog entries are runtime-oriented contracts. `catalog/*.yaml` is never edited directly; the approval-gated `POST /api/catalog/publish` path in Reuse Hub `등록 승인` is the only app write path, publishing versioned entries from active-root `catalog-delta.yaml` proposals. Human PR merge remains valid for bulk or seed changes. Seed catalog items may include deterministic synthetic `runtime_mock` payloads for local ADK smoke tests, but those payloads are test doubles only: no private banking data, private endpoints, credentials, deployment scripts, or real business logic.

ADK taxonomy/Graph IR baseline: ADK 2.3 (current target `google-adk` 2.3.0; ADK Python 2.0 GA was May 19, 2026). This baseline governs classification only — `workflow_kind` allows only `orchestration`, `graph`, `dynamic`, and `unknown`, and ADK graph workflow maps sequence, fan-out/fan-in, loop, route, join, and human input through Graph IR nodes, containers, and edges; active docs do not use ADK 1.x workflow-agent classes as the default classification basis. The runnable source generator targets the ADK 2.3 `google.adk.workflow.Workflow` runtime; the shared requirements floor may remain lower when 2.1 -> 2.3 compatibility has been verified.

## Agent Factory Harness

Before non-trivial analysis, taxonomy, scaffold, export, or DLC skill work, apply `docs/workbench/agent-factory-harness.md`.

Core harness rules:

- Use `af-analyze-requirement` for schema-first analysis artifacts before implementation.
- Use `af-design-boundaries` for module, Graph IR, runtime contract, Remote A2A, and reuse approval.
- Use `af-build-runtime-stub` only after approved scaffold-plan artifacts exist.
- Use `af-verify-feedback` to record validation evidence and catalog delta proposals.
- Classify first: `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Keep retrieval, rule registry, and tool/adapter concepts as adapter subtypes, not top-level categories.
- Treat Remote A2A as high-friction: require independent ownership, protocol boundary, auth, lifecycle, timeout, retry, fallback, and audit details.
- ADK Runtime Handoff must consume approved scaffold-plan data, never raw requests or unreviewed analyzer output.
- Preserve reviewable artifacts: normalized requirements, evidence, missing-information records, module candidates, process flows, reuse/domain mapping, risk gates, validation output, and decision notes.
- Preserve runtime contract review artifacts when legacy, callback, Context Manager, ADK callback, or async resume behavior is involved.

## Skill And Subagent Usage

Use skills as execution discipline, not ceremony.

### Superpowers

Use the relevant Superpowers skill before changing behavior:

- Use `superpowers:brainstorming` when the user is still shaping UX, feature behavior, workflow semantics, or screen structure.
- Use `superpowers:writing-plans` when an approved spec needs to become implementation steps.
- Use `superpowers:systematic-debugging` when a regression, unexpected UI return, test failure, or confusing runtime behavior appears. Identify the root cause before patching.
- Use `superpowers:verification-before-completion` before claiming work is complete, fixed, or ready for PR.

Do not skip the user-review gate when a Superpowers workflow explicitly requires it, unless the user has already approved the concrete spec or plan in the same thread.

### Frontend Skill

For any visible workbench UI change, apply `frontend-skill`.

Agent Factory is an operational workbench, not a marketing surface. Prefer:

- dense but readable workspace layouts
- clear task hierarchy
- restrained colors and borders
- utility copy in natural Korean
- English technical terms where they are clearer, such as `Agent`, `Workflow`, `Adapter`, `Remote A2A`, `Graph IR`, and `Runtime Handoff`
- cards only when the card is the interaction surface

When changing a screen, verify that removed UI does not still render from a parent shell, context panel, inspector, or shared layout component.

### Subagents

Use subagents only when they materially improve reliability or protect the main context from growing too large.

A subagent is appropriate when:

- the task is bounded and can be reviewed independently
- the subagent can receive nearly the same relevant context as the main agent
- the expected output quality should match the main agent's work
- the work is review, focused investigation, or an isolated implementation slice
- the main agent can continue useful non-overlapping work while the subagent runs

Do not use a subagent for the immediate blocking step when the main thread must act on that result before doing anything else.

When the user authorizes subagents for Agent Factory work, default subagent model settings are:

- model: `gpt-5.5`
- reasoning effort: `high`

For code-changing subagents, assign a clear file or module ownership boundary and instruct them not to revert or overwrite unrelated work. For review subagents, ask for concrete findings with file and line references, not broad opinions.

## Worktree Hygiene

Git worktrees created for isolated slices (subagent/Codex work, parallel branches) must be cleaned up once their work lands — do not let them accumulate.

- After creating a PR and confirming it is merged, treat the source worktree and its branch as cleanup-pending in the same session: the task is not done until they are removed (or the user explicitly chooses to keep them).
- To clean up a landed branch: `git worktree remove <path>` then `git branch -d <branch>`. Run `git worktree prune` to drop dead registrations (directories already gone).
- Before deleting, confirm the branch is merged (`git merge-base --is-ancestor <branch> main`) or its content is already on `main`, and that the worktree has no uncommitted changes (`git -C <path> status`). Keep anything unmerged and surface it instead of deleting.
- Periodically run `git worktree list` to spot leftovers. Never remove the primary checkout, and do not touch remote branches unless the user asks.

## Editing Rules

- Keep changes scoped to the requested workbench behavior.
- Review documentation impact before source edits and keep active `docs/` Markdown current when behavior, taxonomy, catalog semantics, schemas, validation, or UI flow changes.
- Do not introduce abstractions, configuration, or extensibility unless the present task requires it.
- When the user asks to modify an artifact or generated ADK behavior, do not solve it by hard-coding domain terms, route aliases, product names, scenario names, or workflow-specific literals into `scripts/generate-adk-source.mjs` or another generator. First decide whether the current Graph IR / scaffold-plan / schema can express the needed behavior. If not, add a reviewed, generic contract field across schema/types/validator/UI/generator as needed, then update the artifact data to use that field.
- Generator defaults may be deterministic, but they must be framework/runtime-neutral. Workflow-specific choices such as router labels, human choice aliases, adapter argument hints, prompt rules, and business terms belong in reviewed artifacts or catalog/mock specs, not in generator code. If a compatibility fallback is unavoidable, document why and cover it with a regression.
- Preserve legacy migration data with `legacy_recommended_type`; do not use it as the primary classifier.
- Remote A2A must remain high-friction and must not be inferred only because a workflow has multiple local steps.
- ADK Runtime Handoff and scaffold generation must consume approved artifacts, not raw user requests.
- Required runtime contracts in `AnalysisResult.runtimeContracts` must be reviewed and approved before Runtime Handoff proceeds.
- Generated source defaults to a smoke TODO/runtime-wiring handoff. A reviewed `scaffold-plan` `output_mode: runnable` (an approved capability) emits a runnable ADK 2.3 `Workflow` (Gemini `LlmAgent` nodes + synthetic Mock Lab MCP adapters) instead — still generated only from approved artifacts (`raw_requirement_to_code` stays `false`), never from raw requests, and never containing private endpoints, credentials, or real customer data.

## WSL Browser Verification

This repository is often operated from WSL while the visible Chrome window is a Windows process. Do not assume Chrome DevTools MCP can see that browser.

## Dev Server Reachability

- Manual/browser testing for `packages/web` uses one fixed port: `5173`.
- When the user asks to run or restart the dev server, do not let Vite auto-increment to `5174`, `5175`, or another fallback port. Use `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` outside the sandbox so the server binds where the user can reach it.
- Before starting, check `lsof -iTCP:5173 -sTCP:LISTEN`. If an existing Agent Factory/Vite process owns the port, stop that stale process and restart on `5173`. If an unrelated process owns the port, report the blocker instead of silently moving ports.
- Verify reachability from the same network namespace where the server is bound with `curl -I http://127.0.0.1:5173/` and, when useful, `lsof -iTCP:5173 -sTCP:LISTEN`.
- Report only the fixed testing URL `http://127.0.0.1:5173/` unless the user explicitly approves a different port.

Before using Chrome DevTools MCP navigation, DOM inspection, or screenshots, run this gate from WSL:

```bash
curl -s http://127.0.0.1:9222/json/version
```

The browser tool is usable only when that command returns JSON with `webSocketDebuggerUrl`. If it fails, do not call `mcp__chrome_devtools__navigate`, `evaluate`, or `screenshot` and do not claim a screenshot was taken.

Known working setup in this environment:

```bash
google-chrome-stable \
  --headless=new \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-codex-devtools \
  --no-first-run \
  --no-default-browser-check \
  about:blank
```

Then verify:

```bash
curl -s http://127.0.0.1:9222/json/version
lsof -iTCP:9222 -sTCP:LISTEN
```

Observed behavior on 2026-05-09:

- Normal Windows Chrome processes were running, but none had `--remote-debugging-port=9222`.
- `127.0.0.1:9222` and the WSL nameserver host candidate `10.255.255.254:9222` did not respond until a dedicated WSL `google-chrome-stable` process was launched.
- After launching the WSL headless Chrome command above, Chrome DevTools MCP `navigate`, `evaluate`, and `screenshot` worked; `screenshot` returned a `/tmp/chrome-devtools-mcp-*/screenshot.png` path.

Use a separate `--user-data-dir` for the automation browser. Do not try to retrofit the user's normal Windows Chrome session unless the debug endpoint is first proven reachable from WSL.

## Verification

- After TypeScript, React, analyzer, or export changes, run:

```bash
cd packages/web
npm run build
```

- If dependency installation is needed, run `npm install` in `packages/web` before the build.
- Do not call work complete without observable verification.
