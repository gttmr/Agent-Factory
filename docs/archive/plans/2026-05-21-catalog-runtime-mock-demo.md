# Catalog Runtime Mock Demo Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task when parallel execution is useful.

**Goal:** Replace the seed catalog with a coherent synthetic banking demo catalog whose approved catalog-bound modules can generate ADK source and return deterministic mock outputs during local smoke runs.

**Architecture:** Keep catalog entries as runtime contracts, but add an explicit `runtime_mock` payload to seeded catalog rows. `buildScaffoldPlan` carries that payload into `ScaffoldPlanModule`; `buildAdkSourceBundle` embeds it into generated `COMPONENT_CONTRACTS` and generated node functions return it as ADK `Event.output` in stub mode. This keeps private endpoints and real business logic out while making local smoke execution meaningful.

**Tech Stack:** TypeScript, React/Vite, YAML seed catalogs, generated Python ADK source.

---

### Task 1: Add runtime_mock to catalog/scaffold types

**Objective:** Allow seed catalog entries to carry deterministic mock output without changing taxonomy.

**Files:**
- Modify: `packages/web/src/catalog/types.ts`
- Modify: `packages/web/src/catalog/seed.ts`
- Modify: `packages/web/src/analyzer/types.ts`
- Modify: `packages/web/src/analyzer/scaffoldPlan.ts`
- Modify: `schemas/scaffold-plan.schema.json`

**Steps:**
1. Add `runtime_mock?: Record<string, unknown> | null` to `CatalogEntry` and `ScaffoldPlanModule`.
2. Add `runtime_mock` to AgentRow/AdapterRow/WorkflowRow/RemoteRow seed parser interfaces.
3. Copy `catalogEntry?.runtime_mock ?? null` into scaffold modules.
4. Add optional `runtime_mock` object property to scaffold-plan schema.
5. Run `cd packages/web && npm run build`.

### Task 2: Generate runnable mock Event outputs

**Objective:** Make generated ADK nodes return catalog mock outputs instead of only TODO placeholders when a reviewed catalog contract includes `runtime_mock`.

**Files:**
- Modify: `packages/web/src/analyzer/adkSource.ts`

**Steps:**
1. Embed `runtime_mock` in `COMPONENT_CONTRACTS`.
2. Add a generated Python helper that merges `_event_output(...)` with `contract["runtime_mock"]`.
3. For catalog-bound stub/adapter/agent/workflow nodes with `runtime_mock`, return `Event(output=_contract_stub_output(...))`.
4. Preserve TODO boundaries for non-catalog or no-mock modules.
5. Preserve `mcp_contract_call` metadata for adapter runtime mode.
6. Run `cd packages/web && npm run build`.

### Task 3: Rewrite seed catalog as one coherent complete mock scenario

**Objective:** Replace proposed/runtime_config_required assets with approved synthetic assets that cover intake → lookup → rules → reasoning → template generation.

**Files:**
- Replace: `catalog/agents.yaml`
- Replace: `catalog/adapters.yaml`
- Replace: `catalog/workflows.yaml`
- Replace: `catalog/remote-a2a-contracts.yaml`
- Update if needed: `catalog/contracts/**`

**Steps:**
1. Use synthetic demo data only.
2. Set `status: approved`, `contract_status: mock_ready`, and `runtime_binding: stub` for local runnable assets.
3. Include complete inputs, outputs, risk signals, and `runtime_mock` payloads.
4. Keep Remote A2A either empty or explicitly approved synthetic; do not imply remote boundary unless required.
5. Run artifact validation for catalog contracts.

### Task 4: Update docs and fixtures

**Objective:** Make active documentation describe mock-ready catalog semantics.

**Files:**
- Modify: `README.md`
- Modify: `docs/workbench/validation.md`
- Modify if needed: `templates/scaffold-plan.template.json`

**Steps:**
1. Explain that seed catalog can include deterministic synthetic runtime mocks for local smoke.
2. Clarify mocks remain synthetic test doubles, not private banking implementations.
3. Update scaffold-plan template with `runtime_mock` example if the schema now supports it.
4. Run `node scripts/validate-artifacts.mjs templates`.

### Task 5: Verify end-to-end

**Objective:** Prove changes compile and artifact validation still passes.

**Commands:**
- `node scripts/validate-artifacts.mjs templates`
- `node scripts/validate-artifacts.mjs catalog/contracts`
- `cd packages/web && npm run build`

**Manual smoke:**
1. Open `http://127.0.0.1:5173/`.
2. Enter a loan precheck use case that mentions document intake, customer/account lookup, rules, risk reasoning, and customer notice template.
3. Approve catalog-bound modules.
4. Generate source in ADK Runtime Handoff with stub mode.
5. Run smoke and confirm events include `stubbed_runtime_contract` plus catalog mock output fields.
