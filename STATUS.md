# STATUS — Agent Factory Workbench

Last updated: 2026-07-19 (KST).

This file is a branch-neutral status entrypoint. It is not a live cleanliness or PR tracker. For the current checkout, always run:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
```

## Target Product Migration Status

- The canonical Taxonomy, Graph IR, Operating Model, and source-backed Handbook remain the Target Contract and behavior-navigation sources.
- The Handbook source survey is based on commit `7deea452e73f63828fc14402b7e16dcf40e753ac`, checked on 2026-07-18. Handbook locators must still be re-verified against the current checkout before use.
- Product code uses strict `contract_version: "2.0"` analysis output, Target asset/binding/profile/reuse fields, graph asset refs, and Invocation Control. Legacy-only roots and fields are unsupported.
- Reuse Hub and publish UX use exactly Agent, Workflow, and Tool. Catalog storage is `agents.yaml`, `workflows.yaml`, and `tools.yaml`.
- The generator consumes Target candidates and canonical Graph IR directly; no legacy selector projection is retained.
- The strict cutover result and intentionally unsupported old inputs are recorded in [docs/migration/taxonomy-vnext-status.md](docs/migration/taxonomy-vnext-status.md) and [docs/migration/skill-vnext-status.md](docs/migration/skill-vnext-status.md).

## Source Of Truth

- Model-facing repository rules: [AGENTS.md](AGENTS.md) plus the nearest child `AGENTS.md`.
- Human overview: [README.md](README.md).
- Active documentation entrypoint: [docs/README.md](docs/README.md).
- Target concepts and asset classification: [docs/workbench/taxonomy.md](docs/workbench/taxonomy.md).
- Target Workflow Graph representation: [docs/workbench/graph-ir.md](docs/workbench/graph-ir.md).
- Operating stages, approvals, and verification: [docs/workbench/operating-model.md](docs/workbench/operating-model.md).
- Current behavior and source locators: [docs/handbook/README.md](docs/handbook/README.md); source code remains the final authority.
- Target-versus-current gaps: [docs/migration/taxonomy-vnext-status.md](docs/migration/taxonomy-vnext-status.md).
- Historical material: `docs/archive/**` and git history. Session-environment mirrors under `docs/handoff/claude-home/**`, when present, are not active product documentation.
- Follow-up backlog, when present in the active documentation set: `docs/workbench/follow-ups/STATUS.md`; its index is `docs/workbench/follow-ups/INDEX.md`.

## Current Posture

- Agent Factory remains a local-first, artifact-root-first workbench for reviewed planning artifacts and review-gated Runtime Handoff.
- Raw requirements do not directly generate code; Runtime Handoff consumes approved artifacts.
- Current `output_mode` values `smoke` and `runnable` support local review and verification only. They are not production business logic or deployment readiness.
- Catalog publication follows the approval-gated operating path documented by the Operating Model; ad hoc application paths must not edit `catalog/*.yaml`.

## Local Safety

- Do not add private endpoints, credentials, deployment scripts, real customer data, production business logic, or organization-specific runtime code.
- Keep generated artifacts under ignored `artifacts/` roots.
- Treat local dev servers, Runtime Handoff, and Mock Lab as local-only surfaces. Do not expose them to untrusted networks or put sensitive inputs into demos.

## Historical Note

Pre-vNext taxonomy wording and branch-specific status snapshots are historical material. Use `docs/archive/**` or git history to inspect them; do not treat them as current authority.
