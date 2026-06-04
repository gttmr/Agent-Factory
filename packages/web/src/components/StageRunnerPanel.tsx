import { useEffect, useMemo, useState, type ReactNode } from "react";
import { codexAnalyzerModels, type CodexAnalyzerModel } from "../analyzer/types";
import type { StageRunEvent, StageRunRequestBody, StageRunStage, StageRunSummary } from "../state/apiClient";
import {
  useApplyStageRun,
  useStageRunDetail,
  useStageRuns,
  useStartStageRun
} from "../state/useStageRunner";
import { Button, Panel, SectionHeader, SelectField } from "../ui/primitives";

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
  runButtonLabel = "Skill Runner 실행",
  buildRunBody,
  onRunCompleted,
  onApplied
}: StageRunnerPanelProps) {
  const [selectedModel, setSelectedModel] = useState<CodexAnalyzerModel>(codexAnalyzerModels[0]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<StageRunEvent[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const runsQuery = useStageRuns(reqId, stage);
  const runs = runsQuery.data ?? [];
  const runningRun = runs.find((run) => run.status === "running") ?? null;
  const isServerRunning = Boolean(runningRun);
  const isRunStatePending = runsQuery.isPending;
  const detailQuery = useStageRunDetail(reqId, stage, selectedRunId, {
    refetchInterval: isServerRunning ? 2000 : false
  });
  const applyMutation = useApplyStageRun(reqId, stage, currentArtifactEtag);
  const startMutation = useStartStageRun(reqId, stage, (event) => {
    setLiveEvents((prev) => [...prev, event]);
  });

  useEffect(() => {
    if (runningRun && selectedRunId !== runningRun.run_id) {
      setSelectedRunId(runningRun.run_id);
      return;
    }
    if (!selectedRunId && runs[0]) {
      setSelectedRunId(runs[0].run_id);
    }
  }, [runningRun, runs, selectedRunId]);

  const selectedRun = detailQuery.data?.summary ?? runs.find((run) => run.run_id === selectedRunId) ?? null;
  const detail = detailQuery.data;
  const isRunning = startMutation.isPending || isServerRunning;
  const displayedEvents = startMutation.isPending && liveEvents.length > 0 ? liveEvents : detail?.events ?? [];
  const canRun = !disabledReason && !isRunning && !isRunStatePending;
  const canApply = Boolean(detail?.summary.status === "completed" && detail.diff_summary.files.every((file) => file.valid));
  const latest = runs[0] ?? null;
  const codexMetadata = selectedRun?.codex ?? latest?.codex ?? null;

  function handleRun() {
    setActionMessage(null);
    setLiveEvents([]);
    startMutation.mutate(buildRunBody(selectedModel), {
      onSuccess: (summary) => {
        setSelectedRunId(summary.run_id);
        setActionMessage(
          summary.status === "failed"
            ? summary.last_error ?? "stage run 실패"
            : "run output 이 생성되었습니다. canonical artifact 는 아직 변경되지 않았습니다."
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
        setActionMessage(`제안 적용 완료: ${result.applied_artifacts.join(", ")}`);
        onApplied?.();
      },
      onError: (error) => {
        setActionMessage(error instanceof Error ? error.message : "제안 적용 실패");
      }
    });
  }

  const statusText = useMemo(() => {
    if (isRunning) return "running";
    if (selectedRun) return selectedRun.status;
    if (latest) return latest.status;
    return "not_run";
  }, [isRunning, latest, selectedRun]);

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
        <span>backend {codexMetadata?.backend ?? "—"}</span>
        <span>thread {formatThreadId(codexMetadata?.thread_id)}</span>
        <span>SDK events {typeof codexMetadata?.event_count === "number" ? codexMetadata.event_count : "—"}</span>
      </div>

      <div className="af-runner-grid">
        <div className="af-runner-main">
          {controls ? <div className="af-runner-controls-extra">{controls}</div> : null}
          <div className="af-runner-controls">
            <SelectField
              label="모델"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value as CodexAnalyzerModel)}
              disabled={isRunning || isRunStatePending}
            >
              {codexAnalyzerModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </SelectField>
            <Button type="button" variant="primary" onClick={handleRun} disabled={!canRun}>
              {isRunning ? "실행 중…" : isRunStatePending ? "상태 확인 중…" : runButtonLabel}
            </Button>
          </div>
          {isServerRunning && !startMutation.isPending ? (
            <p className="af-landing-message">실행 중인 run 을 다시 연결했습니다. 완료될 때까지 새 실행은 막힙니다.</p>
          ) : null}
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
            <Button type="button" variant="secondary" onClick={handleApply} disabled={!canApply || applyMutation.isPending}>
              {applyMutation.isPending ? "적용 중…" : "제안 적용"}
            </Button>
          </div>
          {detailQuery.isLoading ? <p className="af-landing-message">run 상세 불러오는 중…</p> : null}
          {detail ? (
            <>
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
                <div className="af-runner-event-body">
                  <strong>{event.title ?? event.message}</strong>
                  {formatEventMeta(event) ? <small>{formatEventMeta(event)}</small> : null}
                  {event.snippet ? <p>{event.snippet}</p> : null}
                </div>
                {typeof event.elapsedMs === "number" ? <small>{event.elapsedMs}ms</small> : null}
              </li>
            ))}
          </ol>
        </section>
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

function formatThreadId(threadId: string | null | undefined): string {
  if (!threadId) return "—";
  return threadId.length > 18 ? `${threadId.slice(0, 10)}…${threadId.slice(-6)}` : threadId;
}

function formatEventMeta(event: StageRunEvent): string {
  return [event.rawEventType, event.itemType, event.status, event.toolName].filter(Boolean).join(" · ");
}
