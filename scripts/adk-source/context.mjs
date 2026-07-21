import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateAgainstSchema } from "../artifact-validation/json-schema.mjs";
import { scaffoldAssetProjectionErrors } from "../artifact-validation/scaffold-asset-projection.mjs";
import { toPythonIdentifier } from "./naming.mjs";

export const DEFAULT_MODEL = "hosted_vllm/local-model";
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
export const RUNTIME_MCP_LABEL = "런타임 MCP";
export const RUNTIME_MCP_NOTE = "실행 시점에 synthetic MCP 서버를 통해 모델이 파악한 데이터입니다.";

const REMOVED_FILENAMES = new Map([
  ["module-candidates.json", "asset-candidates.json"],
  ["process-flow.json", "graph-ir.json"],
  ["commonization-notes.json", "analysis-result.json"]
]);
const REMOVED_KEYS = new Set([
  "moduleCandidates",
  "processFlow",
  "modules",
  "excluded_modules",
  "module_category",
  "subtype",
  "adapter_kind",
  "agent_kind",
  "workflow_kind",
  "access_protocol",
  "runtime_binding",
  "selected_by_llm",
  "decision_owner",
  "invoke_binding",
  "call_control",
  "mcp_server",
  "mcp_tool_name",
  "mcp_schema_ref",
  "mcp_auth_mode",
  "remote_contract_kind",
  "a2a_contract_id",
  "module_id",
  "execution_kind",
  "edge_kind",
  "execution_semantics",
  "flow_kind",
  "route_condition",
  "state_key",
  "artifact_key",
  "is_remote_boundary_crossing"
]);

export function loadArtifactContext(artifactRoot) {
  for (const [name, replacement] of REMOVED_FILENAMES) {
    if (existsSync(join(artifactRoot, name))) {
      throw new Error(`${name} is removed; use ${replacement}.`);
    }
  }

  const analysisResult = readRequiredJson(artifactRoot, "analysis-result.json");
  const scaffoldPlan = readRequiredJson(artifactRoot, "scaffold-plan.json");
  const runManifest = readRequiredJson(artifactRoot, "af-run-manifest.json");
  const mockLabSpec = readOptionalJson(artifactRoot, "mock-lab/mock-spec.json");
  assertStrictAnalysisResult(analysisResult);
  assertStrictScaffoldPlan(scaffoldPlan);
  assertSchema(runManifest, "af-run-manifest.schema.json", "af-run-manifest.json");

  const normalizedRequirement = analysisResult.normalizedRequirement;
  const graph = scaffoldPlan.graph;
  const assetCandidates = analysisResult.assetCandidates;
  const assets = scaffoldPlan.assets;
  validateRunInputs({ analysisResult, normalizedRequirement, graph, assetCandidates, runManifest, scaffoldPlan, assets });
  assertSupportedToolTransports(assets);

  return {
    analysisResult,
    normalizedRequirement,
    graph,
    assetCandidates,
    runManifest,
    mockLabSpec,
    scaffoldPlan,
    assets,
    outputMode: scaffoldPlan.output_mode === "runnable" ? "runnable" : "smoke",
    packageName: scaffoldPackageName(scaffoldPlan, normalizedRequirement)
  };
}

function assertSupportedToolTransports(assets) {
  for (const asset of assets) {
    if (asset.asset_type !== "tool") continue;
    const transport = asset.connection?.transport;
    if (transport === "unknown") {
      throw new Error(`Unsupported Tool transport unknown for ${asset.asset_id}; generation requires an explicit supported transport.`);
    }
    if (asset.binding?.kind === "mcp" && transport !== "http") {
      throw new Error(
        `Unsupported MCP transport ${transport ?? "missing"} for ${asset.asset_id}; the current generator supports only http and will not emit stdio as HTTP.`
      );
    }
  }
}

function readRequiredJson(root, name) {
  const path = join(root, name);
  if (!existsSync(path)) throw new Error(`Missing required artifact: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readOptionalJson(root, name) {
  const path = join(root, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function assertStrictAnalysisResult(result) {
  assertSchema(result, "analysis-result.schema.json", "analysis-result.json");
  assertNoRemovedRecursive(result, "analysis-result.json");
  assertAssetIntegrity(
    result.assetCandidates,
    result.normalizedRequirement.id,
    "analysis-result.json.assetCandidates",
    "normalizedRequirement.id"
  );
  const assetsById = new Map(result.assetCandidates.map((asset) => [asset.asset_id, asset]));
  const a2aContractIds = new Set();
  result.a2aContracts.forEach((contract, index) => {
    const at = `analysis-result.json.a2aContracts[${index}]`;
    if (a2aContractIds.has(contract.contract_id)) throw new Error(`${at}.contract_id duplicates ${contract.contract_id}.`);
    a2aContractIds.add(contract.contract_id);
    const agent = assetsById.get(contract?.agent_ref);
    const contractRefs = [agent?.binding?.contract_ref, agent?.exposure?.contract_ref].filter(Boolean);
    if (!agent || agent.asset_type !== "agent" || !contractRefs.includes(contract.contract_id)) {
      throw new Error(`${at}.agent_ref must reference an A2A Agent.`);
    }
  });
  assertRuntimeContractIntegrity(result.runtimeContracts, assetsById, "analysis-result.json.runtimeContracts");
  assertGraphReferences(result.graph, result.assetCandidates, "analysis-result.json.graph");
}

function assertStrictScaffoldPlan(plan) {
  assertSchema(plan, "scaffold-plan.schema.json", "scaffold-plan.json");
  assertNoRemovedRecursive(plan, "scaffold-plan.json");
  if (!Array.isArray(plan.assets) || plan.assets.length === 0) {
    throw new Error("scaffold-plan.json must contain at least one approved asset.");
  }
  if (plan.validation?.can_generate_source === false) {
    throw new Error(`scaffold-plan.json has blockers: ${(plan.validation.blockers ?? []).join("; ")}`);
  }
  assertAssetIntegrity(plan.assets, plan.requirement_id, "scaffold-plan.json.assets", "requirement_id");
  assertRuntimeContractIntegrity(
    plan.runtime_contracts,
    new Map(plan.assets.map((asset) => [asset.asset_id, asset])),
    "scaffold-plan.json.runtime_contracts"
  );
  assertGraphReferences(plan.graph, plan.assets, "scaffold-plan.json.graph");
}

function assertAssetIntegrity(assets, requirementId, label, requirementLabel) {
  const assetIds = new Set();
  for (const [index, asset] of assets.entries()) {
    const at = `${label}[${index}]`;
    if (assetIds.has(asset.asset_id)) throw new Error(`${at}.asset_id duplicates ${asset.asset_id}.`);
    assetIds.add(asset.asset_id);
    if (asset.source_requirement_id !== requirementId) {
      throw new Error(`${at}.source_requirement_id must equal ${requirementLabel}.`);
    }
  }
}

function assertRuntimeContractIntegrity(contracts, assetsById, label) {
  const contractIds = new Set();
  for (const [index, contract] of contracts.entries()) {
    const at = `${label}[${index}]`;
    if (contractIds.has(contract.contract_id)) throw new Error(`${at}.contract_id duplicates ${contract.contract_id}.`);
    contractIds.add(contract.contract_id);
    if (contract.asset_id !== null && !assetsById.has(contract.asset_id)) {
      throw new Error(`${at}.asset_id ${contract.asset_id} references a missing asset.`);
    }
  }
}

function assertSchema(value, schemaName, label) {
  const errors = validateAgainstSchema(value, schemaName, label);
  if (errors.length) throw new Error(errors.join("\n"));
}

function assertGraphReferences(graph, assets, label) {
  const assetsById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  if (graph.workflow_ref !== null && assetsById.get(graph.workflow_ref)?.asset_type !== "workflow") {
    throw new Error(`${label}.workflow_ref must reference a Workflow asset when non-null.`);
  }
  const nodeIds = new Set();
  for (const [index, node] of graph.nodes.entries()) {
    const at = `${label}.nodes[${index}]`;
    if (nodeIds.has(node.id)) throw new Error(`${at}.id duplicates node id ${node.id}.`);
    nodeIds.add(node.id);
    if (node.node_kind === "agent" && assetsById.get(node.agent_ref)?.asset_type !== "agent") throw new Error(`${at}.agent_ref must reference an Agent.`);
    if (node.node_kind === "tool" && assetsById.get(node.tool_ref)?.asset_type !== "tool") throw new Error(`${at}.tool_ref must reference a Tool.`);
    if (node.node_kind === "subworkflow" && assetsById.get(node.workflow_ref)?.asset_type !== "workflow") throw new Error(`${at}.workflow_ref must reference a Workflow.`);
    for (const tool of node.available_tools ?? []) {
      if (assetsById.get(tool.tool_ref)?.asset_type !== "tool") throw new Error(`${at}.available_tools must reference Tool assets.`);
    }
  }
  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    const at = `${label}.edges[${index}]`;
    if (edgeIds.has(edge.id)) throw new Error(`${at}.id duplicates ${edge.id}.`);
    edgeIds.add(edge.id);
    for (const endpoint of ["from", "to"]) {
      if (!nodeIds.has(edge[endpoint])) {
        throw new Error(`${at}.${endpoint} references missing Node ${edge[endpoint]}.`);
      }
    }
  }
  assertRegionReferences(graph.regions, nodeIds, label);
}

function assertRegionReferences(regions, nodeIds, graphLabel) {
  const regionIds = new Set();
  for (const [index, region] of regions.entries()) {
    const at = `${graphLabel}.regions[${index}]`;
    if (regionIds.has(region.id)) throw new Error(`${at}.id duplicates region id ${region.id}.`);
    regionIds.add(region.id);
    const members = new Set(region.node_ids);
    for (const key of ["node_ids", "entry_node_ids", "exit_node_ids"]) {
      for (const nodeId of region[key]) {
        if (!nodeIds.has(nodeId)) throw new Error(`${at}.${key} references missing Node ${nodeId}.`);
        if (key !== "node_ids" && !members.has(nodeId)) {
          throw new Error(`${at}.${key} reference ${nodeId} must be contained in node_ids.`);
        }
      }
    }
  }
  for (const [index, region] of regions.entries()) {
    if (region.parent_region_id !== null && !regionIds.has(region.parent_region_id)) {
      throw new Error(`${graphLabel}.regions[${index}].parent_region_id ${region.parent_region_id} references missing Region.`);
    }
  }
  assertAcyclicRegionParents(regions, graphLabel);
}

function assertAcyclicRegionParents(regions, graphLabel) {
  const parentById = new Map(regions.map((region) => [region.id, region.parent_region_id]));
  const complete = new Set();
  const active = new Set();
  const visit = (regionId, path) => {
    if (complete.has(regionId)) return;
    if (active.has(regionId)) {
      const start = path.indexOf(regionId);
      const cycle = [...path.slice(start), regionId];
      throw new Error(`${graphLabel}.parent_region_id cycle detected: ${cycle.join(" -> ")}.`);
    }
    active.add(regionId);
    const parentId = parentById.get(regionId);
    if (parentId !== null) visit(parentId, [...path, regionId]);
    active.delete(regionId);
    complete.add(regionId);
  };
  for (const regionId of parentById.keys()) visit(regionId, []);
}

function assertNoRemovedRecursive(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRemovedRecursive(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (REMOVED_KEYS.has(key)) {
      throw new Error(`${label}.${key} is retired vocabulary.`);
    }
    assertNoRemovedRecursive(entry, `${label}.${key}`);
  }
}

function validateRunInputs({ analysisResult, normalizedRequirement, graph, assetCandidates, runManifest, scaffoldPlan, assets }) {
  const requirementId = normalizedRequirement.id || scaffoldPlan.requirement_id;
  if (scaffoldPlan.requirement_id !== requirementId) throw new Error("scaffold-plan.json requirement_id does not match normalizedRequirement.id.");
  if (graph.source_requirement_id !== requirementId) throw new Error("Graph source_requirement_id does not match the requirement.");
  if (!deepEqual(analysisResult.graph, graph)) throw new Error("scaffold-plan.json graph does not match approved analysis Graph IR.");
  if (!deepEqual(analysisResult.runtimeContracts, scaffoldPlan.runtime_contracts)) {
    throw new Error("scaffold-plan.json runtime_contracts do not match approved analysis runtime contracts.");
  }
  if (runManifest.requirement_id !== requirementId) {
    throw new Error("af-run-manifest.json requirement_id does not match normalizedRequirement.id.");
  }
  const missingApprovals = ["analysis_reviewed", "boundaries_approved", "runtime_contracts_approved"].filter(
    (key) => runManifest.approvals[key] !== true
  );
  if (missingApprovals.length) throw new Error(`af-run-manifest.json is not approved for build: ${missingApprovals.join(", ")}.`);
  if (runManifest.stages.design.status !== "complete") throw new Error("af-run-manifest.json design stage must be complete before generation.");
  const unapprovedRuntime = [...analysisResult.runtimeContracts, ...(scaffoldPlan.runtime_contracts ?? [])].filter(
    (contract) => contract?.contract_status !== "approved"
  );
  if (unapprovedRuntime.length) throw new Error("Runtime contracts must be approved before generation.");
  const unapprovedA2a = analysisResult.a2aContracts.filter((contract) => contract?.contract_status !== "approved");
  if (unapprovedA2a.length) throw new Error("A2A contracts must be approved before generation.");
  assertRequiredRuntimeContracts({ normalizedRequirement, graph, assets, contracts: scaffoldPlan.runtime_contracts });
  const blockers = scaffoldAssetProjectionErrors(assetCandidates, assets);
  if (blockers.length) throw new Error(`scaffold-plan.json includes unapproved or drifted assets: ${blockers.join("; ")}`);
}

function assertRequiredRuntimeContracts({ normalizedRequirement, graph, assets, contracts }) {
  const approved = contracts.filter((contract) => contract?.contract_status === "approved");
  const missing = [];
  const graphNodeIdsByAsset = new Map();
  for (const node of graph.nodes ?? []) {
    const assetId = node.agent_ref ?? node.tool_ref ?? node.workflow_ref ?? null;
    if (!assetId) continue;
    const ids = graphNodeIdsByAsset.get(assetId) ?? [];
    ids.push(node.id);
    graphNodeIdsByAsset.set(assetId, ids);
  }
  const coversAsset = (contract, asset) => {
    if (contract.asset_id === asset.asset_id) return true;
    const nodeIds = new Set(graphNodeIdsByAsset.get(asset.asset_id) ?? []);
    return Object.values(contract.graph_ir_annotations ?? {}).some((value) => nodeIds.has(value));
  };
  const hasAssetContract = (asset, predicate) => approved.some((contract) => coversAsset(contract, asset) && predicate(contract));

  for (const asset of assets) {
    if (asset.binding?.kind === "mcp" && !hasAssetContract(asset, (contract) => contract.contract_kind === "mcp_connection")) {
      missing.push(`mcp_connection for ${asset.asset_id}`);
    }
    if (isWriteBoundary(asset) && !hasAssetContract(asset, isWriteContract)) {
      missing.push(`write for ${asset.asset_id}`);
    }
    if (asset.risk_signals?.includes("external_message") && !hasAssetContract(asset, isExternalMessageContract)) {
      missing.push(`external message for ${asset.asset_id}`);
    }
    if (asset.binding?.kind === "a2a" && !hasAssetContract(asset, (contract) => contract.contract_kind === "external_connection")) {
      missing.push(`external message for A2A consumer ${asset.asset_id}`);
    }
    if (asset.exposure?.protocol === "a2a" && !hasAssetContract(asset, (contract) => contract.contract_kind === "external_connection")) {
      missing.push(`external message for A2A exposure ${asset.asset_id}`);
    }
  }

  for (const node of graph.nodes ?? []) {
    if (node.node_kind !== "human_input") continue;
    const covered = approved.some(
      (contract) =>
        isHumanApprovalContract(contract) &&
        contract.graph_ir_annotations?.human_input_node_id === node.id
    );
    if (!covered) missing.push(`human approval for node ${node.id}`);
  }

  const requirementRisks = new Set(normalizedRequirement.risk_signals ?? []);
  if (requirementRisks.has("transaction_write") && !approved.some(isWriteContract)) {
    missing.push("write for normalized requirement");
  }
  if (requirementRisks.has("human_approval_required") && !approved.some(isHumanApprovalContract)) {
    missing.push("human approval for normalized requirement");
  }
  if (requirementRisks.has("external_message") && !approved.some(isExternalMessageContract)) {
    missing.push("external message for normalized requirement");
  }

  if (missing.length) {
    throw new Error(`Missing required runtime contract boundaries: ${[...new Set(missing)].join("; ")}.`);
  }
}

function isWriteBoundary(asset) {
  return asset.side_effect === "write" || asset.side_effect === "read_write" || asset.risk_signals?.includes("transaction_write");
}

function isWriteContract(contract) {
  return (
    contract.operation?.operation_type === "write" ||
    contract.operation?.operation_type === "batch" ||
    contract.operation?.side_effect_level === "write" ||
    contract.operation?.side_effect_level === "financial_write"
  );
}

function isHumanApprovalContract(contract) {
  return (
    contract.contract_kind === "async_resume" &&
    contract.runtime_support?.human_approval_required === true &&
    contract.operation?.operation_type === "approval" &&
    contract.operation?.async_resume_required === true
  );
}

function isExternalMessageContract(contract) {
  return (
    contract.contract_kind === "external_connection" &&
    (contract.operation?.operation_type === "notification" || contract.operation?.side_effect_level === "customer_notification")
  );
}

function deepEqual(left, right) {
  return isDeepStrictEqual(left, right);
}

function scaffoldPackageName(scaffoldPlan, normalizedRequirement) {
  const explicit = typeof scaffoldPlan.package_name === "string" ? scaffoldPlan.package_name.trim() : "";
  if (explicit) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(explicit)) throw new Error("scaffold-plan.json package_name must be a valid ASCII Python package identifier.");
    return explicit;
  }
  return `${toPythonIdentifier(normalizedRequirement.id || scaffoldPlan.requirement_id || "agent_factory_workflow")}_adk`;
}
