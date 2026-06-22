#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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
  "orchestration",
  "graph",
  "dynamic",
  "unknown"
]);
const remoteKinds = new Set(["a2a", "unknown"]);
const accessProtocols = new Set(["local", "http_rest", "mcp", "grpc", "message_queue", "unknown"]);
const runtimeBindings = new Set(["unresolved", "direct_api", "mcp", "mcp_tool", "local_function", "remote_a2a", "workflow_call", "ui_input"]);
const scaffoldOutputModes = new Set(["smoke", "runnable"]);
const smokeScaffoldOutputs = {
  adapter: "contract_or_stub_only",
  agent: "agent_shell_only",
  workflow: "orchestration_shell_only",
  remote_a2a: "contract_placeholder_only"
};
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
  "adapter_call",
  "human_input",
  "callback_wait",
  "workflow",
  "workflow_call",
  "remote_a2a",
  "remote_agent_call",
  "join",
  "router",
  "loop_control"
]);
const agentExecutionModes = new Set(["single_turn", "chat"]);
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
const graphInvokeBindings = new Set([
  "unresolved",
  "local_python",
  "direct_api",
  "mcp_tool",
  "mcp_toolset",
  "local_function",
  "internal_workflow",
  "ui_input",
  "remote_a2a",
  "callback_wait",
  "unknown"
]);
const graphDecisionOwners = new Set(["workflow_code", "llm", "human", "remote_agent", "system", "unknown"]);
const graphCallControls = new Set(["none", "fixed_by_workflow", "selected_by_llm", "selected_by_human", "event_callback", "resume", "unknown"]);
const graphFlowKinds = new Set(["sequence", "route", "fan_out", "fan_in", "loop_back", "loop_exit", "fallback", "error", "resume", "callback", "unknown"]);
const graphSideEffects = new Set(["none", "read", "write", "external_message", "transaction", "unknown"]);
const graphPolicies = new Set([
  "none",
  "auth_required",
  "approval_required",
  "audit_required",
  "idempotency_required",
  "timeout_retry_required",
  "data_policy_required",
  "manual_fallback_required",
  "callback_resume_required",
  "compensation_required",
  "unknown"
]);
const callbackInvokeBindings = new Set(["callback_wait"]);
const callbackCallControls = new Set(["event_callback", "resume"]);
const callbackFlowKinds = new Set(["callback", "resume"]);
// Synthetic / graph-semantics node kinds that MUST NOT bind to a module candidate.
const syntheticNodeKindsStrict = new Set(["input", "output", "join", "router", "loop_control", "human_input", "callback_wait"]);
// Synthetic-ish kinds that MAY optionally bind to a candidate without erroring.
const syntheticNodeKindsLenient = new Set(["function", "tool"]);
const remoteAgentNodeKinds = new Set(["remote_a2a", "remote_agent_call"]);
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
const runtimeContractKinds = new Set([
  "mcp_legacy_adapter",
  "eai_legacy_adapter",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
]);
const runtimeContractStatuses = new Set(["draft", "needs_info", "approved", "rejected"]);
const afRunStages = new Set(["analyze", "design", "build", "verify"]);
const afRunStageStatuses = new Set(["pending", "complete", "blocked"]);
const afRunValidationResults = new Set(["not_run", "passed", "failed"]);
const afStageRunStatuses = new Set(["running", "completed", "failed", "applied", "canceled"]);
const afStageRunIdPattern = /^\d{8}T\d{6}Z-(analyze|design)-[a-f0-9]{6}$/;

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
validateCodexOutputSchema(resolve("schemas/analysis-draft.schema.json"));

for (const target of targets) {
  validateModuleCandidates(target);
  validateProcessFlow(target);
  validateAnalysisResult(target);
  validateAfRunManifest(target);
  validateScaffoldPlan(target);
  validateSavedAnalysisFixtures(target);
  validateContractRegistry(target);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Artifact validation OK");

function validateCodexOutputSchema(path) {
  if (!existsSync(path)) return;
  const schema = readJson(path);
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
  if (stat.isFile()) {
    const parent = dirname(start);
    if (looksLikeArtifactDir(parent)) {
      return [parent];
    }
    errors.push(`Path is not a recognized artifact file: ${start}.`);
    return [];
  }
  if (!stat.isDirectory()) {
    errors.push(`Path is not a directory or artifact file: ${start}.`);
    return [];
  }

  // If this directory itself looks like a leaf artifact directory, validate
  // it directly. We treat the presence of analysis-result.json,
  // module-candidates.json, process-flow.json, scaffold-plan(.template).json,
  // or af-run-manifest.json
  // as the leaf signal so the existing templates/ smoke check still works.
  if (looksLikeArtifactDir(start)) {
    return [start];
  }

  // Otherwise walk one level deep and pick up every subdirectory that looks
  // like an artifact leaf.
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
    if (looksLikeArtifactDir(child)) {
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
    existsSync(join(dir, "scaffold-plan.template.json")) ||
    existsSync(join(dir, "af-run-manifest.json"))
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

function validateAfRunManifest(dir = root) {
  const path = join(dir, "af-run-manifest.json");
  if (!existsSync(path)) {
    return;
  }
  const manifest = readJson(path);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push("af-run-manifest.json must contain an object.");
    return;
  }

  const label = "af-run-manifest.json";
  requireNonEmptyString(manifest.requirement_id, `${label}.requirement_id`);
  const artifactRootOk = requireNonEmptyString(manifest.artifact_root, `${label}.artifact_root`);
  if (artifactRootOk && manifest.artifact_root.includes("\\")) {
    errors.push(`${label}.artifact_root must use POSIX-style / separators.`);
  }
  if (!afRunStages.has(manifest.current_stage)) {
    errors.push(`${label}.current_stage must be one of ${Array.from(afRunStages).join(", ")}.`);
  }

  if (!manifest.stages || typeof manifest.stages !== "object" || Array.isArray(manifest.stages)) {
    errors.push(`${label}.stages must be an object.`);
  } else {
    for (const stage of afRunStages) {
      validateAfRunStage(manifest.stages[stage], `${label}.stages.${stage}`);
    }
  }

  if (!manifest.approvals || typeof manifest.approvals !== "object" || Array.isArray(manifest.approvals)) {
    errors.push(`${label}.approvals must be an object.`);
  } else {
    for (const key of [
      "analysis_reviewed",
      "boundaries_approved",
      "runtime_contracts_approved",
      "stub_ready_for_followup"
    ]) {
      if (typeof manifest.approvals[key] !== "boolean") {
        errors.push(`${label}.approvals.${key} must be a boolean.`);
      }
    }
  }

  if (!manifest.validation || typeof manifest.validation !== "object" || Array.isArray(manifest.validation)) {
    errors.push(`${label}.validation must be an object.`);
  } else {
    if (!Array.isArray(manifest.validation.commands)) {
      errors.push(`${label}.validation.commands must be an array.`);
    } else {
      manifest.validation.commands.forEach((command, index) => {
        if (typeof command !== "string" || !command.trim()) {
          errors.push(`${label}.validation.commands[${index}] must be a non-empty string.`);
        }
      });
    }
    if (!afRunValidationResults.has(manifest.validation.last_result)) {
      errors.push(`${label}.validation.last_result must be one of ${Array.from(afRunValidationResults).join(", ")}.`);
    }
  }

  if (manifest.stage_runs !== undefined) {
    validateAfStageRuns(manifest.stage_runs, `${label}.stage_runs`);
  }
}

function validateAfRunStage(stage, label) {
  if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!afRunStageStatuses.has(stage.status)) {
    errors.push(`${label}.status must be one of ${Array.from(afRunStageStatuses).join(", ")}.`);
  }
  if (!Array.isArray(stage.outputs)) {
    errors.push(`${label}.outputs must be an array.`);
    return;
  }
  stage.outputs.forEach((output, index) => {
    if (typeof output !== "string" || !output.trim()) {
      errors.push(`${label}.outputs[${index}] must be a non-empty string.`);
      return;
    }
    if (output.includes("\\")) {
      errors.push(`${label}.outputs[${index}] must use POSIX-style / separators.`);
    }
  });
}

function validateAfStageRuns(stageRuns, label) {
  if (!stageRuns || typeof stageRuns !== "object" || Array.isArray(stageRuns)) {
    errors.push(`${label} must be an object when present.`);
    return;
  }
  for (const [stage, entry] of Object.entries(stageRuns)) {
    const entryLabel = `${label}.${stage}`;
    if (!afRunStages.has(stage)) {
      errors.push(`${entryLabel} uses an unknown stage key.`);
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${entryLabel} must be an object.`);
      continue;
    }
    if (!afStageRunIdPattern.test(entry.latest_run_id) || !entry.latest_run_id.includes(`-${stage}-`)) {
      errors.push(`${entryLabel}.latest_run_id must be a sortable stage run id.`);
    }
    if (!afStageRunStatuses.has(entry.status)) {
      errors.push(`${entryLabel}.status must be one of ${Array.from(afStageRunStatuses).join(", ")}.`);
    }
    requireNonEmptyString(entry.started_at, `${entryLabel}.started_at`);
    if (entry.finished_at !== null && entry.finished_at !== undefined && typeof entry.finished_at !== "string") {
      errors.push(`${entryLabel}.finished_at must be a string or null.`);
    }
    requireNonEmptyString(entry.skill_name, `${entryLabel}.skill_name`);
    requireNonEmptyString(entry.model, `${entryLabel}.model`);
    if (!Array.isArray(entry.output_artifacts)) {
      errors.push(`${entryLabel}.output_artifacts must be an array.`);
    } else {
      entry.output_artifacts.forEach((artifactPath, index) => {
        if (typeof artifactPath !== "string" || !artifactPath.trim()) {
          errors.push(`${entryLabel}.output_artifacts[${index}] must be a non-empty string.`);
          return;
        }
        if (artifactPath.includes("\\") || artifactPath.includes("..")) {
          errors.push(`${entryLabel}.output_artifacts[${index}] must be a safe POSIX-style relative path.`);
        }
      });
    }
    if (entry.last_error !== null && entry.last_error !== undefined && typeof entry.last_error !== "string") {
      errors.push(`${entryLabel}.last_error must be a string or null.`);
    }
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be a non-empty string.`);
    return false;
  }
  return true;
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

  // Edges.
  const edgeIds = new Set();
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
        // Scope is carried by edge_kind; the stored state_key is the bare channel
        // name. A leading scope prefix is allowed only when it matches edge_kind,
        // so a wrong-scope prefix is caught instead of being silently re-scoped by
        // the generator. (Bare keys are the canonical form the picker authors.)
        const scopePrefixByKind = { temp_state: "temp:", user_state: "user:", app_state: "app:" };
        const expected = scopePrefixByKind[edge.edge_kind] ?? null; // null for session_state
        const present = (edge.state_key.match(/^(temp:|user:|app:)/) || [])[1] ?? null;
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
  });

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
  });
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

function validateSavedAnalysisFixtures(dir = root) {
  for (const path of findJsonFiles(dir)) {
    const record = readJson(path);
    if (!isSavedAnalysisFixture(record)) continue;
    validateSavedAnalysisRecord(record, relative(root, path) || path);
  }
}

function isSavedAnalysisFixture(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    typeof value.savedAt === "string" &&
    value.analysis &&
    typeof value.analysis === "object" &&
    Array.isArray(value.catalogEntries) &&
    typeof value.scaffoldReady === "boolean"
  );
}

function validateSavedAnalysisRecord(record, label) {
  const requiredStrings = ["id", "title", "savedAt", "analyzerModel", "activeStep"];
  for (const field of requiredStrings) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }
  if (!["intake", "analysis", "modules", "graph", "runtimeContracts", "a2aContracts", "catalog", "saved", "export"].includes(record.activeStep)) {
    errors.push(`${label}.activeStep is not a known workbench step.`);
  }
  if (!Array.isArray(record.acceptedMissing) || record.acceptedMissing.some((item) => typeof item !== "string")) {
    errors.push(`${label}.acceptedMissing must be an array of strings.`);
  }
  if (!record.input || typeof record.input !== "object" || typeof record.input.rawText !== "string") {
    errors.push(`${label}.input.rawText is required.`);
  }

  const analysis = record.analysis;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    errors.push(`${label}.analysis must be an object.`);
    return;
  }
  if (!analysis.normalizedRequirement || typeof analysis.normalizedRequirement !== "object") {
    errors.push(`${label}.analysis.normalizedRequirement is required.`);
  }
  if (!analysis.evidence || typeof analysis.evidence !== "object") {
    errors.push(`${label}.analysis.evidence is required.`);
  }
  if (!Array.isArray(analysis.moduleCandidates)) {
    errors.push(`${label}.analysis.moduleCandidates must be an array.`);
    return;
  }
  if (!Array.isArray(record.moduleCandidates)) {
    errors.push(`${label}.moduleCandidates must be an array.`);
    return;
  }

  const embeddedIds = analysis.moduleCandidates.map((candidate) => candidate?.id).filter(Boolean).join("|");
  const recordIds = record.moduleCandidates.map((candidate) => candidate?.id).filter(Boolean).join("|");
  if (embeddedIds !== recordIds) {
    errors.push(`${label}.moduleCandidates must mirror analysis.moduleCandidates by id and order.`);
  }

  const catalogById = new Map();
  record.catalogEntries.forEach((entry, index) => {
    validateCatalogEntryObject(entry, `${label}.catalogEntries[${index}]`);
    if (entry && typeof entry.id === "string") catalogById.set(entry.id, entry);
  });

  const candidatesById = new Map();
  let needsInfoCount = 0;
  for (const [index, candidate] of analysis.moduleCandidates.entries()) {
    const candidateLabel = `${label}.analysis.moduleCandidates[${index}]`;
    validateModuleCandidateObject(candidate, candidateLabel);
    if (candidate && typeof candidate.id === "string") candidatesById.set(candidate.id, candidate);
    if (candidate?.status === "needs_info") needsInfoCount += 1;
    if (typeof candidate?.missing_information_resolution !== "string") {
      errors.push(`${candidateLabel}.missing_information_resolution must be present as a string in saved-analysis fixtures.`);
    }
    if (!Array.isArray(candidate?.resolved_missing_information)) {
      errors.push(`${candidateLabel}.resolved_missing_information must be present as an array in saved-analysis fixtures.`);
    } else if (candidate.resolved_missing_information.some((item) => typeof item !== "string" || !item.trim())) {
      errors.push(`${candidateLabel}.resolved_missing_information must contain non-empty strings.`);
    }
    if (candidate?.status === "approved" && Array.isArray(candidate.missing_information) && candidate.missing_information.length > 0) {
      errors.push(`${candidateLabel} is approved but still has candidate-level missing_information.`);
    }
    if (typeof candidate?.catalog_entry_id === "string" && candidate.catalog_entry_id) {
      const catalogEntry = catalogById.get(candidate.catalog_entry_id);
      if (!catalogEntry) {
        errors.push(`${candidateLabel}.catalog_entry_id ${candidate.catalog_entry_id} is not in the saved catalog snapshot.`);
      } else if (catalogEntry.module_category !== candidate.module_category) {
        errors.push(`${candidateLabel}.catalog_entry_id category does not match saved catalog entry.`);
      }
    }
    if (candidate?.access_protocol === "mcp" && candidate.mcp_schema_ref) {
      const refs = collectMcpSchemaRefs(resolve("catalog/contracts"));
      if (refs.size > 0 && !refs.has(candidate.mcp_schema_ref)) {
        errors.push(`${candidateLabel}.mcp_schema_ref ${candidate.mcp_schema_ref} has no catalog/contracts/mcp contract.`);
      }
    }
  }

  if (record.scaffoldReady && needsInfoCount > 0) {
    errors.push(`${label}.scaffoldReady cannot be true while needs_info candidates remain.`);
  }
  if (record.scaffoldReady && record.activeStep !== "export") {
    errors.push(`${label}.scaffoldReady fixtures should land on export.`);
  }

  const contracts = Array.isArray(analysis.a2aContracts) ? analysis.a2aContracts : [];
  const contractsById = new Map();
  for (const contract of contracts) {
    if (contract && typeof contract.contract_id === "string") contractsById.set(contract.contract_id, contract);
  }
  if (analysis.processFlow !== undefined) {
    validateGraphIR(analysis.processFlow, `${label}.analysis.processFlow`, candidatesById, contractsById);
  }
  if (analysis.runtimeContracts !== undefined) {
    if (!Array.isArray(analysis.runtimeContracts)) {
      errors.push(`${label}.analysis.runtimeContracts must be an array when present.`);
    } else {
      analysis.runtimeContracts.forEach((contract, index) =>
        validateRuntimeContractObject(contract, `${label}.analysis.runtimeContracts[${index}]`)
      );
    }
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

function validateCatalogEntryObject(entry, label) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof entry.id !== "string" || !entry.id.trim()) errors.push(`${label}.id is required.`);
  if (typeof entry.name !== "string" || !entry.name.trim()) errors.push(`${label}.name is required.`);
  if (!categories.has(entry.module_category)) errors.push(`${label}.module_category is invalid.`);
  if (entry.module_category === "adapter" && !adapterKinds.has(entry.adapter_kind)) {
    errors.push(`${label}.adapter_kind is invalid.`);
  }
  if (entry.module_category === "agent" && !agentKinds.has(entry.agent_kind)) {
    errors.push(`${label}.agent_kind is invalid.`);
  }
  if (entry.module_category === "workflow" && !workflowKinds.has(entry.workflow_kind)) {
    errors.push(`${label}.workflow_kind is invalid.`);
  }
  if (!["seeded", "session_added", "session_edited", "session_deleted"].includes(entry.provenance)) {
    errors.push(`${label}.provenance is invalid.`);
  }
}

function validateModuleCandidateObject(candidate, label) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof candidate.id !== "string" || !candidate.id.trim()) errors.push(`${label}.id is required.`);
  if (!categories.has(candidate.module_category)) errors.push(`${label}.module_category is invalid.`);
  if (!["needs_info", "approved", "deferred", "rejected"].includes(candidate.status)) {
    errors.push(`${label}.status is invalid.`);
  }
  if (!Array.isArray(candidate.inputs)) errors.push(`${label}.inputs must be an array.`);
  if (!Array.isArray(candidate.outputs)) errors.push(`${label}.outputs must be an array.`);
  if (!Array.isArray(candidate.missing_information)) errors.push(`${label}.missing_information must be an array.`);
  if (
    candidate.missing_information_resolution !== undefined &&
    typeof candidate.missing_information_resolution !== "string"
  ) {
    errors.push(`${label}.missing_information_resolution must be a string when present.`);
  }
  if (
    candidate.resolved_missing_information !== undefined &&
    (!Array.isArray(candidate.resolved_missing_information) ||
      candidate.resolved_missing_information.some((item) => typeof item !== "string" || !item.trim()))
  ) {
    errors.push(`${label}.resolved_missing_information must be an array of non-empty strings when present.`);
  }
  if (candidate.module_category === "adapter" && !adapterKinds.has(candidate.adapter_kind)) {
    errors.push(`${label}.adapter_kind is invalid.`);
  }
  if (candidate.module_category === "agent" && !agentKinds.has(candidate.agent_kind)) {
    errors.push(`${label}.agent_kind is invalid.`);
  }
  if (candidate.module_category === "workflow" && !workflowKinds.has(candidate.workflow_kind)) {
    errors.push(`${label}.workflow_kind is invalid.`);
  }
  if (candidate.access_protocol === "mcp" && (!candidate.mcp_server || !candidate.mcp_tool_name || !candidate.mcp_schema_ref)) {
    errors.push(`${label} access_protocol=mcp requires mcp_server, mcp_tool_name, and mcp_schema_ref.`);
  }
}

function validateContractRegistry(dir = root) {
  for (const path of findJsonFiles(dir)) {
    const normalizedPath = path.replace(/\\/g, "/");
    if (!normalizedPath.includes("/catalog/contracts/")) continue;
    const contract = readJson(path);
    if (isMcpContract(contract)) {
      validateMcpContract(contract, relative(root, path) || path);
    } else if (isA2ARegistryContract(contract)) {
      validateA2ARegistryContract(contract, relative(root, path) || path);
    }
  }
}

function isMcpContract(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.schema_ref === "string" &&
    typeof value.server === "string" &&
    typeof value.tool === "string" &&
    value.inputSchema &&
    value.outputSchema
  );
}

function validateMcpContract(contract, label) {
  for (const field of ["schema_ref", "server", "tool", "title", "description"]) {
    if (typeof contract[field] !== "string" || !contract[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }
  validateJsonSchemaObject(contract.inputSchema, `${label}.inputSchema`);
  validateJsonSchemaObject(contract.outputSchema, `${label}.outputSchema`);
  if (!Array.isArray(contract.success_examples) || contract.success_examples.length === 0) {
    errors.push(`${label}.success_examples must be a non-empty array.`);
  } else {
    contract.success_examples.forEach((example, index) => {
      if (!example || typeof example !== "object" || Array.isArray(example)) {
        errors.push(`${label}.success_examples[${index}] must be an object.`);
        return;
      }
      validateSchemaInstance(example.arguments, contract.inputSchema, `${label}.success_examples[${index}].arguments`);
      validateSchemaInstance(example.structuredContent, contract.outputSchema, `${label}.success_examples[${index}].structuredContent`);
    });
  }
  if (!Array.isArray(contract.error_examples) || contract.error_examples.length === 0) {
    errors.push(`${label}.error_examples must be a non-empty array.`);
  } else {
    contract.error_examples.forEach((example, index) => {
      if (example?.isError !== true) {
        errors.push(`${label}.error_examples[${index}].isError must be true.`);
      }
      if (typeof example?.message !== "string" || !example.message.trim()) {
        errors.push(`${label}.error_examples[${index}].message is required.`);
      }
    });
  }
  if (!contract.mock_response || typeof contract.mock_response !== "object" || Array.isArray(contract.mock_response)) {
    errors.push(`${label}.mock_response must be an object.`);
    return;
  }
  if (contract.mock_response.isError !== false) {
    errors.push(`${label}.mock_response.isError must be false for the default deterministic response.`);
  }
  if (!Array.isArray(contract.mock_response.content) || contract.mock_response.content.length === 0) {
    errors.push(`${label}.mock_response.content must be a non-empty array.`);
  }
  validateSchemaInstance(contract.mock_response.structuredContent, contract.outputSchema, `${label}.mock_response.structuredContent`);
}

function isA2ARegistryContract(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.contract_id === "string" &&
    value.agent_card &&
    value.task_lifecycle &&
    value.artifact_contract
  );
}

function validateA2ARegistryContract(contract, label) {
  validateA2AContract(contract, label, new Map(), new Set(), new Map());
  for (const field of ["success_task_example", "auth_required_example", "failed_task_example"]) {
    if (!contract[field] || typeof contract[field] !== "object" || Array.isArray(contract[field])) {
      errors.push(`${label}.${field} must be an object.`);
    }
  }
}

function validateJsonSchemaObject(schema, label) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (schema.type !== "object") {
    errors.push(`${label}.type must be object.`);
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    errors.push(`${label}.properties must be an object.`);
  }
  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    errors.push(`${label}.required must be an array when present.`);
  }
}

function validateSchemaInstance(value, schema, label) {
  if (!schema || typeof schema !== "object") return;
  const type = schema.type;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) errors.push(`${label}.${key} is required by schema.`);
    }
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) validateSchemaInstance(value[key], childSchema, `${label}.${key}`);
    }
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array.`);
      return;
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaInstance(item, schema.items, `${label}[${index}]`));
    }
    return;
  }
  if (type === "string" && typeof value !== "string") errors.push(`${label} must be a string.`);
  if (type === "number" && typeof value !== "number") errors.push(`${label} must be a number.`);
  if (type === "boolean" && typeof value !== "boolean") errors.push(`${label} must be a boolean.`);
}

function collectMcpSchemaRefs(dir) {
  const refs = new Set();
  if (!existsSync(dir)) return refs;
  for (const path of findJsonFiles(dir)) {
    const contract = readJson(path);
    if (isMcpContract(contract)) refs.add(contract.schema_ref);
  }
  return refs;
}

function findJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) {
    return dir.endsWith(".json") ? [dir] : [];
  }
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path);
    }
  }
  return files;
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
