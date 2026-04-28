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
const workflowKinds = new Set(["sequential", "parallel", "loop", "human_review", "orchestration", "unknown"]);
const remoteKinds = new Set(["a2a", "unknown"]);
const remoteRequiredFields = ["owner", "agent_card", "auth", "task_lifecycle", "timeout", "retry", "fallback", "audit"];

validateModuleCandidates();
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
