# Agent Factory Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Evolve the current ADK/A2A skill-note repository into a generic, public, multi-domain agent-factory reference kit with documentation, schemas, graph visualization, validation, scaffold generation, and a local frontend workbench.

**Architecture:** Keep the existing `.agents/skills/adk-a2a-agent-generate` skill as the single-request unit workflow. Add a portfolio-level layer around it: intake templates, registry schemas, validation CLI, graph exporter, scaffold generator, and frontend workbench. Preserve the repository rule that public examples remain generic and do not include private bank data or deployment assumptions.

**Tech Stack:** Markdown docs, JSON Schema/YAML templates, Python CLI for validation and generation, Mermaid for static diagrams, React/Vite or Next.js for a local frontend workbench.

---

## Phase 1: Documentation and Architecture Baseline

### Task 1: Add multi-domain agent-factory playbook

**Objective:** Document how leaders should process many unstructured domain requests before implementation.

**Files:**
- Create: `docs/playbooks/multi-domain-agent-factory.md`
- Modify: `docs/README.md`

**Content requirements:**
- Explain intake -> capability extraction -> classification -> registry match -> architecture review -> scaffold -> eval -> registry update.
- Include the rule: function = tool, responsibility = agent, process = workflow, independent boundary = A2A.
- Include stakeholder workshop guidance.
- Keep examples generic: `credit`, `cards`, `risk`, `customer` can be illustrative but not private.

**Verification:**
- `docs/README.md` links to the new playbook.
- No private organization-specific content appears.

### Task 2: Add boundary taxonomy reference

**Objective:** Promote existing boundary rules into a human-facing reference page.

**Files:**
- Create: `docs/reference/boundary-taxonomy.md`
- Modify: `docs/reference/target-agent-architecture/README.md`

**Content requirements:**
- Define Tool/Adapter, Metadata Registry, Specialist Agent, Shared Agent, Internal Workflow, Remote A2A.
- Explain evidence for and against each boundary.
- Cross-link existing `.agents/skills/adk-a2a-agent-generate/references/*` files.

**Verification:**
- `target-agent-architecture/README.md` points to the taxonomy.

### Task 3: Add governance and risk classification reference

**Objective:** Define readiness and risk gates for regulated enterprise projects.

**Files:**
- Create: `docs/reference/risk-classification.md`
- Create: `docs/reference/definition-of-ready.md`

**Content requirements:**
- Define low/medium/high risk.
- High risk includes customer impact, money movement, approval/rejection, personal data, compliance impact.
- Define human-in-the-loop defaults.
- Define minimum artifacts before scaffolding.

**Verification:**
- A use case cannot be marked scaffold-ready unless owner, schemas, risk, eval cases, and decision record exist.

## Phase 2: Templates and Schemas

### Task 4: Add intake and registry templates

**Objective:** Provide copyable YAML templates for normalized work.

**Files:**
- Create: `templates/usecase-intake.yaml`
- Create: `templates/capability.yaml`
- Create: `templates/tool.yaml`
- Create: `templates/agent.yaml`
- Create: `templates/workflow.yaml`
- Create: `templates/a2a-contract.yaml`
- Create: `templates/decision-record.md`
- Create: `templates/eval-case.yaml`

**Verification:**
- Every template has stable IDs, owner, domain, status, and notes fields.

### Task 5: Add JSON schemas

**Objective:** Make templates machine-validatable.

**Files:**
- Create: `schemas/usecase.schema.json`
- Create: `schemas/capability.schema.json`
- Create: `schemas/tool.schema.json`
- Create: `schemas/agent.schema.json`
- Create: `schemas/workflow.schema.json`
- Create: `schemas/a2a-contract.schema.json`
- Create: `schemas/eval-case.schema.json`

**Verification:**
- Schemas validate the example templates.
- Required fields match definition-of-ready.

## Phase 3: Validation and Registry CLI

### Task 6: Create Python package skeleton

**Objective:** Add a small local CLI without assuming private infrastructure.

**Files:**
- Create: `pyproject.toml`
- Create: `packages/core/agent_factory/__init__.py`
- Create: `packages/core/agent_factory/cli.py`
- Create: `packages/core/agent_factory/validate.py`
- Create: `tests/test_cli_smoke.py`

**CLI commands:**
- `agent-factory validate <path>`
- `agent-factory graph <registry_dir>`
- `agent-factory classify <usecase_path>` initially rule-based and minimal

**Verification:**
- `python -m pytest` passes.
- `agent-factory --help` works.

### Task 7: Implement schema validation

**Objective:** Validate YAML files against schemas.

**Files:**
- Modify: `packages/core/agent_factory/validate.py`
- Create: `tests/fixtures/valid_usecase.yaml`
- Create: `tests/fixtures/invalid_usecase.yaml`
- Create: `tests/test_schema_validation.py`

**Verification:**
- Valid fixture passes.
- Invalid fixture fails with a useful error message.

### Task 8: Implement registry consistency checks

**Objective:** Detect duplicate IDs and broken references across registries.

**Files:**
- Create: `packages/core/agent_factory/registry.py`
- Create: `tests/test_registry_consistency.py`

**Checks:**
- duplicate capability IDs
- agent references missing tools
- A2A contract references missing source/target agents
- workflows referencing missing capabilities

**Verification:**
- Tests cover valid and invalid registries.

## Phase 4: Graph Visualization

### Task 9: Add Mermaid graph exporter

**Objective:** Generate visual diagrams from registry data.

**Files:**
- Create: `packages/core/agent_factory/graph.py`
- Create: `docs/diagrams/README.md`
- Create: `tests/test_graph_export.py`

**Graph outputs:**
- domain -> capability graph
- agent -> tool graph
- A2A topology graph

**Verification:**
- CLI writes Mermaid text.
- Tests assert stable graph output for fixtures.

### Task 10: Add example registries and diagrams

**Objective:** Provide generic examples that demonstrate the system.

**Files:**
- Create: `examples/registries/capabilities.yaml`
- Create: `examples/registries/tools.yaml`
- Create: `examples/registries/agents.yaml`
- Create: `examples/registries/a2a_contracts.yaml`
- Create: `docs/diagrams/example-a2a-topology.mmd`

**Verification:**
- Example registries pass validation.
- Graph command can regenerate the Mermaid diagram.

## Phase 5: Scaffold Generator

### Task 11: Add scaffold generator

**Objective:** Generate an ADK-oriented skeleton only from approved specs.

**Files:**
- Create: `packages/core/agent_factory/scaffold.py`
- Create: `tests/test_scaffold_generation.py`

**Generated files:**
- `agents/<agent_name>/agent.py`
- `agents/<agent_name>/README.md`
- `agents/<agent_name>/agent.yaml`
- `agents/<agent_name>/tools.yaml`
- `agents/<agent_name>/a2a.yaml`
- `agents/<agent_name>/tests/test_contract.py`
- `agents/<agent_name>/evals/golden_cases.yaml`
- `agents/<agent_name>/decision.md`

**Verification:**
- Generator refuses unapproved or incomplete specs.
- Generated scaffold keeps business logic as explicit TODOs.

## Phase 6: Frontend Workbench

### Task 12: Create frontend workbench shell

**Objective:** Add a local UI for architecture review, not a production chat app.

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/styles.css`

**Screens:**
- Use Case Intake
- Classification Review
- Registry Browser
- Graph View
- Simulation/Test Panel

**Verification:**
- `npm install && npm run dev` launches locally.
- Mock data renders without backend.

### Task 13: Add mock review flow

**Objective:** Make the frontend useful before backend integration.

**Files:**
- Create: `packages/web/src/mockData.ts`
- Create: `packages/web/src/components/ClassificationReview.tsx`
- Create: `packages/web/src/components/GraphView.tsx`
- Create: `packages/web/src/components/RegistryBrowser.tsx`

**Verification:**
- User can inspect a mock use case, classification, registry reuse, risk, and A2A topology.

## Final Verification

Run:

```bash
python -m pytest
npm --prefix packages/web run build
agent-factory validate examples/registries
agent-factory graph examples/registries --format mermaid
```

Expected result:

- tests pass
- frontend builds
- example registries validate
- diagrams generate deterministically
