# Agent Factory Coding-Agent Skills

## Scope

This tree contains the Agent Factory coding-agent skills and shared references.
Edit it only for explicit skill, DLC workflow, or skill-sync work.

## Structure

Entrypoint + four work skills (canonical):

- `af-workflow`: entrypoint — checks repository/artifact state, routes to the right work skill, prevents stage skipping. Produces no artifacts itself.
- `af-discover-assets`: requirement → evidence-backed Agent/Workflow/Tool candidates, resources, dependencies, missing information.
- `af-compose-solution`: reviewed candidates → execution structure (standalone-or-Workflow decision, Graph IR, Invocation Control, Binding, runtime pattern contracts, scaffold readiness).
- `af-scaffold-runtime`: approved compose output → ADK project / Runtime Handoff bundle. Never consumes raw requirements.
- `af-verify-runtime`: five-level verification (skill structure, artifact contract, code correctness, runtime smoke, behavior evaluation) with evidence.

Legacy compatibility shims (do not extend; removal criteria in `docs/migration/skill-vnext-status.md`):

- `af-analyze-requirement` → `af-discover-assets`
- `af-design-boundaries` → `af-compose-solution`
- `af-build-runtime-stub` → `af-scaffold-runtime`
- `af-verify-feedback` → `af-verify-runtime`

The Workbench Stage Runner now reads the canonical `skillPath`s directly (migrated 2026-07-18); the shims remain only for direct/manual legacy invocations and must still hand off immediately with the stage output contracts intact.

`_shared` is reference material only, never a triggerable skill. Pattern cards live under `_shared/adk/` and are read conditionally via `_shared/runtime-pattern-selection.md`, not all at once.

## Where To Look

| Task | Location |
| --- | --- |
| Which skill to run next | `af-workflow/SKILL.md` |
| Truth hierarchy and Target/Current/Compatibility/Blocker labels | `_shared/source-of-truth.md` |
| Stage order, raw→code prohibition, approval invariants | `_shared/lifecycle-invariants.md` |
| Artifact root, run ledger, proposed-first apply (Current Implementation) | `_shared/artifact-root-and-stage-runner.md` |
| Asset taxonomy summary (canonical: docs/workbench/taxonomy.md) | `_shared/taxonomy.md` |
| Graph IR summary (canonical: docs/workbench/graph-ir.md) | `_shared/graph-ir.md` |
| Target 판단 → current `legacy` serialization | `_shared/compatibility-current-schema.md` |
| Missing-information hard/soft gates | `_shared/missing-information.md` |
| Security and synthetic-data rules | `_shared/security-and-data.md` |
| Catalog proposal and reuse boundary | `_shared/catalog-and-reuse.md` |
| Evidence → runtime pattern card routing | `_shared/runtime-pattern-selection.md` |
| Deterministic test vs behavior eval contract | `_shared/testing-contract.md` |
| ADK pattern cards (MCP, A2A, callbacks, event loop, ambient, human input, state, graph/dynamic) | `_shared/adk/*.md` |

## Local Rules

- Keep stage order intact: discover → compose → scaffold → verify; `af-workflow` routes but never skips gates.
- `af-scaffold-runtime` must not consume raw requirements or unapproved compose output.
- Tool Invocation Control uses only Workflow | Agent; `selected_by_llm` and `decision_owner: llm` appear only inside the Compatibility Layer as `legacy` serialization.
- Writing current canonical/proposed artifacts requires `_shared/compatibility-current-schema.md`; unmappable Target judgments become Blockers in `docs/migration/skill-vnext-status.md`, never invented enums.
- Skills do not toggle `manifest.approvals.*` or stage statuses, and never write `catalog/*.yaml` directly.
- Keep `_shared` references generic; skill-specific procedure belongs in that skill's `SKILL.md` or `references/`.
- Reference files stay version-neutral in name; record Checked date, official source, and installed package version inside the file.
- Canonical skills never reference the legacy shims; shims contain no independent procedure.
- Skill output under `artifacts/af/*` is ignored runtime data, not source to commit.

## Verification

- Structural validation: `node scripts/validate-skills.mjs`
- Documentation-only skill edits: `git diff --check`
- Contract-affecting artifacts: `node scripts/validate-artifacts.mjs`
- Scenario/trigger testing: see `tests/skills/README.md` (light models, fresh sessions, no answer leakage)
