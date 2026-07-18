# Agent Working Index

## Repository Role

- This is the primary Agent Factory workbench repository.
- Treat `.agents/skills`, `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active Agent Factory source trees.
- Do not treat this repository as only a public skill-source extract.
- Do not add private banking data, private endpoints, credentials, deployment scripts, real customer data, or organization-specific runtime code.
- Edit `.agents/skills` only when the task explicitly asks for skill, DLC workflow, or skill-sync work.

## Required Reading Order

Before non-trivial work:

1. Read [docs/README.md](docs/README.md) for the active documentation path.
2. Read [docs/handbook/README.md](docs/handbook/README.md) to locate current behavior in source.
3. Use the canonical document that owns the decision:
   - concepts and asset classification: [docs/workbench/taxonomy.md](docs/workbench/taxonomy.md)
   - Workflow Graph decisions and display: [docs/workbench/graph-ir.md](docs/workbench/graph-ir.md)
   - stages, approvals, artifacts, and verification: [docs/workbench/operating-model.md](docs/workbench/operating-model.md)
   - Target Contract versus Current Implementation gaps: [docs/migration/taxonomy-vnext-status.md](docs/migration/taxonomy-vnext-status.md)

Do not duplicate or redefine a canonical taxonomy or Graph enum in this file. Link to the owning document.

## Canonical Decision Rules

- Do not create a top-level asset type other than Agent, Workflow, or Tool. Roles, protocols, resources, dependencies, domains, ownership, and reuse states do not become additional asset types.
- Tool Invocation Control uses the display labels Workflow and Agent. Do not promote Model or LLM to an Invocation Control owner. Follow the canonical [Taxonomy](docs/workbench/taxonomy.md) and [Graph IR](docs/workbench/graph-ir.md).
- Handbook locators are navigation aids, not authority over source. Before using a locator, open the current file and re-verify its symbol, callers, inputs, outputs, and side effects.
- When documentation and code differ, state **Target Contract** and **Current Implementation** separately. Do not present a documentation target as implemented behavior.

## Current Implementation Boundary (`legacy`)

The current code, schemas, validators, generator, Catalog data, and skill Compatibility Layer still serialize the `legacy` field `module_category` with the `legacy` values `agent`, `workflow`, `adapter`, and `remote_a2a`. They also use `legacy` identifiers including `adapter_kind`, `agent_kind`, `workflow_kind`, `selected_by_llm`, `decision_owner`, and current Graph node and edge values. The skill tree is organized as `af-workflow` plus four canonical Work Skills; the four former stage IDs remain compatibility shims. Follow [.agents/skills/AGENTS.md](.agents/skills/AGENTS.md) for the current map.

When editing source, do not casually rename, remove, or reinterpret these `legacy` contracts. Their alignment is a separate follow-up migration, not part of documentation wording changes. Record and interpret the gap through [docs/migration/taxonomy-vnext-status.md](docs/migration/taxonomy-vnext-status.md). A current identifier must be formatted as code and explicitly marked `legacy` whenever an active document discusses it.

## Local AGENTS.md Hierarchy

This root file carries repository-wide policy. More specific guidance lives near active ownership boundaries:

- [.agents/skills/AGENTS.md](.agents/skills/AGENTS.md): DLC skill authoring, canonical skill map, compatibility shims, and shared references.
- `packages/web/AGENTS.md`: web workbench package, routes, UI, server middleware, and verification entrypoints.
- `packages/mock-lab/AGENTS.md`: standalone Mock Lab package and MCP runtime.
- `docs/AGENTS.md`: active docs versus historical and status snapshots.
- `schemas/AGENTS.md`, `catalog/AGENTS.md`, `templates/AGENTS.md`, `scripts/AGENTS.md`: artifact contracts, seed catalogs, fixtures, and root generators or validators.

When editing inside one of these trees, read the nearest child `AGENTS.md` after this root file. Child files specialize this policy; they do not relax it.

## Documentation Ownership And Impact

- `docs/README.md` indexes active human-facing documentation. The Handbook maps behavior to current source; source remains the final authority.
- Before a source change, check the documentation-impact rules in [Operating Model](docs/workbench/operating-model.md). Update affected active documentation in the same change set.
- If a change alters an interface, schema, gate, or UX contract, append a dated entry to `docs/decision-log.md` with PR, decision, rationale, and impact. The decision log preserves history; canonical documents own current rules.
- `docs/archive/**` and `docs/handoff/claude-home/**` are not active authority and are excluded from normal documentation-currency sweeps. Do not edit them to describe current behavior unless the task explicitly asks for archival or handoff work.
- `.agents/skills/**` Markdown is operational material governed by its nearest `SKILL.md`; do not include it in a general docs sweep or edit it without an explicit skill-related request.

## Skill And Subagent Usage

Use skills as execution discipline, not ceremony.

### Superpowers

Use the relevant Superpowers skill before changing behavior:

- Use `superpowers:brainstorming` when the user is still shaping UX, feature behavior, workflow semantics, or screen structure.
- Use `superpowers:writing-plans` when an approved spec needs to become implementation steps.
- Use `superpowers:systematic-debugging` when a regression, unexpected UI return, test failure, or confusing runtime behavior appears. Identify the root cause before patching.
- Use `superpowers:verification-before-completion` before claiming work is complete, fixed, or ready for PR.

Do not skip a user-review gate required by a Superpowers workflow unless the user already approved the concrete spec or plan in the same thread.

### Frontend Skill

For any visible workbench UI change, apply `frontend-skill`.

Agent Factory is an operational workbench, not a marketing surface. Prefer:

- dense but readable workspace layouts
- clear task hierarchy
- restrained colors and borders
- utility copy in natural Korean
- English technical terms where clearer, such as `Agent`, `Workflow`, `Tool`, `Graph IR`, and `Runtime Handoff`
- cards only when the card is the interaction surface

The Current Implementation UI can still render the `legacy` labels `Adapter` and `Remote A2A`. When documenting or editing those current labels, identify them as `legacy` UI vocabulary; do not present them as Target Contract asset types.

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

When the user authorizes subagents for Agent Factory work, use these defaults:

- model: `gpt-5.6` (the configured Codex default; do not pass `gpt-5.5`)
- reasoning effort: `high`

For code-changing subagents, assign a clear file or module ownership boundary and instruct them not to revert or overwrite unrelated work. For review subagents, request concrete findings with current file and line references.

Track every spawned subagent until its lifecycle is closed. Capture its deliverable, close it immediately after completion, and perform a final sweep before finishing. If the available tool surface cannot close completed subagents, do not start a multi-agent workflow that would leave resident runtimes behind.

## Worktree Hygiene

Git worktrees created for isolated slices must be cleaned up after their work lands.

- After a PR is merged, treat the source worktree and local branch as cleanup-pending in the same session unless the user explicitly keeps them.
- Before deleting, confirm the worktree is clean and the branch is merged with `git merge-base --is-ancestor <branch> main`, or confirm its content is already on `main`.
- Remove a landed worktree with `git worktree remove <path>`, delete its local branch with `git branch -d <branch>`, and run `git worktree prune` for dead registrations.
- Keep and report anything unmerged or dirty. Never remove the primary checkout or touch a remote branch unless the user asks.
- Periodically run `git worktree list` to identify leftovers.

## Editing Rules

- Keep changes scoped to the requested behavior. Do not add unrelated abstractions, configuration, or extensibility.
- Keep Target Contract wording and Current Implementation behavior visibly separate.
- Runtime Handoff and scaffold generation consume approved artifacts, never raw requirements or unreviewed analyzer output.
- Follow [Operating Model](docs/workbench/operating-model.md) for Catalog publication; do not edit `catalog/*.yaml` as an ad hoc application path.
- Do not solve generated behavior by hard-coding domain terms, route aliases, product names, scenario names, or Workflow-specific literals into a generator. Generator defaults must stay framework- and runtime-neutral; behavior-specific choices belong in reviewed artifacts or Catalog/mock contracts.
- Preserve Korean workbench UI copy unless the task explicitly changes the language.
- Before a visual change, read `docs/visualization/design-system.md`; verify the result in the real screen and capture a screenshot before reporting completion.

## WSL Browser Verification

This repository is often operated from WSL while the visible Chrome window is a Windows process. Do not assume a browser automation tool can see that browser.

Before Chrome DevTools navigation, DOM inspection, or screenshots, run this WSL gate:

```bash
curl -s http://127.0.0.1:9222/json/version
```

The browser tool is usable only when the response is JSON containing `webSocketDebuggerUrl`. If the gate fails, do not call Chrome DevTools navigation, evaluation, or screenshot operations and do not claim a screenshot was taken.

A known working dedicated WSL browser setup is:

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

Use a separate `--user-data-dir` for the automation browser. Do not retrofit the user's normal Windows Chrome session unless its debug endpoint is first proven reachable from WSL.

## Dev Server Reachability

- Manual and browser testing for `packages/web` uses the fixed port `5173`.
- Start Vite outside the agent sandbox with `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` so the user can reach it. Do not let Vite auto-increment to another port.
- Before starting, run `lsof -iTCP:5173 -sTCP:LISTEN`. Stop an existing stale Agent Factory/Vite owner; if an unrelated process owns the port, report the blocker instead of moving ports.
- Verify from the same network namespace with `curl -I http://127.0.0.1:5173/` and, when useful, `lsof -iTCP:5173 -sTCP:LISTEN`.
- Report only `http://127.0.0.1:5173/` unless the user explicitly approves another port.

## Verification

After TypeScript, React, analyzer, export, or web behavior changes, run:

```bash
cd packages/web
npm run build
```

If dependencies are missing, run `npm install` in `packages/web` before the build.

For artifact, schema, Catalog projection, or validator-sensitive changes, run from the repository root:

```bash
node scripts/validate-artifacts.mjs
```

Documentation-only changes must at least pass `git diff --check`, link checks appropriate to the staged documentation set, and an edited-file inventory. Do not call work complete without observable verification; state any unverified item and why it remains unverified.
