import type { A2AContract, AnalysisResult, ModuleCandidate, RuntimeContract } from "./types";

export interface BuildAnalysisResultArtifactInput {
  analysis: AnalysisResult;
  moduleCandidates: ModuleCandidate[];
  a2aContracts?: A2AContract[];
  runtimeContracts?: RuntimeContract[];
}

export function buildAnalysisResultArtifact({
  analysis,
  moduleCandidates,
  a2aContracts = analysis.a2aContracts,
  runtimeContracts = analysis.runtimeContracts
}: BuildAnalysisResultArtifactInput): AnalysisResult {
  return {
    ...analysis,
    moduleCandidates,
    a2aContracts,
    runtimeContracts
  };
}

export function serializeAnalysisResultArtifact(input: BuildAnalysisResultArtifactInput): string {
  return `${JSON.stringify(buildAnalysisResultArtifact(input), null, 2)}\n`;
}
