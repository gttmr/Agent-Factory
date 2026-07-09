import type { CatalogHubEntry } from "../../catalog/catalogIndex";
import type { StageNextAction, StageStep } from "../../layout/StageShell";

export type AnalyzeStepId = "run" | "review" | "approve";

export const ANALYZE_STEP_IDS: AnalyzeStepId[] = ["run", "review", "approve"];

export interface AnalyzeCatalogEntry {
  readonly id?: string;
  readonly name: string;
  readonly module_category: "agent" | "workflow" | "adapter" | "remote_a2a";
  readonly subtype?: string | null;
  readonly [key: string]: unknown;
}

export function buildAnalyzeSteps({
  hasAnalysis,
  reviewReady,
  approved,
  activeStep
}: {
  hasAnalysis: boolean;
  reviewReady: boolean;
  approved: boolean;
  activeStep: AnalyzeStepId;
}): StageStep[] {
  return [
    {
      id: "run",
      label: "1. 실행",
      hint: "요구사항 분석",
      status: hasAnalysis ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "이해·누락정보 확인",
      available: hasAnalysis,
      status: !hasAnalysis ? "todo" : reviewReady ? "done" : activeStep === "review" ? "current" : "blocked"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "analysis_reviewed",
      available: hasAnalysis,
      status: approved ? "done" : !reviewReady ? (hasAnalysis ? "blocked" : "todo") : activeStep === "approve" ? "current" : "todo"
    }
  ];
}

export function AnalyzeSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function buildAnalyzeNextAction({
  activeStep,
  reqId,
  hasAnalysis,
  reviewReady,
  approved,
  onAdvance
}: {
  activeStep: AnalyzeStepId;
  reqId: string;
  hasAnalysis: boolean;
  reviewReady: boolean;
  approved: boolean;
  onAdvance: (id: AnalyzeStepId) => void;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !hasAnalysis,
      hint: hasAnalysis
        ? "분석 결과가 준비됐습니다. ‘2. 검토’로 이동해 이해와 누락 정보를 확인하세요."
        : "왼쪽 입력란에 요구사항을 적고 Analyze 를 실행하면 분석 결과가 생성됩니다."
    };
  }
  if (activeStep === "review") {
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !reviewReady,
      hint: reviewReady
        ? "누락 정보를 모두 수용했습니다. ‘3. 승인’으로 이동하세요."
        : "‘보조 근거 → 누락 정보’ drawer에서 모든 항목을 ‘수용’ 처리해야 승인할 수 있습니다."
    };
  }
  return {
    label: "설계 단계로 →",
    to: `/af/${reqId}/design`,
    disabled: !approved,
    hint: approved
      ? "분석 검토가 완료됐습니다. 설계(경계) 단계로 이동하세요."
      : reviewReady
        ? "아래 ‘검토 완료로 표시’를 눌러 analysis_reviewed 게이트를 통과하세요."
        : "먼저 ‘2. 검토’에서 누락 정보를 모두 수용하세요."
  };
}

export function flattenCatalogForAnalyzer(
  index:
    | { agents: CatalogHubEntry[]; workflows: CatalogHubEntry[]; adapters: CatalogHubEntry[]; remoteA2A: CatalogHubEntry[] }
    | undefined
): AnalyzeCatalogEntry[] {
  if (!index) return [];
  const groups: Array<[AnalyzeCatalogEntry["module_category"], CatalogHubEntry[]]> = [
    ["agent", index.agents],
    ["workflow", index.workflows],
    ["adapter", index.adapters],
    ["remote_a2a", index.remoteA2A]
  ];
  const result: AnalyzeCatalogEntry[] = [];
  for (const [moduleCategory, entries] of groups) {
    for (const entry of entries) {
      result.push({
        ...entry,
        id: entry.id,
        name: entry.name,
        module_category: moduleCategory,
        subtype: entry.subtype ?? null
      });
    }
  }
  return result;
}
