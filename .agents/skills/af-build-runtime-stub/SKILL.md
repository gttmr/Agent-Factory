---
name: af-build-runtime-stub
description: Build TODO-only Agent Factory runtime stubs from approved scaffold-plan artifacts. Use when Codex must generate or prepare ADK Runtime Handoff source bundles from approved modules, runtime contracts, Graph IR, and catalog bindings while preserving raw_requirement_to_code=false and no runnable business logic.
---

# AF Build Runtime Stub

## Overview

Use this skill for the third DLC stage: approved artifacts -> TODO-only runtime stub.
The stub makes contracts executable enough for structural smoke, then directs developers to replace TODOs with reviewed runtime wiring and business logic in a separate implementation task.

## Required Reading

- Read `../_shared/agent-factory-dlc.md`.
- Read `../_shared/artifact-contracts.md`.
- Read `../_shared/adk-2.md`.
- Read `references/runtime-stub.md`.
- Read repo-root `<repo>/schemas/scaffold-plan.schema.json` and `<repo>/scripts/generate-adk-source.mjs` before generating source.

## Workflow

1. Load the approved `artifacts/af/<req-id>/af-run-manifest.json`, `analysis-result.json`, and `scaffold-plan.json`.
2. Refuse to build from raw requirements, unapproved candidates, unresolved Graph IR errors, unapproved required runtime contracts, or `a2aContracts` that are required for Remote A2A but not `approved`.
3. Generate source under `artifacts/af/<req-id>/runtime-stub/`.
4. Keep `raw_requirement_to_code=false`, `no_runnable_business_logic=true`, TODO runtime wiring, and TODO business logic explicit.
5. Include synthetic `runtime_mock` only as deterministic local smoke output when already present in reviewed catalog contracts.
6. Write `implementation-handoff.md` with exact TODOs and non-goals.
7. Update `af-run-manifest.json` with generated paths and verification commands.

## Gate

Do not write real endpoints, credentials, private deployment scripts, customer data, or production business logic.
Do not mark the stub production-ready; it is a reviewed handoff surface for the next implementation task.
