# Agent Factory Workbench

Agent Factory is a local-first workbench that turns raw requirements into reviewed planning artifacts and a review-gated ADK Runtime Handoff. Its first user is a development leader who needs to make architecture, ownership, reuse, and delivery boundaries reviewable before implementation begins.

The workbench refines a requirement through a short evidence-preserving flow:

1. **Analyze** the raw requirement, evidence, assumptions, and missing information.
2. **Design and review** asset boundaries, Workflow Graph IR, contracts, ownership, and reuse decisions.
3. **Approve** the reviewed artifacts through explicit human gates.
4. **Build and hand off** only from approved artifacts.
5. **Verify** artifact consistency and record validation evidence and Catalog proposals.

Raw requirements do not directly generate code. ADK Runtime Handoff is a reviewed source-bundle handoff for follow-up implementation or local execution checks; it is not production deployment. The Current Implementation exposes the `legacy` `output_mode` values `smoke` and `runnable`. Both consume reviewed artifacts, and neither represents production business logic or deployment readiness.

## Target Contract

Agent Factory reviews three top-level asset types. Their full definitions, attributes, and decision rules belong only in the canonical [Taxonomy](docs/workbench/taxonomy.md).

- **Agent** — an executable asset with an independent reasoning and judgment responsibility.
- **Workflow** — an executable asset that owns the flow and control of multiple execution units.
- **Tool** — a callable asset with a clear input contract and a clear result or error contract.

Catalog Taxonomy and Workflow Graph IR describe different layers. The Catalog identifies independently reviewed and reusable Agent, Workflow, and Tool contracts; Graph IR describes what a particular Workflow executes, waits for, or joins. A Graph Node may reference a Catalog asset, but a node is not automatically a new asset. See the canonical [Graph IR](docs/workbench/graph-ir.md).

## Migration Status

The documentation has moved first to the Target Contract. The Current Implementation has not: code, schemas, validators, skills, and Catalog data still serialize the `legacy` `module_category` values `agent`, `workflow`, `adapter`, and `remote_a2a`, along with `legacy` identifiers such as `adapter_kind`, `agent_kind`, and `selected_by_llm`. This is not evidence that the new taxonomy is implemented. The current gaps and affected areas are recorded in [Taxonomy vNext Migration Status](docs/migration/taxonomy-vnext-status.md).

## Documentation

- [Documentation index](docs/README.md) — progressive entrypoint for active project documentation.
- [Agent Factory Handbook](docs/handbook/README.md) — source-backed map from workbench behavior to current implementation locations.
- [Operating Model](docs/workbench/operating-model.md) — review stages, approval flow, artifact discipline, and verification expectations.

## Repository Scope

- `.agents/skills`: Agent Factory DLC skills for analysis, boundary review, Runtime Handoff generation, and verification feedback. These operational assets still use `legacy` implementation contracts until a separate migration occurs.
- `packages/web`: React/Vite workbench for artifact review, Workflow Graph IR, Catalog governance, Runtime Handoff, and local verification surfaces.
- `schemas`: Current JSON Schema contracts for normalized requirements, candidates, process flow, and scaffold-plan artifacts; their taxonomy identifiers remain `legacy`.
- `catalog`: Reusable Agent, Workflow, and Tool contracts in the Target model. Current filenames and serialized categories, including the `legacy` file `catalog/adapters.yaml`, remain unchanged during the documentation migration.
- `templates`: Generic reviewed-artifact templates and scaffold-plan validation fixtures.
- `docs`: Canonical concepts, operating guidance, the source-backed Handbook, migration status, validation guidance, and historical records.

## Development

```bash
cd packages/web
npm install
npm run build
```

The web package build runs `tsc --noEmit && vite build`.

Artifact validation runs from the repository root:

```bash
node scripts/validate-artifacts.mjs
node scripts/validate-artifacts.mjs path/to/artifacts
```

## Security Boundary

This repository is a review workbench, not a banking deployment. Do not add private endpoints, credentials, real customer data, internal deployment scripts, or organization-specific runtime code. Runtime Handoff, Mock Lab data, examples, and smoke inputs must use synthetic data and remain local review surfaces.
