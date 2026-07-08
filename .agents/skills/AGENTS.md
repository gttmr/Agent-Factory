# Agent Factory DLC Skills

## Scope

This tree contains Agent Factory DLC stage skills and shared references. Edit it
only for explicit skill, DLC workflow, or skill-sync work.

## Structure

- `af-analyze-requirement`: raw/imported requirement to schema-first analysis proposals.
- `af-design-boundaries`: module, Graph IR, runtime contract, Remote A2A, and reuse review.
- `af-build-runtime-stub`: approved scaffold-plan artifacts to Runtime Handoff bundle.
- `af-verify-feedback`: validation evidence, runtime-stub checks, and catalog-delta feedback.
- `_shared`: stage-neutral topic references; not a triggerable skill.

Shared references:

- `_shared/workflow-invariants.md`
- `_shared/artifact-root-stage-runner.md`
- `_shared/taxonomy-boundaries.md`
- `_shared/missing-information-gates.md`
- `_shared/runtime-contracts.md`
- `_shared/catalog-feedback.md`
- `_shared/adk-2.3-baseline.md`
- `_shared/adk-2.3-routes.md`
- `_shared/adk-2.3-data-handling.md`
- `_shared/adk-2.3-human-input.md`
- `_shared/adk-2.3-dynamic.md`
- `_shared/adk-2.3-remote-a2a.md`

## Where To Look

| Task | Location |
| --- | --- |
| Stage trigger and step gates | Each stage `SKILL.md` |
| Stage order and non-goals | `_shared/workflow-invariants.md` |
| Artifact root, run ledger, proposed files | `_shared/artifact-root-stage-runner.md` |
| Taxonomy and Remote A2A boundary rules | `_shared/taxonomy-boundaries.md` |
| Missing-information hard and soft gates | `_shared/missing-information-gates.md` |
| Runtime contract posture | `_shared/runtime-contracts.md` |
| Catalog proposal boundary | `_shared/catalog-feedback.md` |
| ADK baseline and truth order | `_shared/adk-2.3-baseline.md` |
| Route/join lowering review | `_shared/adk-2.3-routes.md` |
| State/artifact channel lowering review | `_shared/adk-2.3-data-handling.md` |
| Human input lowering review | `_shared/adk-2.3-human-input.md` |
| Dynamic workflow lowering review | `_shared/adk-2.3-dynamic.md` |
| Remote A2A lowering review | `_shared/adk-2.3-remote-a2a.md` |
| Analyze-specific output and shapes | `af-analyze-requirement/references/` |
| Design-specific review rubrics | `af-design-boundaries/references/` |
| Build-specific sync and runtime checks | `af-build-runtime-stub/references/` |
| Verify-specific allow-list and reports | `af-verify-feedback/references/` |

## Local Rules

- Keep stage order intact: analyze -> design -> build -> verify.
- Do not let `af-build-runtime-stub` consume raw requirements or unapproved analyzer output.
- Keep `_shared` references generic and stage-neutral; stage-specific procedure belongs in that stage's `SKILL.md` or `references/`.
- Stage Runner proposed-first mode is primary; standalone canonical mode is secondary.
- Stage skills do not toggle `manifest.approvals.*` or stage statuses directly.
- Remote A2A contracts are canonical in `analysis-result.json.a2aContracts[]`; do not treat split `a2a-contracts.json` as a standard artifact.
- When a skill changes artifact shape, update schemas, workbench surfaces, validator/generator checks, and active docs in the same change set.
- Skill output under `artifacts/af/*` is ignored runtime data, not source to commit.

## Anti-Patterns

- Do not treat `_shared` as a fifth user-facing skill.
- Do not approve Remote A2A without owner, protocol, auth, lifecycle, timeout, retry, fallback, and audit detail.
- Do not add private endpoints, credentials, customer data, deployment scripts, or production runtime code to examples.
- Do not teach freehand ADK coding from raw requirements; ADK details here are for generated-output review and Graph IR mapping.
- Do not write `catalog/*.yaml` from DLC skills; use `catalog-delta.yaml` proposals and the approval-gated publish path.

## Verification

- For documentation-only skill edits, run `git diff --check`.
- For contract-affecting skill edits, also run `node scripts/validate-artifacts.mjs`.
- For workbench-facing behavior changes, run `cd packages/web && npm run build`.
