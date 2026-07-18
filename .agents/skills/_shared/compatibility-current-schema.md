# Compatibility Layer for the Current Schema

## Contents

- [Purpose](#purpose)
- [When to read](#when-to-read)
- [Decision criteria](#decision-criteria)
- [Required evidence](#required-evidence)
- [Artifact implications](#artifact-implications)
- [Scaffold implications](#scaffold-implications)
- [Verification](#verification)
- [Stop conditions](#stop-conditions)
- [Official sources checked](#official-sources-checked)
- [Checked date](#checked-date)

## Purpose

Serialize Target decisions into the current product schema only where Stage Runner or a current canonical artifact requires it. Output written through this layer is compatibility output. It is not evidence that the Target Contract is implemented.

## When to read

Read this reference before writing or replacing:

- Stage Runner Analyze or Design `proposed-artifacts/analysis-result.json`;
- canonical `artifacts/af/<req-id>/analysis-result.json`;
- current `processFlow`, module candidates, runtime contracts, or embedded A2A contracts;
- any scaffold input derived from those current artifacts.

Do not apply this layer to standalone design notes that are outside current validators and intentionally use Target vocabulary.

## Decision criteria

Classify and design in Target terms first. Then map only the required current payload:

1. Record the Target asset, Graph, Invocation Control, Binding, Transport, and rationale.
2. Open the Current Implementation mappings in [Taxonomy](../../../docs/workbench/taxonomy.md#current-implementation-대응legacy) and [Graph IR](../../../docs/workbench/graph-ir.md#current-implementation-대응legacy).
3. Select a current `legacy` value only when the mapping is supported by evidence.
4. Preserve Target rationale in `rationale`, notes, review fields, or the paired design document.
5. Validate immediately.
6. If mapping is ambiguous or impossible, stop and add an impact-area Blocker to `docs/migration/skill-vnext-status.md` instead of inventing an enum or disguising the loss.

### Target to current module serialization

| Target judgment | Current compatibility serialization | Required caution |
| --- | --- | --- |
| Agent | `module_category: "agent"` (`legacy`) | `agent_kind` is a required nullable `legacy` key; do not treat its values as Target types. |
| Workflow | `module_category: "workflow"` (`legacy`) | `workflow_kind` is a required nullable `legacy` key; preserve Target representation/coordination rationale separately. |
| Tool | often `module_category: "adapter"` (`legacy`) | Reclassify first. A Resource or Dependency must not be forced into Tool merely to fit the schema. |
| Agent with A2A connection/exposure | `module_category: "remote_a2a"` (`legacy`) only when the current contract requires it | This is compatibility output, not a fourth Target asset type; require a 1:1 embedded A2A contract. |

The four current `legacy` category literals are `agent`, `workflow`, `adapter`, and `remote_a2a`.

### Target to current Graph serialization

Current `legacy` `node_kind` literals are:

```text
input, output, agent, function, tool, adapter, adapter_call,
human_input, callback_wait, workflow, workflow_call, remote_a2a,
remote_agent_call, join, router, loop_control
```

Current `legacy` `edge_kind` literals are:

```text
event_output, event_message, session_state, temp_state, user_state,
app_state, artifact, route, control, remote_a2a
```

Use the linked Graph IR mapping rather than assuming same-name semantic identity. In particular:

- a current `legacy` `adapter` node may represent a Tool Node or a non-asset boundary;
- current `legacy` `remote_a2a` and `remote_agent_call` represent an Agent Node plus an A2A boundary;
- current `legacy` `router`, `loop_control`, and `callback_wait` are control nodes or semantics, not assets;
- `workflow_call` is the direct current counterpart for a Subworkflow Node when the referenced Workflow contract exists.

### Invocation and binding compatibility

Target Invocation Control has only Workflow and Agent.

| Target decision | Current compatibility fields |
| --- | --- |
| Workflow explicitly invokes a Tool | `call_control: "fixed_by_workflow"` (`legacy`), usually on a Tool call node/edge |
| Agent decides whether to use an available Tool | `call_control: "selected_by_llm"` (`legacy`) on the Agent node only; this literal is a current serialization artifact, while the Target owner is Agent |
| Human approval affects later flow | `human_input` node plus subsequent Workflow control; do not create a third Invocation Control value |

Current `legacy` `invoke_binding` literals are `unresolved`, `local_python`, `direct_api`, `mcp_tool`, `mcp_toolset`, `local_function`, `internal_workflow`, `ui_input`, `remote_a2a`, `callback_wait`, and `unknown`. Interpret them through the canonical mapping:

- `mcp_tool` -> Tool with MCP Binding;
- `mcp_toolset` -> Agent-to-available-MCP-Tools relationship;
- `local_function` -> Function Node or Function-bound Tool, based on responsibility;
- `internal_workflow` -> Subworkflow Node;
- `ui_input` -> Human Input Node;
- `remote_a2a` -> Agent Node plus A2A boundary;
- `unresolved` or `unknown` -> missing information, never a normal Target type.

Current `decision_owner` is also `legacy` compatibility metadata. Interpret `decision_owner: "workflow_code"` (`legacy`) as Target Workflow control and `decision_owner: "llm"` (`legacy`) as Target Agent control. Interpret `human`, `remote_agent`, and `system` only as Human Input/Workflow semantics, remote-Agent responsibility, or runtime semantics respectively; none adds a Target Invocation Control value.

## Required evidence

The current `analysis-result.json` is a closed object with these required top-level keys:

```text
normalizedRequirement, evidence, moduleCandidates,
a2aContracts, runtimeContracts, processFlow
```

`a2aContracts` and `runtimeContracts` remain present as arrays even when empty. `processFlow` remains the current persisted field name.

Required shape checkpoints:

- `normalizedRequirement`: `id`, `title`, `raw_text`, `domain`, `requester`, `business_goal`, `current_process`, `inputs`, `outputs`, `systems`, `risk_signals`, `missing_information`, `contradictions`, `status`.
- `evidence`: `requested_goal`, `business_domain_hint`, `user_role`, `input_data`, `output_data`, `systems_mentioned`, `decisions_implied`, `risk_signals`, `missing_information`, `contradictions`, `assumptions`.
- each module candidate requires these current keys (many accept `null`):

```text
id, source_requirement_id, name, module_category,
agent_kind, workflow_kind, adapter_kind, remote_contract_kind,
legacy_recommended_type, confidence, rationale, adk_hints,
inputs, outputs, reuse_candidate, risk_level, risk_signals,
status, missing_information, side_effect, auth_required,
audit_required, citation_required, grounding_required,
source_acl_required, versioned, effective_date_required,
owner_domain, owner, agent_card, auth, task_lifecycle,
timeout, retry, fallback, audit, data_policy, a2a_contract_id
```

The current schema, not this summary, remains exhaustive for nested values and conditional rules.
- `processFlow`: `requirement_id`, `graph_id`, `root_workflow_module_id`, `nodes`, `edges`, `containers`, `lanes`, `validation`.
- each node: `id`, `module_id`, `label`, `node_kind`, `execution_kind`, `adk_node_role`, `owner_scope`, `container_id`, `lane_id`, `input_ports`, `output_ports`, `schema_refs`, `review_status`.
- each edge: `id`, `from`, `to`, `from_port`, `to_port`, `edge_kind`, `execution_semantics`, `data_label`, `schema_ref`, `route_condition`, `state_key`, `artifact_key`, `a2a_contract_id`, `is_remote_boundary_crossing`.

Load-bearing conditional rules include:

- final edge IDs use `edge-001` form and container IDs use `container-*` form;
- synthetic `input`, `output`, `join`, `router`, and `loop_control` nodes use `module_id: null`;
- a `route` edge requires `route_condition` unless the current default-route contract applies;
- an `artifact` edge requires `artifact_key`;
- a `remote_a2a` edge requires `is_remote_boundary_crossing: true` and `a2a_contract_id`;
- a current remote candidate requires exactly one matching embedded contract;
- old stage-flow keys such as `type`, `subtype`, `edge_type`, `data`, and `data_channel` are forbidden in current Graph IR export.

Open `schemas/analysis-result.schema.json` and the current validator before relying on nullable/optional detail; this reference intentionally does not duplicate the entire schema.

## Artifact implications

- Analyze and Design proposals must pass `validateAnalysisResult` before apply.
- Design must still produce both `analysis-result.json` and `boundary-design.md`.
- Keep Target reasoning in `rationale` or the paired design notes; compatibility values alone are insufficient review evidence.
- Do not claim Full Integration, Target support, or migration completion from a valid compatibility artifact.
- Record every unrepresentable or materially lossy mapping as a Blocker in `docs/migration/skill-vnext-status.md`.

## Scaffold implications

- Scaffold only after current schema validation, required approval gates, candidate missing-information closure, and runtime/A2A contract approval.
- Treat current enum values as generator input constraints, not preferred Target design.
- Do not teach generated Python to depend on a guessed Target field that current artifacts do not serialize.
- Keep product-schema migration and generator extension as separate product work.

## Verification

For proposed or canonical current artifacts:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Also parse JSON, inspect the exact proposal inventory, and compare mappings against the two linked Current Implementation tables. For Stage Runner, confirm explicit apply and ETag behavior through [artifact-root-and-stage-runner.md](artifact-root-and-stage-runner.md).

## Stop conditions

Stop and record a Blocker when:

- Target intent maps to more than one materially different current category or node without decisive evidence;
- a Resource or Dependency would need to masquerade as a Tool;
- an A2A boundary lacks a 1:1 contract;
- a required key, conditional Graph field, or approval is missing;
- validation fails;
- compatibility output would be described as Target implementation support.

## Official sources checked

- [Taxonomy Current Implementation mapping](../../../docs/workbench/taxonomy.md#current-implementation-대응legacy)
- [Graph IR Current Implementation mapping](../../../docs/workbench/graph-ir.md#current-implementation-대응legacy)
- [Operating Model Current Implementation](../../../docs/workbench/operating-model.md#current-implementationlegacy)
- Current schema: `schemas/analysis-result.schema.json`
- Stage Runner evidence: [r1-stagerunner-contract.md](../../../tests/skills/evidence/research/r1-stagerunner-contract.md)

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory active docs, current schema, validator, and Stage Runner source
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Artifacts produced through this layer are explicitly compatibility output and do not demonstrate Target Contract support.
