import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { EmptyState, Panel, SelectField } from "../ui/primitives";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { VERIFY_COMMANDS } from "../state/useVerify";
import { buildVerifyStageRunnerConfig, summarizeVerifyRunState } from "./stageRunnerScreenConfig";
import { VerifyReviewStep } from "./verify/VerifyReviewStep";

type VerifyStepId = "run" | "review";
const VERIFY_STEP_IDS: VerifyStepId[] = ["run", "review"];

export default function VerifyWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const mountedAtRef = useRef(Date.now());
  const { data: manifestData, isStale, dataUpdatedAt } = useArtifactRoot(reqId);

  const reportArtifact = useTextArtifact(reqId, "validation-report.md");
  const saveReport = useSaveTextArtifact(reqId, "validation-report.md");
  const deltaArtifact = useTextArtifact(reqId, "catalog-delta.yaml");
  const saveDelta = useSaveTextArtifact(reqId, "catalog-delta.yaml");

  const [reportDraft, setReportDraft] = useState("");
  const [reportDirty, setReportDirty] = useState(false);
  const [deltaDraft, setDeltaDraft] = useState("");
  const [deltaDirty, setDeltaDirty] = useState(false);
  const [stageRunnerCommand, setStageRunnerCommand] = useState("validate_artifact_root");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!reportDirty && reportArtifact.data) setReportDraft(reportArtifact.data.content);
  }, [reportArtifact.data, reportDirty]);
  useEffect(() => {
    if (!deltaDirty && deltaArtifact.data) setDeltaDraft(deltaArtifact.data.content);
  }, [deltaArtifact.data, deltaDirty]);

  const manifest = manifestData?.manifest;
  const verifyRunState = summarizeVerifyRunState(manifest);
  const stageRunnerConfig = buildVerifyStageRunnerConfig({
    commandKey: stageRunnerCommand,
    runState: verifyRunState,
    reportExists: Boolean(reportArtifact.data),
    deltaExists: Boolean(deltaArtifact.data)
  });

  const landingStepRef = useRef<VerifyStepId | null>(null);
  // Fresh-enough cache pins immediately; stale cache waits for data successfully updated after this mount.
  if (
    manifestData !== undefined &&
    (!isStale || dataUpdatedAt > mountedAtRef.current) &&
    landingStepRef.current === null
  ) {
    landingStepRef.current = verifyRunState.hasRun ? "review" : "run";
  }
  const [activeStep, setActiveStep] = useStageStep(VERIFY_STEP_IDS, landingStepRef.current ?? "run");

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  const steps: StageStep[] = [
    {
      id: "run",
      label: "실행",
      hint: "명령·로그",
      status: verifyRunState.hasRun ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "기록",
      hint: "report·delta",
      status: activeStep === "review" ? "current" : "todo"
    }
  ];

  const nextAction: StageNextAction =
    activeStep === "run"
      ? {
          label: "결과 기록으로 →",
          onClick: () => setActiveStep("review"),
          hint: verifyRunState.hasRun
            ? "검증 완료. 결과와 리스크는 ‘기록’에 남기세요."
            : "허용된 검증 명령을 실행한 뒤 결과를 기록하세요. (명령을 실행하지 않고도 기록으로 이동할 수 있습니다.)"
        }
      : {
          label: "Reuse Hub 로 →",
          to: "/catalog",
          hint: "검증 결과와 catalog 변경 제안(catalog-delta.yaml)을 기록했다면 Reuse Hub 에서 후속 작업을 이어가세요."
        };

  const notice = actionMessage ? (
    <div className="af-stage-notice" role="status">
      <span>{actionMessage}</span>
    </div>
  ) : null;

  return (
    <StageShell
      eyebrow={`검증 · ${reqId}`}
      title="검증"
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      summary={
        <>
          <VerifySummaryItem label="마지막 검증" value={verifyRunState.validationLabel} />
          <VerifySummaryItem label="최근 run" value={verifyRunState.latestRunStatusLabel} />
          <VerifySummaryItem label="실행 명령" value={`${verifyRunState.commandCount}개`} />
          <VerifySummaryItem label="report" value={reportArtifact.data ? "있음" : "없음"} />
          <VerifySummaryItem label="catalog-delta" value={deltaArtifact.data ? "있음" : "없음"} />
        </>
      }
      nextAction={nextAction}
    >
      {notice}

      {activeStep === "run" ? (
        <>
          <StageRunnerPanel
            reqId={reqId}
            {...stageRunnerConfig}
            controls={
              <SelectField
                label="검증 명령"
                value={stageRunnerCommand}
                onChange={(event) => setStageRunnerCommand(event.currentTarget.value)}
              >
                {VERIFY_COMMANDS.map((command) => (
                  <option key={command.key} value={command.key}>
                    {command.label}
                  </option>
                ))}
              </SelectField>
            }
            onApplied={() => {
              setActionMessage("검증 제안 적용 완료");
              setActiveStep("review");
            }}
          />
        </>
      ) : null}

      {activeStep === "review" ? (
        <VerifyReviewStep
          deltaDraft={deltaDraft}
          deltaDirty={deltaDirty}
          deltaExists={Boolean(deltaArtifact.data)}
          isDeltaSaving={saveDelta.isPending}
          isReportSaving={saveReport.isPending}
          onDeltaChange={(value) => {
            setDeltaDraft(value);
            setDeltaDirty(true);
          }}
          onDeltaSave={() =>
            saveDelta.mutate(
              { content: deltaDraft, etag: deltaArtifact.data?.etag ?? null },
              {
                onSuccess: () => {
                  setActionMessage("catalog-delta.yaml 저장 완료");
                  setDeltaDirty(false);
                },
                onError: (error) => setActionMessage(error instanceof Error ? error.message : "catalog-delta 저장 실패")
              }
            )
          }
          onReportChange={(value) => {
            setReportDraft(value);
            setReportDirty(true);
          }}
          onReportSave={() =>
            saveReport.mutate(
              { content: reportDraft, etag: reportArtifact.data?.etag ?? null },
              {
                onSuccess: () => {
                  setActionMessage("validation-report.md 저장 완료");
                  setReportDirty(false);
                },
                onError: (error) => setActionMessage(error instanceof Error ? error.message : "validation-report 저장 실패")
              }
            )
          }
          reportDraft={reportDraft}
          reportDirty={reportDirty}
          reportExists={Boolean(reportArtifact.data)}
        />
      ) : null}
    </StageShell>
  );
}

function VerifySummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
