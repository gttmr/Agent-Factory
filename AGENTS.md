# Agent Working Index

## Repository Role

- This is the primary Agent Factory workbench repository.
- Treat `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active workbench source of truth.
- Do not treat this repository as only a public skill-source extract.
- Do not add private banking data, private endpoints, credentials, deployment scripts, or organization-specific runtime code.
- Do not edit `.agents/skills` during workbench taxonomy refactors unless the task explicitly asks for a separate skill-sync step.

## Source Of Truth Map

- `README.md`: human-facing workbench overview and taxonomy contract.
- `AGENTS.md`: model-facing repository index and working rules.
- `CLAUDE.md`: Claude Code-facing repository guide; keep it aligned with this file on load-bearing rules.
- `docs/workbench/agent-factory-harness.md`: project-specific Agent Factory operating harness for intake, classification, scaffold gating, review artifacts, and verification.
- `packages/web`: requirement intake, analysis review, process flow, Graph IR, and ADK runtime handoff UI.
- `schemas`: normalized requirement, module candidate, and process-flow schemas.
- `catalog`: YAML catalogs for reusable runtime contracts, domain owners, and risk gates.
- `templates`: generic artifact and scaffold-plan templates.
- `docs`: active workbench analysis, taxonomy, workflow-decision, validation, and reference notes.

## Markdown Documentation Ownership

- `docs/README.md` indexes human-facing workbench documentation under `docs/`.
- `.agents/skills/**` Markdown is governed by the nearest `SKILL.md` and should not be moved or linked from `docs/README.md` unless the task explicitly asks for a skill-sync step.
- Historical review records belong under `docs/archive/` and must not override the canonical policy files listed above.

## Documentation Impact Discipline

- Before starting any source-code change, explicitly check whether the change affects `docs/` Markdown: taxonomy, catalog semantics, schemas, analyzer behavior, workflow/Graph IR rules, validation commands, UI behavior, or operating policy.
- If the source change affects active docs, update the relevant `docs/` Markdown in the same change set.
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

Catalog entries are runtime-oriented contracts, not mocks. Mock/test-double generation is a separate future workflow that may read catalog contracts, but seed catalog items should describe intended MCP, Remote A2A, or implementation bindings.

ADK runtime baseline: ADK 2.0 (Beta). `workflow_kind` allows only `orchestration`, `graph`, `dynamic`, and `unknown`. ADK graph workflow maps sequence, fan-out/fan-in, loop, route, join, and human input through Graph IR nodes, containers, and edges; active docs do not use ADK 1.x workflow-agent classes as the default classification basis.

## Agent Factory Harness

Before non-trivial analysis, taxonomy, scaffold, or export work, apply `docs/workbench/agent-factory-harness.md`.

Core harness rules:

- Convert raw requirements into reviewed artifacts before implementation.
- Classify first: `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Keep retrieval, rule registry, and tool/adapter concepts as adapter subtypes, not top-level categories.
- Treat Remote A2A as high-friction: require independent ownership, protocol boundary, auth, lifecycle, timeout, retry, fallback, and audit details.
- ADK Runtime Handoff must consume approved scaffold-plan data, never raw requests or unreviewed analyzer output.
- Preserve reviewable artifacts: normalized requirements, evidence, missing-information records, module candidates, process flows, reuse/domain mapping, risk gates, validation output, and decision notes.

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

## Editing Rules

- Keep changes scoped to the requested workbench behavior.
- Review documentation impact before source edits and keep active `docs/` Markdown current when behavior, taxonomy, catalog semantics, schemas, validation, or UI flow changes.
- Do not introduce abstractions, configuration, or extensibility unless the present task requires it.
- Preserve legacy migration data with `legacy_recommended_type`; do not use it as the primary classifier.
- Remote A2A must remain high-friction and must not be inferred only because a workflow has multiple local steps.
- ADK Runtime Handoff and scaffold generation must consume approved artifacts, not raw user requests.
- Generated source must stay a TODO/runtime wiring handoff unless a separate task explicitly approves runnable business logic.

## WSL Browser Verification

This repository is often operated from WSL while the visible Chrome window is a Windows process. Do not assume Chrome DevTools MCP can see that browser.

## Dev Server Reachability

- When the user asks to run a dev server for manual/browser testing, start it in a network namespace that the user can actually reach. In this environment that usually means requesting approval to run `npm run dev -- --host 0.0.0.0` outside the sandbox instead of first starting an isolated sandbox server.
- Verify reachability from the same network namespace where the server is bound, for example with `curl -I http://127.0.0.1:<port>/` and, when useful, `lsof -iTCP:<port> -sTCP:LISTEN`.
- Report the actual port Vite selected. If the default port is occupied and Vite moves to another port, use the moved port in verification and in the final testing URL.

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
