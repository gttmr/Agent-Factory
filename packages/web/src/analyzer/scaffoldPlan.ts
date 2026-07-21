import type { CatalogEntry } from "../catalog/types";
import { validateGraphIR } from "./graphValidation";
import { requiredRuntimeContractKeys, runtimeContractReadinessIssues } from "./runtimeContracts";
import { approvedGraphReferenceIssues, candidateSemanticReadinessIssues, graphOwnershipReadinessIssues } from "./targetContract";
import { TARGET_CONTRACT_VERSION, type AssetCandidate, type GraphIR, type NormalizedRequirement, type RuntimeContract, type ScaffoldOutputMode, type ScaffoldPlan } from "./types";

export interface BuildScaffoldPlanInput {
  normalizedRequirement: NormalizedRequirement;
  assetCandidates: AssetCandidate[];
  graph: GraphIR;
  runtimeContracts?: RuntimeContract[];
  catalogEntries?: CatalogEntry[];
  outputMode?: ScaffoldOutputMode;
  packageName?: string;
}

export function buildScaffoldPlan({
  normalizedRequirement,
  assetCandidates,
  graph,
  runtimeContracts = [],
  catalogEntries = [],
  outputMode = "smoke",
  packageName
}: BuildScaffoldPlanInput): ScaffoldPlan {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const assets = assetCandidates.filter((candidate) => candidate.status === "approved");
  const excludedAssets = assetCandidates.filter((candidate) => candidate.status !== "approved").map((candidate) => ({
    asset_id: candidate.asset_id,
    name: candidate.name,
    status: candidate.status,
    reason: candidate.status === "needs_info" ? "필수 정보 검토가 끝나지 않았습니다." : `후보 상태가 ${candidate.status}입니다.`
  }));
  if (!assets.length) blockers.push("Scaffold source generation 전에 approved Asset이 하나 이상 필요합니다.");
  for (const candidate of assetCandidates) {
    const unresolved = candidate.missing_information.filter((item) => !(candidate.resolved_missing_information ?? []).includes(item));
    if (candidate.status === "needs_info" || unresolved.length) blockers.push(`${candidate.name}: 정보 필요 후보 (${unresolved.join(", ") || "status"})`);
    if (candidate.status === "approved") {
      blockers.push(...candidateSemanticReadinessIssues(candidate).map((issue) => `${candidate.asset_id}: ${issue}`));
    }
  }
  for (const contract of runtimeContracts) blockers.push(...runtimeContractReadinessIssues(contract));
  blockers.push(...requiredRuntimeContractCoverageIssues(normalizedRequirement, assets, runtimeContracts));
  const graphValidation = validateGraphIR(graph);
  blockers.push(...graphValidation.errors.map((entry) => entry.message));
  warnings.push(...graphValidation.warnings.map((entry) => entry.message));
  blockers.push(...approvedGraphReferenceIssues(assets, graph));
  blockers.push(...graphOwnershipReadinessIssues(graph));
  blockers.push(...runnableRepresentationIssues(assetCandidates, graph, outputMode));

  const catalogById = new Map(catalogEntries.map((entry) => [entry.asset_id, entry]));
  const catalogBoundAssets = assets.flatMap((asset) => {
    if (!asset.catalog_entry_id) return [];
    const catalog = catalogById.get(asset.catalog_entry_id);
    if (!catalog) {
      blockers.push(`${asset.name}: catalog_entry_id ${asset.catalog_entry_id}를 찾을 수 없습니다.`);
      return [];
    }
    return [{
      asset_id: asset.asset_id,
      asset_name: asset.name,
      catalog_id: catalog.asset_id,
      catalog_name: catalog.name
    }];
  });
  const catalogBoundIds = new Set(catalogBoundAssets.map((entry) => entry.asset_id));

  return {
    contract_version: TARGET_CONTRACT_VERSION,
    requirement_id: normalizedRequirement.id,
    ...(packageName ? { package_name: packageName } : {}),
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: outputMode,
    assets,
    runtime_contracts: runtimeContracts,
    excluded_assets: excludedAssets,
    graph,
    manifest: {
      catalog_bound_assets: catalogBoundAssets,
      new_code_required: assets.filter((asset) => !catalogBoundIds.has(asset.asset_id)).map((asset) => ({
        asset_id: asset.asset_id,
        asset_name: asset.name,
        reason: "검토된 Catalog binding이 없어 새 구현 경계가 필요합니다.",
        developer_todos: [...(asset.developer_todos ?? [])]
      }))
    },
    validation: {
      can_generate_source: blockers.length === 0,
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)]
    }
  };
}

function requiredRuntimeContractCoverageIssues(
  normalizedRequirement: NormalizedRequirement,
  assets: readonly AssetCandidate[],
  contracts: readonly RuntimeContract[]
): string[] {
  const byKey = new Map<string, RuntimeContract[]>();
  for (const contract of contracts) {
    if (contract.asset_id === null) continue;
    const key = `${contract.asset_id}:${contract.contract_kind}`;
    const matches = byKey.get(key) ?? [];
    matches.push(contract);
    byKey.set(key, matches);
  }
  return requiredRuntimeContractKeys({ normalizedRequirement, assetCandidates: [...assets] }).flatMap((required) => {
    const key = `${required.asset_id}:${required.contract_kind}`;
    const matches = byKey.get(key) ?? [];
    if (matches.length === 0) return [`필수 Runtime contract ${key}가 없습니다.`];
    if (matches.length > 1) return [`필수 Runtime contract ${key}는 exactly once 존재해야 합니다 (${matches.length}개 발견).`];
    return [];
  });
}

const STATIC_DYNAMIC_CONTROL_KINDS = new Set([
  "retry",
  "fallback",
  "error",
  "callback",
  "resume",
  "cancel",
  "timeout",
  "loop_back",
  "loop_exit"
]);

function runnableRepresentationIssues(
  assets: readonly AssetCandidate[],
  graph: GraphIR,
  outputMode: ScaffoldOutputMode
): string[] {
  if (outputMode !== "runnable") return [];
  const owner = graph.workflow_ref === null
    ? null
    : assets.find((asset) => asset.asset_id === graph.workflow_ref && asset.asset_type === "workflow") ?? null;
  if (graph.workflow_ref !== null && !owner) {
    return [`Graph owning Workflow ${graph.workflow_ref}를 approved Asset에서 찾을 수 없습니다.`];
  }
  const representation = owner?.workflow_profile?.representation ?? "graph";
  if (representation === "unresolved") {
    return [`Workflow ${owner?.asset_id ?? graph.workflow_ref} representation이 unresolved라 runnable source를 생성할 수 없습니다.`];
  }
  if (representation === "dynamic") return [];

  const reasons: string[] = [];
  const dynamicEdges = graph.edges.filter((edge) => STATIC_DYNAMIC_CONTROL_KINDS.has(edge.control.kind));
  if (dynamicEdges.length) {
    reasons.push(`dynamic control edge ${dynamicEdges.map((edge) => edge.id).join(", ")}`);
  }
  const dynamicSubworkflows = graph.nodes.flatMap((node) => {
    if (node.node_kind !== "subworkflow") return [];
    const workflow = assets.find((asset) => asset.asset_id === node.workflow_ref && asset.asset_type === "workflow");
    return workflow?.workflow_profile?.representation === "dynamic" ? [node.id] : [];
  });
  if (dynamicSubworkflows.length) {
    reasons.push(`dynamic subworkflow node ${dynamicSubworkflows.join(", ")}`);
  }
  const cycleNodeIds = graphCycleNodeIds(graph);
  if (cycleNodeIds.length) reasons.push(`cycle ${cycleNodeIds.join(", ")}`);
  if (!reasons.length) return [];
  return [
    `Workflow ${owner?.asset_id ?? "standalone Graph IR"}의 representation graph은 현재 static Graph lowerer가 ${reasons.join("; ")}를 생성할 수 없습니다. representation: dynamic을 명시적으로 검토하거나 Graph를 acyclic static shape로 수정하세요.`
  ];
}

function graphCycleNodeIds(graph: GraphIR): string[] {
  const ids = [...new Set(graph.nodes.map((node) => node.id))];
  const idSet = new Set(ids);
  const inDegree = new Map(ids.map((id) => [id, 0]));
  const adjacency = new Map(ids.map((id) => [id, [] as string[]]));
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    const key = `${edge.from}->${edge.to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  const queue = ids.filter((id) => inDegree.get(id) === 0);
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }
  return ids.filter((id) => (inDegree.get(id) ?? 0) > 0);
}
