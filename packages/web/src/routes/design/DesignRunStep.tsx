import { StageRunnerPanel } from "../../components/StageRunnerPanel";
import type { AnalysisResult } from "../../analyzer/types";
import { buildDesignStageRunnerConfig } from "../stageRunnerScreenConfig";

interface DesignRunStepProps {
  reqId: string;
  analysis: AnalysisResult | null;
  analysisReviewed: boolean;
  allCandidatesApproved: boolean;
  graphNodeCount: number;
  errorCount: number;
  runtimeContractCount: number;
  a2aContractCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  analysisEtag: string | null;
}

export function DesignRunStep({
  reqId,
  analysis,
  analysisReviewed,
  allCandidatesApproved,
  graphNodeCount,
  errorCount,
  runtimeContractCount,
  a2aContractCount,
  runtimeContractsReady,
  a2aContractsReady,
  analysisEtag
}: DesignRunStepProps) {
  const stageRunnerConfig = buildDesignStageRunnerConfig({
    hasAnalysis: Boolean(analysis),
    analysisReviewed,
    approvedCandidateCount: analysis?.assetCandidates.filter((candidate) => candidate.status === "approved").length ?? 0,
    totalCandidateCount: analysis?.assetCandidates.length ?? 0,
    allCandidatesApproved,
    graphNodeCount,
    errorCount,
    runtimeContractCount,
    a2aContractCount,
    runtimeContractsReady,
    a2aContractsReady,
    analysisEtag
  });

  return (
    <StageRunnerPanel
      reqId={reqId}
      {...stageRunnerConfig}
    />
  );
}
