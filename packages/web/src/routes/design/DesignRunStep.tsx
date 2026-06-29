import { StageRunnerPanel } from "../../components/StageRunnerPanel";
import type { AnalysisResult } from "../../analyzer/types";

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
  return (
    <StageRunnerPanel
      reqId={reqId}
      stage="design"
      skillName="af-design-boundaries"
      title="Design Skill Runner"
      description="reviewed analysis-result.json 을 기준으로 모듈 경계, Graph IR, Runtime 계약, A2A 계약 변경 제안을 생성합니다. 성공한 run 도 approval gate 를 자동으로 켜지 않습니다."
      metrics={[
        {
          label: "analysis_reviewed",
          value: analysisReviewed ? "true" : "false",
          tone: analysisReviewed ? "ok" : "danger"
        },
        {
          label: "module status",
          value: analysis ? `approved ${analysis.moduleCandidates.filter((candidate) => candidate.status === "approved").length} / ${analysis.moduleCandidates.length}` : "없음",
          tone: allCandidatesApproved ? "ok" : "warn"
        },
        { label: "Graph IR", value: `nodes ${graphNodeCount} · errors ${errorCount}`, tone: errorCount ? "danger" : "ok" },
        {
          label: "Runtime/A2A",
          value: `runtime ${runtimeContractCount} · A2A ${a2aContractCount}`,
          tone: runtimeContractsReady && a2aContractsReady ? "ok" : "warn"
        }
      ]}
      disabledReason={
        !analysis
          ? "analysis-result.json 이 없어 Design runner 를 실행할 수 없습니다."
          : !analysisReviewed
            ? "analysis_reviewed=true 상태에서만 Design runner 를 실행할 수 있습니다."
            : null
      }
      currentArtifactEtag={analysisEtag}
      runButtonLabel="Design 실행"
      buildRunBody={(model) => ({ model })}
    />
  );
}
