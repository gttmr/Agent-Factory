# Module Approval Rubric

Review module candidates before Runtime Handoff.

## Required Per Candidate

| Field family | Requirement |
| --- | --- |
| identity | `id`, `source_requirement_id`, `name` |
| taxonomy | `module_category` plus matching subtype |
| confidence | `confidence`, `rationale`, evidence-backed status |
| contracts | non-empty `inputs` and `outputs` for approved modules |
| risk | `risk_level`, `risk_signals`, side-effect/auth/audit flags when needed |
| ownership | `owner_domain` or `owner` when boundary or risk requires it |
| status | `approved`, `deferred`, `rejected`, or `needs_info` |

Use only top-level categories `agent`, `workflow`, `adapter`, and `remote_a2a`.

## Approval Rules

- Approve only candidates with coherent subtype, I/O, risk, owner, and no unresolved candidate-level missing information.
- Defer or keep `needs_info` when evidence is insufficient.
- Reject duplicates or boundaries that collapse into another approved module.
- Keep `legacy_recommended_type` only as migration evidence, never as primary classification.

## Catalog Reuse

`reuse_candidate` and `catalog_entry_id` are review signals. They do not by themselves approve catalog binding or Runtime Handoff.

## Stop Conditions

- Remote A2A inferred from local workflow shape only.
- Adapter subtype missing or invented.
- Approved candidate lacks required input/output contract.
- Required risk policies are not recorded.

## Grounding

- `scripts/artifact-validation/constants.mjs`
- `packages/web/src/analyzer/types.ts`
- `docs/workbench/agent-factory-harness.md`
