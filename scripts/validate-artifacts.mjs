#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const rawArg = process.argv[2] ?? "templates";
const root = resolve(rawArg);
const errors = [];

const categories = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
const adapterKinds = new Set([
  "legacy_api",
  "retrieval",
  "rule_registry",
  "data_query",
  "template",
  "computation",
  "external_service",
  "unknown"
]);
const agentKinds = new Set(["specialist", "shared"]);
const workflowKinds = new Set([
  "sequential",
  "parallel",
  "loop",
  "human_review",
  "orchestration",
  "graph",
  "dynamic",
  "unknown"
]);
const remoteKinds = new Set(["a2a", "unknown"]);
const accessProtocols = new Set(["local", "http_rest", "mcp", "grpc", "message_queue", "unknown"]);
// Graph IR (ADK 2.0). Mirrors the GRAPH_* constant exports in
// packages/web/src/analyzer/types.ts. The validator must stay
// dependency-free, so the lists are duplicated here.
const graphNodeKinds = new Set([
  "input",
  "output",
  "agent",
  "function",
  "tool",
  "adapter",
  "human_input",
  "workflow",
  "remote_a2a",
  "join",
  "router",
  "loop_control"
]);
const graphContainerKinds = new Set([
  "graph_workflow",
  "dynamic_workflow",
  "parallel_region",
  "loop_region",
  "human_review_region",
  "remote_boundary"
]);
const graphEdgeKinds = new Set([
  "event_output",
  "event_message",
  "session_state",
  "temp_state",
  "user_state",
  "app_state",
  "artifact",
  "route",
  "control",
  "remote_a2a"
]);
const graphLaneIds = new Set([
  "input",
  "local_graph",
  "adapter",
  "human_input",
  "output",
  "remote_boundary"
]);
const graphLayoutPolicies = new Set([
  "dag_with_routes",
  "fan_out_fan_in",
  "loop",
  "linear",
  "free"
]);
const graphExecutionSemantics = new Set([
  "normal_transition",
  "fan_out",
  "fan_in",
  "loop_back",
  "loop_exit",
  "conditional",
  "boundary_crossing"
]);
// Synthetic node kinds that MUST NOT bind to a module candidate.
const syntheticNodeKindsStrict = new Set(["input", "output", "join", "router", "loop_control"]);
// Synthetic-ish kinds that MAY optionally bind to a candidate without erroring.
const syntheticNodeKindsLenient = new Set(["function", "tool", "human_input"]);
const adkHintKeys = new Set(["state_memory", "callbacks", "artifacts_events", "mcp_a2a", "streaming_grounding"]);
const remoteRequiredFields = [
  "owner",
  "agent_card",
  "auth",
  "task_lifecycle",
  "timeout",
  "retry",
  "fallback",
  "audit",
  "data_policy"
];

// ---------------------------------------------------------------------------
// A2A 1.0 contract constants. Kept in lockstep with
// packages/web/src/analyzer/types.ts (A2A_OPERATION_NAMES, A2A_HTTP_PATHS,
// A2A_TASK_STATES, A2A_PART_FIELDS, A2A_ROLES, A2A_STREAM_WRAPPERS,
// A2A_STALE_NAMES, A2A_CONTRACT_STATUSES). Validator must stay dependency-free,
// so the lists are duplicated here. If you change one, change the other.
// ---------------------------------------------------------------------------
const a2aOperationNames = new Set([
  "SendMessage",
  "SendStreamingMessage",
  "GetTask",
  "SubscribeToTask",
  "CancelTask",
  "ListTasks"
]);
const a2aHttpPaths = new Set([
  "/message:send",
  "/message:stream",
  "/tasks/{id}",
  "/tasks/{id}:subscribe",
  "/tasks/{id}:cancel"
]);
const a2aTaskStates = new Set([
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_AUTH_REQUIRED",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_REJECTED"
]);
const a2aPartFields = new Set(["text", "raw", "url", "data"]);
const a2aRoles = new Set(["ROLE_USER", "ROLE_AGENT"]);
const a2aStreamWrappers = new Set(["task", "message", "taskStatusUpdate", "taskArtifactUpdate"]);
const a2aContractStatuses = new Set(["draft", "needs_info", "approved"]);

// Required string fields on an A2AContract (top-level scalar string fields).
// Nested object fields are validated separately.
const a2aContractRequiredStringFields = [
  "contract_id",
  "remote_module_id",
  "target_agent_name",
  "target_agent_purpose",
  "adk_host_mapping",
  "timeout",
  "retry",
  "fallback",
  "cancellation",
  "unsupported_operation",
  "get_task_fallback",
  "auth",
  "token_handling",
  "audit",
  "data_policy"
];
const a2aContractRequiredArrayFields = [
  "supported_interfaces",
  "input_modes",
  "output_modes",
  "security_schemes",
  "security_requirements",
  "skills",
  "extensions",
  "operations",
  "http_paths"
];
const a2aContractRequiredObjectFields = [
  "agent_card",
  "message_contract",
  "task_lifecycle",
  "streaming",
  "artifact_contract"
];

// Stale terminology that must never appear inside a serialized contract.
const a2aStaleNames = [
  "tasks/send",
  "tasks/sendSubscribe",
  "tasks/get",
  "tasks/cancel",
  "tasks/pushNotification/set",
  "tasks/pushNotification/get",
  "tasks/resubscribe",
  "tasks/list",
  "SendTaskRequest",
  "SendTaskResponse",
  "SendTaskStreamingRequest",
  "SendTaskStreamingResponse",
  "GetTaskRequest",
  "GetTaskResponse",
  "CancelTaskRequest",
  "CancelTaskResponse",
  "TaskSendParams",
  "TaskQueryParams",
  "TaskIdParams",
  "submitted",
  "working",
  "input-required",
  "completed",
  "failed",
  "canceled",
  "rejected",
  "auth-required",
  "SUBMITTED",
  "WORKING",
  "INPUT_REQUIRED",
  "AUTH_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REJECTED",
  "final",
  "TaskStatusUpdateEvent",
  "TaskArtifactUpdateEvent",
  "isFinal",
  "lastChunk",
  "TextPart",
  "FilePart",
  "DataPart",
  "file"
];
// A small allowlist of substrings that legitimately match stale tokens but
// are not themselves stale usage. The stale scan ignores any contract whose
// JSON contains *only* allowlisted occurrences. We keep this list narrow.
const a2aStaleAllowlist = new Set([
  // none today; populate only if a real contract surfaces a false positive
]);

// Determine the set of directories to validate. If the supplied path itself
// contains an analysis-result.json (or any of the other recognized artifact
// files), we validate that directory only. Otherwise we walk one level deep
// and pick up every immediate subdirectory that contains an
// analysis-result.json. This lets a parent like
// `templates/regression-scenarios` validate every scenario in one command
// while preserving the legacy single-directory behaviour for `templates/`.
const targets = collectTargets(root);

for (const target of targets) {
  validateModuleCandidates(target);
  validateProcessFlow(target);
  validateAnalysisResult(target);
  validateScaffoldPlan(target);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Artifact validation OK");

function collectTargets(start) {
  if (!existsSync(start)) {
    errors.push(`Path does not exist: ${start}.`);
    return [];
  }
  let stat;
  try {
    stat = statSync(start);
  } catch (error) {
    errors.push(`Cannot stat ${start}: ${error.message}`);
    return [];
  }
  if (!stat.isDirectory()) {
    errors.push(`Path is not a directory: ${start}.`);
    return [];
  }

  // If this directory itself looks like a leaf artifact directory, validate
  // it directly. We treat the presence of analysis-result.json,
  // module-candidates.json, process-flow.json, or scaffold-plan(.template).json
  // as the leaf signal so the existing templates/ smoke check still works.
  if (looksLikeArtifactDir(start)) {
    return [start];
  }

  // Otherwise walk one level deep and pick up every subdirectory that
  // contains an analysis-result.json file.
  const found = [];
  let entries;
  try {
    entries = readdirSync(start, { withFileTypes: true });
  } catch (error) {
    errors.push(`Cannot read directory ${start}: ${error.message}`);
    return [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = join(start, entry.name);
    if (existsSync(join(child, "analysis-result.json"))) {
      found.push(child);
    }
  }
  if (found.length === 0) {
    // Nothing to walk: fall back to validating the directory itself, so
    // pre-existing callers that pass a leaf-shaped directory without
    // canonical files still get the legacy "no-op success" behaviour.
    return [start];
  }
  return found;
}

function looksLikeArtifactDir(dir) {
  return (
    existsSync(join(dir, "analysis-result.json")) ||
    existsSync(join(dir, "module-candidates.json")) ||
    existsSync(join(dir, "process-flow.json")) ||
    existsSync(join(dir, "scaffold-plan.json")) ||
    existsSync(join(dir, "scaffold-plan.template.json"))
  );
}

function validateModuleCandidates(dir = root) {
  const path = join(dir, "module-candidates.json");
  if (!existsSync(path)) {
    return;
  }

  const candidates = readJson(path);
  if (!Array.isArray(candidates)) {
    errors.push("module-candidates.json must contain an array.");
    return;
  }

  candidates.forEach((candidate, index) => {
    const label = candidate.name ?? `module-candidates[${index}]`;
    if (!categories.has(candidate.module_category)) {
      errors.push(`${label} has invalid or missing module_category.`);
    }
    if ("recommended_type" in candidate) {
      errors.push(`${label} uses recommended_type as a classifier; use module_category instead.`);
    }
    if (
      !Array.isArray(candidate.missing_information) ||
      candidate.missing_information.some((item) => typeof item !== "string" || !item.trim())
    ) {
      errors.push(`${label} missing_information must be an array of non-empty strings.`);
    }
    validateAdkHints(candidate.adk_hints, label);
    if (candidate.module_category === "adapter" && !adapterKinds.has(candidate.adapter_kind)) {
      errors.push(`${label} is adapter but has invalid or missing adapter_kind.`);
    }
    if (candidate.module_category === "agent" && !agentKinds.has(candidate.agent_kind)) {
      errors.push(`${label} is agent but has invalid or missing agent_kind.`);
    }
    if (candidate.module_category === "workflow" && !workflowKinds.has(candidate.workflow_kind)) {
      errors.push(`${label} is workflow but has invalid or missing workflow_kind.`);
    }
    if (candidate.module_category === "remote_a2a") {
      if (!remoteKinds.has(candidate.remote_contract_kind)) {
        errors.push(`${label} is remote_a2a but has invalid or missing remote_contract_kind.`);
      }
      if (candidate.risk_level !== "high") {
        errors.push(`${label} is remote_a2a and must be high risk.`);
      }
      const missing = remoteRequiredFields.filter((field) => !candidate[field]);
      if (missing.length) {
        errors.push(`${label} is remote_a2a and is missing contract fields: ${missing.join(", ")}.`);
      }
      if (typeof candidate.a2a_contract_id !== "string" || !candidate.a2a_contract_id.trim()) {
        errors.push(`${label} is remote_a2a and is missing a2a_contract_id.`);
      } else if (!/^a2a-\d{3,}$/.test(candidate.a2a_contract_id)) {
        errors.push(`${label}.a2a_contract_id must match a2a-NNN.`);
      }
    }
    if (candidate.access_protocol !== undefined && candidate.access_protocol !== null) {
      if (!accessProtocols.has(candidate.access_protocol)) {
        errors.push(`${label} has invalid access_protocol.`);
      }
      if (candidate.access_protocol === "mcp") {
        if (!candidate.mcp_server || !candidate.mcp_tool_name) {
          errors.push(`${label} access_protocol mcp requires mcp_server and mcp_tool_name.`);
        }
      }
    }
  });
}

function validateProcessFlow(dir = root) {
  const path = join(dir, "process-flow.json");
  if (!existsSync(path)) {
    return;
  }
  const flow = readJson(path);
  validateGraphIR(flow, "process-flow.json", new Map(), new Map());
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

  // validation block presence
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
    if (!graphLaneIds.has(node.lane_id)) {
      errors.push(`${label}.nodes[${index}] (${node.id}) has invalid lane_id.`);
    }
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
          (node.node_kind === "workflow" && candidate.module_category !== "workflow") ||
          (node.node_kind === "adapter" && candidate.module_category !== "adapter") ||
          (node.node_kind === "remote_a2a" && candidate.module_category !== "remote_a2a")
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

  // Edges.
  const edgeIds = new Set();
  edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      errors.push(`${label}.edges[${index}] must be an object.`);
      return;
    }
    if (typeof edge.id !== "string" || !edge.id.trim()) {
      errors.push(`${label}.edges[${index}].id is required.`);
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

    if (edge.edge_kind === "route") {
      if (typeof edge.route_condition !== "string" || !edge.route_condition.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) route edge requires non-empty route_condition.`);
      }
    }
    if (edge.edge_kind === "artifact") {
      if (typeof edge.artifact_key !== "string" || !edge.artifact_key.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) artifact edge requires non-empty artifact_key.`);
      }
    }
    const stateEdgeKinds = ["session_state", "temp_state", "user_state", "app_state"];
    if (stateEdgeKinds.includes(edge.edge_kind)) {
      if (typeof edge.state_key !== "string" || !edge.state_key.trim()) {
        errors.push(`${label}.edges[${index}] (${edge.id}) ${edge.edge_kind} edge requires non-empty state_key.`);
      } else {
        if (edge.edge_kind === "temp_state" && !edge.state_key.startsWith("temp:")) {
          errors.push(`${label}.edges[${index}] (${edge.id}) temp_state state_key must start with "temp:".`);
        }
        if (edge.edge_kind === "user_state" && !edge.state_key.startsWith("user:")) {
          errors.push(`${label}.edges[${index}] (${edge.id}) user_state state_key must start with "user:".`);
        }
        if (edge.edge_kind === "app_state" && !edge.state_key.startsWith("app:")) {
          errors.push(`${label}.edges[${index}] (${edge.id}) app_state state_key must start with "app:".`);
        }
      }
    }
    if (edge.edge_kind === "remote_a2a") {
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

  // At least one input-laned and one output-laned node.
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

  // Container-kind specific structural rules.
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
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

function validateAdkHints(value, label) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} adk_hints must be an object or null.`);
    return;
  }
  Object.entries(value).forEach(([key, hint]) => {
    if (!adkHintKeys.has(key)) {
      errors.push(`${label} adk_hints has unknown key: ${key}.`);
      return;
    }
    if (hint === null) {
      return;
    }
    if (typeof hint !== "string" || !hint.trim()) {
      errors.push(`${label} adk_hints.${key} must be a non-empty string or null.`);
    }
  });
}

function validateScaffoldPlan(dir = root) {
  const path = join(dir, "scaffold-plan.json");
  const templatePath = join(dir, "scaffold-plan.template.json");
  const selectedPath = existsSync(path) ? path : existsSync(templatePath) ? templatePath : null;
  if (!selectedPath) {
    return;
  }

  const plan = readJson(selectedPath);
  if (plan.source !== "approved_workbench_artifact") {
    errors.push("scaffold plan source must be approved_workbench_artifact.");
  }
  if (plan.raw_requirement_to_code !== false) {
    errors.push("scaffold plan must explicitly set raw_requirement_to_code to false.");
  }
  if (!Array.isArray(plan.modules)) {
    errors.push("scaffold plan modules must be an array.");
    return;
  }

  plan.modules.forEach((module, index) => {
    const label = module.name ?? `scaffold.modules[${index}]`;
    if (!categories.has(module.module_category)) {
      errors.push(`${label} has invalid or missing module_category.`);
    }
    if (module.no_runnable_business_logic !== true) {
      errors.push(`${label} must set no_runnable_business_logic to true.`);
    }
    if (module.module_category === "adapter" && module.scaffold_output !== "contract_or_stub_only") {
      errors.push(`${label} adapter scaffold output must be contract_or_stub_only.`);
    }
    if (module.module_category === "agent" && module.scaffold_output !== "agent_shell_only") {
      errors.push(`${label} agent scaffold output must be agent_shell_only.`);
    }
    if (module.module_category === "workflow" && module.scaffold_output !== "orchestration_shell_only") {
      errors.push(`${label} workflow scaffold output must be orchestration_shell_only.`);
    }
    if (module.module_category === "remote_a2a" && module.scaffold_output !== "contract_placeholder_only") {
      errors.push(`${label} remote_a2a scaffold output must be contract_placeholder_only.`);
    }
  });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path} is not valid JSON: ${error.message}`);
    return {};
  }
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
  const result = readJson(path);
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    errors.push("analysis-result.json must contain an object.");
    return;
  }

  if (!Array.isArray(result.a2aContracts)) {
    errors.push("analysis-result.json a2aContracts must be an array.");
    return;
  }

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
    const loaded = readJson(candidatesPath);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
