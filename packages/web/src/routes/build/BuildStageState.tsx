import type { StageNextAction, StageStep } from "../../layout/StageShell";
import { useStageStep } from "../../layout/StageShell";
import { useArtifactRoot } from "../../state/useArtifactRoot";
import { useRuntimeStub, useScaffoldPlan } from "../../state/useScaffoldPlan";

export type BuildStepId = "run" | "review" | "approve";

const BUILD_STEP_IDS: readonly BuildStepId[] = ["run", "review", "approve"];

export interface BuildStageState {
  readonly activeStep: string;
  readonly boundariesApproved: boolean;
  readonly designGatesReady: boolean;
  readonly nextAction: StageNextAction;
  readonly onStepChange: (id: string) => void;
  readonly runtimeApproved: boolean;
  readonly steps: readonly StageStep[];
  readonly stubApproved: boolean;
  readonly summary: {
    readonly outputMode: string;
    readonly moduleCount: number | null;
    readonly runtimeStubFileCount: number;
    readonly stubApproved: boolean;
  };
}

export function useBuildStageState(reqId: string | undefined): BuildStageState {
  const { data: manifestData } = useArtifactRoot(reqId);
  const { data: scaffoldPlan } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);

  const manifest = manifestData?.manifest;
  const boundariesApproved = manifest?.approvals.boundaries_approved ?? false;
  const runtimeApproved = manifest?.approvals.runtime_contracts_approved ?? false;
  const designGatesReady = boundariesApproved && runtimeApproved;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;
  const runtimeStubFileCount = runtimeStub?.files.length ?? 0;
  const stubReady = runtimeStubFileCount > 0;
  const stubApproved = manifest?.approvals.stub_ready_for_followup ?? false;
  const defaultStep: BuildStepId = !stubReady ? "run" : !stubApproved ? "review" : "approve";
  const [activeStep, setActiveStep] = useStageStep([...BUILD_STEP_IDS], defaultStep);

  return {
    activeStep,
    boundariesApproved,
    designGatesReady,
    nextAction: buildBuildNextAction({
      activeStep,
      designGatesReady,
      onAdvance: setActiveStep,
      planReady,
      reqId,
      stubApproved,
      stubReady
    }),
    onStepChange: setActiveStep,
    runtimeApproved,
    steps: buildBuildSteps({ activeStep, designGatesReady, stubApproved, stubReady }),
    stubApproved,
    summary: {
      outputMode: scaffoldPlan?.output_mode ?? "smoke",
      moduleCount: scaffoldPlan?.modules.length ?? null,
      runtimeStubFileCount,
      stubApproved
    }
  };
}

export function BuildStageSummary({ summary }: { readonly summary: BuildStageState["summary"] }) {
  return (
    <>
      <BuildSummaryItem label="출력 모드" value={summary.outputMode} />
      <BuildSummaryItem label="모듈" value={summary.moduleCount === null ? "—" : `${summary.moduleCount}개`} />
      <BuildSummaryItem label="stub 파일" value={`${summary.runtimeStubFileCount}개`} />
      <BuildSummaryItem label="게이트" value={summary.stubApproved ? "stub_ready✓" : "stub_ready·"} />
    </>
  );
}

function buildBuildSteps({
  activeStep,
  designGatesReady,
  stubApproved,
  stubReady
}: {
  readonly activeStep: string;
  readonly designGatesReady: boolean;
  readonly stubApproved: boolean;
  readonly stubReady: boolean;
}): readonly StageStep[] {
  return [
    {
      id: "run",
      label: "1. 실행",
      hint: "scaffold·stub 생성",
      status: stubReady ? "done" : !designGatesReady ? "blocked" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "stub·handoff",
      available: stubReady,
      status: !stubReady ? "todo" : activeStep === "review" ? "current" : "done"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "stub_ready",
      available: stubReady,
      status: stubApproved ? "done" : !stubReady ? "todo" : activeStep === "approve" ? "current" : "todo"
    }
  ];
}

function buildBuildNextAction({
  activeStep,
  designGatesReady,
  onAdvance,
  planReady,
  reqId,
  stubApproved,
  stubReady
}: {
  readonly activeStep: string;
  readonly designGatesReady: boolean;
  readonly onAdvance: (id: string) => void;
  readonly planReady: boolean;
  readonly reqId: string | undefined;
  readonly stubApproved: boolean;
  readonly stubReady: boolean;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !stubReady,
      hint: stubReady
        ? "runtime-stub 이 생성됐습니다. ‘2. 검토’에서 파일과 handoff 를 확인하세요."
        : !designGatesReady
          ? "Design 단계에서 boundaries_approved · runtime_contracts_approved 를 먼저 통과하세요."
          : !planReady
            ? "scaffold-plan 을 생성·저장해 can_generate_source 를 통과시키세요."
            : "scaffold-plan 저장 후 runtime-stub 을 생성하세요."
    };
  }
  if (activeStep === "review") {
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !stubReady,
      hint: "stub 파일과 handoff 를 확인했다면 ‘3. 승인’에서 stub_ready_for_followup 게이트를 토글하세요."
    };
  }
  return {
    label: "검증 단계로 →",
    to: reqId ? `/af/${reqId}/verify` : undefined,
    disabled: !stubApproved,
    hint: stubApproved
      ? "후속 인계 준비가 끝났습니다. 검증(Verify) 단계로 이동하세요."
      : "stub_ready_for_followup 게이트를 통과하면 다음 단계로 갈 수 있습니다."
  };
}

function BuildSummaryItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
