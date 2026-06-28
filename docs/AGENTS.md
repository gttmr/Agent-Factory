# Documentation Tree

## Scope

`docs` contains active workbench guidance, visual design docs, onboarding, and
historical records. Only active docs define current behavior.

## Source Priority

1. `docs/README.md`: human docs entrypoint and default read path.
2. `docs/workbench/*.md`: active behavior specs for analysis, taxonomy, workflow decisions, process flow, validation, review board, harness, and ADK execution modes.
3. `docs/visualization/design-system.md`: active web UI and Graph display contract.
4. `docs/decision-log.md`: decision history; not the behavior spec itself.
5. `docs/mock-lab/local-mcp-mock-lab.md`: active Mock Lab flow.

## Historical Or Status Material

- `docs/archive/**` is historical. Do not revive old taxonomy, scaffold, or ADK 1.x assumptions from it unless the task explicitly asks for migration analysis.
- `docs/archive/reports/**` are evidence snapshots, not canonical specs.
- `docs/workbench/follow-ups/INDEX.md` and `STATUS.md` are backlog/status entrypoints. Use them for follow-up implementation scope, then verify against active docs and code.
- Root `STATUS.md` is a repo-level status entrypoint and source-of-truth pointer. Use it to orient current posture, then verify behavior against active docs and code.

## Local Rules

- Documentation-only edits should not imply behavior changes unless they cite the active source being updated.
- Interface, schema, gate, or UX contract changes also need a decision-log entry.
- Do not update `docs/archive/**` for current behavior.
- Keep Korean user-facing workflow text consistent with the workbench UI where docs describe screens.

## Verification

- Run `git diff --check` for docs-only edits.
- If docs describe schema, validation, generated source, or UI behavior, also run the matching code/artifact verification.
