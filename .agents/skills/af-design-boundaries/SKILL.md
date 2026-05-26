---
name: af-design-boundaries
description: Refine Agent Factory analysis artifacts into approved module, workflow, runtime contract, catalog reuse, and Remote A2A boundary decisions. Use when Codex must review module candidates, Graph IR, runtimeContracts, A2A contracts, schema I/O, and reuse decisions before any Runtime Handoff or stub generation.
---

# AF Design Boundaries

## Overview

Use this skill for the second DLC stage: reviewed analysis artifacts -> approved boundary design.
This is the human-review gate before Runtime Handoff or source stub generation.

## Required Reading

- Read `../_shared/agent-factory-dlc.md`.
- Read `../_shared/artifact-contracts.md`.
- Read `../_shared/boundary-rules.md`.
- Read `../_shared/runtime-support-rules.md`.
- Read `references/design-review.md`.
- Read repo-root `<repo>/docs/workbench/taxonomy.md`, `<repo>/docs/workbench/workflow-decision-guide.md`, and relevant `<repo>/schemas/` files when artifact fields are uncertain.

## Workflow

1. Load `artifacts/af/<req-id>/af-run-manifest.json` and `analysis-result.json`.
2. Verify the previous stage exists. If the user supplies only a canonical `analysis-result.json` fixture for dry-run or continuation, treat it as a read-only stand-in for missing split artifacts and report that no manifest-backed approval can be recorded until an artifact root exists. If no canonical analysis artifact exists, stop and ask for the analysis artifact path.
3. Review each module candidate for category, subtype, ownership, I/O schema, risk, reuse, and missing information.
4. Update Graph IR only through valid node, container, edge, lane, and execution semantics from the repo schemas.
5. Add or refine `runtimeContracts` for MCP/EAI/Legacy adapters, Context Manager, Callback Broker, ADK callbacks, and async resume when evidence requires them.
6. Add or refine `a2aContracts` only when the Remote A2A high-friction contract is present.
7. Write `boundary-design.md`, update `analysis-result.json`, and refresh split artifacts.
8. Record human approval status in `af-run-manifest.json`.

## Gate

Do not approve a candidate with unresolved candidate-level `missing_information`.
Do not move to `af-build-runtime-stub` until approved modules, required runtime contracts, Graph IR, and Remote A2A contracts are coherent.
