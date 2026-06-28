# Agent Factory DLC Skills

## Scope

This tree contains Agent Factory DLC stage skills and shared references. Edit it
only for explicit skill, DLC workflow, or skill-sync work.

## Structure

- `af-analyze-requirement`: raw requirement to schema-first analysis artifacts.
- `af-design-boundaries`: module, Graph IR, runtime contract, Remote A2A, and reuse review.
- `af-build-runtime-stub`: approved scaffold-plan to runtime handoff bundle.
- `af-verify-feedback`: validation evidence and catalog-delta feedback.
- `_shared`: reference rules used by the stage skills; not a triggerable skill.

## Where To Look

| Task | Location |
| --- | --- |
| Stage trigger and required reading | Each stage `SKILL.md` |
| Shared artifact file contract | `_shared/artifact-contracts.md` |
| Taxonomy and Remote A2A boundaries | `_shared/boundary-rules.md` |
| Runtime contract posture | `_shared/runtime-support-rules.md` |

## Local Rules

- Keep stage order intact: analyze -> design -> build -> verify.
- Do not let `af-build-runtime-stub` consume raw requirements or unapproved analyzer output.
- Keep `_shared` references generic and stage-neutral; stage-specific procedure belongs in that stage's `SKILL.md` or `references/`.
- When a skill changes artifact shape, update schemas, workbench surfaces, validator/generator checks, and active docs in the same change set.
- Skill output under `artifacts/af/*` is ignored runtime data, not source to commit.

## Anti-Patterns

- Do not treat `_shared` as a fifth user-facing skill.
- Do not approve Remote A2A without owner, protocol, auth, lifecycle, timeout, retry, fallback, and audit detail.
- Do not add private endpoints, credentials, customer data, deployment scripts, or production runtime code to examples.

## Verification

- For documentation-only skill edits, run `git diff --check`.
- For contract-affecting skill edits, also run `node scripts/validate-artifacts.mjs`.
- For workbench-facing behavior changes, run `cd packages/web && npm run build`.
