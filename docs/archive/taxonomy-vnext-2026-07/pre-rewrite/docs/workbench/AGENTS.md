# Active Workbench Docs

## Scope

This directory is the active behavior spec for Agent Factory workbench concepts,
taxonomy, workflow decisions, Graph IR, validation, follow-up briefs, and
project harness rules.

## Where To Look

| Task | Documents |
| --- | --- |
| Operating harness | `agent-factory-harness.md` |
| Taxonomy and subtype rules | `taxonomy.md` |
| Workflow classification | `workflow-decision-guide.md`, `adk-agent-execution-modes.md` |
| Graph IR shape and display meaning | `process-flow.md` |
| Module review policy | `review-board.md` |
| Validation and Runtime Handoff | `validation.md` |
| Implementation backlog/status | `follow-ups/INDEX.md`, `follow-ups/STATUS.md` |

## Local Rules

- Keep the ADK 2.3 target baseline separate from historical ADK 2.0 GA notes and from generated-template literal follow-ups.
- Keep retrieval, rule registry, and tools as adapter subtypes unless the active taxonomy changes everywhere.
- Remote A2A remains high-friction and contract-backed.
- Build/Verify/Run docs must preserve the split: Build generates/edits handoff, Verify runs allow-list checks, Run links to ADK dev UI.
- If a detailed follow-up brief conflicts with `INDEX.md`, `STATUS.md`, active docs, or current code, verify before copying it forward.

## Anti-Patterns

- Do not use reports or archive notes as active behavior contracts.
- Do not document app writes to seed catalogs outside Reuse Hub publish or human PR seed changes.
- Do not claim a UI behavior without checking the route/component that owns it.

## Verification

- Docs-only: `git diff --check`.
- Contract changes: run `node scripts/validate-artifacts.mjs`.
- Web behavior changes: run `cd packages/web && npm run build`.
