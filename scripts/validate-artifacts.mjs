#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "templates");
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
const flowNodeTypes = new Set(["input", "output", "agent", "workflow", "adapter", "remote_a2a"]);
const flowEdgeTypes = new Set(["local", "remote_a2a"]);
const flowDataChannels = new Set([
  "event_output",
  "event_message",
  "session_state",
  "temp_state",
  "user_state",
  "app_state",
  "artifact",
  "route",
  "control",
  "unknown"
]);
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

validateModuleCandidates();
validateProcessFlow();
validateScaffoldPlan();

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Artifact validation OK");

function validateModuleCandidates() {
  const path = join(root, "module-candidates.json");
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

function validateProcessFlow() {
  const path = join(root, "process-flow.json");
  if (!existsSync(path)) {
    return;
  }

  const flow = readJson(path);
  if (typeof flow !== "object" || flow === null || Array.isArray(flow)) {
    errors.push("process-flow.json must contain an object.");
    return;
  }
  if (!Array.isArray(flow.nodes)) {
    errors.push("process-flow.json nodes must be an array.");
  } else {
    flow.nodes.forEach((node, index) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        errors.push(`process-flow.json nodes[${index}] must be an object.`);
        return;
      }
      if (typeof node.id !== "string" || !node.id.trim()) {
        errors.push(`process-flow.json nodes[${index}] requires id.`);
      }
      if (typeof node.label !== "string" || !node.label.trim()) {
        errors.push(`process-flow.json nodes[${index}] requires label.`);
      }
      if (!flowNodeTypes.has(node.type)) {
        errors.push(`process-flow.json nodes[${index}] has invalid type.`);
      }
    });
  }
  if (!Array.isArray(flow.edges)) {
    errors.push("process-flow.json edges must be an array.");
    return;
  }
  flow.edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      errors.push(`process-flow.json edges[${index}] must be an object.`);
      return;
    }
    ["from", "to", "data"].forEach((key) => {
      if (typeof edge[key] !== "string" || !edge[key].trim()) {
        errors.push(`process-flow.json edges[${index}] requires ${key}.`);
      }
    });
    if (!flowEdgeTypes.has(edge.edge_type)) {
      errors.push(`process-flow.json edges[${index}] has invalid edge_type.`);
    }
    if (edge.data_channel !== undefined && !flowDataChannels.has(edge.data_channel)) {
      errors.push(`process-flow.json edges[${index}] has invalid data_channel.`);
    }
    ["state_key", "artifact_key", "schema_ref", "route_condition"].forEach((key) => {
      if (edge[key] !== undefined && edge[key] !== null && (typeof edge[key] !== "string" || !edge[key].trim())) {
        errors.push(`process-flow.json edges[${index}] ${key} must be a non-empty string or null.`);
      }
    });
  });
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

function validateScaffoldPlan() {
  const path = join(root, "scaffold-plan.json");
  const templatePath = join(root, "scaffold-plan.template.json");
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
