import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { useRunVerify, VERIFY_COMMANDS, type VerifyRunResult } from "../state/useVerify";
import type { ProcessStreamEvent } from "../state/useStreamingProcess";

interface StreamLogEntry {
  id: number;
  text: string;
}

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
      label: "1. 실행",
      hint: "검증 명령",
      status: ranSomething ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 기록",
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
        <Panel>
          <SectionHeader
            title="검증 명령 실행"
            description="검증 명령은 허용 목록으로만 child_process 로 실행됩니다. catalog/*.yaml 은 직접 편집하지 않습니다."
          />
          <div className="af-verify-grid">
            {VERIFY_COMMANDS.map((command) => (
              <article key={command.key} className="af-verify-card">
                <header>
                  <strong>{command.label}</strong>
                  <code>{command.key}</code>
                </header>
                <p>{command.description}</p>
                <Button
                  type="button"
                  variant="primary"
                  disabled={runVerify.isPending}
                  onClick={() => handleRun(command.key)}
                >
                  {runVerify.isPending && runningCommand === command.key ? "실행 중…" : "실행"}
                </Button>
              </article>
            ))}
          </div>
          {verifyStreamLog.length > 0 ? (
            <div className="af-stream-log-panel">
              <div className="af-stream-log-header">
                <strong>실시간 로그</strong>
                <span>{runVerify.isPending ? "실행 중" : "마지막 실행"}</span>
              </div>
              <pre ref={verifyStreamLogRef} className="af-stream-log">
                {verifyStreamLog.map((entry) => entry.text).join("")}
              </pre>
            </div>
          ) : null}
          {lastRun ? (
            <div className="af-verify-result">
              <p>
                <strong>{lastRun.command_key}</strong> · exit {lastRun.exit_code} · {lastRun.ok ? "통과" : "실패"}
              </p>
              <p>
                <code>{lastRun.command}</code>
              </p>
              {lastRun.stdout ? (
                <details open>
                  <summary>stdout</summary>
                  <pre>{lastRun.stdout}</pre>
                </details>
              ) : null}
              {lastRun.stderr ? (
                <details open>
                  <summary>stderr</summary>
                  <pre>{lastRun.stderr}</pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </Panel>
      ) : null}

      {activeStep === "review" ? (
        <>
          <Panel>
            <SectionHeader
              title="validation-report.md"
              description="검증 명령 결과와 잔존 위험을 markdown 으로 정리합니다."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!reportDirty || saveReport.isPending}
                  onClick={() =>
                    saveReport.mutate(
                      { content: reportDraft, etag: reportArtifact.data?.etag ?? null },
                      {
                        onSuccess: () => {
                          setActionMessage("validation-report.md 저장 완료");
                          setReportDirty(false);
                        },
                        onError: (error) =>
                          setActionMessage(error instanceof Error ? error.message : "validation-report 저장 실패")
                      }
                    )
                  }
                >
                  {saveReport.isPending ? "저장 중…" : "저장"}
                </Button>
              }
            />
            <textarea
              value={reportDraft}
              onChange={(event) => {
                setReportDraft(event.target.value);
                setReportDirty(true);
              }}
              rows={10}
              className="af-markdown-editor"
              placeholder="# Validation report&#10;&#10;- 명령: …&#10;- 결과: …&#10;- 잔존 위험: …"
            />
          </Panel>

          <Panel>
            <SectionHeader
              title="catalog-delta.yaml"
              description="catalog 변경 제안만 기록합니다 (실제 catalog/*.yaml 은 절대 직접 편집하지 않습니다)."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!deltaDirty || saveDelta.isPending}
                  onClick={() =>
                    saveDelta.mutate(
                      { content: deltaDraft, etag: deltaArtifact.data?.etag ?? null },
                      {
                        onSuccess: () => {
                          setActionMessage("catalog-delta.yaml 저장 완료");
                          setDeltaDirty(false);
                        },
                        onError: (error) =>
                          setActionMessage(error instanceof Error ? error.message : "catalog-delta 저장 실패")
                      }
                    )
                  }
                >
                  {saveDelta.isPending ? "저장 중…" : "저장"}
                </Button>
              }
            />
            <textarea
              value={deltaDraft}
              onChange={(event) => {
                setDeltaDraft(event.target.value);
                setDeltaDirty(true);
              }}
              rows={10}
              className="af-markdown-editor af-yaml-editor"
              placeholder={`proposed_additions:\n  - category: adapter\n    name: …\n    rationale: …\n`}
            />
          </Panel>
        </>
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

function formatProcessStreamLogLine(event: ProcessStreamEvent): string {
  const data = event.data;
  if (event.event === "stdout" || event.event === "stderr") {
    return `[${event.event}] ${withTrailingNewline(valueToString(data.chunk))}`;
  }
  if (event.event === "start") {
    return `[start] ${valueToString(data.command ?? data.command_key ?? "process")}\n`;
  }
  if (event.event === "done") {
    return `[done] exit ${valueToString(data.exit_code ?? 0)}\n`;
  }
  if (event.event === "error") {
    return `[error] ${valueToString(data.error ?? data.message ?? "실패")}\n`;
  }
  return `[${event.event}] ${JSON.stringify(data)}\n`;
}

function valueToString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
