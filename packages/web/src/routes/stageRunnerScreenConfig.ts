import type { ReactNode } from "react";
import type { AfRunManifest, AfRunValidationResult, AfStageRunStatus } from "../analyzer/afRunManifest";
import type { CodexAnalyzerModel, ScaffoldOutputMode } from "../analyzer/types";
import type { StageRunRequestBody, StageRunStage } from "../state/apiClient";
import type { AnalyzeCatalogEntry } from "./analyze/analyzeStageModel";

type StageRunnerMetricTone = "default" | "ok" | "warn" | "danger";

interface StageRunnerScreenMetric {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: StageRunnerMetricTone;
}

interface StageRunnerScreenConfig {
  readonly stage: StageRunStage;
  readonly skillName: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly metrics: StageRunnerScreenMetric[];
  readonly disabledReason: string | null;
  readonly currentArtifactEtag: string | null;
  readonly runButtonLabel: string;
  readonly buildRunBody: (model: CodexAnalyzerModel) => StageRunRequestBody;
}

interface AnalyzeStageRunnerConfigInput {
  readonly hasAnalysis: boolean;
  readonly analysisEtag: string | null;
  readonly analyzeRawText: string;
  readonly analyzeDomain: string;
  readonly catalog: AnalyzeCatalogEntry[];
  readonly catalogCounts: Record<AnalyzeCatalogEntry["module_category"], number>;
  readonly currentCandidateCount: number | null;
}

interface DesignStageRunnerConfigInput {
  readonly hasAnalysis: boolean;
  readonly analysisReviewed: boolean;
  readonly approvedCandidateCount: number;
  readonly totalCandidateCount: number;
  readonly allCandidatesApproved: boolean;
  readonly graphNodeCount: number;
  readonly errorCount: number;
  readonly runtimeContractCount: number;
  readonly a2aContractCount: number;
  readonly runtimeContractsReady: boolean;
  readonly a2aContractsReady: boolean;
  readonly analysisEtag: string | null;
}

interface BuildStageReadinessInput {
  readonly analysisExists: boolean;
  readonly boundariesApproved: boolean;
  readonly runtimeApproved: boolean;
  readonly modeDirty: boolean;
  readonly planReady: boolean;
}

interface BuildStageRunnerConfigInput extends BuildStageReadinessInput {
  readonly stubReady: boolean;
  readonly runtimeStubFileCount: number;
  readonly selectedOutputMode: ScaffoldOutputMode;
}

interface VerifyStageRunnerConfigInput {
  readonly commandKey: string;
  readonly runState: VerifyRunState;
  readonly reportExists: boolean;
  readonly deltaExists: boolean;
}

export interface VerifyRunState {
  readonly hasRun: boolean;
  readonly validationResult: AfRunValidationResult;
  readonly validationLabel: string;
  readonly commandCount: number;
  readonly latestRunId: string | null;
  readonly latestRunStatus: AfStageRunStatus | null;
  readonly latestRunStatusLabel: string;
  readonly latestRunTone: StageRunnerMetricTone;
}

const verifyValidationLabels: Record<AfRunValidationResult, string> = {
  passed: "통과",
  failed: "실패",
  not_run: "미실행"
};

const verifyValidationTones: Record<AfRunValidationResult, StageRunnerMetricTone> = {
  passed: "ok",
  failed: "danger",
  not_run: "warn"
};

const stageRunStatusLabels: Record<AfStageRunStatus, string> = {
  running: "실행 중",
  completed: "완료",
  failed: "실패",
  applied: "적용됨",
  canceled: "취소"
};

const stageRunStatusTones: Record<AfStageRunStatus, StageRunnerMetricTone> = {
  running: "warn",
  completed: "ok",
  failed: "danger",
  applied: "ok",
  canceled: "warn"
};

export function buildAnalyzeStageRunnerConfig(input: AnalyzeStageRunnerConfigInput): StageRunnerScreenConfig {
  return {
    stage: "analyze",
    skillName: "af-discover-assets",
    title: "Analyze Skill Runner",
    description: input.hasAnalysis
      ? "분석 결과가 있을 때 이 단계는 입력 보강, 재분석, JSON import 를 위한 refresh path 입니다. 검토 근거와 approval path 는 ‘2. 검토’ 이후에서 확인합니다."
      : "요구사항 텍스트와 seed catalog 를 서버 Stage Runner 로 보내고, 결과는 run 폴더의 proposed artifact 로 먼저 저장합니다. canonical analysis-result.json 은 제안 적용 후에만 바뀝니다.",
    metrics: [
      { label: "입력 글자", value: `${input.analyzeRawText.length}자`, tone: input.analyzeRawText ? "ok" : "danger" },
      { label: "현재 후보", value: input.currentCandidateCount === null ? "없음" : `${input.currentCandidateCount}개` },
      { label: "catalog", value: `${input.catalog.length}개` },
      {
        label: "catalog 구성",
        value: `A ${input.catalogCounts.agent} · W ${input.catalogCounts.workflow} · D ${input.catalogCounts.adapter} · R ${input.catalogCounts.remote_a2a}`
      }
    ],
    disabledReason: input.analyzeRawText
      ? null
      : "요구사항 텍스트가 비어 있습니다. 원문을 입력하거나 raw_text 가 포함된 analysis-result.json 을 import 하세요.",
    currentArtifactEtag: input.analysisEtag,
    runButtonLabel: input.hasAnalysis ? "Analyze 재실행" : "Analyze 실행",
    buildRunBody: (model) => ({
      model,
      input: { rawText: input.analyzeRawText, domain: input.analyzeDomain },
      catalog: input.catalog
    })
  };
}

export function buildDesignStageRunnerConfig(input: DesignStageRunnerConfigInput): StageRunnerScreenConfig {
  return {
    stage: "design",
    skillName: "af-compose-solution",
    title: "Design Skill Runner",
    description:
      "reviewed analysis-result.json 을 기준으로 모듈 경계, Graph IR, Runtime 계약, A2A 계약 변경 제안을 생성합니다. 성공한 run 도 approval gate 를 자동으로 켜지 않습니다.",
    metrics: [
      {
        label: "analysis_reviewed",
        value: input.analysisReviewed ? "true" : "false",
        tone: input.analysisReviewed ? "ok" : "danger"
      },
      {
        label: "module status",
        value: input.hasAnalysis ? `approved ${input.approvedCandidateCount} / ${input.totalCandidateCount}` : "없음",
        tone: input.allCandidatesApproved ? "ok" : "warn"
      },
      { label: "Graph IR", value: `nodes ${input.graphNodeCount} · errors ${input.errorCount}`, tone: input.errorCount ? "danger" : "ok" },
      {
        label: "Runtime/A2A",
        value: `runtime ${input.runtimeContractCount} · A2A ${input.a2aContractCount}`,
        tone: input.runtimeContractsReady && input.a2aContractsReady ? "ok" : "warn"
      }
    ],
    disabledReason: !input.hasAnalysis
      ? "analysis-result.json 이 없어 Design runner 를 실행할 수 없습니다."
      : !input.analysisReviewed
        ? "analysis_reviewed=true 상태에서만 Design runner 를 실행할 수 있습니다."
        : null,
    currentArtifactEtag: input.analysisEtag,
    runButtonLabel: "Design 실행",
    buildRunBody: (model) => ({ model })
  };
}

export function buildBuildStageRunnerConfig(input: BuildStageRunnerConfigInput): StageRunnerScreenConfig {
  return {
    stage: "build",
    skillName: "af-scaffold-runtime",
    title: "Build Stage Runner",
    description: "기존 runtime-stub 생성 primitive를 실행하고 run 이력에 기록합니다. canonical runtime-stub side effect는 기존 Build API와 동일합니다.",
    metrics: [
      { label: "scaffold", value: input.planReady ? "ready" : "blocked", tone: input.planReady ? "ok" : "warn" },
      { label: "runtime-stub", value: input.stubReady ? `${input.runtimeStubFileCount} files` : "empty", tone: input.stubReady ? "ok" : "warn" },
      { label: "mode", value: input.selectedOutputMode }
    ],
    disabledReason: buildBuildStageDisabledReason(input),
    currentArtifactEtag: null,
    runButtonLabel: "runtime-stub build 기록 실행",
    buildRunBody: (model) => ({ model })
  };
}

export function buildBuildCompoundDisabledReason(input: Pick<BuildStageReadinessInput, "analysisExists" | "boundariesApproved" | "runtimeApproved">): string | null {
  if (!input.boundariesApproved || !input.runtimeApproved) {
    return `게이트 미충족: boundaries_approved=${input.boundariesApproved ? "예" : "아니오"}, runtime_contracts_approved=${
      input.runtimeApproved ? "예" : "아니오"
    }`;
  }
  return input.analysisExists ? null : "analysis-result.json 이 없어 계약 동기화를 실행할 수 없습니다.";
}

function buildBuildStageDisabledReason(input: BuildStageReadinessInput): string | null {
  const compoundDisabledReason = buildBuildCompoundDisabledReason(input);
  if (compoundDisabledReason) return compoundDisabledReason;
  if (input.modeDirty) {
    return "저장된 scaffold-plan 과 선택한 output mode가 다릅니다. 먼저 scaffold-plan 을 재생성하세요.";
  }
  if (!input.planReady) {
    return "scaffold-plan.json 이 생성 가능 상태여야 build stage를 실행할 수 있습니다.";
  }
  return null;
}

export function buildVerifyStageRunnerConfig(input: VerifyStageRunnerConfigInput): StageRunnerScreenConfig {
  return {
    stage: "verify",
    skillName: "af-verify-runtime",
    title: "Verify Stage Runner",
    description: "allow-list 검증 명령을 실행하고 validation-report.md와 catalog-delta.yaml 제안 템플릿을 run 이력에 남깁니다.",
    metrics: [
      {
        label: "검증 결과",
        value: input.runState.validationLabel,
        tone: verifyValidationTones[input.runState.validationResult]
      },
      {
        label: "최근 run",
        value: input.runState.latestRunStatusLabel,
        tone: input.runState.latestRunTone
      },
      { label: "report", value: input.reportExists ? "있음" : "없음", tone: input.reportExists ? "ok" : "warn" },
      { label: "catalog-delta", value: input.deltaExists ? "있음" : "없음", tone: input.deltaExists ? "ok" : "warn" }
    ],
    disabledReason: null,
    currentArtifactEtag: null,
    runButtonLabel: "Verify 실행 기록",
    buildRunBody: (model) => ({ model, verifyCommand: input.commandKey })
  };
}

export function summarizeVerifyRunState(manifest: AfRunManifest | null | undefined): VerifyRunState {
  const validationResult = manifest?.validation.last_result ?? "not_run";
  const latestRun = manifest?.stage_runs?.verify ?? null;
  return {
    hasRun: Boolean(latestRun) || validationResult !== "not_run",
    validationResult,
    validationLabel: verifyValidationLabels[validationResult],
    commandCount: manifest?.validation.commands.length ?? 0,
    latestRunId: latestRun?.latest_run_id ?? null,
    latestRunStatus: latestRun?.status ?? null,
    latestRunStatusLabel: latestRun ? stageRunStatusLabels[latestRun.status] : "이력 없음",
    latestRunTone: latestRun ? stageRunStatusTones[latestRun.status] : "warn"
  };
}
