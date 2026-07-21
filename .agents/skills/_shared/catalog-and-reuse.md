# Catalog and Reuse

## Purpose

Separate asset reuse decisions, Catalog proposals, and approval-gated publication from direct Catalog edits.

## When to read

Read when comparing candidates with existing assets, assigning reuse status, proposing runtime contracts or synthetic mocks, or preparing verification feedback for Reuse Hub.

## Decision criteria

Use the canonical [`reuse_status`](../../../docs/workbench/taxonomy.md#reuse-governance) meanings. Keep reuse state independent from asset type, domain scope, and owner.

Distinguish:

- reuse of an already reviewed Catalog asset;
- a new publish candidate;
- project-only implementation;
- an excluded or not-yet-reviewed candidate.

Do not infer reuse from similar names. Require compatible responsibility, input/output, side effect, owner, version, security, and runtime contract evidence.

## Required evidence

For each reuse decision, record:

- candidate and Catalog identifiers;
- responsibility and schema comparison;
- owner and version compatibility;
- auth, data, side-effect, timeout, retry, and audit compatibility;
- decision: reuse, publish proposal, project-only, excluded, or unresolved;
- divergence and follow-up needed;
- synthetic mock contract when local validation needs one.

## Artifact implications

- Write proposal feedback only to `artifacts/af/<req-id>/catalog-delta.yaml` or the Stage Runner Verify proposal path.
- Do not edit `catalog/*.yaml` from a DLC skill.
- Each `proposed_additions[]` item is an Agent, Workflow, or Tool entry. It may carry a deterministic synthetic `runtime_mock`; runtime contract differences belong in that entry's reviewed fields or notes, not in a separate top-level Catalog category.
- Keep private endpoints, credentials, customer data, deployment scripts, and production logic out of proposals.
- Proposal existence and Verify apply do not publish an entry.

## Scaffold implications

- Bind reviewed existing assets by stable Catalog reference when contracts match.
- Keep publish candidates as proposals; do not scaffold against a future Catalog ID as though publication occurred.
- Use local synthetic mocks for unresolved external dependencies only when the mock contract is reviewed.
- Preserve manual completion notes for unavailable runtime contracts.

## Verification

```bash
git diff --name-only -- catalog
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

The first command must print no Catalog path after skill execution. Verify proposal syntax and sanitize evidence before publication review.

## Stop conditions

Stop when reuse compatibility is unproven, publication approval is absent, a proposal contains sensitive data, a future Catalog entry is treated as existing, or any skill action would directly change `catalog/*.yaml`.

## Official sources checked

- [Taxonomy Reuse Governance](../../../docs/workbench/taxonomy.md#reuse-governance)
- [Operating Model Catalog governance](../../../docs/workbench/operating-model.md#5-catalog재사용-거버넌스)
- Current publish boundary: `POST /api/catalog/publish`

## Checked date

- Checked date: 2026-07-20
- Official sources: Agent Factory Taxonomy and Operating Model
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Current Catalog proposals and publish APIs are product contracts; `reuse_status` remains the Target governance vocabulary.
