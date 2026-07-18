# Seed Catalogs

## Scope

`catalog` contains versioned seed runtime contracts for reusable agents,
workflows, adapters, Remote A2A contracts, domain owners, risk gates, and richer
contract bodies under `catalog/contracts`.

The category/subtype enums and files below are Current Implementation (`legacy`) contracts; Target assets are defined by [Taxonomy](../docs/workbench/taxonomy.md), and the gap is tracked in `docs/migration/taxonomy-vnext-status.md`.

## Structure

- `agents.yaml`, `workflows.yaml`, `adapters.yaml`, `remote-a2a-contracts.yaml`: Current Implementation (`legacy`) category catalogs.
- `domain-owners.yaml`: ownership hints.
- `risk-gates.yaml`: risk signals used by candidates and review.
- `contracts/*`: detailed MCP/A2A contract bodies.

## Local Rules

- Seed entries are runtime-oriented contracts, not production integrations.
- `runtime_mock` payloads must be deterministic synthetic local smoke data.
- Human PR seed edits are allowed, but app writes must go through Reuse Hub publish from reviewed `catalog-delta.yaml`.
- Keep the Current Implementation (`legacy`) category and subtype values aligned with schemas, analyzer types, validator, and UI.
- Risk signals should line up with `risk-gates.yaml`.

## Anti-Patterns

- Do not add private endpoints, credentials, deployment scripts, real customer data, or organization-specific business logic.
- Do not repurpose catalog entries as reviewer approval records; approval lives in artifact roots.
- Do not merge the Current Implementation (`legacy`) Remote A2A and Adapter contracts.

## Verification

```bash
node scripts/validate-artifacts.mjs
cd packages/web && npm run test:analyzer
```

Review YAML diffs carefully because publish can canonicalize formatting.
