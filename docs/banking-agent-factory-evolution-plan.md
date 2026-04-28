# Enterprise Multi-Domain Agent Factory Evolution Plan

> This plan keeps the public repository generic while targeting the same class of problem: many loosely specified agent requests across multiple regulated business domains.

## Current Repository Assessment

This repository is currently a documentation-focused public extract for a Codex skill named `adk-a2a-agent-generate`.

Strengths:

- Clear specialist-first default.
- Good distinction between ADK internal workflow and remote A2A.
- Compact boundary taxonomy: Specialist Agent, Shared Agent, Tool/Adapter, Metadata Registry, Internal Workflow, Remote A2A.
- Useful evidence-first workflow before code generation.
- Existing skill contract is small enough to be portable into restricted environments.

Current limitations for a large multi-domain project:

- It handles one request at a time, but does not yet define a portfolio-level intake and governance process.
- There is no domain/capability registry schema for deduplication across hundreds of requests.
- There is no visualization model for dependency graphs, domain maps, capability maps, or A2A topology.
- There is no frontend/workbench for stakeholders or architects to submit, classify, review, and test requests.
- Scaffold shape is intentionally minimal and does not yet include contract/eval artifacts needed for regulated delivery.
- There is no executable validation harness for schemas, risk rules, readiness checks, or graph constraints.

## Target Positioning

Evolve the repository from a single-agent skill extract into an agent-factory reference kit.

The kit should help a development lead guide multiple domains through:

1. use case intake
2. capability extraction
3. tool/agent/workflow/A2A classification
4. registry deduplication
5. architecture review
6. scaffold generation
7. graph visualization
8. contract/eval testing
9. frontend simulation

## Target Repository Shape

```text
repo/
  README.md
  AGENTS.md

  docs/
    README.md
    concepts/
    reference/
    playbooks/
    diagrams/
    examples/

  .agents/
    skills/
      adk-a2a-agent-generate/
      agent-factory-intake/
      agent-factory-classify/
      agent-factory-scaffold/
      agent-factory-review/

  schemas/
    usecase.schema.json
    capability.schema.json
    tool.schema.json
    agent.schema.json
    workflow.schema.json
    a2a-contract.schema.json
    risk.schema.json
    eval-case.schema.json

  templates/
    usecase-intake.yaml
    capability.yaml
    tool.yaml
    agent.yaml
    workflow.yaml
    a2a-contract.yaml
    decision-record.md
    eval-case.yaml

  examples/
    domains/
    registries/
    generated/

  packages/
    core/
      agent_factory/
        ingest.py
        classify.py
        registry.py
        graph.py
        validate.py
        scaffold.py
    web/
      src/

  tests/
    fixtures/
    test_classification_rules.py
    test_schema_validation.py
    test_graph_constraints.py
    test_scaffold_contract.py
```

## Core Architecture

### Layer 1: Intake

Normalizes stakeholder requests into a controlled use case shape.

Required outputs:

- normalized use case YAML
- missing information list
- candidate capabilities
- risk hints

### Layer 2: Classification

Classifies each capability or request as one of:

- Tool/Adapter
- Retrieval capability
- Metadata Registry
- Specialist Agent
- Shared Agent
- Internal Workflow
- Remote A2A

Rules should remain deterministic and inspectable. LLMs may propose classifications, but rule validation should catch obvious violations.

### Layer 3: Registry

Stores cross-domain reusable assets:

- capabilities
- tools
- agents
- workflows
- A2A contracts
- systems
- decisions

The registry is the project memory. It prevents hundreds of requests from becoming hundreds of duplicated agents.

### Layer 4: Graph

Builds visual maps:

- domain -> capability map
- capability -> tool/agent/workflow map
- agent -> tool dependency graph
- A2A topology
- risk heatmap
- duplicate capability clusters

### Layer 5: Scaffold

Generates reviewable ADK-oriented skeletons only after classification and readiness checks pass.

A production-oriented scaffold should include:

- agent code shell
- prompt/instruction file
- tool bindings
- schemas
- A2A contracts
- tests
- eval cases
- decision record
- README

### Layer 6: Frontend Workbench

A lightweight web UI should support:

- use case intake form
- classification result viewer
- registry browser
- graph visualization
- scaffold preview
- test/eval runner view
- architecture review status

## Frontend MVP

The frontend should not start as a chat UI. It should start as an architecture workbench.

Recommended screens:

1. Use Case Intake
   - structured form
   - import YAML/Markdown
   - missing fields validation

2. Classification Review
   - evidence summary
   - recommended shape
   - reuse bindings
   - missing info
   - risk level
   - approve/reject/defer

3. Registry Browser
   - capabilities
   - tools
   - agents
   - workflows
   - A2A contracts

4. Graph View
   - domain capability map
   - agent dependency graph
   - A2A topology

5. Simulation/Test Panel
   - run sample eval case
   - inspect selected agent contract
   - show mock tool outputs
   - show expected vs actual behavior

## Documentation Roadmap

Add these documents first:

- `docs/playbooks/multi-domain-agent-factory.md`
- `docs/playbooks/stakeholder-intake-workshop.md`
- `docs/reference/boundary-taxonomy.md`
- `docs/reference/registry-model.md`
- `docs/reference/risk-classification.md`
- `docs/reference/a2a-governance.md`
- `docs/reference/frontend-workbench.md`
- `docs/diagrams/agent-factory-flow.mmd`
- `docs/diagrams/a2a-topology.mmd`

## Implementation Phases

### Phase 1: Documentation and Standards

- Expand the existing single-request skill into portfolio-level playbooks.
- Add controlled templates and schemas.
- Define definition-of-ready and definition-of-done.

### Phase 2: Registry and Validation CLI

- Add a small Python package or Node package for registry validation.
- Validate schema, uniqueness, dependency references, A2A contract shape, and risk rules.
- Generate graph data from registry files.

### Phase 3: Visualization

- Generate Mermaid diagrams from registries.
- Add graph export JSON for the frontend.
- Create example multi-domain maps.

### Phase 4: Scaffold Generator

- Generate ADK-oriented skeletons from approved specs.
- Include contract tests and eval fixtures.
- Keep business logic TODO when requirements are incomplete.

### Phase 5: Frontend Workbench

- Build a local-only workbench for intake, review, graph browsing, and test simulation.
- Start with mock data and static registries.
- Later connect it to the validation/scaffold CLI.

## Leadership Guidance

Use the repository as a leadership tool, not just a generator.

The lead should enforce:

- no free-form agent requests entering development
- no new agent without reuse check
- no A2A without independent ownership/lifecycle evidence
- no high-risk automation without human-in-the-loop
- no scaffold without test/eval artifacts
- no implementation without decision record

The most important success metric is not how many agents are created. It is how many stakeholder requests are compressed into reusable capabilities, governed contracts, and tested scaffolds.
