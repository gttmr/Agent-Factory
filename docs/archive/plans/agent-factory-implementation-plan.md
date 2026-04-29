# Agent Factory Implementation Plan

Agent Factory is a workbench-first repository. The first implementation priority is consistent requirement intake, classification, review, and export artifacts.

## Current Foundation

- `packages/web` provides the local-first workbench UI.
- `schemas` defines artifact contracts.
- `templates` provides generic artifact examples.
- `docs` records validation and scaffold bridge rules.

## Taxonomy

The workbench uses four top-level categories:

- Agent
- Workflow
- Adapter
- Remote A2A

Adapter subtypes preserve callable capability distinctions such as legacy API, retrieval, rule registry, data query, template, computation, and external service.

## Implementation Order

1. Keep README and AGENTS aligned with the workbench-first role.
2. Keep schema and TypeScript models synchronized.
3. Keep mock analysis deterministic and network-free.
4. Keep UI labels aligned with the approved taxonomy.
5. Keep exported artifacts scaffold-ready and review-gated.
6. Add live analyzer providers only through a trusted backend boundary.
7. Add scaffold generation only after approved artifact contracts stabilize.
