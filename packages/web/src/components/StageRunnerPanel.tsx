import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { codexAnalyzerModels, type CodexAnalyzerModel } from "../analyzer/types";
import type { StageRunEvent, StageRunRequestBody, StageRunStage, StageRunSummary } from "../state/apiClient";
import {
  useApplyStageRun,
  useCancelStageRun,
  useStageRunDetail,
  useStageRuns,
  useStartStageRun
} from "../state/useStageRunner";
import { Button, Panel, SectionHeader, SelectField } from "../ui/primitives";
import { selectProcessLog, selectStageRunnerNarrative, stageRunCompletionMessage } from "./stageRunnerNarrative";

interface RunnerMetric {
  label: string;
  value: ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
}

interface StageRunnerPanelProps {
  reqId: string;
  stage: StageRunStage;
  skillName: string;
  title: string;
  description: ReactNode;
  headerAction?: ReactNode;
  controls?: ReactNode;
  metrics: RunnerMetric[];
  disabledReason?: string | null;
  currentArtifactEtag?: string | null;
  applyMode?: "proposed" | "none";
  runButtonLabel?: string;
  buildRunBody: (model: CodexAnalyzerModel) => StageRunRequestBody;
  onRunCompleted?: (summary: StageRunSummary) => void;
  onApplied?: () => void;
}

export function StageRunnerPanel({
  reqId,
  stage,
  skillName,
  title,
  description,
  headerAction,
  controls,
  metrics,
  disabledReason,
  currentArtifactEtag,
  applyMode = "proposed",
  runButtonLabel = "Skill Runner 실행",
  buildRunBody,
  onRunCompleted,
  onApplied
}: StageRunnerPanelProps) {
  const [selectedModel, setSelectedModel] = useState<CodexAnalyzerModel>(codexAnalyzerModels[0]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<StageRunEvent[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const processLogRef = useRef<HTMLPreElement | null>(null);
  const runsQuery = useStageRuns(reqId, stage);
  const runs = runsQuery.data ?? [];
  const detailQuery = useStageRunDetail(reqId, stage, selectedRunId);
  const applyMutation = useApplyStageRun(reqId, stage, currentArtifactEtag);
  const cancelMutation = useCancelStageRun(reqId, stage);
  const startMutation = useStartStageRun(reqId, stage, (event) => {
    setLiveEvents((prev) => {
      const next = [...prev, event];
      return next.length > 500 ? next.slice(-500) : next;
    });
  });

  useEffect(() => {
    if (!selectedRunId && runs[0]) {
      setSelectedRunId(runs[0].run_id);
    }
  }, [runs, selectedRunId]);

  const selectedRun = detailQuery.data?.summary ?? runs.find((run) => run.run_id === selectedRunId) ?? null;
  const detail = detailQuery.data;
  const displayedEvents = startMutation.isPending
    ? liveEvents
    : detail?.events ?? (selectedRunId === liveRunId ? liveEvents : []);
  const narrative = useMemo(() => selectStageRunnerNarrative(displayedEvents), [displayedEvents]);
  const processLog = useMemo(() => selectProcessLog(displayedEvents), [displayedEvents]);
  const showNarrative = startMutation.isPending && (narrative.agentMessage || narrative.todoProgress);
  const canRun = !disabledReason && !startMutation.isPending;
  const canApply = Boolean(
    applyMode === "proposed" &&
      detail?.summary.status === "completed" &&
      detail.diff_summary.files.length > 0 &&
      detail.diff_summary.files.every((file) => file.valid)
  );
  const latest = runs[0] ?? null;

  useEffect(() => {
    if (!startMutation.isPending || processLog === null) return;
    const log = processLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [processLog, startMutation.isPending]);

  function handleRun() {
    setActionMessage(null);
    setLiveRunId(null);
    setLiveEvents([]);
    startMutation.mutate(buildRunBody(selectedModel), {
      onSuccess: (summary) => {
        setSelectedRunId(summary.run_id);
        setLiveRunId(summary.run_id);
        setActionMessage(
          summary.status === "failed"
            ? summary.last_error ?? "stage run 실패"
            : stageRunCompletionMessage(stage)
        );
        onRunCompleted?.(summary);
      },
      onError: (error) => {
        setActionMessage(error instanceof Error ? error.message : "stage run 실행 실패");
      }
    });
  }

  function handleApply() {
    if (!selectedRunId) return;
    setActionMessage(null);
    applyMutation.mutate(selectedRunId, {
      onSuccess: (result) => {
        const skipped = result.skipped_artifacts.length
          ? ` · 적용 제외: ${result.skipped_artifacts.map((artifact) => artifact.path).join(", ")}`
          : "";
        setActionMessage(`제안 적용 완료: ${result.applied_artifacts.join(", ")}${skipped}`);
        onApplied?.();
      },
      onError: (error) => {
        setActionMessage(error instanceof Error ? error.message : "제안 적용 실패");
      }
    });
  }

  function handleCancel() {
    setActionMessage(null);
    cancelMutation.mutate(undefined, {
      onSuccess: () => setActionMessage("stage run 취소 요청을 보냈습니다."),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "stage run 취소 실패")
    });
  }

  const statusText = useMemo(() => {
    if (startMutation.isPending) return "running";
    if (selectedRun) return selectedRun.status;
    if (latest) return latest.status;
    return "not_run";
  }, [latest, selectedRun, startMutation.isPending]);

  return (
    <Panel className="af-stage-runner">
      <SectionHeader
        eyebrow={`${skillName} · ${reqId}`}
        title={title}
        description={description}
        action={headerAction}
      />
      <div className="af-runner-status-row">
        <span className={`af-runner-status af-runner-status-${statusText}`}>{statusText}</span>
        <span>latest {latest?.run_id ?? "—"}</span>
        <span>model {selectedModel}</span>
      </div>

      <div className="af-runner-grid">
        <div className="af-runner-main">
          {controls ? <div className="af-runner-controls-extra">{controls}</div> : null}
          <div className="af-runner-controls">
            <SelectField
              label="모델"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value as CodexAnalyzerModel)}
              disabled={startMutation.isPending}
            >
              {codexAnalyzerModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </SelectField>
            <Button type="button" variant="primary" onClick={handleRun} disabled={!canRun}>
              {startMutation.isPending ? "실행 중…" : runButtonLabel}
            </Button>
            {startMutation.isPending ? (
              <Button type="button" variant="ghost" onClick={handleCancel} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? "취소 요청 중…" : "취소"}
              </Button>
            ) : null}
          </div>
          {disabledReason ? <p className="af-runner-readiness-blocked">{disabledReason}</p> : null}
          {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
          {startMutation.isError ? (
            <p className="af-landing-error">{(startMutation.error as Error).message}</p>
          ) : null}
        </div>

        <dl className="af-runner-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={`af-runner-metric af-runner-metric-${metric.tone ?? "default"}`}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {showNarrative ? (
        <section className="af-runner-narrative" aria-label="실행 진행 메모">
          {narrative.agentMessage ? (
            <div className="af-runner-narrative-note">
              <span>진행 메모</span>
              <p>{narrative.agentMessage}</p>
            </div>
          ) : null}
          {narrative.todoProgress ? (
            <div className="af-runner-narrative-todo">
              <strong>
                할 일 {narrative.todoProgress.completedCount}/{narrative.todoProgress.totalCount} 완료
              </strong>
              {narrative.todoProgress.currentItem ? (
                <span>현재: {narrative.todoProgress.currentItem}</span>
              ) : (
                <span>현재: 모든 항목 완료</span>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="af-runner-detail-grid">
        <section className="af-runner-history" aria-label="최근 stage run">
          <h3>최근 run</h3>
          {runs.length === 0 ? <p className="af-design-empty">아직 실행 이력이 없습니다.</p> : null}
          {runs.slice(0, 5).map((run) => (
            <button
              key={run.run_id}
              type="button"
              className={`af-runner-history-button${selectedRunId === run.run_id ? " af-runner-history-button-active" : ""}`}
              onClick={() => setSelectedRunId(run.run_id)}
            >
              <span>{run.run_id}</span>
              <strong className={`af-runner-status-${run.status}`}>{run.status}</strong>
              <small>{formatElapsed(run.elapsed_ms)}</small>
            </button>
          ))}
        </section>

        <section className="af-runner-detail" aria-label="run 상세">
          <div className="af-runner-detail-header">
            <h3>{selectedRun?.run_id ?? "선택된 run 없음"}</h3>
            {applyMode === "proposed" ? (
              <Button type="button" variant="secondary" onClick={handleApply} disabled={!canApply || applyMutation.isPending}>
                {applyMutation.isPending ? "적용 중…" : "제안 적용"}
              </Button>
            ) : null}
          </div>
          {detailQuery.isLoading ? <p className="af-landing-message">run 상세 불러오는 중…</p> : null}
          {detail ? (
            <>
              {detail.summary.catalog_context ? (
                <div className="af-runner-catalog-context">
                  <strong>catalog</strong>
                  <span>
                    {detail.summary.catalog_context.source} · {detail.summary.catalog_context.count} entries
                  </span>
                  {detail.summary.catalog_context.diagnostics.length ? (
                    <small>{detail.summary.catalog_context.diagnostics.join(" ")}</small>
                  ) : null}
                </div>
              ) : null}
              <div className="af-runner-artifacts">
                {detail.diff_summary.files.map((file) => (
                  <article key={file.path} className="af-runner-artifact-row">
                    <div>
                      <strong>{file.path}</strong>
                      <small>
                        {file.status} · {file.valid ? "valid" : "invalid"} · {formatBytes(file.bytes)}
                      </small>
                    </div>
                    <p>{file.before_summary}</p>
                    <p>{file.after_summary}</p>
                    {file.validation_errors.length ? (
                      <ul>
                        {file.validation_errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
              <details className="af-runner-preview">
                <summary>proposed artifact preview</summary>
                {detail.proposed_artifacts.map((artifact) => (
                  <pre key={artifact.path}>{artifact.preview}</pre>
                ))}
              </details>
              {detail.diagnostics ? (
                <details className="af-runner-diagnostics">
                  <summary>diagnostics</summary>
                  <pre>{detail.diagnostics}</pre>
                </details>
              ) : null}
            </>
          ) : (
            <p className="af-design-empty">run 을 선택하면 diff/preview 가 표시됩니다.</p>
          )}
        </section>

        <section className="af-runner-events" aria-label="stage run events">
          <h3>events</h3>
          {displayedEvents.length === 0 ? <p className="af-design-empty">표시할 이벤트가 없습니다.</p> : null}
          <ol>
            {displayedEvents.slice(-12).map((event, index) => (
              <li key={`${event.phase}-${event.at ?? index}-${index}`}>
                <span>{event.phase}</span>
                <strong>{event.title ?? event.message}</strong>
                {typeof event.elapsedMs === "number" ? <small>{event.elapsedMs}ms</small> : null}
                {event.phase === "validation" && event.title && event.message ? (
                  <p className="af-runner-event-message">{event.message}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        {processLog !== null ? (
          <section className="af-runner-process-log" aria-label="실행 로그">
            <h3>실행 로그</h3>
            <pre ref={processLogRef} className="af-stream-log">
              {processLog}
            </pre>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

function formatElapsed(ms: number | null): string {
  if (typeof ms !== "number") return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}
