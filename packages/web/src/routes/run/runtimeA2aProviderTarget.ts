import type { A2AContract, AnalysisResult, AssetCandidate } from "../../analyzer/types";

const LOCAL_ARTIFACT_OWNER_PREFIX = "local artifact:";

export interface RuntimeA2aProviderTarget {
  readonly reqId: string;
  readonly source: "current_artifact" | "a2a_contract";
  readonly agentAssetId: string;
  readonly contractId: string;
}

export function runtimeA2aProviderTarget(analysis: AnalysisResult | null | undefined): RuntimeA2aProviderTarget | null {
  if (!analysis) return null;
  const contracts = new Map(analysis.a2aContracts.map((contract) => [contract.contract_id, contract]));
  return analysis.assetCandidates
    .filter((candidate) => candidate.asset_type === "agent" && candidate.status === "approved")
    .sort((left, right) => left.asset_id.localeCompare(right.asset_id))
    .map((candidate) => localProviderTargetFromCandidate(candidate, contracts))
    .find((target) => target !== null) ?? null;
}

function localProviderTargetFromCandidate(
  candidate: AssetCandidate,
  contracts: ReadonlyMap<string, A2AContract>
): RuntimeA2aProviderTarget | null {
  const contract = referencedA2AContracts(candidate, contracts)
    .find((entry) => entry.agent_ref === candidate.asset_id);
  if (!contract) return null;
  const reqId = localProviderReqId(candidate.owner);
  if (!reqId) return null;
  return {
    reqId,
    source: "a2a_contract",
    agentAssetId: candidate.asset_id,
    contractId: contract.contract_id
  };
}

function referencedA2AContracts(
  candidate: AssetCandidate,
  contracts: ReadonlyMap<string, A2AContract>
): A2AContract[] {
  const refs = new Set<string>();
  if (candidate.binding?.kind === "a2a") refs.add(candidate.binding.contract_ref);
  if (candidate.exposure?.protocol === "a2a") refs.add(candidate.exposure.contract_ref);
  return [...refs].flatMap((contractId) => {
    const contract = contracts.get(contractId);
    return contract ? [contract] : [];
  });
}

function localProviderReqId(owner: string | undefined): string | null {
  if (!owner?.startsWith(LOCAL_ARTIFACT_OWNER_PREFIX)) return null;
  const reqId = owner.slice(LOCAL_ARTIFACT_OWNER_PREFIX.length).trim();
  return reqId.length > 0 ? reqId : null;
}
