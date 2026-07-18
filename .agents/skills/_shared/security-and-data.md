# Security and Data

## Purpose

Keep skill artifacts, fixtures, Runtime Handoff, and validation evidence safe for repository and local-review use.

## When to read

Read when requirements mention authentication, private systems, personal or financial data, external calls, side effects, audit, callbacks, ambient triggers, A2A, MCP, artifacts, or test fixtures.

## Decision criteria

Use the minimum data and authority needed for review:

- represent secrets by environment-variable names or secret references, never values;
- replace private endpoints and identifiers with synthetic placeholders;
- use deterministic synthetic inputs and outputs for mocks and smoke tests;
- separate read, write, notification, transaction, and approval side effects;
- require explicit auth, authorization, audit, masking, retention, and replay decisions where the pattern crosses a boundary;
- keep local Runtime Handoff and `/run` evidence distinct from production readiness.

## Required evidence

Record:

- data classification and prohibited fields;
- source ACL and least-privilege requirement;
- secret injection mechanism and allowed environment-variable name pattern;
- side-effect and idempotency boundary;
- audit event, actor, correlation identifier, and redaction policy;
- retention/deletion requirement for state, artifacts, logs, and run ledgers;
- synthetic fixture provenance;
- threat or failure scenarios relevant to the selected runtime pattern.

## Artifact implications

Do not place any of the following in requirements normalized for examples, proposals, Catalog deltas, evidence, mocks, or generated source:

- credentials, tokens, keys, cookies, or secret values;
- private endpoints or internal hostnames;
- real customer or banking data;
- production payload captures or full private terminal history;
- organization-specific deployment scripts or runtime business logic.

Preserve only sanitized summaries and references. Catalog proposals may contain deterministic synthetic mock payloads, not production data.

## Scaffold implications

- Use environment lookups with approved variable names; do not generate secret defaults.
- Default side-effecting examples to disabled, mocked, or manual-review paths.
- Add idempotency and duplicate-delivery handling for at-least-once tools, ambient triggers, and resume paths.
- Keep auth, timeout, retry, fallback, cancellation, and cleanup explicit for MCP/A2A connections.
- Do not emit deployment automation from a skill-only Runtime Handoff.

## Verification

- Inspect the changed-file inventory and generated artifact tree.
- Search the authorized output set for secret patterns, private hosts, and copied production payloads.
- Run applicable artifact validation and pattern-specific negative scenarios.
- Record redactions and residual security uncertainty without reproducing the sensitive value.

## Stop conditions

Stop when a task requires a real secret, private endpoint, customer record, unapproved side effect, production deployment authority, or retention policy that has not been decided.

## Official sources checked

- [Operating Model security boundary](../../../docs/workbench/operating-model.md#7-보안비공개-경계)
- [Agent Factory local development security](../../../docs/workbench/local-dev-security.md)
- Pattern-specific ADK official pages linked from `adk/` cards

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory Operating Model and local-development security guidance
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Local Workbench and Runtime Handoff success is not evidence of production authorization, security review, or deployment readiness.
