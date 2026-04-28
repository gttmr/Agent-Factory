# Requirement Intake Workbench

The requirement intake workbench is a local-first planning surface for turning imperfect stakeholder text into reviewable architecture artifacts. It preserves the raw source, extracts evidence, normalizes the use case, proposes reusable module candidates, and keeps a human architect in control before anything is treated as approved.

Phase 1 is not a production chat UI and does not generate final ADK agents. It provides documentation, schemas, templates, a TypeScript frontend shell, and a deterministic mock analyzer. The UI defaults to Korean for product-facing labels while preserving ADK terms and machine-facing taxonomy values in English where precision matters.

Real LLM integration can be added later behind the `AnalyzerProvider` boundary. The default provider remains the rule-based `MockAnalyzerProvider`; the `OpenAICompatibleAnalyzerProvider` is only a disabled placeholder for future restricted or offline deployment. Do not add secrets, private endpoints, private datasets, or default network calls to the public workbench.

## Product Goals

Stakeholders often submit requirements that are almost structured but incomplete, contradictory, or too broad. They may call every capability an "agent" even when the right implementation unit is a deterministic tool, retrieval capability, workflow, registry entry, or remote interoperability contract.

The workbench supports this reality by helping architects:

- accept raw stakeholder text without overwriting it
- extract evidence separately from assumptions
- normalize a requirement into a draft use case
- identify missing or contradictory information
- classify requested functionality into the project architecture taxonomy
- split one incorrectly named "agent" into multiple module candidates
- review reusable modules and process flow before approval
- export normalized artifacts for later registry or scaffold work

## Architecture Taxonomy

Use these exact module type values in schemas, templates, and implementation artifacts:

- `tool_adapter`: deterministic integration, lookup, calculation, validation, parsing, transformation, or storage.
- `knowledge_retrieval`: search or summarization over documents, policies, FAQs, manuals, procedures, contracts, regulations, or other knowledge sources. It returns evidence, snippets, citations, summaries, or grounded answer context.
- `internal_workflow`: ordered steps, checklists, handoffs, or fan-out/fan-in inside one boundary.
- `specialist_agent`: a narrow domain responsibility that combines tools, maintains task context, and produces judgment or recommendations.
- `shared_agent`: a higher-level reusable capability needed by multiple specialists with its own lifecycle, policy, or owner.
- `metadata_registry`: structured architecture or operating metadata such as routing tables, ownership maps, schema catalogs, capability catalogs, tool registries, agent registries, server registries, risk rules, or thresholds.
- `remote_a2a_contract`: interaction with an independently owned, independently deployed, or independently governed remote agent boundary.

This taxonomy is project-level. It is derived from public ADK concepts, A2A protocol boundaries, MCP/tool-integration practice, and architecture governance needs. It is not an official Google ADK enum.

## UI Flow

### 1. Requirement Intake

Purpose: accept imperfect user input.

Fields:

- title
- domain hint
- raw requirement text
- optional requester team
- optional requester role
- optional known systems
- optional expected output

Actions:

- Analyze Requirement
- Load Example
- Clear

Acceptance criteria:

- The user can paste a requirement and run analysis.
- Raw text is preserved in state.
- Missing optional fields do not block analysis.
- Missing raw text shows a clear validation message.

### 2. Analysis Result

Purpose: show what the analyzer understood.

Sections:

- evidence summary
- normalized use case
- missing information
- contradictions
- risk signals

Actions:

- inspect normalized fields
- mark missing information as acceptable for draft
- re-run analysis
- continue to module split

Acceptance criteria:

- Facts and assumptions are visibly separated.
- Missing information is explicit.
- The normalized requirement remains a draft until reviewed.

### 3. Module Split Review

Purpose: correct broad or incorrectly named "agent" requests into the right architecture units.

Table columns:

- proposed module name
- recommended type
- rationale
- inputs
- outputs
- reuse candidate
- risk level
- status

Actions:

- change module type
- rename module
- mark as shared candidate
- approve, defer, or reject

Acceptance criteria:

- A single raw "agent" request can produce multiple module candidates.
- Human overrides update in-memory state and exports.
- Review status is explicit.

### 4. Process Flow View

Purpose: show how inputs, modules, and outputs connect, then help the reviewer decide which ADK orchestration type is appropriate.

Initial implementation:

- render Mermaid-style graph text and a staged HTML flow
- keep generated flow data visible for review
- distinguish local edges from `remote_a2a_contract` edges
- show independent lookup or retrieval branches as `ParallelAgent candidate`
- show fixed handoff and review stages as `SequentialAgent candidate`
- show `Custom Agent 후보` only when the analyzer detects conditional routing, dynamic agent selection, unusually complex state, external integration flow control, or another non-standard orchestration pattern
- show a `Session/State 계획` panel with candidate keys such as `current_step`, `temp:branch_results`, `user:preferred_language`, and `app:taxonomy_version`

Acceptance criteria:

- Flow renders for the mock example.
- Flow updates when module candidates change.
- Remote A2A edges are visibly labeled when present.
- The UI does not imply that an ADK runtime is integrated; it exposes review guidance only.

### 5. Registry Candidate Export

Purpose: prepare artifacts for later registry and scaffold stages.

Exports:

- normalized requirement JSON
- module candidates JSON
- process flow JSON
- decision notes Markdown

Acceptance criteria:

- Users can copy generated artifacts.
- Artifacts remain generic and public-safe.
- Export reflects user edits.

## Public-Safety Constraints

Keep Phase 1 generic. Do not include private datasets, credentials, private endpoints, private deployment scripts, or organization-specific runtime code. Example data should use generic customer-service, operations, support, or knowledge-work scenarios only.

## ADK Review Guidance

The workbench uses public ADK terminology as reviewer guidance, not as a runtime contract.

- ADK `Workflow Agents` control sub-agent execution with predefined logic. The workbench therefore prefers workflow-agent candidates before `Custom Agent` when the pattern is deterministic. See [Workflow Agents](https://adk.dev/agents/workflow-agents/).
- Use `SequentialAgent` guidance when sub-agents need a fixed, strict order. See [Sequential agents](https://adk.dev/agents/workflow-agents/sequential-agents/).
- Use `ParallelAgent` guidance when independent branches can run concurrently and collect results later. See [Parallel agents](https://adk.dev/agents/workflow-agents/parallel-agents/).
- Use `LoopAgent` guidance only when a repeat-until condition is explicit enough to review safely.
- Raise a `Custom Agent` candidate only for conditional routing, complex state management, external integration flow control, dynamic agent selection, or a unique workflow pattern. See [Custom agents](https://adk.dev/agents/custom-agents/).
- Treat `Session` as the conversation-thread container for `events` and `state`, with lifecycle handled by `SessionService`. See [Session](https://adk.dev/sessions/session/).
- Treat `State` as serializable key-value scratchpad data. Prefer planned keys with explicit scopes such as `user:`, `app:`, and `temp:`, and update runtime state through event/state-delta mechanisms when an actual ADK runtime is later added. See [State](https://adk.dev/sessions/state/).

## Analyzer Provider Boundary

The frontend calls an async provider contract:

- `AnalyzerProvider.analyze(input)` returns normalized requirement, evidence, module candidates, and process flow artifacts.
- `MockAnalyzerProvider` wraps the current deterministic rule analyzer and is the only default provider.
- `OpenAICompatibleAnalyzerProvider` exists as a placeholder so future deployments can connect a local GLM 5.1 endpoint or another OpenAI-compatible endpoint without changing UI code.

The placeholder must remain disabled in this public repository. Future model-backed deployments must be restricted or offline, must keep credentials out of source control, and must document the endpoint outside this public extract.
