# STATUS — Agent Factory Workbench

Last updated: 2026-06-28 (KST).

This file is a branch-neutral status entrypoint. It is not a live cleanliness or
PR tracker. For the current checkout, always run:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
```

## Source Of Truth

- Model-facing rules: `AGENTS.md` plus the nearest child `AGENTS.md`.
- Human overview: `README.md`.
- Active docs: `docs/README.md`, `docs/workbench/*.md`, `docs/visualization/design-system.md`, `docs/mock-lab/local-mcp-mock-lab.md`.
- Follow-up backlog: `docs/workbench/follow-ups/INDEX.md` and `docs/workbench/follow-ups/STATUS.md`.
- Historical material: `docs/archive/**` and old branch-specific status snapshots in git history.

## Current Posture

- Agent Factory is a local-first, artifact-root-first workbench for reviewed Agent/Workflow/Adapter/Remote A2A artifacts.
- Raw requirements never drive generated source directly; Runtime Handoff consumes approved artifacts and keeps `raw_requirement_to_code=false`.
- Smoke output remains TODO/runtime-wiring handoff; reviewed `output_mode: runnable` emits synthetic ADK Workflow wiring for local smoke review, not production business logic.
- Reuse Hub catalog publishing is approval-gated through the app publish path or human PR seed changes; ad hoc app paths must not edit `catalog/*.yaml`.
- Mock Lab is the integrated `/mock-lab` route on the 5173 workbench plus a standalone 5176 package for package-local development.

## Follow-Up Backlog

The active follow-up queue is in `docs/workbench/follow-ups/STATUS.md`.
As of this update, briefs 10-14 remain the tracked backlog:

- 10 dynamic workflow lowering
- 11 agent/non-connected consumer channel reads
- 12 A2A policy mapping
- 13 scaffold-plan warning accuracy
- 14 runtime-stub runtime UX

## Local Safety

- Do not add private endpoints, credentials, deployment scripts, real customer data, or production business logic.
- Keep generated artifacts under ignored `artifacts/` roots.
- Treat local dev servers as local-only surfaces; do not expose them to untrusted networks or put sensitive inputs into demos.

## Historical Note

This file previously described the `feat/port-mock-lab-design-system` branch and
PR #21 state. That branch-specific snapshot is obsolete for current work and can
be recovered from git history if needed.
