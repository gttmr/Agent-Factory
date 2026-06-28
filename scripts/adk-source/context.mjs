import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { toPythonIdentifier } from "./naming.mjs";

export const DEFAULT_MODEL = "hosted_vllm/local-model";
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
export const RUNTIME_MCP_LABEL = "런타임 MCP";
export const RUNTIME_MCP_NOTE = "실행 시점에 Mock Lab MCP 서버를 통해 모델이 파악한 데이터입니다.";

export function loadArtifactContext(artifactRoot) {
  const readJson = (name, fallbackName) => {
    const path = join(artifactRoot, name);
    const selectedPath = existsSync(path) ? path : fallbackName ? join(artifactRoot, fallbackName) : path;
    if (!existsSync(selectedPath)) {
      throw new Error(`Missing required artifact: ${path}`);
    }
    return JSON.parse(readFileSync(selectedPath, "utf8"));
  };

  const readOptionalJson = (name) => {
    const path = join(artifactRoot, name);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  };

  const analysisResult = readOptionalJson("analysis-result.json");
  const normalizedRequirement = readOptionalJson("normalized-requirement.json") ?? analysisResult?.normalizedRequirement;
  const processFlow = readOptionalJson("process-flow.json") ?? analysisResult?.processFlow;
  const moduleCandidates = readOptionalJson("module-candidates.json") ?? analysisResult?.moduleCandidates ?? null;
  const runManifest = readOptionalJson("af-run-manifest.json");
  const mockLabSpec = readOptionalJson("mock-lab/mock-spec.json");
  const scaffoldPlan = readJson("scaffold-plan.json", "scaffold-plan.template.json");

  if (!normalizedRequirement || typeof normalizedRequirement !== "object") {
    throw new Error("Missing required artifact: normalized-requirement.json or analysis-result.json:normalizedRequirement");
  }
  if (!processFlow || typeof processFlow !== "object") {
    throw new Error("Missing required artifact: process-flow.json or analysis-result.json:processFlow");
  }
  // Hard invariant in BOTH smoke and runnable modes: runnable output is still
  // generated from approved workbench artifacts, never from raw requirements.
  if (scaffoldPlan?.source !== "approved_workbench_artifact" || scaffoldPlan?.raw_requirement_to_code !== false) {
    throw new Error("scaffold-plan.json must be an approved_workbench_artifact with raw_requirement_to_code=false.");
  }
  if (!Array.isArray(scaffoldPlan.modules) || scaffoldPlan.modules.length === 0) {
    throw new Error("scaffold-plan.json must contain at least one approved module.");
  }
  if (scaffoldPlan.validation?.can_generate_source === false) {
    throw new Error(`scaffold-plan.json has blockers: ${(scaffoldPlan.validation.blockers ?? []).join("; ")}`);
  }

  const modules = scaffoldPlan.modules;
  const outputMode = scaffoldPlan.output_mode === "runnable" ? "runnable" : "smoke";
  validateRunInputs({
    analysisResult,
    normalizedRequirement,
    processFlow,
    moduleCandidates,
    runManifest,
    scaffoldPlan,
    modules
  });

  return {
    analysisResult,
    normalizedRequirement,
    processFlow,
    moduleCandidates,
    runManifest,
    mockLabSpec,
    scaffoldPlan,
    modules,
    outputMode,
    packageName: scaffoldPackageName(scaffoldPlan, normalizedRequirement)
  };
}

function scaffoldPackageName(scaffoldPlan, normalizedRequirement) {
  const explicit = typeof scaffoldPlan.package_name === "string" ? scaffoldPlan.package_name.trim() : "";
  if (explicit) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(explicit)) {
      throw new Error("scaffold-plan.json package_name must be a valid ASCII Python package identifier.");
    }
    return explicit;
  }
  return `${toPythonIdentifier(normalizedRequirement.id || scaffoldPlan.requirement_id || "agent_factory_workflow")}_adk`;
}

function validateRunInputs({
  analysisResult,
  normalizedRequirement,
  processFlow,
  moduleCandidates,
  runManifest,
  scaffoldPlan,
  modules
}) {
  const requirementId = normalizedRequirement.id || scaffoldPlan.requirement_id;
  if (runManifest && runManifest.requirement_id !== requirementId) {
    throw new Error(
      `af-run-manifest.json requirement_id (${runManifest.requirement_id}) does not match ${requirementId}.`
    );
  }
  if (scaffoldPlan.requirement_id && requirementId && scaffoldPlan.requirement_id !== requirementId) {
    throw new Error(`scaffold-plan.json requirement_id (${scaffoldPlan.requirement_id}) does not match ${requirementId}.`);
  }
  if (runManifest) {
    const missingApprovals = [];
    if (runManifest.approvals?.analysis_reviewed !== true) missingApprovals.push("analysis_reviewed");
    if (runManifest.approvals?.boundaries_approved !== true) missingApprovals.push("boundaries_approved");
    if (runManifest.approvals?.runtime_contracts_approved !== true) missingApprovals.push("runtime_contracts_approved");
    if (missingApprovals.length > 0) {
      throw new Error(`af-run-manifest.json is not approved for build: ${missingApprovals.join(", ")}.`);
    }
    if (runManifest.stages?.design?.status !== "complete") {
      throw new Error("af-run-manifest.json design stage must be complete before runtime stub generation.");
    }
  }

  const graphErrors = processFlow.validation?.errors;
  if (Array.isArray(graphErrors) && graphErrors.length > 0) {
    throw new Error(`processFlow has Graph IR errors: ${graphErrors.join("; ")}`);
  }
  assertAgentExecutionModesSupported({ modules, processFlow });

  const runtimeContracts = Array.isArray(analysisResult?.runtimeContracts) ? analysisResult.runtimeContracts : [];
  const unapprovedRuntimeContracts = runtimeContracts.filter((contract) => contract?.contract_status !== "approved");
  if (unapprovedRuntimeContracts.length > 0) {
    throw new Error(
      `analysis-result.json has unapproved runtimeContracts: ${unapprovedRuntimeContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }
  const scaffoldRuntimeContracts = Array.isArray(scaffoldPlan.runtime_contracts) ? scaffoldPlan.runtime_contracts : [];
  const unapprovedScaffoldRuntimeContracts = scaffoldRuntimeContracts.filter(
    (contract) => contract?.contract_status !== "approved"
  );
  if (unapprovedScaffoldRuntimeContracts.length > 0) {
    throw new Error(
      `scaffold-plan.json has unapproved runtime_contracts: ${unapprovedScaffoldRuntimeContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }

  const a2aContracts = Array.isArray(analysisResult?.a2aContracts) ? analysisResult.a2aContracts : [];
  const unapprovedA2AContracts = a2aContracts.filter((contract) => contract?.contract_status !== "approved");
  if (unapprovedA2AContracts.length > 0) {
    throw new Error(
      `analysis-result.json has unapproved a2aContracts: ${unapprovedA2AContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }

  validateApprovedModuleSource({ moduleCandidates, modules });
}

function assertAgentExecutionModesSupported({ modules, processFlow }) {
  const validModes = new Set(["single_turn", "chat"]);
  const invalidModules = modules
    .filter(
      (module) =>
        module.agent_execution_mode !== undefined &&
        module.agent_execution_mode !== null &&
        !validModes.has(module.agent_execution_mode)
    )
    .map((module) => `${module.id}:${module.agent_execution_mode}`);
  if (invalidModules.length > 0) {
    throw new Error(`scaffold-plan.json has invalid agent_execution_mode values: ${invalidModules.join(", ")}`);
  }
  const invalidModuleScopes = modules
    .filter(
      (module) =>
        module.agent_execution_mode !== undefined &&
        module.agent_execution_mode !== null &&
        module.module_category !== "agent"
    )
    .map((module) => `${module.id}:${module.module_category}:${module.agent_execution_mode}`);
  if (invalidModuleScopes.length > 0) {
    throw new Error(`scaffold-plan.json sets agent_execution_mode on non-agent modules: ${invalidModuleScopes.join(", ")}`);
  }

  const invalidNodes = (Array.isArray(processFlow.nodes) ? processFlow.nodes : [])
    .filter(
      (node) =>
        node?.agent_execution_mode !== undefined &&
        node.agent_execution_mode !== null &&
        (!validModes.has(node.agent_execution_mode) || node.node_kind !== "agent")
    )
    .map((node) => `${node.id}:${node.node_kind}:${node.agent_execution_mode}`);
  if (invalidNodes.length > 0) {
    throw new Error(`processFlow has invalid agent_execution_mode values: ${invalidNodes.join(", ")}`);
  }
}

function validateApprovedModuleSource({ moduleCandidates, modules }) {
  if (!Array.isArray(moduleCandidates)) return;
  const candidatesById = new Map(
    moduleCandidates
      .filter((candidate) => candidate && typeof candidate.id === "string")
      .map((candidate) => [candidate.id, candidate])
  );
  const blockers = [];
  for (const module of modules) {
    const candidate = candidatesById.get(module.id);
    if (!candidate) {
      blockers.push(`${module.id}: missing module candidate`);
      continue;
    }
    if (candidate.status !== "approved") {
      blockers.push(`${module.id}: status ${candidate.status ?? "unknown"}`);
    }
    if (Array.isArray(candidate.missing_information) && candidate.missing_information.length > 0) {
      blockers.push(`${module.id}: unresolved missing_information`);
    }
  }
  if (blockers.length > 0) {
    throw new Error(`scaffold-plan.json includes modules that are not approved in analysis artifacts: ${blockers.join("; ")}`);
  }
}
