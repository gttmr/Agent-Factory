import type { DesignBottomTab } from "../../design/designWorkbenchTabs";
import type { StageNextAction, StageStep } from "../../layout/StageShell";

export type SidebarTab = DesignBottomTab;
export type DesignStepId = "run" | "review" | "approve";

export const DESIGN_STEP_IDS: DesignStepId[] = ["run", "review", "approve"];
export const INSPECTOR_ENABLED = false;
export const GRAPH_IR_SAVE_SUCCESS_MESSAGE =
  "Graph IR 저장 완료 — Build 에서 계약 동기화 + runtime-stub 재생성이 필요합니다.";

export function buildDesignSteps({
  hasGraph,
  designRunComplete,
  reviewReady,
  bothApproved,
  activeStep
}: {
  hasGraph: boolean;
  designRunComplete: boolean;
  reviewReady: boolean;
  bothApproved: boolean;
  activeStep: DesignStepId;
}): StageStep[] {
  return [
    {
      id: "run",
      label: "1. 실행",
      hint: "경계·Graph IR 생성",
      status: designRunComplete ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "모듈·그래프·계약",
      available: hasGraph,
      status: !hasGraph ? "todo" : reviewReady ? "done" : activeStep === "review" ? "current" : "blocked"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "경계·계약 게이트",
      available: hasGraph,
      status: bothApproved ? "done" : activeStep === "approve" ? "current" : !reviewReady ? (hasGraph ? "blocked" : "todo") : "todo"
    }
  ];
}

export function buildDesignNextAction({
  activeStep,
  reqId,
  hasAnalysis,
  analysisReviewed,
  hasGraph,
  reviewReady,
  bothApproved,
  unapprovedCandidateCount,
  errorCount,
  runtimeContractsReady,
  a2aContractsReady,
  runtimeContractCount,
  a2aContractCount,
  onAdvance
}: {
  activeStep: DesignStepId;
  reqId: string;
  hasAnalysis: boolean;
  analysisReviewed: boolean;
  hasGraph: boolean;
  reviewReady: boolean;
  bothApproved: boolean;
  unapprovedCandidateCount: number;
  errorCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  runtimeContractCount: number;
  a2aContractCount: number;
  onAdvance: (id: DesignStepId) => void;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !hasGraph,
      hint: hasGraph
        ? "경계·Graph IR 제안이 준비됐습니다. ‘2. 검토’에서 모듈·그래프·계약을 확인하세요."
        : !hasAnalysis
          ? "Analyze 단계에서 분석 결과를 먼저 만들어야 Design 을 실행할 수 있습니다."
          : !analysisReviewed
            ? "Analyze 단계에서 analysis_reviewed 게이트를 먼저 통과하세요."
            : "Design 을 실행해 Graph IR·계약 제안을 생성하세요."
    };
  }
  if (activeStep === "review") {
    const unmetConditions = buildReviewUnmetConditions({
      hasGraph,
      unapprovedCandidateCount,
      errorCount,
      runtimeContractsReady,
      a2aContractsReady,
      runtimeContractCount,
      a2aContractCount
    });
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !hasGraph,
      hint: reviewReady
        ? "모든 모듈 approved · Graph IR 오류 0 · Runtime/A2A 계약 준비 완료. ‘3. 승인’에서 게이트를 토글하세요."
        : unmetConditions.join(" · ")
    };
  }
  return {
    label: "개발 단계로 →",
    to: `/af/${reqId}/build`,
    disabled: !bothApproved,
    hint: bothApproved
      ? "경계·계약 승인이 끝났습니다. 개발(Build) 단계로 이동하세요."
      : "boundaries_approved 와 runtime_contracts_approved 를 모두 통과해야 다음 단계로 갈 수 있습니다."
  };
}

function buildReviewUnmetConditions({
  hasGraph,
  unapprovedCandidateCount,
  errorCount,
  runtimeContractsReady,
  a2aContractsReady,
  runtimeContractCount,
  a2aContractCount
}: {
  hasGraph: boolean;
  unapprovedCandidateCount: number;
  errorCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  runtimeContractCount: number;
  a2aContractCount: number;
}): string[] {
  const unmet: string[] = [];
  if (!hasGraph) unmet.push("Graph IR 없음 — Design 실행 필요");
  if (unapprovedCandidateCount > 0) unmet.push(`미승인 모듈 ${unapprovedCandidateCount}개 — 하단 모듈 탭에서 승인`);
  if (errorCount > 0) unmet.push(`Graph IR 오류 ${errorCount}개 — 그래프 편집으로 해소`);
  if (runtimeContractCount + a2aContractCount > 0) {
    if (!runtimeContractsReady) unmet.push("Runtime 계약 준비 필요");
    if (!a2aContractsReady) unmet.push("A2A 계약 준비 필요");
  }
  return unmet.length ? unmet : ["검토 조건을 다시 확인하세요."];
}

export function statusLabel(status: string): string {
  if (status === "approved") return "approved";
  if (status === "needs_info") return "needs_info";
  if (status === "deferred") return "deferred";
  if (status === "rejected") return "rejected";
  return status;
}
