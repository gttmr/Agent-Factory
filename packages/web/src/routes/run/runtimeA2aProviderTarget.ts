import type { AnalysisResult, ModuleCandidate } from "../../analyzer/types";

const LOCAL_ARTIFACT_OWNER_PREFIX = "local artifact:";

export interface RuntimeA2aProviderTarget {
  readonly reqId: string;
  readonly source: "current_artifact" | "remote_a2a_contract";
  readonly remoteModuleId: string | null;
}

export function runtimeA2aProviderTarget(analysis: AnalysisResult | null | undefined, currentReqId: string): RuntimeA2aProviderTarget {
  const localProvider = analysis?.moduleCandidates
    .filter((candidate) => candidate.module_category === "remote_a2a" && candidate.status === "approved")
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(localProviderTargetFromCandidate)
    .find((target) => target !== null);

  return (
    localProvider ?? {
      reqId: currentReqId,
      source: "current_artifact",
      remoteModuleId: null
    }
  );
}

function localProviderTargetFromCandidate(candidate: ModuleCandidate): RuntimeA2aProviderTarget | null {
  const reqId = localProviderReqId(candidate.owner);
  if (!reqId) return null;
  return {
    reqId,
    source: "remote_a2a_contract",
    remoteModuleId: candidate.id
  };
}

function localProviderReqId(owner: string | undefined): string | null {
  if (!owner?.startsWith(LOCAL_ARTIFACT_OWNER_PREFIX)) return null;
  const reqId = owner.slice(LOCAL_ARTIFACT_OWNER_PREFIX.length).trim();
  return reqId.length > 0 ? reqId : null;
}
