# CLAUDE.md

This file guides Claude Code when working in the Agent Factory repository.

## Repository Scope

Agent Factory is a local-first workbench that turns raw requirements into reviewed planning artifacts and a review-gated ADK Runtime Handoff. Runtime Handoff consumes approved artifacts; raw requirements do not directly generate code. The workbench and its generated bundles are local review and verification surfaces, not production deployment.

Treat `.agents/skills`, `packages/web`, `schemas`, `templates`, `catalog`, and `docs` as the active repository source trees. Do not add private endpoints, credentials, real customer data, internal deployment scripts, or organization-specific runtime code.

## Required Reading Order

Before non-trivial work:

1. Read `AGENTS.md` for repository-wide working rules and the nearest child `AGENTS.md` for the tree being edited.
2. Read `docs/README.md` for the progressive active-documentation path.
3. Read `docs/handbook/README.md` before relying on a route, symbol, state hook, server handler, artifact producer, or consumer.
4. Open the current source behind every Handbook locator before using it. Source is the final authority for Current Implementation behavior.

## Canonical References

| Question | Canonical source |
| --- | --- |
| Concept and asset classification | [Taxonomy](docs/workbench/taxonomy.md) |
| Workflow Graph nodes, edges, invocation relationships, and display | [Graph IR](docs/workbench/graph-ir.md) |
| Stages, approvals, artifact flow, Catalog governance, and verification | [Operating Model](docs/workbench/operating-model.md) |
| Current behavior and source location | [Handbook](docs/handbook/README.md) |
| Target Contract versus Current Implementation gap | [Taxonomy vNext Migration Status](docs/migration/taxonomy-vnext-status.md) |

Do not redefine taxonomy or Graph IR in this file. If documentation and source differ, describe **Target Contract** and **Current Implementation** separately and record the gap through the migration status.

## Common Commands

The web package is the primary buildable artifact. Run these commands from `packages/web`:

```bash
cd packages/web
npm install              # first-time setup or dependency changes
npm run build            # tsc --noEmit && vite build; required verification
npm run preview          # preview the built bundle
```

For manual development, keep the fixed Agent Factory port:

```bash
cd packages/web
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Run the artifact validator from the repository root:

```bash
node scripts/validate-artifacts.mjs
node scripts/validate-artifacts.mjs path/to/artifacts
```

The validator checks Current Implementation contracts. Its success does not mean that the Target Contract taxonomy has been migrated into code.

## Current Implementation

The route layer starts under `packages/web/src/routes`, server middleware and API behavior live under `packages/web/server`, and client query and mutation hooks live under `packages/web/src/state`. Use the Handbook stage pages for current behavior, artifacts, calls, and verified symbols instead of repeating that detail here.

The implementation still serializes the `legacy` `module_category` values `agent`, `workflow`, `adapter`, and `remote_a2a`, plus `legacy` identifiers such as `adapter_kind`, `agent_kind`, `workflow_kind`, and `selected_by_llm`. Code, schemas, validators, and Catalog files have not been migrated to the Target Contract. The skill tree is partially migrated to `af-workflow` plus four canonical Work Skills; current artifact writes pass through a Compatibility Layer and the four former stage IDs remain shims. Follow [.agents/skills/AGENTS.md](.agents/skills/AGENTS.md) and [Skills vNext Migration Status](docs/migration/skill-vnext-status.md); do not change the `legacy` Product contracts incidentally.

The current workbench routes and servers remain under the paths above. Detailed Analyze, Design, Build, Verify, Catalog, local runtime, and Mock Lab behavior belongs in the Handbook and [Operating Model](docs/workbench/operating-model.md), not in this root guide.

## Session Environment Handoff

Some Claude Code context can live only in a machine's `~/.claude/**`, including session memory, plans, permissions, and MCP or plugin definitions. If `docs/handoff/claude-home/README.md` exists in the current worktree, use it to restore a synchronized snapshot on a new machine and follow its documented prerequisites.

The snapshot is a mirror, not the source of truth; live files remain under each machine's `~/.claude/**`. Treat `docs/handoff/claude-home/**` as session-environment material, exclude it from product documentation sweeps, and never commit secrets into it. The directory may be absent or intentionally deleted in a current worktree.

## Editing Rules

- Keep edits surgical and limited to the requested behavior.
- Edit `.agents/skills` only for an explicit skill, DLC workflow, or skill-sync task.
- Before source edits, follow the documentation-impact and decision-log rules in [Operating Model](docs/workbench/operating-model.md).
- Preserve natural Korean UI copy unless the task explicitly changes the language.
- Before visible UI changes, read `docs/visualization/design-system.md`, run the fixed-port development server, and verify the actual screen with a screenshot.
- Keep generators framework- and runtime-neutral; Workflow-specific labels, aliases, prompts, and business terms must come from reviewed artifacts or Catalog/mock contracts rather than generator literals.
- Do not use archive material or `docs/handoff/claude-home/**` as current product authority.

## Verification

- After TypeScript, React, analyzer, Stage Runner, Runtime Handoff, or web behavior changes, run `cd packages/web && npm run build`.
- For artifact, schema, Catalog projection, or validator-sensitive changes, run `node scripts/validate-artifacts.mjs` from the repository root.
- For documentation-only work, run `git diff --check`, verify relative links against the complete intended documentation set, and confirm the edited-file inventory.
- For browser verification, follow the WSL DevTools gate and fixed `5173` reachability rules in `AGENTS.md`; never claim a screenshot without a reachable debug endpoint and an actual capture.
- Do not report completion without observable evidence. State what was not verified and why.
