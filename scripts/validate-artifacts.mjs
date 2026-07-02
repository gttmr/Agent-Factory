#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  a2aContractRequiredArrayFields,
  a2aContractRequiredObjectFields,
  a2aContractRequiredStringFields,
  a2aContractStatuses,
  a2aHttpPaths,
  a2aOperationNames,
  a2aPartFields,
  a2aRoles,
  a2aRuntimeAuthModes,
  a2aRuntimeFallbackModes,
  a2aStaleAllowlist,
  a2aStaleNames,
  a2aStreamWrappers,
  a2aTaskStates,
  accessProtocols,
  agentExecutionModes,
  callbackCallControls,
  callbackFlowKinds,
  callbackInvokeBindings,
  categories,
  graphCallControls,
  graphContainerKinds,
  graphDecisionOwners,
  graphEdgeKinds,
  graphExecutionSemantics,
  graphFlowKinds,
  graphInvokeBindings,
  graphLaneIds,
  graphLayoutPolicies,
  graphNodeKinds,
  graphPolicies,
  graphSideEffects,
  graphStateEdgeKinds,
  graphStateScopePrefixByKind,
  graphStateScopePrefixPattern,
  remoteAgentNodeKinds,
  runtimeBindings,
  runtimeContractKinds,
  runtimeContractStatuses,
  scaffoldOutputModes,
  smokeScaffoldOutputs,
  syntheticNodeKindsLenient,
  syntheticNodeKindsStrict,
  workflowKinds
} from "./artifact-validation/constants.mjs";
import { validateAfRunManifest } from "./artifact-validation/af-run-manifest.mjs";
import { collectTargets, findJsonFiles, readJson } from "./artifact-validation/files.mjs";
import { isMcpContract, validateContractRegistry } from "./artifact-validation/contract-registry.mjs";
import { validateModuleCandidates } from "./artifact-validation/module-candidates.mjs";
import { validateSavedAnalysisFixtures } from "./artifact-validation/saved-analysis.mjs";

const rawArg = process.argv[2] ?? "templates";
const root = resolve(rawArg);
const errors = [];

// Determine the set of directories to validate. If the supplied path itself
// contains an analysis-result.json (or any of the other recognized artifact
// files), we validate that directory only. Otherwise we walk one level deep
// and pick up every immediate subdirectory that contains an
// analysis-result.json. This lets a parent like
// `templates/regression-scenarios` validate every scenario in one command
// while preserving the legacy single-directory behaviour for `templates/`.
const targets = collectTargets(root, errors);
validateCodexOutputSchema(resolve("schemas/analysis-draft.schema.json"));

for (const target of targets) {
  validateModuleCandidates({ dir: target, errors });
  validateProcessFlow(target);
  validateAnalysisResult(target);
  validateAfRunManifest({ dir: target, errors });
  validateScaffoldPlan(target);
  validateSavedAnalysisFixtures({
    dir: target,
    root,
    errors,
    validateGraphIR,
    validateRuntimeContractObject,
    isMcpContract
  });
  validateContractRegistry({
    dir: target,
    root,
    errors,
    validateA2AContract
  });
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Artifact validation OK");

function validateCodexOutputSchema(path) {
  if (!existsSync(path)) return;
  const schema = readJson(path, errors);
  walkCodexOutputSchema(schema, "codex_output_schema");
}

function walkCodexOutputSchema(schema, label) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") {
    if (schema.additionalProperties !== false) {
      errors.push(`${label} object schema must set additionalProperties to false for Codex response_format.`);
    }
    const propertyNames = Object.keys(schema.properties ?? {});
    const required = new Set(schema.required ?? []);
    const missingRequired = propertyNames.filter((name) => !required.has(name));
    if (missingRequired.length) {
      errors.push(`${label} object schema properties must all be listed in required: ${missingRequired.join(", ")}.`);
    }
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === "enum" || key === "required") continue;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walkCodexOutputSchema(item, `${label}.${key}[${index}]`));
    } else {
      walkCodexOutputSchema(value, `${label}.${key}`);
    }
  }
}

function validateProcessFlow(dir = root) {
  const path = join(dir, "process-flow.json");
  if (!existsSync(path)) {
    return;
  }
  const flow = readJson(path, errors);
  validateGraphIR(flow, "process-flow.json", new Map(), new Map());
}

function validateOptionalEnumValue(value, allowed, label) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(`${label} has invalid value ${JSON.stringify(value)}.`);
  }
}

function hasCallbackWaitControlMetadata(node, edges) {
  if (typeof node.invoke_binding === "string" && callbackInvokeBindings.has(node.invoke_binding)) return true;
  if (typeof node.call_control === "string" && callbackCallControls.has(node.call_control)) return true;
  if (node.policy === "callback_resume_required") return true;
  return edges.some((edge) => {
    if (!edge || (edge.from !== node.id && edge.to !== node.id)) return false;
    return (
      (typeof edge.call_control === "string" && callbackCallControls.has(edge.call_control)) ||
      (typeof edge.flow_kind === "string" && callbackFlowKinds.has(edge.flow_kind))
    );
  });
}

function isRemoteAgentNode(node) {
  return node && typeof node.node_kind === "string" && remoteAgentNodeKinds.has(node.node_kind);
}

// Workflow-first invariant: LLM-selected MCP toolset semantics belong on an
// `agent` decision node. A fixed call node (adapter_call/adapter) must use
// invoke_binding: mcp_tool + call_control: fixed_by_workflow and must never
// carry mcp_toolset / selected_by_llm. See docs/workbench/taxonomy.md
// ("Graph invoke binding") and docs/workbench/validation.md. Returns an error
// suffix string when the node violates the rule, or null when it is fine.
function llmToolsetOwnerIssue(node) {
  if (!node || typeof node !== "object") return null;
  const llmSelected = node.invoke_binding === "mcp_toolset" || node.call_control === "selected_by_llm";
  if (!llmSelected || node.node_kind === "agent") return null;
  return `carries LLM-selected MCP toolset semantics (invoke_binding=${JSON.stringify(
    node.invoke_binding ?? null
  )}, call_control=${JSON.stringify(
    node.call_control ?? null
  )}); mcp_toolset / selected_by_llm belong on an agent decision node, while adapter_call must use mcp_tool + fixed_by_workflow.`;
}

// Same invariant on the edge surface: `selected_by_llm` is agent-node ownership
// metadata (LLM toolset selection), never edge control. Returns an error suffix
// string when an edge carries it, or null otherwise.
function llmToolsetEdgeIssue(edge) {
  if (!edge || typeof edge !== "object") return null;
  if (edge.call_control !== "selected_by_llm") return null;
  return `has call_control selected_by_llm; LLM-selected toolset selection is agent node metadata (node_kind: agent), not edge metadata.`;
}

/**
 * Structural validation for an ADK 2.0 Graph IR object.
 *
 * @param {unknown} graph - the GraphIR document
 * @param {string} label - prefix used in error messages
 * @param {Map<string, object>} candidatesById - module candidate index for
 *   cross-checking node module bindings (empty Map skips that check)
 * @param {Map<string, object>} contractsById - A2A contract index for
 *   cross-checking remote_a2a edges (empty Map skips that check)
 */
function validateGraphIR(graph, label, candidatesById, contractsById) {
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
    errors.push(`${label} must contain an object.`);
    return;
  }

  if (typeof graph.graph_id !== "string" || !/^graph-[0-9]+$/.test(graph.graph_id)) {
    errors.push(`${label}.graph_id must match ^graph-[0-9]+$.`);
  }

  if (graph.root_workflow_module_id !== null && typeof graph.root_workflow_module_id !== "string") {
    errors.push(`${label}.root_workflow_module_id must be a string or null.`);
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : null;
  const edges = Array.isArray(graph.edges) ? graph.edges : null;
  const containers = Array.isArray(graph.containers) ? graph.containers : null;
  const lanes = Array.isArray(graph.lanes) ? graph.lanes : null;

  if (!nodes) errors.push(`${label}.nodes must be an array.`);
  if (!edges) errors.push(`${label}.edges must be an array.`);
  if (!containers) errors.push(`${label}.containers must be an array.`);
  if (!lanes) errors.push(`${label}.lanes must be an array.`);

  if (!graph.validation || typeof graph.validation !== "object" || Array.isArray(graph.validation)) {
    errors.push(`${label}.validation must be an object with ok/errors/warnings.`);
  } else {
    if (typeof graph.validation.ok !== "boolean") {
      errors.push(`${label}.validation.ok must be a boolean.`);
    }
    if (!Array.isArray(graph.validation.errors)) {
      errors.push(`${label}.validation.errors must be an array.`);
    }
    if (!Array.isArray(graph.validation.warnings)) {
      errors.push(`${label}.validation.warnings must be an array.`);
    }
  }

  if (!nodes || !edges || !containers) return;

  // Index nodes / containers, enforce id uniqueness.
  const nodeById = new Map();
  nodes.forEach((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push(`${label}.nodes[${index}] must be an object.`);
      return;
    }
    if (typeof node.id !== "string" || !node.id.trim()) {
      errors.push(`${label}.nodes[${index}].id is required.`);
      return;
    }
    if (nodeById.has(node.id)) {
      errors.push(`${label}.nodes[${index}].id duplicates ${node.id}.`);
    } else {
      nodeById.set(node.id, node);
    }
    if (!graphNodeKinds.has(node.node_kind)) {
      errors.push(`${label}.nodes[${index}] (${node.id}) has invalid node_kind.`);
    }
    for (const legacyKey of ["type", "subtype"]) {
      if (legacyKey in node) {
        errors.push(`${label}.nodes[${index}] (${node.id}) uses legacy ${legacyKey}; emit native Graph IR fields only.`);
      }
    }
    if (!graphLaneIds.has(node.lane_id)) {
      errors.push(`${label}.nodes[${index}] (${node.id}) has invalid lane_id.`);
    }
    if (
      Object.prototype.hasOwnProperty.call(node, "position") &&
      node.position !== null &&
      (!node.position ||
        typeof node.position !== "object" ||
        Array.isArray(node.position) ||
        typeof node.position.x !== "number" ||
        !Number.isFinite(node.position.x) ||
        typeof node.position.y !== "number" ||
        !Number.isFinite(node.position.y))
    ) {
      errors.push(`${label}.nodes[${index}] (${node.id}) has invalid position; expected {x:number,y:number} or null.`);
    }
    if (node.agent_execution_mode !== undefined && node.agent_execution_mode !== null) {
      if (!agentExecutionModes.has(node.agent_execution_mode)) {
        errors.push(
          `${label}.nodes[${index}] (${node.id}) has invalid agent_execution_mode ${node.agent_execution_mode}; expected single_turn or chat.`
        );
      }
      if (node.node_kind !== "agent") {
        errors.push(
          `${label}.nodes[${index}] (${node.id}) has agent_execution_mode but node_kind is ${node.node_kind}; only agent nodes may set it.`
        );
      }
    }
    validateOptionalEnumValue(node.invoke_binding, graphInvokeBindings, `${label}.nodes[${index}] (${node.id}).invoke_binding`);
    validateOptionalEnumValue(node.decision_owner, graphDecisionOwners, `${label}.nodes[${index}] (${node.id}).decision_owner`);
    validateOptionalEnumValue(node.call_control, graphCallControls, `${label}.nodes[${index}] (${node.id}).call_control`);
    validateOptionalEnumValue(node.side_effect, graphSideEffects, `${label}.nodes[${index}] (${node.id}).side_effect`);
    validateOptionalEnumValue(node.policy, graphPolicies, `${label}.nodes[${index}] (${node.id}).policy`);
    const toolsetIssue = llmToolsetOwnerIssue(node);
    if (toolsetIssue) {
      errors.push(`${label}.nodes[${index}] (${node.id}) ${toolsetIssue}`);
    }
    validateHumanInputContract(node, `${label}.nodes[${index}] (${node.id})`);
  });

  const containerById = new Map();
  containers.forEach((container, index) => {
    if (!container || typeof container !== "object" || Array.isArray(container)) {
      errors.push(`${label}.containers[${index}] must be an object.`);
      return;
    }
    if (typeof container.id !== "string" || !container.id.trim()) {
      errors.push(`${label}.containers[${index}].id is required.`);
      return;
    }
    if (!/^container-[a-z0-9-]+$/.test(container.id)) {
      errors.push(`${label}.containers[${index}].id ${container.id} must match ^container-[a-z0-9-]+$.`);
    }
    if (containerById.has(container.id)) {
      errors.push(`${label}.containers[${index}].id duplicates ${container.id}.`);
    } else {
      containerById.set(container.id, container);
    }
    if (!graphContainerKinds.has(container.container_kind)) {
      errors.push(`${label}.containers[${index}] (${container.id}) has invalid container_kind.`);
    }
    if (!graphLayoutPolicies.has(container.layout_policy)) {
      errors.push(`${label}.containers[${index}] (${container.id}) has invalid layout_policy.`);
    }
    for (const key of ["contains_node_ids", "entry_node_ids", "exit_node_ids"]) {
      if (!Array.isArray(container[key])) {
        errors.push(`${label}.containers[${index}] (${container.id}).${key} must be an array.`);
        continue;
      }
      container[key].forEach((id, idx) => {
        if (typeof id !== "string" || !nodeById.has(id)) {
          errors.push(
            `${label}.containers[${index}] (${container.id}).${key}[${idx}] references unknown node ${id}.`
          );
        }
      });
    }
  });

  // node.container_id must reference an existing container.
  nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") return;
    if (node.container_id !== null && node.container_id !== undefined) {
      if (typeof node.container_id !== "string" || !containerById.has(node.container_id)) {
        errors.push(
          `${label}.nodes[${index}] (${node.id}).container_id references unknown container ${node.container_id}.`
        );
      }
    }
    // Module-bound nodes: cross-check candidate category vs node_kind.
    if (typeof node.module_id === "string" && node.module_id.trim()) {
      if (syntheticNodeKindsStrict.has(node.node_kind)) {
        errors.push(
          `${label}.nodes[${index}] (${node.id}) has node_kind ${node.node_kind} but is bound to module ${node.module_id}; synthetic nodes must have module_id null.`
        );
      } else if (candidatesById.size > 0) {
        const candidate = candidatesById.get(node.module_id);
        if (!candidate) {
          errors.push(
            `${label}.nodes[${index}] (${node.id}).module_id ${node.module_id} does not match any module candidate.`
          );
        } else if (
          (node.node_kind === "agent" && candidate.module_category !== "agent") ||
          ((node.node_kind === "workflow" || node.node_kind === "workflow_call") && candidate.module_category !== "workflow") ||
          ((node.node_kind === "adapter" || node.node_kind === "adapter_call") && candidate.module_category !== "adapter") ||
          ((node.node_kind === "remote_a2a" || node.node_kind === "remote_agent_call") && candidate.module_category !== "remote_a2a")
        ) {
          errors.push(
            `${label}.nodes[${index}] (${node.id}) node_kind ${node.node_kind} does not match candidate ${candidate.id} module_category ${candidate.module_category}.`
          );
        }
      }
    } else if (
      !syntheticNodeKindsStrict.has(node.node_kind) &&
      !syntheticNodeKindsLenient.has(node.node_kind) &&
      node.node_kind !== undefined
    ) {
      errors.push(
        `${label}.nodes[${index}] (${node.id}) node_kind ${node.node_kind} requires a module_id.`
      );
    }
  });

  const edgeIds = new Set();
  const defaultRouteEdgesByRouter = new Map();
  edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      errors.push(`${label}.edges[${index}] must be an object.`);
      return;
    }
    if (typeof edge.id !== "string" || !edge.id.trim()) {
      errors.push(`${label}.edges[${index}].id is required.`);
    } else if (!/^edge-[0-9]+$/.test(edge.id)) {
      errors.push(`${label}.edges[${index}].id ${edge.id} must match ^edge-[0-9]+$.`);
    } else if (edgeIds.has(edge.id)) {
      errors.push(`${label}.edges[${index}].id duplicates ${edge.id}.`);
    } else {
      edgeIds.add(edge.id);
    }
    if (typeof edge.from !== "string" || !nodeById.has(edge.from)) {
      errors.push(`${label}.edges[${index}] (${edge.id}).from references unknown node ${edge.from}.`);
    }
    if (typeof edge.to !== "string" || !nodeById.has(edge.to)) {
      errors.push(`${label}.edges[${index}] (${edge.id}).to references unknown node ${edge.to}.`);
    }
    if (!graphEdgeKinds.has(edge.edge_kind)) {
      errors.push(`${label}.edges[${index}] (${edge.id}) has invalid edge_kind.`);
    }
    if (!graphExecutionSemantics.has(edge.execution_semantics)) {
      errors.push(`${label}.edges[${index}] (${edge.id}) has invalid execution_semantics.`);
    }
    validateOptionalEnumValue(edge.flow_kind, graphFlowKinds, `${label}.edges[${index}] (${edge.id}).flow_kind`);
    validateOptionalEnumValue(edge.call_control, graphCallControls, `${label}.edges[${index}] (${edge.id}).call_control`);
    const edgeToolsetIssue = llmToolsetEdgeIssue(edge);
    if (edgeToolsetIssue) {
      errors.push(`${label}.edges[${index}] (${edge.id}) ${edgeToolsetIssue}`);
    }
    for (const legacyKey of ["edge_type", "data", "data_channel"]) {
      if (legacyKey in edge) {
        errors.push(`${label}.edges[${index}] (${edge.id}) uses legacy ${legacyKey}; emit native Graph IR fields only.`);
      }
    }

    if (edge.edge_kind === "route") {
      if (typeof edge.route_condition !== "string" || !edge.route_condition.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) route edge requires non-empty route_condition.`);
      }
    }
    validateRouteReviewContract(edge, `${label}.edges[${index}] (${edge.id})`, defaultRouteEdgesByRouter);
    if (edge.edge_kind === "artifact") {
      if (typeof edge.artifact_key !== "string" || !edge.artifact_key.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) artifact edge requires non-empty artifact_key.`);
      }
    }
    if (graphStateEdgeKinds.has(edge.edge_kind)) {
      if (typeof edge.state_key !== "string" || !edge.state_key.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) ${edge.edge_kind} edge requires non-empty state_key.`);
      } else {
        // Scope is carried by edge_kind; the stored state_key is the bare channel
        // name. A leading scope prefix is allowed only when it matches edge_kind,
        // so a wrong-scope prefix is caught instead of being silently re-scoped by
        // the generator. (Bare keys are the canonical form the picker authors.)
        const expected = graphStateScopePrefixByKind[edge.edge_kind] ?? null; // null for session_state
        const present = (edge.state_key.match(graphStateScopePrefixPattern) || [])[1] ?? null;
        if (present && present !== expected) {
          errors.push(
            `${label}.edges[${index}] (${edge.id}) ${edge.edge_kind} state_key has scope prefix "${present}" that does not match the edge kind; use a bare key (scope comes from the data-passing method)${expected ? ` or the "${expected}" prefix` : ""}.`
          );
        }
      }
    }
    if (edge.edge_kind === "remote_a2a") {
      const fromNode = nodeById.get(edge.from);
      const toNode = nodeById.get(edge.to);
      const remoteNode = isRemoteAgentNode(fromNode) ? fromNode : isRemoteAgentNode(toNode) ? toNode : null;
      if (!remoteNode || typeof remoteNode.module_id !== "string" || !remoteNode.module_id.trim()) {
        errors.push(
          `${label}.edges[${index}] (${edge.id}) remote_a2a edge must connect to a remote agent node with module_id.`
        );
      }
      if (edge.is_remote_boundary_crossing !== true) {
        errors.push(
          `${label}.edges[${index}] (${edge.id}) remote_a2a edge must set is_remote_boundary_crossing=true.`
        );
      }
      if (typeof edge.a2a_contract_id !== "string" || !edge.a2a_contract_id.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) remote_a2a edge requires a2a_contract_id.`);
      } else if (contractsById.size > 0 && !contractsById.has(edge.a2a_contract_id)) {
        errors.push(
          `${label}.edges[${index}] (${edge.id}).a2a_contract_id ${edge.a2a_contract_id} does not match any A2A contract.`
        );
      } else {
        const contract = contractsById.get(edge.a2a_contract_id);
        if (contract) {
          if (remoteNode && typeof remoteNode.module_id === "string" && remoteNode.module_id.trim()) {
            if (contract.remote_module_id !== remoteNode.module_id) {
              errors.push(
                `${label}.edges[${index}] (${edge.id}) remote endpoint node ${remoteNode.id} module_id ${remoteNode.module_id} does not match A2A contract ${edge.a2a_contract_id} remote_module_id ${contract.remote_module_id}.`
              );
            }
            const candidate = candidatesById.get(remoteNode.module_id);
            if (
              candidate &&
              typeof candidate.a2a_contract_id === "string" &&
              candidate.a2a_contract_id.trim() &&
              candidate.a2a_contract_id !== edge.a2a_contract_id
            ) {
              errors.push(
                `${label}.edges[${index}] (${edge.id}) remote endpoint node ${remoteNode.id} module_id ${remoteNode.module_id} links candidate.a2a_contract_id ${candidate.a2a_contract_id}, not edge contract ${edge.a2a_contract_id}.`
              );
            }
          }
        }
      }
    } else {
      if (edge.is_remote_boundary_crossing !== false) {
        errors.push(
          `${label}.edges[${index}] (${edge.id}) non-remote edge must set is_remote_boundary_crossing=false.`
        );
      }
      if (edge.a2a_contract_id !== null && edge.a2a_contract_id !== undefined) {
        errors.push(
          `${label}.edges[${index}] (${edge.id}) non-remote edge must have a2a_contract_id=null.`
        );
      }
    }
  });

  for (const [routerId, defaults] of defaultRouteEdgesByRouter) {
    if (defaults.length > 1) {
      errors.push(`${label} router ${routerId} has multiple default route edges: ${defaults.join(", ")}.`);
    }
  }

  const hasInputLane = nodes.some((node) => node && node.lane_id === "input");
  const hasOutputLane = nodes.some((node) => node && node.lane_id === "output");
  if (!hasInputLane) errors.push(`${label} requires at least one node with lane_id "input".`);
  if (!hasOutputLane) errors.push(`${label} requires at least one node with lane_id "output".`);

  // human_input nodes must have at least one outgoing edge.
  for (const node of nodes) {
    if (node && node.node_kind === "human_input") {
      const out = edges.some((edge) => edge && edge.from === node.id);
      if (!out) {
        errors.push(`${label}.nodes (${node.id}) human_input node must have at least one outgoing edge.`);
      }
    }
  }

  // callback_wait nodes are design-time pause/resume controls. They must point
  // at callback/resume metadata so reviewers can tie them to runtimeContracts.
  for (const node of nodes) {
    if (node && node.node_kind === "callback_wait" && !hasCallbackWaitControlMetadata(node, edges)) {
      errors.push(
        `${label}.nodes (${node.id}) callback_wait node requires callback/resume invoke_binding, call_control, flow_kind, or policy metadata.`
      );
    }
  }

  // Module-bound nodes must be connected into the reviewed workflow. A graph
  // with isolated candidate nodes can render but cannot be a scaffold source.
  for (const node of nodes) {
    if (!node || typeof node.module_id !== "string" || !node.module_id.trim()) continue;
    const incoming = edges.some((edge) => edge && edge.to === node.id);
    const outgoing = edges.some((edge) => edge && edge.from === node.id);
    if (!incoming) {
      errors.push(`${label}.nodes (${node.id}) module-bound node must have at least one incoming edge.`);
    }
    if (!outgoing) {
      errors.push(`${label}.nodes (${node.id}) module-bound node must have at least one outgoing edge.`);
    }
  }

  // Container-kind specific structural rules.
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    if (
      container.container_kind === "dynamic_workflow" &&
      typeof container.adk_mapping === "string" &&
      container.adk_mapping.trim()
    ) {
      errors.push(
        `${label}.containers (${container.id}) dynamic_workflow is design-only and must not declare a runtime adk_mapping.`
      );
    }
    if (container.container_kind === "parallel_region") {
      if (!Array.isArray(container.entry_node_ids) || container.entry_node_ids.length < 2) {
        errors.push(
          `${label}.containers (${container.id}) parallel_region must have ≥2 entry_node_ids.`
        );
      }
      if (!Array.isArray(container.exit_node_ids) || container.exit_node_ids.length < 1) {
        errors.push(`${label}.containers (${container.id}) parallel_region must have ≥1 exit_node_ids.`);
      }
      // At least one node downstream of the region must be a join node.
      const inside = new Set(Array.isArray(container.contains_node_ids) ? container.contains_node_ids : []);
      const reachableJoin = edges.some(
        (edge) => edge && inside.has(edge.from) && nodeById.get(edge.to)?.node_kind === "join"
      );
      if (!reachableJoin) {
        errors.push(
          `${label}.containers (${container.id}) parallel_region must reach a join node downstream.`
        );
      }
    }
    if (container.container_kind === "loop_region") {
      const hasLoopBack = edges.some((edge) => edge && edge.execution_semantics === "loop_back");
      const hasLoopExit = edges.some((edge) => edge && edge.execution_semantics === "loop_exit");
      if (!hasLoopBack) {
        errors.push(
          `${label}.containers (${container.id}) loop_region requires at least one edge with execution_semantics "loop_back".`
        );
      }
      if (!hasLoopExit) {
        errors.push(
          `${label}.containers (${container.id}) loop_region requires at least one edge with execution_semantics "loop_exit".`
        );
      }
    }
  }
}

function validateHumanInputContract(node, label) {
  if (node.node_kind !== "human_input" && node.human_input_contract !== undefined && node.human_input_contract !== null) {
    errors.push(`${label}.human_input_contract is allowed only on human_input nodes.`);
    return;
  }
  if (node.node_kind !== "human_input" || node.human_input_contract === undefined || node.human_input_contract === null) {
    return;
  }
  const contract = node.human_input_contract;
  if (typeof contract !== "object" || Array.isArray(contract)) {
    errors.push(`${label}.human_input_contract must be an object or null.`);
    return;
  }
  if (typeof contract.message !== "string" || !contract.message.trim()) {
    errors.push(`${label}.human_input_contract.message must be a non-empty reviewed prompt.`);
  }
  if (contract.payload_schema_ref !== undefined && contract.payload_schema_ref !== null) {
    if (typeof contract.payload_schema_ref !== "string" || !contract.payload_schema_ref.trim()) {
      errors.push(`${label}.human_input_contract.payload_schema_ref must be a non-empty string or null.`);
    }
  }
  const responseSchemaRef = contract.response_schema_ref;
  if (responseSchemaRef !== null && responseSchemaRef !== undefined && responseSchemaRef !== "str") {
    errors.push(
      `${label}.response_schema_ref ${responseSchemaRef} is design-only; runnable currently supports only null or "str".`
    );
  }
  if (contract.response_mapping !== undefined && contract.response_mapping !== null) {
    if (
      typeof contract.response_mapping !== "object" ||
      Array.isArray(contract.response_mapping) ||
      Object.entries(contract.response_mapping).some(
        ([key, value]) => !key.trim() || typeof value !== "string" || !value.trim()
      )
    ) {
      errors.push(`${label}.human_input_contract.response_mapping must be an object with non-empty string values or null.`);
    }
  }
  if (contract.choice_options !== undefined && contract.choice_options !== null) {
    if (
      !Array.isArray(contract.choice_options) ||
      contract.choice_options.some((item) => typeof item !== "string" || !item.trim())
    ) {
      errors.push(`${label}.human_input_contract.choice_options must be an array of non-empty strings or null.`);
    }
  }
  if (contract.accepted_aliases !== undefined && contract.accepted_aliases !== null) {
    if (
      typeof contract.accepted_aliases !== "object" ||
      Array.isArray(contract.accepted_aliases) ||
      Object.entries(contract.accepted_aliases).some(
        ([key, aliases]) =>
          !key.trim() ||
          !Array.isArray(aliases) ||
          aliases.some((alias) => typeof alias !== "string" || !alias.trim())
      )
    ) {
      errors.push(`${label}.human_input_contract.accepted_aliases must be an object of non-empty string arrays or null.`);
    }
  }
  if (contract.default_choice !== undefined && contract.default_choice !== null) {
    if (typeof contract.default_choice !== "string" || !contract.default_choice.trim()) {
      errors.push(`${label}.human_input_contract.default_choice must be a non-empty string or null.`);
    }
  }
}

function validateScaffoldPlan(dir = root) {
  const path = join(dir, "scaffold-plan.json");
  const templatePath = join(dir, "scaffold-plan.template.json");
  const selectedPath = existsSync(path) ? path : existsSync(templatePath) ? templatePath : null;
  if (!selectedPath) {
    return;
  }

  const plan = readJson(selectedPath, errors);
  if (plan.source !== "approved_workbench_artifact") {
    errors.push("scaffold plan source must be approved_workbench_artifact.");
  }
  if (plan.raw_requirement_to_code !== false) {
    errors.push("scaffold plan must explicitly set raw_requirement_to_code to false.");
  }
  if (plan.package_name !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(plan.package_name)) {
    errors.push("scaffold plan package_name must be a valid ASCII Python package identifier.");
  }
  // Absent output_mode is treated as smoke (fail-closed): smoke keeps the strict
  // no-runnable-logic rules; runnable allows reviewed synthetic wiring. The
  // raw_requirement_to_code / source invariants above hold in BOTH modes.
  if (plan.output_mode !== undefined && !scaffoldOutputModes.has(plan.output_mode)) {
    errors.push(`scaffold plan output_mode must be "smoke" or "runnable" when present.`);
  }
  const outputMode = plan.output_mode === "runnable" ? "runnable" : "smoke";
  if (!Array.isArray(plan.modules)) {
    errors.push("scaffold plan modules must be an array.");
    return;
  }
  validateScaffoldGraph(plan.graph);
  if (!Array.isArray(plan.runtime_contracts)) {
    errors.push("scaffold plan runtime_contracts must be an array.");
  } else {
    plan.runtime_contracts.forEach((contract, index) =>
      validateRuntimeContractObject(contract, `scaffold.runtime_contracts[${index}]`)
    );
    plan.runtime_contracts.forEach((contract, index) => {
      if (contract?.contract_status !== "approved") {
        errors.push(`scaffold.runtime_contracts[${index}].contract_status must be approved.`);
      }
    });
  }

  plan.modules.forEach((module, index) => {
    const label = module.name ?? `scaffold.modules[${index}]`;
    if (!categories.has(module.module_category)) {
      errors.push(`${label} has invalid or missing module_category.`);
    }
    if (outputMode === "runnable") {
      if (module.no_runnable_business_logic !== false) {
        errors.push(`${label} must set no_runnable_business_logic to false in runnable output_mode.`);
      }
      if (module.scaffold_output !== "runnable") {
        errors.push(`${label} scaffold_output must be "runnable" in runnable output_mode.`);
      }
    } else {
      if (module.no_runnable_business_logic !== true) {
        errors.push(`${label} must set no_runnable_business_logic to true in smoke output_mode.`);
      }
      const expected = smokeScaffoldOutputs[module.module_category];
      if (expected && module.scaffold_output !== expected) {
        errors.push(`${label} ${module.module_category} scaffold output must be ${expected}.`);
      }
    }
    if (module.agent_execution_mode !== undefined && module.agent_execution_mode !== null) {
      if (!agentExecutionModes.has(module.agent_execution_mode)) {
        errors.push(`${label} has invalid agent_execution_mode "${module.agent_execution_mode}".`);
      }
      if (module.module_category !== "agent") {
        errors.push(`${label} has agent_execution_mode but module_category is ${module.module_category}; only agent modules may set it.`);
      }
    }
    validateScaffoldMcpBinding(module, label);
  });
}

function validateScaffoldGraph(graph) {
  if (graph === undefined || graph === null) {
    return;
  }
  if (typeof graph !== "object" || Array.isArray(graph)) {
    errors.push("scaffold.graph must be an object when present.");
    return;
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : null;
  const edges = Array.isArray(graph.edges) ? graph.edges : null;
  if (!nodes) {
    errors.push("scaffold.graph.nodes must be an array.");
    return;
  }
  if (!edges) {
    errors.push("scaffold.graph.edges must be an array.");
    return;
  }

  const nodeIds = new Set();
  nodes.forEach((node, index) => {
    const label = `scaffold.graph.nodes[${index}]`;
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (typeof node.id !== "string" || !node.id.trim()) {
      errors.push(`${label}.id must be a non-empty string.`);
    } else {
      nodeIds.add(node.id);
    }
    if (typeof node.node_kind !== "string" || !graphNodeKinds.has(node.node_kind)) {
      errors.push(`${label}.node_kind has invalid value ${JSON.stringify(node.node_kind)}.`);
    }
    if (node.module_id !== undefined && node.module_id !== null && typeof node.module_id !== "string") {
      errors.push(`${label}.module_id must be a string or null when present.`);
    }
    validateOptionalEnumValue(node.invoke_binding, graphInvokeBindings, `${label}.invoke_binding`);
    validateOptionalEnumValue(node.decision_owner, graphDecisionOwners, `${label}.decision_owner`);
    validateOptionalEnumValue(node.call_control, graphCallControls, `${label}.call_control`);
    validateOptionalEnumValue(node.side_effect, graphSideEffects, `${label}.side_effect`);
    validateOptionalEnumValue(node.policy, graphPolicies, `${label}.policy`);
    const toolsetIssue = llmToolsetOwnerIssue(node);
    if (toolsetIssue) {
      errors.push(`${label} ${toolsetIssue}`);
    }
    validateHumanInputContract(node, label);
  });

  const scaffoldDefaultRouteEdgesByRouter = new Map();
  edges.forEach((edge, index) => {
    const label = `scaffold.graph.edges[${index}]`;
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (edge.id !== undefined && edge.id !== null && typeof edge.id !== "string") {
      errors.push(`${label}.id must be a string or null when present.`);
    }
    if (typeof edge.from !== "string" || !edge.from.trim()) {
      errors.push(`${label}.from must be a non-empty string.`);
    } else if (!nodeIds.has(edge.from)) {
      errors.push(`${label}.from references unknown node ${edge.from}.`);
    }
    if (typeof edge.to !== "string" || !edge.to.trim()) {
      errors.push(`${label}.to must be a non-empty string.`);
    } else if (!nodeIds.has(edge.to)) {
      errors.push(`${label}.to references unknown node ${edge.to}.`);
    }
    if (typeof edge.edge_kind !== "string" || !graphEdgeKinds.has(edge.edge_kind)) {
      errors.push(`${label}.edge_kind has invalid value ${JSON.stringify(edge.edge_kind)}.`);
    }
    validateOptionalEnumValue(edge.flow_kind, graphFlowKinds, `${label}.flow_kind`);
    validateOptionalEnumValue(edge.call_control, graphCallControls, `${label}.call_control`);
    const edgeToolsetIssue = llmToolsetEdgeIssue(edge);
    if (edgeToolsetIssue) {
      errors.push(`${label} ${edgeToolsetIssue}`);
    }
    validateRouteReviewContract(edge, label, scaffoldDefaultRouteEdgesByRouter);
  });
  for (const [routerId, defaults] of scaffoldDefaultRouteEdgesByRouter) {
    if (defaults.length > 1) {
      errors.push(`scaffold.graph router ${routerId} has multiple default route edges: ${defaults.join(", ")}.`);
    }
  }
}

function validateRouteReviewContract(edge, label, defaultRouteEdgesByRouter) {
  const isRouteReviewEdge =
    edge.edge_kind === "route" ||
    ((edge.execution_semantics === "loop_back" || edge.execution_semantics === "loop_exit") && edge.edge_kind === "control");
  if (Array.isArray(edge.route_aliases)) {
    if (edge.route_aliases.length > 0 && !isRouteReviewEdge) {
      errors.push(`${label} route_aliases is allowed only on route or loop decision edges.`);
    }
    if (edge.route_aliases.some((alias) => typeof alias !== "string" || !alias.trim())) {
      errors.push(`${label} route_aliases entries must be non-empty strings.`);
    }
  } else if (edge.route_aliases !== undefined && edge.route_aliases !== null) {
    errors.push(`${label} route_aliases must be an array of strings or null.`);
  }
  if (edge.is_default_route === true) {
    if (!isRouteReviewEdge) {
      errors.push(`${label} is_default_route is allowed only on route or loop decision edges.`);
    } else if (typeof edge.from === "string") {
      if (edge.edge_kind === "route") {
        const defaults = defaultRouteEdgesByRouter.get(edge.from) ?? [];
        defaults.push(typeof edge.id === "string" ? edge.id : label);
        defaultRouteEdgesByRouter.set(edge.from, defaults);
      }
    }
  } else if (
    edge.is_default_route !== undefined &&
    edge.is_default_route !== null &&
    edge.is_default_route !== false
  ) {
    errors.push(`${label} is_default_route must be boolean or null.`);
  }
}

// MCP binding consistency for scaffold modules. A partial binding (server or
// tool without the other, or without access_protocol="mcp") is a bug that would
// generate a broken connected adapter, so it is rejected in both modes.
function validateScaffoldMcpBinding(module, label) {
  if (
    module.access_protocol !== undefined &&
    module.access_protocol !== null &&
    !accessProtocols.has(module.access_protocol)
  ) {
    errors.push(`${label} has invalid access_protocol "${module.access_protocol}".`);
  }
  if (
    module.runtime_binding !== undefined &&
    module.runtime_binding !== null &&
    !runtimeBindings.has(module.runtime_binding)
  ) {
    errors.push(`${label} has invalid runtime_binding "${module.runtime_binding}".`);
  }
  const hasServer = typeof module.mcp_server === "string" && module.mcp_server.trim().length > 0;
  const hasTool = typeof module.mcp_tool_name === "string" && module.mcp_tool_name.trim().length > 0;
  // Any signal of an MCP binding (protocol, runtime_binding, or either field)
  // requires a complete, non-blank binding so the generator can emit a connected
  // adapter; otherwise it is a bug, not a silent unconnected downgrade.
  const declaresMcp =
    module.access_protocol === "mcp" || module.runtime_binding === "mcp" || module.runtime_binding === "mcp_tool" || hasServer || hasTool;
  if (declaresMcp && (!hasServer || !hasTool || module.access_protocol !== "mcp")) {
    errors.push(
      `${label} has an incomplete MCP binding (require access_protocol="mcp" with non-empty mcp_server and mcp_tool_name).`
    );
  }
}

function validateRuntimeContractObject(contract, label) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof contract.contract_id !== "string" || !/^rtc-[a-z0-9-]+$/.test(contract.contract_id)) {
    errors.push(`${label}.contract_id must match rtc-*.`);
  }
  if (!runtimeContractKinds.has(contract.contract_kind)) {
    errors.push(`${label}.contract_kind is invalid.`);
  }
  if (!runtimeContractStatuses.has(contract.contract_status)) {
    errors.push(`${label}.contract_status is invalid.`);
  }
  if (contract.module_id !== null && typeof contract.module_id !== "string") {
    errors.push(`${label}.module_id must be string or null.`);
  }
  if (typeof contract.title !== "string" || !contract.title.trim()) {
    errors.push(`${label}.title is required.`);
  }
  if (!Array.isArray(contract.required_review_fields)) {
    errors.push(`${label}.required_review_fields must be an array.`);
  }
  if (!Array.isArray(contract.identifiers)) {
    errors.push(`${label}.identifiers must be an array.`);
  }
  if (!Array.isArray(contract.developer_todos)) {
    errors.push(`${label}.developer_todos must be an array.`);
  }
  ["runtime_support", "operation", "policies", "graph_ir_annotations"].forEach((field) => {
    if (!contract[field] || typeof contract[field] !== "object" || Array.isArray(contract[field])) {
      errors.push(`${label}.${field} must be an object.`);
    }
  });
}

// ---------------------------------------------------------------------------
// Analysis-result validation (a2aContracts) and 1:1 pairing with remote
// candidates. Conditional: only runs when analysis-result.json exists in the
// target dir. The templates dir contains no analysis-result.json today, so
// the validator's existing template smoke check still passes unchanged.
// ---------------------------------------------------------------------------
function validateAnalysisResult(dir = root) {
  const path = join(dir, "analysis-result.json");
  if (!existsSync(path)) {
    return;
  }
  const result = readJson(path, errors);
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    errors.push("analysis-result.json must contain an object.");
    return;
  }

  if (!Array.isArray(result.a2aContracts)) {
    errors.push("analysis-result.json a2aContracts must be an array.");
    return;
  }
  if (!Array.isArray(result.runtimeContracts)) {
    errors.push("analysis-result.json runtimeContracts must be an array.");
    return;
  }
  result.runtimeContracts.forEach((contract, index) =>
    validateRuntimeContractObject(contract, `analysis-result.json.runtimeContracts[${index}]`)
  );

  // Anti-regression for spec §11: stages are no longer the workflow semantic
  // unit. Reject any leftover top-level stages array on the analysis result.
  if ("stages" in result) {
    errors.push("analysis-result.json must not contain a top-level stages field; use processFlow Graph IR instead.");
  }

  // Build the candidate index from the same dir, if present, so we can
  // cross-check remote_module_id and 1:1 pairing. Falls back to the
  // analysis-result's embedded moduleCandidates when no sibling file exists.
  const candidatesPath = join(dir, "module-candidates.json");
  let candidates = [];
  if (existsSync(candidatesPath)) {
    const loaded = readJson(candidatesPath, errors);
    if (Array.isArray(loaded)) {
      candidates = loaded;
    }
  } else if (Array.isArray(result.moduleCandidates)) {
    candidates = result.moduleCandidates;
  }
  const remoteCandidateById = new Map();
  for (const candidate of candidates) {
    if (candidate && candidate.module_category === "remote_a2a" && typeof candidate.id === "string") {
      remoteCandidateById.set(candidate.id, candidate);
    }
  }

  const seenContractIds = new Set();
  const contractByModuleId = new Map();

  result.a2aContracts.forEach((contract, index) => {
    const label = contract && contract.contract_id ? contract.contract_id : `a2aContracts[${index}]`;
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    validateA2AContract(contract, label, remoteCandidateById, seenContractIds, contractByModuleId);
  });

  // 1:1 pairing: every remote_a2a candidate must have exactly one matching
  // contract by a2a_contract_id <-> contract_id.
  for (const [moduleId, candidate] of remoteCandidateById.entries()) {
    const linkedContractId = candidate.a2a_contract_id;
    const matches = contractByModuleId.get(moduleId) ?? [];
    if (matches.length === 0) {
      errors.push(`remote_a2a candidate ${moduleId} has no matching A2A contract.`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(
        `remote_a2a candidate ${moduleId} is linked to ${matches.length} contracts; exactly one is required.`
      );
      continue;
    }
    if (typeof linkedContractId === "string" && linkedContractId !== matches[0].contract_id) {
      errors.push(
        `remote_a2a candidate ${moduleId}.a2a_contract_id (${linkedContractId}) does not match its contract (${matches[0].contract_id}).`
      );
    }
  }

  // GraphIR structural validation. Build full candidate index (not just
  // remote) and contract index so node module bindings and remote-edge
  // contract refs can be cross-checked.
  const candidatesById = new Map();
  for (const candidate of candidates) {
    if (candidate && typeof candidate.id === "string") {
      candidatesById.set(candidate.id, candidate);
    }
  }
  const contractsById = new Map();
  for (const contract of result.a2aContracts) {
    if (contract && typeof contract.contract_id === "string") {
      contractsById.set(contract.contract_id, contract);
    }
  }
  if (result.processFlow !== undefined) {
    validateGraphIR(result.processFlow, "analysis-result.json:processFlow", candidatesById, contractsById);
  }
}

function validateA2AContract(contract, label, remoteCandidateById, seenContractIds, contractByModuleId) {
  // contract_id pattern + uniqueness
  if (typeof contract.contract_id !== "string" || !/^a2a-\d{3,}$/.test(contract.contract_id)) {
    errors.push(`${label}.contract_id must match a2a-NNN.`);
  } else if (seenContractIds.has(contract.contract_id)) {
    errors.push(`${label}.contract_id duplicated: ${contract.contract_id}.`);
  } else {
    seenContractIds.add(contract.contract_id);
  }

  // remote_module_id must reference an existing remote_a2a candidate.
  if (typeof contract.remote_module_id !== "string" || !contract.remote_module_id.trim()) {
    errors.push(`${label}.remote_module_id is required.`);
  } else if (remoteCandidateById.size > 0 && !remoteCandidateById.has(contract.remote_module_id)) {
    errors.push(
      `${label}.remote_module_id ${contract.remote_module_id} does not match any remote_a2a candidate.`
    );
  } else {
    const list = contractByModuleId.get(contract.remote_module_id) ?? [];
    list.push(contract);
    contractByModuleId.set(contract.remote_module_id, list);
  }

  // contract_status must be a known enum value.
  if (typeof contract.contract_status !== "string" || !a2aContractStatuses.has(contract.contract_status)) {
    errors.push(`${label}.contract_status must be one of draft|needs_info|approved.`);
  }

  // Required string presence (the literal "needs_info" satisfies presence
  // but is reported as a review warning rather than a hard error).
  for (const field of a2aContractRequiredStringFields) {
    if (typeof contract[field] !== "string" || !contract[field].trim()) {
      errors.push(`${label}.${field} is required and must be a non-empty string.`);
    } else if (contract[field] === "needs_info") {
      // Warning track: surface but don't fail. The presence rule is met.
      // The validator emits a single line so reviewers can see it in CI logs
      // without breaking the pipeline.
      console.warn(`[needs_info] ${label}.${field} is awaiting review.`);
    }
  }

  // Required arrays must exist (may be empty for skills/extensions/etc.;
  // we just require array type. Specific subset checks come later.)
  for (const field of a2aContractRequiredArrayFields) {
    if (!Array.isArray(contract[field])) {
      errors.push(`${label}.${field} must be an array.`);
    }
  }

  // Required object fields must be objects.
  for (const field of a2aContractRequiredObjectFields) {
    if (!contract[field] || typeof contract[field] !== "object" || Array.isArray(contract[field])) {
      errors.push(`${label}.${field} must be an object.`);
    }
  }

  // push_notification_policy: string or null (explicit null allowed by spec).
  if (
    contract.push_notification_policy !== null &&
    (typeof contract.push_notification_policy !== "string" || !contract.push_notification_policy.trim())
  ) {
    errors.push(`${label}.push_notification_policy must be a non-empty string or explicit null.`);
  }

  validateA2ARuntimePolicy(contract.adk_runtime_policy, label);

  // operations subset of A2A_OPERATION_NAMES.
  if (Array.isArray(contract.operations)) {
    contract.operations.forEach((op, idx) => {
      if (!a2aOperationNames.has(op)) {
        errors.push(`${label}.operations[${idx}] (${op}) is not a known A2A 1.0 operation.`);
      }
    });
  }

  // http_paths subset of A2A_HTTP_PATHS.
  if (Array.isArray(contract.http_paths)) {
    contract.http_paths.forEach((path, idx) => {
      if (!a2aHttpPaths.has(path)) {
        errors.push(`${label}.http_paths[${idx}] (${path}) is not a known A2A 1.0 HTTP+JSON path.`);
      }
    });
  }

  // task_lifecycle.states non-empty subset of A2A_TASK_STATES.
  const lifecycle = contract.task_lifecycle;
  if (lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle)) {
    if (!Array.isArray(lifecycle.states)) {
      errors.push(`${label}.task_lifecycle.states must be an array.`);
    } else {
      if (lifecycle.states.length === 0) {
        errors.push(`${label}.task_lifecycle.states must be non-empty.`);
      }
      lifecycle.states.forEach((state, idx) => {
        if (!a2aTaskStates.has(state)) {
          errors.push(`${label}.task_lifecycle.states[${idx}] (${state}) is not a known TASK_STATE_*.`);
        }
      });
    }
    if (Array.isArray(lifecycle.terminal_states)) {
      lifecycle.terminal_states.forEach((state, idx) => {
        if (!a2aTaskStates.has(state)) {
          errors.push(
            `${label}.task_lifecycle.terminal_states[${idx}] (${state}) is not a known TASK_STATE_*.`
          );
        }
      });
    }
  }

  // streaming.wrappers subset of A2A_STREAM_WRAPPERS.
  const streaming = contract.streaming;
  if (streaming && typeof streaming === "object" && !Array.isArray(streaming)) {
    if (Array.isArray(streaming.wrappers)) {
      streaming.wrappers.forEach((wrapper, idx) => {
        if (!a2aStreamWrappers.has(wrapper)) {
          errors.push(`${label}.streaming.wrappers[${idx}] (${wrapper}) is not a known stream wrapper.`);
        }
      });
    }
  }

  // message_contract.allowed_part_fields subset of A2A_PART_FIELDS,
  // allowed_roles subset of A2A_ROLES.
  const messageContract = contract.message_contract;
  if (messageContract && typeof messageContract === "object" && !Array.isArray(messageContract)) {
    if (Array.isArray(messageContract.allowed_part_fields)) {
      messageContract.allowed_part_fields.forEach((field, idx) => {
        if (!a2aPartFields.has(field)) {
          errors.push(
            `${label}.message_contract.allowed_part_fields[${idx}] (${field}) is not a known A2A 1.0 Part field.`
          );
        }
      });
    }
    if (Array.isArray(messageContract.allowed_roles)) {
      messageContract.allowed_roles.forEach((role, idx) => {
        if (!a2aRoles.has(role)) {
          errors.push(`${label}.message_contract.allowed_roles[${idx}] (${role}) is not a known A2A role.`);
        }
      });
    }
  }

  // Stale-name scan: serialize the contract to JSON and look for any
  // forbidden token as a whole substring. We use word-boundary checks for
  // identifier-like tokens to reduce false positives on legitimate prose
  // (e.g. "submitted" inside a sentence). Forbidden URL-shaped tokens
  // (tasks/...) are matched as plain substrings since they cannot appear
  // in legitimate A2A 1.0 paths (current paths use ":" not "/").
  const serialized = JSON.stringify(contract);
  for (const stale of a2aStaleNames) {
    if (a2aStaleAllowlist.has(stale)) continue;
    const found = stale.includes("/")
      ? serialized.includes(`"${stale}"`) || serialized.includes(stale)
      : new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(stale)}([^A-Za-z0-9_-]|$)`).test(serialized);
    if (found) {
      errors.push(`${label} contains stale A2A terminology: ${stale}.`);
    }
  }
}

function validateA2ARuntimePolicy(policy, label) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    errors.push(`${label}.adk_runtime_policy must be an object.`);
    return;
  }
  if (policy.timeout_seconds !== null && (typeof policy.timeout_seconds !== "number" || !Number.isFinite(policy.timeout_seconds) || policy.timeout_seconds <= 0)) {
    errors.push(`${label}.adk_runtime_policy.timeout_seconds must be a positive number or null.`);
  }
  const auth = policy.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    errors.push(`${label}.adk_runtime_policy.auth must be an object.`);
  } else {
    if (typeof auth.mode !== "string" || !a2aRuntimeAuthModes.has(auth.mode)) {
      errors.push(`${label}.adk_runtime_policy.auth.mode must be none, bearer_env, or metadata_env.`);
    }
    if (auth.env_var !== null && (typeof auth.env_var !== "string" || !/^AF_A2A_[A-Z0-9_]+$/.test(auth.env_var))) {
      errors.push(`${label}.adk_runtime_policy.auth.env_var must be null or an AF_A2A_* environment variable name.`);
    }
    if (auth.metadata_key !== null && (typeof auth.metadata_key !== "string" || !auth.metadata_key.trim())) {
      errors.push(`${label}.adk_runtime_policy.auth.metadata_key must be a non-empty string or null.`);
    }
  }
  const retry = policy.retry_handoff;
  if (!retry || typeof retry !== "object" || Array.isArray(retry)) {
    errors.push(`${label}.adk_runtime_policy.retry_handoff must be an object.`);
  } else {
    if (retry.max_attempts !== null && (!Number.isInteger(retry.max_attempts) || retry.max_attempts < 1)) {
      errors.push(`${label}.adk_runtime_policy.retry_handoff.max_attempts must be a positive integer or null.`);
    }
    if (retry.backoff_seconds !== null && (typeof retry.backoff_seconds !== "number" || !Number.isFinite(retry.backoff_seconds) || retry.backoff_seconds <= 0)) {
      errors.push(`${label}.adk_runtime_policy.retry_handoff.backoff_seconds must be a positive number or null.`);
    }
    if (!Array.isArray(retry.retry_on) || retry.retry_on.some((item) => typeof item !== "string" || !item.trim())) {
      errors.push(`${label}.adk_runtime_policy.retry_handoff.retry_on must be an array of non-empty strings.`);
    }
  }
  const fallback = policy.fallback_handoff;
  if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) {
    errors.push(`${label}.adk_runtime_policy.fallback_handoff must be an object.`);
  } else {
    if (typeof fallback.mode !== "string" || !a2aRuntimeFallbackModes.has(fallback.mode)) {
      errors.push(`${label}.adk_runtime_policy.fallback_handoff.mode must be none, manual_review, or local_event.`);
    }
    if (fallback.message !== null && (typeof fallback.message !== "string" || !fallback.message.trim())) {
      errors.push(`${label}.adk_runtime_policy.fallback_handoff.message must be a non-empty string or null.`);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
