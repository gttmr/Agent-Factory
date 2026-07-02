import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  accessProtocols,
  adapterKinds,
  adkHintKeys,
  agentKinds,
  categories,
  remoteKinds,
  remoteRequiredFields,
  workflowKinds
} from "./constants.mjs";
import { readJson } from "./files.mjs";

export function validateModuleCandidates({ dir, errors }) {
  const path = join(dir, "module-candidates.json");
  if (!existsSync(path)) {
    return;
  }

  const candidates = readJson(path, errors);
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
    validateAdkHints(candidate.adk_hints, label, errors);
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

function validateAdkHints(value, label, errors) {
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
