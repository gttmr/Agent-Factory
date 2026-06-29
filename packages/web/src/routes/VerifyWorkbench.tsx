import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { EmptyState, Panel, SelectField } from "../ui/primitives";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { useRunVerify, VERIFY_COMMANDS, type VerifyRunResult } from "../state/useVerify";
import type { ProcessStreamEvent } from "../state/useStreamingProcess";
import { VerifyReviewStep } from "./verify/VerifyReviewStep";
import { VerifyRunStep } from "./verify/VerifyRunStep";
import { formatProcessStreamLogLine, type StreamLogEntry } from "./verify/verifyStreamLog";

type VerifyStepId = "run" | "review";
const VERIFY_STEP_IDS: VerifyStepId[] = ["run", "review"];

const validationLabel: Record<string, string> = {
  passed: "통과",
  failed: "실패",
  not_run: "미실행"
};

export default function VerifyWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData } = useArtifactRoot(reqId);
  const runVerify = useRunVerify(reqId);

  const reportArtifact = useTextArtifact(reqId, "validation-report.md");
  const saveReport = useSaveTextArtifact(reqId, "validation-report.md");
  const deltaArtifact = useTextArtifact(reqId, "catalog-delta.yaml");
  const saveDelta = useSaveTextArtifact(reqId, "catalog-delta.yaml");

  const [reportDraft, setReportDraft] = useState("");
  const [reportDirty, setReportDirty] = useState(false);
  const [deltaDraft, setDeltaDraft] = useState("");
  const [deltaDirty, setDeltaDirty] = useState(false);
  const [lastRun, setLastRun] = useState<VerifyRunResult | null>(null);
  const [stageRunnerCommand, setStageRunnerCommand] = useState("validate_artifact_root");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [verifyStreamLog, setVerifyStreamLog] = useState<StreamLogEntry[]>([]);
  const verifyStreamLogRef = useRef<HTMLPreElement | null>(null);
  const verifyStreamSeq = useRef(0);

  useEffect(() => {
    if (!reportDirty && reportArtifact.data) setReportDraft(reportArtifact.data.content);
  }, [reportArtifact.data, reportDirty]);
  useEffect(() => {
    if (!deltaDirty && deltaArtifact.data) setDeltaDraft(deltaArtifact.data.content);
  }, [deltaArtifact.data, deltaDirty]);
  useEffect(() => {
    const log = verifyStreamLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [verifyStreamLog]);

  const manifest = manifestData?.manifest;
  const lastResult = manifest?.validation.last_result ?? "not_run";
  const ranSomething = Boolean(lastRun) || lastResult !== "not_run";

  const defaultStep: VerifyStepId = ranSomething ? "review" : "run";
  const [activeStep, setActiveStep] = useStageStep(VERIFY_STEP_IDS, defaultStep);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  function handleRun(commandKey: string) {
    setActionMessage(null);
    setVerifyStreamLog([]);
    runVerify.mutate({
      commandKey,
      streamProgress: true,
      onEvent: appendVerifyStreamEvent
    }, {
      onSuccess: (result) => {
        setLastRun(result);
        setActionMessage(
          result.ok
            ? `${result.command_key} 통과 (exit ${result.exit_code})`
            : `${result.command_key} 실패 (exit ${result.exit_code}) — stderr 확인`
        );
      },
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "실행 실패")
    });
  }

  function appendVerifyStreamEvent(event: ProcessStreamEvent) {
    const text = formatProcessStreamLogLine(event);
    if (!text) return;
    verifyStreamSeq.current += 1;
    setVerifyStreamLog((entries) => [
      ...entries.slice(-199),
      { id: verifyStreamSeq.current, text }
    ]);
  }

  const runningCommand =
    typeof runVerify.variables === "string" ? runVerify.variables : runVerify.variables?.commandKey;

  const steps: StageStep[] = [
    {
      id: "run",
      label: "실행",
      hint: "명령·로그",
      status: ranSomething ? "done" : activeStep === "run" ? "current" : "todo"
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
          hint: ranSomething
            ? "검증을 실행했습니다. ‘2. 기록’에서 결과와 잔존 위험을 validation-report 에 정리하세요."
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
          <VerifySummaryItem label="마지막 검증" value={validationLabel[lastResult] ?? lastResult} />
          <VerifySummaryItem label="실행 명령" value={`${manifest?.validation.commands.length ?? 0}개`} />
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
            stage="verify"
            skillName="verify/run"
            title="Verify Stage Runner"
            description="기존 allowlist 검증 명령을 실행하고 validation-report.md와 catalog-delta.yaml 제안 템플릿을 run 이력에 남깁니다."
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
            metrics={[
              { label: "last", value: validationLabel[lastResult] ?? lastResult, tone: lastResult === "passed" ? "ok" : lastResult === "failed" ? "danger" : "warn" },
              { label: "report", value: reportArtifact.data ? "exists" : "empty", tone: reportArtifact.data ? "ok" : "warn" },
              { label: "catalog-delta", value: deltaArtifact.data ? "exists" : "empty", tone: deltaArtifact.data ? "ok" : "warn" }
            ]}
            currentArtifactEtag={null}
            runButtonLabel="verify 기록 실행"
            buildRunBody={(model) => ({ model, verifyCommand: stageRunnerCommand })}
            onRunCompleted={() => setActiveStep("review")}
            onApplied={() => {
              setActionMessage("검증 제안 적용 완료");
              setActiveStep("review");
            }}
          />
          <VerifyRunStep
            isPending={runVerify.isPending}
            lastRun={lastRun}
            onRun={handleRun}
            runningCommand={runningCommand}
            streamLog={verifyStreamLog}
            streamLogRef={verifyStreamLogRef}
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
