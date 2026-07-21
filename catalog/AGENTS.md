# Seed Catalogs

## Scope

`catalog` contains versioned seed contracts for reusable Agent, Workflow, and
Tool assets, plus domain owners, risk gates, and detailed contract bodies under
`catalog/contracts`.

Asset meanings are canonical in [Taxonomy](../docs/workbench/taxonomy.md).

## Structure

- `agents.yaml`: Agent assets, including optional A2A binding or exposure.
- `workflows.yaml`: Workflow assets and their workflow profiles.
- `tools.yaml`: Tool assets, including Function, MCP, or built-in bindings.
- `domain-owners.yaml`: ownership hints.
- `risk-gates.yaml`: risk signals used by candidates and review.
- `contracts/*`: detailed protocol contract bodies.

## Local Rules

- Catalog reads and publication use only the `agents`, `workflows`, and `tools` buckets.
- Every row must use strict Target fields such as `asset_id`, `asset_type`, `domain_scope`, `owner`, `reuse_status`, `binding`, and `connection`.
- Seed entries are runtime-oriented contracts, not production integrations.
- `runtime_mock` payloads must be deterministic synthetic local smoke data.
- Human PR seed edits are allowed, but app writes must go through Reuse Hub publish from reviewed `catalog-delta.yaml`.
- Keep fields aligned with schemas, analyzer types, publish validation, and UI.
- Risk signals should line up with `risk-gates.yaml`.

## Anti-Patterns

- Do not create another Catalog bucket or project one asset type into another.
- Do not treat A2A as a Catalog category; it is an Agent protocol boundary.
- Do not add private endpoints, credentials, deployment scripts, real customer data, or organization-specific business logic.
- Do not repurpose Catalog entries as reviewer approval records; approval lives in artifact roots.

## Verification

```bash
node scripts/validate-artifacts.mjs
cd packages/web && npm run test:analyzer
```

Review YAML diffs carefully because publish can canonicalize formatting.
