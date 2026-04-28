# Phase 1 Requirement Intake Workbench Plan

> **For Codex:** Implement this plan incrementally. Follow the project `AGENTS.md`: keep this repository public, generic, documentation/skill/template focused, and do not add private bank data, private endpoints, private deployment scripts, credentials, or organization-specific runtime code.

**Goal:** Build the first planning and implementation foundation for a frontend workbench that accepts imperfect stakeholder text requirements, uses an LLM-style analysis pipeline to normalize them, and helps architects split incorrectly named “agents” into the right reusable modules: tool adapter, knowledge retrieval, internal workflow, specialist agent, shared agent, metadata registry, or remote A2A contract.

**Architecture:** Start with a local-first architecture workbench, not a production chat UI. The frontend should let users paste or upload semi-structured text, run a mock/adapter-based analysis, show evidence and classification results, allow human correction, and materialize normalized specs into reusable registry-style modules. The first phase should be UI + schemas + mock analyzer + review flow; real LLM provider integration comes later behind an adapter interface.

**Tech Stack:** Public docs + JSON Schema/YAML templates + TypeScript frontend. Prefer React/Vite for a small local workbench unless the repo later chooses another frontend stack. Keep backend optional in Phase 1 by using mock data and pure TypeScript analysis stubs.

---

## Product Framing

Stakeholders will submit requirements that are almost structured but not perfect. They may omit fields, contradict themselves, or call everything an “agent.” The workbench must support that reality.

The system should:

1. accept raw stakeholder text
2. preserve the raw source
3. extract evidence
4. normalize the request into an internal use case spec
5. identify missing or contradictory information
6. classify requested functionality into proper implementation units
7. split one incorrectly named “agent” into multiple modules when needed
8. show reusable modules and process flow
9. allow human architect edits before anything becomes approved
10. export normalized specs and registry candidates for later scaffolding

The first phase is not about generating final ADK agents. It is about making messy demand legible and governable.

## Key Concepts

### Raw Requirement

The original user-submitted text. Never overwrite it.

### Normalized Use Case

A structured interpretation of the raw requirement.

### Evidence Summary

Short factual extraction from the requirement:

- requested goal
- business domain hint
- user role
- input data
- output data
- systems mentioned
- decisions implied
- risk signals
- missing information
- contradictions

### Module Candidate

A classified unit produced from the requirement:

- `tool_adapter`
- `knowledge_retrieval`
- `internal_workflow`
- `specialist_agent`
- `shared_agent`
- `metadata_registry`
- `remote_a2a_contract`

### Process Flow

A visual flow showing module input/output order and dependencies.

### Architect Review

Human confirmation/edit step before a module enters the shared registry.

---

## Phase 1 Scope

### In Scope

- Documentation for the requirement intake workbench
- JSON schema for raw/normalized requirement and module candidates
- TypeScript frontend shell
- mock analyzer that simulates LLM output deterministically
- review UI for correcting classification
- registry candidate view
- process flow visualization using mock data
- export/download JSON for normalized use case and modules

### Out of Scope

- real bank data
- real login/auth
- real LLM provider integration
- production ADK scaffold generation
- real MCP server integration
- deployment configuration
- private system/API connections

---

## Data Model Draft

### Normalized Requirement

```json
{
  "id": "req-001",
  "title": "Customer complaint triage assistant",
  "raw_text": "...",
  "domain": "customer-service",
  "requester": {
    "team": "example-domain",
    "role": "business-user"
  },
  "business_goal": "Reduce time spent triaging complaints.",
  "current_process": [
    "Read complaint text",
    "Check customer profile",
    "Classify issue type",
    "Draft response or route to specialist"
  ],
  "inputs": [
    { "name": "complaint_text", "type": "text", "required": true },
    { "name": "customer_id", "type": "string", "required": false }
  ],
  "outputs": [
    { "name": "triage_category", "type": "string" },
    { "name": "recommended_next_step", "type": "string" }
  ],
  "systems": [
    { "name": "customer_profile_system", "access": "unknown" }
  ],
  "risk_signals": ["customer_impact", "personal_data"],
  "missing_information": ["Exact category taxonomy", "System access method"],
  "contradictions": [],
  "status": "draft"
}
```

### Module Candidate

```json
{
  "id": "mod-001",
  "source_requirement_id": "req-001",
  "name": "customer_profile_lookup",
  "recommended_type": "tool_adapter",
  "confidence": 0.82,
  "rationale": "This is a deterministic system lookup with clear input/output.",
  "inputs": [
    { "name": "customer_id", "type": "string" }
  ],
  "outputs": [
    { "name": "customer_profile", "type": "object" }
  ],
  "reuse_candidate": true,
  "risk_level": "medium",
  "status": "needs_review"
}
```

### Flow Edge

```json
{
  "from": "complaint_text",
  "to": "complaint_triage_workflow",
  "data": "raw complaint text"
}
```

---

## UI Flow

### Screen 1: Requirement Intake

Purpose: accept imperfect user input.

Fields:

- title
- domain hint
- raw requirement text
- optional requester/team
- optional known systems
- optional expected output

Actions:

- Analyze Requirement
- Load Example
- Clear

Acceptance criteria:

- User can paste a requirement and run analysis.
- The raw text is preserved in state.
- Missing optional fields do not block analysis.

### Screen 2: Analysis Result

Purpose: show what the LLM/mock analyzer understood.

Sections:

- evidence summary
- normalized use case
- missing information
- contradictions
- risk signals

Actions:

- Edit normalized fields
- Mark missing info as acceptable for draft
- Re-run analysis
- Continue to module split

Acceptance criteria:

- User can see assumptions separately from facts.
- Missing information is explicit.

### Screen 3: Module Split Review

Purpose: correct “everything is an agent” into the right architecture units.

Table columns:

- proposed module name
- recommended type
- rationale
- input
- output
- reuse candidate
- risk level
- status

Actions:

- change type
- rename module
- split module
- merge modules
- mark as shared candidate
- approve/defer/reject

Acceptance criteria:

- A single raw “agent” request can produce multiple module candidates.
- Human reviewer can override classifications.

### Screen 4: Process Flow View

Purpose: see how inputs/outputs connect.

Initial implementation:

- Mermaid graph text or simple SVG/HTML graph
- Later can move to React Flow

Graph should show:

- inputs
- tools
- workflows
- agents
- A2A contracts
- outputs

Acceptance criteria:

- Flow updates when module candidates change.
- A2A edges are visually distinct from local tool/workflow edges.

### Screen 5: Registry Candidate Export

Purpose: prepare data for later registry/scaffold stages.

Exports:

- normalized requirement JSON
- module candidates JSON
- flow JSON
- decision notes Markdown

Acceptance criteria:

- User can copy/download the generated artifacts.
- Artifacts remain generic and contain no hardcoded private project data.

---

## Classification Rules for Phase 1

Important: this is a project architecture taxonomy, not an official Google ADK enum. It is derived from public ADK concepts, A2A protocol boundaries, MCP/tool-integration practice, and enterprise architecture governance needs.

Official/public basis:

- Google ADK provides agents, tools/integrations, multi-agent composition, and workflow agents such as sequential, parallel, and loop agents.
- A2A provides the remote independent agent interoperability boundary.
- MCP/tool practice informs how external deterministic capabilities can be exposed as tools rather than agents.
- The project adds governance artifacts such as module candidates, metadata registries, review status, and reusable capability catalogs.

Use these initial project-level rules in the mock analyzer and UI copy.

### Tool/Adapter

Use when the function is deterministic integration, lookup, calculation, validation, parsing, transformation, or storage.

### Knowledge Retrieval

Use when the capability searches or summarizes documents, policies, FAQs, manuals, procedures, contracts, regulations, or other business knowledge sources. This is an execution capability: it receives a query/context and returns evidence, snippets, citations, summaries, or grounded answer context.

### Workflow

Use when the requirement describes ordered steps, checklists, handoffs, or fan-out/fan-in inside one boundary.

### Specialist Agent

Use when the module owns a narrow domain responsibility, combines tools, maintains context, and produces judgment or recommendations.

### Shared Agent

Use when multiple specialists need the same higher-level capability and it deserves its own lifecycle, policy, or owner.

### Metadata Registry

Use when the reusable unit is structured architecture or operating metadata: routing table, ownership map, schema catalog, capability catalog, tool registry, agent registry, MCP server registry, risk rule table, or threshold table. This is usually configuration/catalog data, not a narrative knowledge search capability.

### A2A Contract

Use only when interacting with an independently owned, independently deployed, or independently governed agent boundary. Do not use A2A just because a workflow has multiple steps.

---

## Implementation Tasks

### Task 1: Add workbench product spec

**Objective:** Document the first frontend product in human-readable form.

**Files:**
- Create: `docs/playbooks/requirement-intake-workbench.md`
- Modify: `docs/README.md`

**Steps:**
1. Create the playbook from the Product Framing, UI Flow, and Classification Rules sections above.
2. Link it from `docs/README.md` under a new `Playbooks` section.
3. Keep examples generic.

**Verification:**
- `docs/README.md` links to `docs/playbooks/requirement-intake-workbench.md`.
- No private organization or deployment details appear.

### Task 2: Add schema drafts

**Objective:** Make the normalized data shape explicit before coding UI.

**Files:**
- Create: `schemas/normalized-requirement.schema.json`
- Create: `schemas/module-candidate.schema.json`
- Create: `schemas/process-flow.schema.json`

**Steps:**
1. Define required fields for normalized requirement.
2. Define module candidate enum values.
3. Define process nodes and edges.
4. Add examples in each schema where helpful.

**Verification:**
- JSON schemas are valid JSON.
- Enum includes all Phase 1 module types.

### Task 3: Add generic templates

**Objective:** Give users and agents copyable starting artifacts.

**Files:**
- Create: `templates/requirement-intake.yaml`
- Create: `templates/normalized-requirement.json`
- Create: `templates/module-candidates.json`
- Create: `templates/process-flow.json`

**Steps:**
1. Use generic example data.
2. Include missing information examples.
3. Include one incorrectly named “agent” split into tool + workflow + specialist agent.

**Verification:**
- Templates match schema field names.

### Task 4: Add frontend package shell

**Objective:** Create a local-first workbench shell.

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/styles.css`

**Steps:**
1. Use React + Vite + TypeScript.
2. Create top-level tabs or steps: Intake, Analysis, Module Review, Flow, Export.
3. Use in-memory state only.

**Verification:**
- `npm --prefix packages/web install`
- `npm --prefix packages/web run build`

### Task 5: Implement mock analyzer

**Objective:** Simulate the LLM analysis pipeline without external dependencies.

**Files:**
- Create: `packages/web/src/analyzer/types.ts`
- Create: `packages/web/src/analyzer/mockAnalyzer.ts`
- Create: `packages/web/src/analyzer/classificationRules.ts`

**Steps:**
1. Define TypeScript types matching schemas.
2. Implement `analyzeRequirement(input)`.
3. Use keyword/rule-based heuristics to produce deterministic mock output.
4. Always include `missing_information` when fields are absent.

**Verification:**
- Sample requirement returns normalized requirement + module candidates + flow.
- No network calls are made.

### Task 6: Build Requirement Intake screen

**Objective:** Let users submit imperfect text.

**Files:**
- Create: `packages/web/src/components/RequirementIntake.tsx`
- Modify: `packages/web/src/App.tsx`

**Steps:**
1. Add fields: title, domain hint, raw text.
2. Add Load Example button.
3. Add Analyze button that calls mock analyzer.

**Verification:**
- Empty optional fields do not crash.
- Missing raw text shows a clear validation message.

### Task 7: Build Analysis Result screen

**Objective:** Show evidence, normalized spec, missing info, contradictions, and risk signals.

**Files:**
- Create: `packages/web/src/components/AnalysisResult.tsx`
- Modify: `packages/web/src/App.tsx`

**Steps:**
1. Render evidence summary.
2. Render missing information as checklist.
3. Render normalized JSON preview.

**Verification:**
- Analysis result is readable without opening devtools.

### Task 8: Build Module Split Review screen

**Objective:** Let architects correct module classifications.

**Files:**
- Create: `packages/web/src/components/ModuleReview.tsx`
- Modify: `packages/web/src/App.tsx`

**Steps:**
1. Render module candidates in a table.
2. Allow changing `recommended_type` via select box.
3. Allow status change: needs_review, approved, deferred, rejected.
4. Allow marking reuse candidate.

**Verification:**
- User override updates state.
- Changed type is reflected in export.

### Task 9: Build Process Flow view

**Objective:** Visualize how modules connect.

**Files:**
- Create: `packages/web/src/components/ProcessFlowView.tsx`
- Modify: `packages/web/src/App.tsx`

**Steps:**
1. Render a simple text/Mermaid-style graph from process flow JSON.
2. Use distinct labels for tool, workflow, agent, and A2A.
3. Update when module review changes.

**Verification:**
- Graph renders for mock example.
- A2A edge is visually labeled when present.

### Task 10: Build Export screen

**Objective:** Let users copy generated artifacts for registry/scaffold stages.

**Files:**
- Create: `packages/web/src/components/ExportArtifacts.tsx`
- Modify: `packages/web/src/App.tsx`

**Steps:**
1. Show normalized requirement JSON.
2. Show module candidates JSON.
3. Show process flow JSON.
4. Show decision notes Markdown.
5. Add copy-to-clipboard buttons.

**Verification:**
- Export reflects user edits.

### Task 11: Add minimal frontend tests or type checks

**Objective:** Catch broken builds.

**Files:**
- Modify: `packages/web/package.json`
- Optional Create: `packages/web/src/analyzer/mockAnalyzer.test.ts`

**Steps:**
1. Add `build` script.
2. Add `typecheck` script if separate from build.
3. Add basic analyzer tests if using Vitest.

**Verification:**
- `npm --prefix packages/web run build` succeeds.

### Task 12: Add Codex handoff prompt

**Objective:** Make this plan directly executable by Codex.

**Files:**
- Create: `docs/prompts/codex-phase-1-requirement-intake-workbench.md`

**Content:**
- repository path
- relevant constraints from `AGENTS.md`
- link to this plan
- expected deliverables
- verification commands
- instruction to preserve generic public examples

**Verification:**
- The prompt is self-contained enough to paste into `codex exec`.

---

## Later TODO Backlog

These are intentionally not part of Phase 1 implementation.

### TODO A: Real LLM Adapter

Add an adapter interface for real LLM providers. Keep provider configuration outside public examples.

### TODO B: Registry Persistence

Add durable registries for capabilities, tools, agents, workflows, A2A contracts, systems, and decisions.

### TODO C: Duplicate Capability Detection

Compare new module candidates against existing registry items.

### TODO D: Graph Visualization Upgrade

Move from simple Mermaid/text graph to React Flow or a similar interactive graph view.

### TODO E: Validation CLI

Add CLI commands:

```bash
agent-factory validate <path>
agent-factory classify <requirement>
agent-factory graph <registry>
agent-factory scaffold <approved-spec>
```

### TODO F: MCP and Tool Registry Modeling

Model MCP servers, tools, tool schemas, auth constraints, and side effects as first-class registry entries.

### TODO G: ADK Scaffold Generator

Generate Google ADK-oriented scaffolds only from approved module specs.

### TODO H: Contract and Eval Harness

Generate contract tests and golden eval cases for every approved agent/workflow/tool.

### TODO I: Multi-Domain Governance Views

Add domain-level dashboards for request status, risk heatmap, capability reuse, and A2A topology.

### TODO J: Image-Based PRD/Design Spec for Codex

Before longer frontend implementation, create a visual PRD with wireframes or screenshots so Codex has design context.

---

## Codex Execution Command

After reviewing this plan, run Codex from the repository root:

```bash
codex exec --full-auto "Implement docs/phase-1-requirement-intake-workbench-plan.md. Follow AGENTS.md. Keep examples generic and public-safe. Start with documentation, schemas, templates, then the React/Vite frontend shell and mock analyzer. Verify with npm --prefix packages/web run build."
```

Use PTY when launching through Hermes.
