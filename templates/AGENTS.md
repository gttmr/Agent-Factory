# Artifact Templates And Fixtures

## Scope

`templates` contains generic artifact templates and regression scenarios consumed
by the validator, source generator tests, analyzer tests, and smoke examples.

Template vocabulary follows the strict Target Contract v2 schemas. Agent, Workflow,
and Tool meanings are canonical in [Taxonomy](../docs/workbench/taxonomy.md), and
Graph shapes are canonical in [Graph IR](../docs/workbench/graph-ir.md).

## Structure

- Top-level JSON/YAML files are generic starting templates.
- `scaffold-plan.template.json` defines approved Runtime Handoff input shape.
- `regression-scenarios`: end-to-end artifact directories for validator and generator coverage.

## Local Rules

- Fixtures must satisfy the active strict Target v2 schemas and web validator; they do not define the contract independently.
- Scenario data must stay synthetic; banking terminology is review scaffolding only.
- Runnable scenarios still come from approved artifacts with `raw_requirement_to_code=false`.
- Keep fixture updates paired with validator/generator/analyzer tests when they cover behavior.
- Prefer adding or updating a scenario when a contract changes, not embedding a special case in code.

## Anti-Patterns

- Do not put credentials, private endpoints, real customer data, or deployment scripts in fixtures.
- Do not use old scenario shapes as authority over `schemas/` and active docs.
- Do not create a fixture that passes only by relying on generator hard-coded domain literals.

## Verification

```bash
node scripts/validate-artifacts.mjs
node scripts/generate-adk-source.test.mjs
```

Run `cd packages/web && npm run test:analyzer` when web analyzer/import paths are involved.
