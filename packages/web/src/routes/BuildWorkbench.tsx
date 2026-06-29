import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Panel, EmptyState } from "../ui/primitives";
import { StageShell } from "../layout/StageShell";
import { useRecentRoots } from "../state/useRecentRoots";
import { BuildApprovalStep } from "./build/BuildApprovalStep";
import { BuildReviewStep } from "./build/BuildReviewStep";
import { BuildRunStep } from "./build/BuildRunStep";
import { BuildStageSummary, useBuildStageState } from "./build/BuildStageState";

export default function BuildWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  const stage = useBuildStageState(reqId);

  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  return (
    <StageShell
      eyebrow={`개발 · ${reqId}`}
      title="개발"
      steps={[...stage.steps]}
      activeStep={stage.activeStep}
      onStepChange={stage.onStepChange}
      summary={<BuildStageSummary summary={stage.summary} />}
      nextAction={stage.nextAction}
    >
      {stage.activeStep === "run" ? (
        <BuildRunStep
          boundariesApproved={stage.boundariesApproved}
          designGatesReady={stage.designGatesReady}
          reqId={reqId}
          runtimeApproved={stage.runtimeApproved}
        />
      ) : null}
      {stage.activeStep === "review" ? <BuildReviewStep reqId={reqId} /> : null}
      {stage.activeStep === "approve" ? <BuildApprovalStep reqId={reqId} /> : null}
    </StageShell>
  );
}
