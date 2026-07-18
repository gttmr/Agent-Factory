# Phase 0-1 current skill audit

Status: research complete for the current `.agents/skills/**` tree. This file records salvage decisions only; it does not author the vNext skills.

## Scope and method

- Governing work order: `agent-factory-skills-vnext-work-order.md` §§0-9, 15, 22, 26.
- Repository commit inspected: `7deea452e73f63828fc14402b7e16dcf40e753ac` on `main`.
- Current tree: 42 files, 1,658 physical lines: one local `AGENTS.md`, 12 `_shared` Markdown files, four skill directories, four `SKILL.md` files, four `agents/openai.yaml` files, and 18 stage references.
- Work-order §6.3 vocabulary used below: Entrypoint Skill, Work Skill, Shared Reference, Stage-specific Reference, Deterministic Script, Example / Fixture, Legacy Compatibility, Obsolete.
- “Body lines” means physical Markdown lines beginning with the `#` heading after frontmatter. For files without frontmatter it is the entire file. Blank lines inside the body count.
- Legacy-term checks are case-sensitive exact-token checks for `adapter`, `adapter_kind`, `agent_kind`, `specialist`, `shared`, `remote_a2a`, `selected_by_llm`, and `mcp_toolset`. `_shared` path fragments and larger underscore-delimited identifiers are not reported as the standalone `shared` or `adapter` tokens.

## Complete inventory and §6.3 classification

The four current full procedures are classified by what they do today: **Work Skill (legacy-named)**. Under the work order migration they must stop being canonical Work Skills; Analyze and Design become **Legacy Compatibility** shims while their vNext procedures move to new canonical directories. Build and Verify are not needed by current Stage Runner itself, though direct/manual consumers may still justify temporary shims.

| Path | Lines | Classification | Disposition signal |
| --- | ---: | --- | --- |
| `.agents/skills/AGENTS.md` | 76 | Shared Reference (tree governance/index) | Rewrite as the vNext tree map; retain invariant boundaries, remove old-name ownership. |
| `.agents/skills/_shared/adk-2.3-baseline.md` | 39 | Shared Reference | Carry truth-order and installed-source verification; rename version-neutrally. |
| `.agents/skills/_shared/adk-2.3-data-handling.md` | 55 | Shared Reference | Carry Graph IR-to-generator state/artifact mapping; rename version-neutrally. |
| `.agents/skills/_shared/adk-2.3-dynamic.md` | 57 | Shared Reference | Carry dynamic-selection and stop conditions; rename version-neutrally. |
| `.agents/skills/_shared/adk-2.3-human-input.md` | 49 | Shared Reference | Carry reviewed HITL mapping and current generator limits; rename version-neutrally. |
| `.agents/skills/_shared/adk-2.3-remote-a2a.md` | 51 | Shared Reference | Carry contract pairing, auth-env, and unsupported-policy limits; rename version-neutrally. |
| `.agents/skills/_shared/adk-2.3-routes.md` | 50 | Shared Reference | Carry route/join mapping, reachability, and acyclic/static limits; rename version-neutrally. |
| `.agents/skills/_shared/artifact-root-stage-runner.md` | 88 | Shared Reference | Carry canonical/run-ledger and proposal allow-lists; reconcile Design two-file enforcement gap. |
| `.agents/skills/_shared/catalog-feedback.md` | 40 | Shared Reference | Carry proposal-only catalog boundary and publish ownership. |
| `.agents/skills/_shared/missing-information-gates.md` | 45 | Shared Reference | Carry requirement-soft/candidate-hard distinction and build blocker. |
| `.agents/skills/_shared/runtime-contracts.md` | 54 | Shared Reference | Carry approval/readiness model and safe-summary boundary. |
| `.agents/skills/_shared/taxonomy-boundaries.md` | 49 | Shared Reference | Legacy contract reference; preserve only where current serialization is explicitly needed, not as vNext target taxonomy. |
| `.agents/skills/_shared/workflow-invariants.md` | 49 | Shared Reference | Carry proposed-first/canonical-secondary discipline and cross-stage non-goals. |
| `.agents/skills/af-analyze-requirement/SKILL.md` | 16 | Work Skill (legacy-named; future Legacy Compatibility) | Canonical procedure moves to `af-discover-assets`; current Stage Runner needs an exact-path shim. |
| `.agents/skills/af-analyze-requirement/agents/openai.yaml` | 4 | Legacy Compatibility auxiliary metadata | Old trigger metadata; not read by Stage Runner. |
| `.agents/skills/af-analyze-requirement/references/analysis-result-shape.md` | 57 | Stage-specific Reference | Salvage schema/write-boundary details into vNext discovery references. |
| `.agents/skills/af-analyze-requirement/references/evidence-and-normalization.md` | 57 | Stage-specific Reference | Salvage evidence/assumption/contradiction discipline. |
| `.agents/skills/af-analyze-requirement/references/graph-ir-draft.md` | 61 | Stage-specific Reference | Salvage evidence-grounded Graph IR draft rules; adapt to vNext stage ownership. |
| `.agents/skills/af-analyze-requirement/references/stage-runner-analyze-output.md` | 43 | Stage-specific Reference | Salvage exact Analyze proposal path and no-canonical-write rule. |
| `.agents/skills/af-design-boundaries/SKILL.md` | 16 | Work Skill (legacy-named; future Legacy Compatibility) | Canonical procedure moves to `af-compose-solution`; current Stage Runner needs an exact-path shim. |
| `.agents/skills/af-design-boundaries/agents/openai.yaml` | 4 | Legacy Compatibility auxiliary metadata | Old trigger metadata; not read by Stage Runner. |
| `.agents/skills/af-design-boundaries/references/design-stage-output.md` | 46 | Stage-specific Reference | Salvage exact two-file proposal/canonical separation. |
| `.agents/skills/af-design-boundaries/references/graph-ir-review.md` | 45 | Stage-specific Reference | Salvage route/state/artifact/HITL/dynamic/remote review checklist. |
| `.agents/skills/af-design-boundaries/references/module-approval-rubric.md` | 41 | Stage-specific Reference | Salvage approve/defer/reject and missing-info criteria; translate taxonomy target. |
| `.agents/skills/af-design-boundaries/references/remote-a2a-review.md` | 56 | Stage-specific Reference | Salvage high-friction A2A evidence and 1:1 contract checks. |
| `.agents/skills/af-design-boundaries/references/runtime-contract-review.md` | 47 | Stage-specific Reference | Salvage runtime contract readiness and approval separation. |
| `.agents/skills/af-build-runtime-stub/SKILL.md` | 20 | Work Skill (legacy-named; future Legacy Compatibility if retained) | Canonical procedure moves to `af-scaffold-runtime`; current Stage Runner Build is a server primitive. |
| `.agents/skills/af-build-runtime-stub/agents/openai.yaml` | 4 | Legacy Compatibility auxiliary metadata | Old trigger metadata; not read by Stage Runner. |
| `.agents/skills/af-build-runtime-stub/references/artifact-sync-build.md` | 58 | Stage-specific Reference | Salvage artifact-sync-first and drift-stop path. |
| `.agents/skills/af-build-runtime-stub/references/handoff-non-goals.md` | 52 | Stage-specific Reference | Salvage handoff status/non-goals and prohibited output. |
| `.agents/skills/af-build-runtime-stub/references/runtime-generation.md` | 47 | Stage-specific Reference | Salvage generator-owned, artifact-driven generation procedure. |
| `.agents/skills/af-build-runtime-stub/references/runtime-output-checks.md` | 45 | Stage-specific Reference | Salvage compile/generated-test evidence rules. |
| `.agents/skills/af-verify-feedback/SKILL.md` | 16 | Work Skill (legacy-named; future Legacy Compatibility if retained) | Canonical procedure moves to `af-verify-runtime`; current Stage Runner Verify is a server primitive. |
| `.agents/skills/af-verify-feedback/agents/openai.yaml` | 4 | Legacy Compatibility auxiliary metadata | Old trigger metadata; not read by Stage Runner. |
| `.agents/skills/af-verify-feedback/references/catalog-delta-proposal.md` | 42 | Stage-specific Reference | Salvage proposal schema/privacy boundaries. |
| `.agents/skills/af-verify-feedback/references/evidence-report.md` | 52 | Stage-specific Reference | Salvage exact command/evidence/residual-uncertainty format. |
| `.agents/skills/af-verify-feedback/references/runtime-stub-checks.md` | 43 | Stage-specific Reference | Salvage conditional compile/test and explicit-unverified rules. |
| `.agents/skills/af-verify-feedback/references/stage-runner-verify-output.md` | 42 | Stage-specific Reference | Salvage exact two-file Verify proposal behavior and server ownership. |
| `.agents/skills/af-verify-feedback/references/validation-allowlist.md` | 38 | Stage-specific Reference | Salvage exact allow-list keys and evidence-strength rule. |

There are currently no Entrypoint Skills, Deterministic Scripts, or Example / Fixture files under `.agents/skills/**`. No current Markdown file is wholly Obsolete: old IDs and legacy-taxonomy guidance require replacement or narrowing, but each contains at least some contract/gate material worth migrating.

## Detailed audit: `AGENTS.md`, four skills, and 12 shared references

### Governance and skill entry files

| File | Frontmatter and body | Artifacts written / gates respected | `_shared` links | Exact legacy terms present |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | No frontmatter; 76 body lines. | Writes none. Governs stage order, proposed-first priority, no approval/status toggle, A2A contract location, no private/deploy/runtime business data, no direct `catalog/*.yaml`, and verification by change type. | All 12 current `_shared` files. | `shared` |
| `af-analyze-requirement/SKILL.md` | `name`, `description`; 11 body lines. | Writes only `analysis-result.json` in the selected proposal or standalone canonical location. Gates: unambiguous root/run, evidence vs assumptions, four-category `legacy` validation, A2A evidence, two-level missing info, no runtime/catalog/docs/approval changes. | `workflow-invariants.md`, `taxonomy-boundaries.md`, `missing-information-gates.md` | `adapter`, `remote_a2a` |
| `af-design-boundaries/SKILL.md` | `name`, `description`; 11 body lines. | Writes only proposed `analysis-result.json` plus `boundary-design.md`, or bounded standalone canonical design edits. Gates: reviewed analysis, valid module fields, closed candidate missing info before Build, approved/coherent runtime and A2A contracts, valid Graph IR, no catalog/runtime/approval writes. | `artifact-root-stage-runner.md`, `missing-information-gates.md` | none |
| `af-build-runtime-stub/SKILL.md` | `name`, `description`; 15 body lines. | Runs artifact sync, produces/inspects `scaffold-plan.json`, `runtime-stub/`, and runtime-stub `implementation-handoff.md`. Gates: reviewed Analyze/Design, canonical analysis, approved manifest/runtime/A2A contracts, no unresolved candidate info, supported route/data/HITL/dynamic/A2A lowering, successful generation/compile/tests, handoff non-goals. | `artifact-root-stage-runner.md`, `runtime-contracts.md`, `adk-2.3-routes.md`, `adk-2.3-data-handling.md`, `adk-2.3-human-input.md`, `adk-2.3-dynamic.md`, `adk-2.3-remote-a2a.md` | none |
| `af-verify-feedback/SKILL.md` | `name`, `description`; 11 body lines. | Writes/inspects `validation-report.md` and `catalog-delta.yaml` proposals. Gates: completed run/root, allow-listed command evidence, conditional runtime checks, explicit unverified status, no direct catalog edit, no private data, and no completion claim without fresh evidence. | `artifact-root-stage-runner.md`, `catalog-feedback.md` | none |

The exact frontmatter descriptions are:

- `af-analyze-requirement`: “Use when a raw or imported Agent Factory requirement must become schema-first analysis artifacts, including evidence extraction, taxonomy classification, Graph IR draft, missing-information records, and Stage Runner analysis proposals without runtime code.”
- `af-design-boundaries`: “Use when Agent Factory analysis artifacts need module approval decisions, Graph IR review, runtime/A2A contract readiness, missing-information closure, or Stage Runner design proposals before Runtime Handoff.”
- `af-build-runtime-stub`: “Use when approved Agent Factory scaffold-plan artifacts need a smoke TODO or runnable ADK Runtime Handoff bundle, including artifact-sync, runtime-stub generation, generated-output checks, and handoff non-goal review.”
- `af-verify-feedback`: “Use when Agent Factory artifacts, Stage Runner output, generated runtime stubs, validation evidence, or catalog-delta proposals need verification and feedback closure without direct catalog edits.”

All four have exactly two frontmatter fields: `name` and a one-line `description`. `AGENTS.md` and all 12 `_shared` files have no YAML frontmatter, so name/description are absent.

### Shared-reference files

All 12 are Shared References, have no frontmatter, and link no other `_shared` file. “Writes none” means they prescribe or review artifacts but are not procedures that independently create files.

| File | Body lines | Artifact scope and gates | Exact legacy terms | Worth carrying forward |
| --- | ---: | --- | --- | --- |
| `adk-2.3-baseline.md` | 39 | Writes none. Installed source -> official docs -> generator/validator -> repo docs truth order; remove exact signatures when installed source is absent. | none | Source-grounding order, version-assumption discipline, generated-output-only boundary. Rename to a version-neutral filename and keep version evidence inside. |
| `adk-2.3-data-handling.md` | 55 | Writes none. Reviews state/artifact edges and generated lowering; blocks ambiguous/multiple producers, missing keys, unsupported consumers, and unsupported agent artifact outputs. | `adapter` | Graph IR channel table, generator ownership, concrete stop cases, validator command. Translate Adapter terminology where vNext contracts permit. |
| `adk-2.3-dynamic.md` | 57 | Writes none. Reviews dynamic selection, loop structure, route metadata, bounded loop generation, and current supported node set; stops unsupported dynamic edges/shapes. | none | Feature-detection rules, loop invariants, `@node`/`ctx.run_node` grounding, static-vs-dynamic split. |
| `adk-2.3-human-input.md` | 49 | Writes none. Reviews `human_input_contract` lowering to `RequestInput` and `FunctionNode(rerun_on_resume=True)`; blocks unsupported response schema. | none | Graph IR field checklist, pause/resume mapping, explicit current generator limitation. |
| `adk-2.3-remote-a2a.md` | 51 | Writes none. Requires exactly one approved embedded contract, Agent Card URL, valid `AF_A2A_*` env auth, and records retry/fallback as non-emitted policy. | `remote_a2a` | High-friction gate, generator/runtime mapping, supported auth modes, clear unsupported wrapper limits. |
| `adk-2.3-routes.md` | 50 | Writes none. Reviews route tuples and joins; blocks missing conditions, unreachable/cyclic static graphs, and unsupported task-mode cases. | none | Graph IR-to-Workflow mapping, synthetic join rule, reachability/acyclicity checks, dynamic routing handoff. |
| `artifact-root-stage-runner.md` | 88 | Writes none itself; defines canonical artifact inventory and run ledger. Allows Analyze one proposal, Design two, Build no proposals/canonical primitive, Verify two; stops missing run folders or out-of-list proposals. | none | Canonical/run path separation, run-file inventory, exact per-stage proposal table, apply semantics. Correct the current code-vs-doc Design completeness gap in the vNext contract. |
| `catalog-feedback.md` | 40 | Writes none itself; permits proposal `catalog-delta.yaml`, forbids skill edits to `catalog/*.yaml`, and routes publication through approval-gated `/api/catalog/publish`. | none | Proposal/publish ownership, privacy exclusions, `git diff -- catalog` guard. |
| `missing-information-gates.md` | 45 | Writes none. Requirement evidence is a soft gate; candidate missing information/`needs_info` is a hard approval/Build gate; validates resolution fields. | none | Two-level model, existing closure fields, explicit scaffold blocker and validator stop. |
| `runtime-contracts.md` | 54 | Writes none. Requires approved required runtime/A2A contracts in analysis and scaffold plan; skills report missing approvals but do not toggle them; raw legacy payloads stay away from LLM nodes. | none by exact-token rule | Contract kind/status list for current serialization, approval propagation, safe-summary boundary. Reconcile kinds with vNext without inventing asset categories. |
| `taxonomy-boundaries.md` | 49 | Writes none. Enforces the four current serialized `legacy` module categories/subtypes and the high-friction A2A evidence gate. | `adapter`, `adapter_kind`, `agent_kind`, `remote_a2a` | Preserve as an explicitly Current Implementation compatibility reference; carry the A2A evidence checklist, but do not carry the four-category model forward as the Target Contract. |
| `workflow-invariants.md` | 49 | Writes none itself; defines each stage's outputs. Gates stage order, approved-artifact-only runtime handoff, no sensitive/deploy/business output, no approval toggle, and narrow proposed/canonical write modes. | none | Stage order, artifact ownership, primary/secondary mode distinction, cross-stage non-goals, root ambiguity stop. |

Across the entire current `.agents/skills/**` tree, exact tokens `specialist`, `selected_by_llm`, and `mcp_toolset` are absent. `agent_kind` appears only in `taxonomy-boundaries.md`. Standalone `adapter` appears in the Analyze entry, data-handling, taxonomy-boundaries, Build handoff-non-goals, and Design graph-review/module-rubric files. `remote_a2a` appears in the Analyze entry and Graph IR draft, remote-A2A, taxonomy-boundaries, and three Design references (graph review, module rubric, remote-A2A review). This does not mean the broader repository schemas lack those terms.

## Per-skill salvage lists

### `af-analyze-requirement` -> future `af-discover-assets`

- Preserve the strict separation of factual evidence, assumptions, contradictions, and missing information.
- Preserve requirement-level soft gates versus candidate-level hard gates.
- Preserve schema-first `analysis-result.json` generation and immediate parse/validator checks.
- Preserve proposed-first Stage Runner output and the no-canonical-write/no-approval-toggle rule.
- Preserve evidence-grounded Graph IR drafting and the explicit no-runtime-code boundary.
- Preserve high-friction Remote A2A evidence checks, translated into vNext taxonomy/contract language.

### `af-design-boundaries` -> future `af-compose-solution`

- Preserve the `analysis_reviewed=true`/canonical-analysis entry gate for Stage Runner Design.
- Preserve explicit approve/defer/reject decisions and candidate missing-information closure.
- Preserve separate runtime-contract and A2A-contract readiness reviews.
- Preserve the comprehensive Graph IR review across route, state, artifact, human input, dynamic, callback, and remote edges.
- Preserve exact two-file Design proposals and the no-approval-toggle/no-runtime-generation boundary.
- Preserve the high-friction 1:1 Remote A2A candidate-to-contract pairing rule.

### `af-build-runtime-stub` -> future `af-scaffold-runtime`

- Preserve artifact-sync as the primary Workbench path and direct generation as a secondary/manual path.
- Preserve approved-artifact-only input and blockers for unresolved candidate information or unapproved contracts.
- Preserve feature-routed review references so only applicable route/data/HITL/dynamic/A2A material is loaded.
- Preserve generator ownership: skills inspect and run deterministic generators rather than hand-authoring runtime behavior from requirements.
- Preserve compileall/generated-test checks with dependency-aware evidence.
- Preserve smoke/runnable status and `raw_requirement_to_code=false`, no deploy, no private data, and no production business logic non-goals.

### `af-verify-feedback` -> future `af-verify-runtime`

- Preserve the three server allow-list keys and their evidence-strength distinction.
- Preserve exact command, stdout/stderr, exit code, failure, and residual-uncertainty recording.
- Preserve dependency-aware runtime-stub checks and explicit “unverified” outcomes.
- Preserve proposal-only `validation-report.md` and `catalog-delta.yaml` behavior.
- Preserve the direct-catalog-edit guard and approval-gated publication ownership.
- Preserve the rule that passing/fixed/complete claims require fresh observable evidence.

## `agents/openai.yaml`

Each four-line file contains only an `interface` mapping:

- `display_name`: human-facing legacy skill title.
- `short_description`: Korean one-line UI summary. Design still says “Agent/Workflow/Adapter/Remote A2A”.
- `default_prompt`: an English prompt that invokes the matching legacy skill with `$<legacy-id>`.

No repository code references `agents/openai.yaml`, and Stage Runner neither reads it nor invokes skills through its `default_prompt`. Therefore the vNext system does **not** need these files for Stage Runner compatibility. If the external Codex/OpenAI skill-discovery UI is intentionally retained, canonical vNext skill directories should receive regenerated metadata using only canonical names; legacy shims should not receive competing launcher metadata. Loader support/policy must be confirmed before treating that optional metadata as mandatory.

Checked date: 2026-07-18

Exact paths verified: `agent-factory-skills-vnext-work-order.md`; `AGENTS.md`; `CLAUDE.md`; `.agents/skills/AGENTS.md`; `.agents/skills/_shared/adk-2.3-baseline.md`; `.agents/skills/_shared/adk-2.3-data-handling.md`; `.agents/skills/_shared/adk-2.3-dynamic.md`; `.agents/skills/_shared/adk-2.3-human-input.md`; `.agents/skills/_shared/adk-2.3-remote-a2a.md`; `.agents/skills/_shared/adk-2.3-routes.md`; `.agents/skills/_shared/artifact-root-stage-runner.md`; `.agents/skills/_shared/catalog-feedback.md`; `.agents/skills/_shared/missing-information-gates.md`; `.agents/skills/_shared/runtime-contracts.md`; `.agents/skills/_shared/taxonomy-boundaries.md`; `.agents/skills/_shared/workflow-invariants.md`; `.agents/skills/af-analyze-requirement/SKILL.md`; `.agents/skills/af-analyze-requirement/agents/openai.yaml`; `.agents/skills/af-analyze-requirement/references/analysis-result-shape.md`; `.agents/skills/af-analyze-requirement/references/evidence-and-normalization.md`; `.agents/skills/af-analyze-requirement/references/graph-ir-draft.md`; `.agents/skills/af-analyze-requirement/references/stage-runner-analyze-output.md`; `.agents/skills/af-design-boundaries/SKILL.md`; `.agents/skills/af-design-boundaries/agents/openai.yaml`; `.agents/skills/af-design-boundaries/references/design-stage-output.md`; `.agents/skills/af-design-boundaries/references/graph-ir-review.md`; `.agents/skills/af-design-boundaries/references/module-approval-rubric.md`; `.agents/skills/af-design-boundaries/references/remote-a2a-review.md`; `.agents/skills/af-design-boundaries/references/runtime-contract-review.md`; `.agents/skills/af-build-runtime-stub/SKILL.md`; `.agents/skills/af-build-runtime-stub/agents/openai.yaml`; `.agents/skills/af-build-runtime-stub/references/artifact-sync-build.md`; `.agents/skills/af-build-runtime-stub/references/handoff-non-goals.md`; `.agents/skills/af-build-runtime-stub/references/runtime-generation.md`; `.agents/skills/af-build-runtime-stub/references/runtime-output-checks.md`; `.agents/skills/af-verify-feedback/SKILL.md`; `.agents/skills/af-verify-feedback/agents/openai.yaml`; `.agents/skills/af-verify-feedback/references/catalog-delta-proposal.md`; `.agents/skills/af-verify-feedback/references/evidence-report.md`; `.agents/skills/af-verify-feedback/references/runtime-stub-checks.md`; `.agents/skills/af-verify-feedback/references/stage-runner-verify-output.md`; `.agents/skills/af-verify-feedback/references/validation-allowlist.md`; `docs/README.md`; `docs/handbook/README.md`; `docs/handbook/index.md`; `docs/workbench/taxonomy.md`; `docs/workbench/graph-ir.md`; `docs/workbench/operating-model.md`; `docs/migration/taxonomy-vnext-status.md`.
