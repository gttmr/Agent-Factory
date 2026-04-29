# Adapter Taxonomy Refactor Review

## Blocking Issues

- None found in the current worktree.

## Checks

1. The repository now uses Agent / Workflow / Adapter / Remote A2A as the primary taxonomy in docs, schemas, analyzer types, mock analysis, UI review, process flow, and exports.
2. Tool/Adapter, Knowledge Retrieval, and Metadata Registry are no longer exposed as separate top-level categories.
3. Retrieval and rule registry are preserved as `adapter_kind` values.
4. Remote A2A remains separate and high-friction in the review board, process flow, exported scaffold plan, validation docs, and scaffold bridge docs.
5. `scaffold-plan.json` is generated from approved modules only and includes `raw_requirement_to_code: false`.
6. `README.md` and `AGENTS.md` are aligned with the workbench-first repository role.
7. `packages/web` build passes with `npm run build`.
8. Stale legacy strings remain only as `legacy_recommended_type` migration metadata or in field names that track shared-agent and remote-contract notes.

## Non-Blocking Issues

- The lightweight validator is dependency-free and intentionally limited; full JSON Schema validation can be added later if artifact contracts become stricter.
- `.agents/skills` was not synchronized in this branch by design.

## Recommended Next PRs

- Add schema-level validation in CI.
- Create a separate skill-sync plan for `.agents/skills`.
- Add backend-only analyzer provider implementation after policy gates and audit logging are specified.
