# Agent Factory v1.0 Goal

Agent Factory is a requirement analysis, classification, visualization, and commonization workbench. A development leader enters incomplete banking use cases, reviews the resulting module candidates, and exports only approved design artifacts for later scaffolding.

## Confirmed Scope

- Primary user: development leader.
- First application domain: banking, while preserving generic taxonomy and artifact structure.
- Temporary banking domains: 고객, 수신, 여신, 카드, 리스크.
- MVP: mock analyzer, workbench UI, export artifacts, scaffold-plan export.
- Not in MVP: live LLM analyzer, scaffold generator, real bank integrations, real A2A runtime integration.

## Taxonomy

Top-level `module_category` values are:

- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

`Tool/Adapter`, `Knowledge Retrieval`, and `Metadata Registry` are not top-level categories. Retrieval is `adapter_kind: retrieval`; managed business rules and metadata registries are `adapter_kind: rule_registry`.

`Remote A2A` is high-friction and is only used for an independently owned remote agent runtime with protocol-level contract, lifecycle, discovery, auth, timeout, retry, fallback, audit, and data policy detail.

## Risk Gates

Banking risk gates are:

- `personal_data`
- `financial_data`
- `credit_decision_support`
- `customer_impact`
- `external_message`
- `transaction_write`
- `human_approval_required`
- `audit_required`

Customer-impacting or credit-decision-supporting capabilities remain draft, recommendation, or human-approval flows in the MVP.

## Workbench Views

Priority views are:

- Module Review Board
- Process Flow
- Reuse Heatmap
- Domain × Capability Map

The Module Review Board is the primary decision surface. A development leader sets each module candidate to `approved`, `deferred`, `rejected`, or `needs_info`.

## Export Contract

MVP exports include JSON, Markdown, Mermaid, and YAML artifacts. `scaffold-plan.json` must include only approved modules and must not include runnable business logic.

Raw requirements never directly drive code generation. Later scaffold work consumes approved `scaffold-plan.json` and `implementation-handoff.md` only.

## Approval Model

A development leader is the single approver for v1.0. The leader sets each module candidate to `approved`, `deferred`, `rejected`, or `needs_info` in the Module Review Board.

Remote A2A approval also flows through the same single approver but remains a high-friction gate. Before a Remote A2A candidate may move to `approved`, the candidate must carry remote owner, agent card or discovery method, request schema, response schema, task lifecycle, auth, timeout, retry, fallback, audit, and data policy detail. Missing any of these forces the status to `deferred`, `needs_info`, or `rejected`.

## LLM Analyzer Sequence

The mock analyzer ships first and stabilizes the schemas, UI states, and exported artifacts. A live LLM analyzer is introduced only afterward, and only through a trusted backend endpoint. The frontend never holds an LLM API key directly.

When the live analyzer is added, the backend must enforce schema validation, policy gates, audit log retention, rejection of invalid `module_category` values, and blocking of Remote A2A approvals that lack the contract fields listed under Approval Model.

## Scaffolding Sequence

Scaffolding work is not part of the v1.0 MVP. The MVP stops at exporting `scaffold-plan.json` and `implementation-handoff.md`. A scaffold generator is built only after the commonization catalog is stable, the Module Review Board produces consistent `approved` decisions, and `scaffold-plan.json` validates against the workbench schema.

The detailed scaffold contract (per-category outputs, no-runnable-business-logic rule) lives in [scaffolding/scaffold-bridge.md](../scaffolding/scaffold-bridge.md).

## Catalog Management

For v1.0 the reusable catalog lives inside this repository as YAML under `catalog/` (`adapters.yaml`, `agents.yaml`, `workflows.yaml`, `remote-a2a-contracts.yaml`, `domain-owners.yaml`, `risk-gates.yaml`). No external database or registry is used in v1.0. Migration to a managed catalog system is deferred until reuse pressure justifies it.

## Non-Goals

The following are explicitly out of scope for v1.0:

- Turning a raw requirement directly into running code.
- Auto-implementing every captured use case.
- Routing every multi-step flow through Remote A2A.
- Connecting the workbench to real bank systems, customer messaging, or live payment rails.
- Auto-sending customer-facing messages.
- Making autonomous credit decisions.
- Hardcoding business rules into agent prompts (rules belong in `adapter_kind: rule_registry`).
- Performing autonomous writes without an explicit approval step.

## Source Of Truth

The single source of truth for Agent Factory is the repository at <https://github.com/gttmr/Agent-Factory>. Workbench code, schemas, catalog, templates, docs, and the bundled skill all live here. Earlier extract-only or skill-only repositories are no longer used as primary development inputs.
