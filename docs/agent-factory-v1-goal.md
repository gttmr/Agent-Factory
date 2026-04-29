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
