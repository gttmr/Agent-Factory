# Missing Information

## Purpose

Keep unknowns visible and enforce separate requirement-level and candidate-level gates without inventing facts.

## When to read

Read whenever requirement evidence is incomplete, a candidate responsibility or contract is unresolved, a runtime pattern needs missing auth/schema/policy detail, or a reviewer proposes approval despite open questions.

## Decision criteria

Use two layers:

| Layer | Current artifact location | Gate behavior |
| --- | --- | --- |
| Requirement evidence | `evidence.missing_information` | soft gate; analysis may continue with explicit assumptions, but review/acceptance is required for approval |
| Candidate or contract | candidate `missing_information`, `status: "needs_info"`, or contract status | hard gate; blocks candidate approval and Runtime Handoff |

Do not move candidate uncertainty into assumptions to bypass the hard gate. A reviewer acceptance of requirement uncertainty does not resolve a candidate contract.

## Required evidence

Each missing-information record should identify:

- the unknown question;
- evidence searched and evidence absent;
- affected candidate, Graph edge/node, contract, risk, or runtime pattern;
- whether it is a soft or hard gate;
- safe default only when a documented default exists;
- reviewer answer, rationale, and artifact fields to update;
- verification required after resolution.

Current candidate closure may use `missing_information_resolution`, `resolved_missing_information`, `resolution_draft`, `resolution_applied_at`, `schema_review_state`, and `smoke_spec`. Reopen the current schema before writing exact nested shapes.

## Artifact implications

- Preserve evidence, assumptions, contradictions, and missing information separately.
- Do not mark a candidate approved while candidate `missing_information` is non-empty.
- Keep unresolved Target decisions as `needs_info` rather than creating an unknown asset type.
- In Stage Runner mode, resolve through the proposal and explicit apply path; never patch approval booleans directly.

## Scaffold implications

- Block scaffold-plan generation and runnable Runtime Handoff when candidate-level missing information remains.
- Require auth, schema, side-effect, timeout, retry, fallback, audit, and data-policy details only when the selected pattern needs them.
- Do not fill TODOs with private endpoints, credentials, or real data.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Confirm no approved candidate has unresolved missing information and no `needs_info` candidate enters the scaffold plan.

## Stop conditions

Stop when a hard-gate item remains, a reviewer answer has not been applied to the actual artifact, a resolution contradicts evidence, or proceeding would require an invented contract or credential.

## Official sources checked

- [Operating Model approval gates](../../../docs/workbench/operating-model.md#3-승인-게이트-모델)
- [Taxonomy unresolved decisions](../../../docs/workbench/taxonomy.md#workflow-profile)
- Current schema and validator: `schemas/analysis-result.schema.json`, `scripts/validate-artifacts.mjs`

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory Operating Model, Taxonomy, and current schema
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Current soft-gate acceptance and candidate resolution fields are `legacy` product contracts; they do not replace Target review rationale.
