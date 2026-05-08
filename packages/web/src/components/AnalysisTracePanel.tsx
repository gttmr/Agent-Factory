import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnalyzerProgressEvent,
  AnalyzerProgressPhase,
  AnalyzerTraceKind,
  AnalyzerTraceStatus,
  CodexAnalyzerModel
} from "../analyzer/types";
import { EmptyState } from "../ui/primitives";

interface AnalysisTracePanelProps {
  events: AnalyzerProgressEvent[];
  analyzerModel: CodexAnalyzerModel;
  inputChars: number;
}

type PipelineStageId = "started" | "cli" | "model" | "completed";
const pipelineStages: Array<{ id: PipelineStageId; label: string }> = [
  { id: "started", label: "시작" },
  { id: "cli", label: "CLI 분석" },
  { id: "model", label: "모델 응답" },
  { id: "completed", label: "완료" }
];

interface TimelineRow {
  key: string;
  traceKind: AnalyzerTraceKind;
  status: AnalyzerTraceStatus;
  toolName?: string;
  title?: string;
  snippet?: string;
  snippetFull?: string;
  startElapsedMs: number;
  durationMs?: number;
  phase: AnalyzerProgressPhase;
}

const TIMELINE_LIMIT = 12;
const TICK_INTERVAL_MS = 1000;
const TERMINAL_PHASES: ReadonlySet<AnalyzerProgressPhase> = new Set(["completed", "failed", "timeout"]);

export function AnalysisTracePanel({ events, analyzerModel, inputChars }: AnalysisTracePanelProps) {
  const latestProgress = events.length ? events[events.length - 1] : null;
  const isTerminal = latestProgress ? TERMINAL_PHASES.has(latestProgress.phase) : false;

  const baseTimeRef = useRef<number | null>(null);
  if (events.length === 0) {
    baseTimeRef.current = null;
  } else if (baseTimeRef.current === null) {
    const first = events[0];
    baseTimeRef.current = Date.now() - (first.elapsedMs ?? 0);
  }

  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  useEffect(() => {
    if (!latestProgress || isTerminal) {
      return;
    }
    const tick = () => {
      const base = baseTimeRef.current;
      if (base !== null) {
        setLiveElapsedMs(Date.now() - base);
      }
    };
    tick();
    const handle = window.setInterval(tick, TICK_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [latestProgress, isTerminal]);

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const visibleTimeline = timeline.slice(-TIMELINE_LIMIT);
  const hiddenCount = Math.max(0, timeline.length - visibleTimeline.length);
  const activeStage = inferPipelineStage(latestProgress, timeline);
  const toolCount = useMemo(() => countTools(timeline), [timeline]);

  if (!latestProgress) {
    return (
      <EmptyState
        title="아직 분석 trace가 없습니다."
        description="요구사항 분석을 실행하면 Codex CLI 호출, 모델 응답, 진단 이벤트가 이 영역에 표시됩니다."
      />
    );
  }

  const headerElapsedMs = isTerminal
    ? latestProgress.elapsedMs
    : Math.max(latestProgress.elapsedMs, liveElapsedMs);

  return (
    <div className={`analysis-progress progress-${latestProgress.phase}`} aria-live="polite">
      <div className="progress-head">
        <strong>분석 진행 Trace</strong>
        <span className={`progress-clock ${isTerminal ? "is-terminal" : "is-live"}`}>
          <span className="clock-dot" aria-hidden="true" />
          {formatElapsed(headerElapsedMs)}
        </span>
      </div>

      <ol className="trace-pipeline" aria-label="분석 단계">
        {pipelineStages.map((stage, index) => {
          const stageState = pipelineStateFor(stage.id, activeStage, latestProgress.phase);
          return (
            <li key={stage.id} className={`stage stage-${stageState}`}>
              <span className="stage-dot" aria-hidden="true">
                {index + 1}
              </span>
              <span className="stage-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      <p className="trace-meta">
        툴 {toolCount} · 이벤트 {latestProgress.eventCount ?? 0} · {latestProgress.model ?? analyzerModel}
      </p>

      {hiddenCount > 0 && <p className="trace-overflow">최근 {visibleTimeline.length}개 표시 · 이전 {hiddenCount}개 생략</p>}

      <ol className="trace-list">
        {visibleTimeline.map((row) => (
          <li key={row.key} className={`trace-${row.traceKind} status-${row.status}`}>
            <span className="trace-time">{formatElapsed(row.startElapsedMs)}</span>
            <div className="trace-body">
              <div className="trace-row">
                <strong>{rowLabel(row)}</strong>
                <span className="trace-meta-right">
                  {row.durationMs !== undefined && <span className="trace-duration">{formatDuration(row.durationMs)}</span>}
                  <span className={`trace-status status-${row.status}`} aria-label={statusAria(row.status)}>
                    {statusGlyph(row.status)}
                  </span>
                </span>
              </div>
              {row.snippet && <p className="trace-snippet">{row.snippet}</p>}
              {hasExpandableSnippet(row) && (
                <details className="trace-snippet-full">
                  <summary>본문 전체 보기</summary>
                  <pre>{row.snippetFull ?? row.snippet}</pre>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>

      {latestProgress.eventTypeCounts && (
        <details className="progress-diagnostics">
          <summary>진단 카운터</summary>
          <dl>
            <div>
              <dt>입력</dt>
              <dd>{latestProgress.inputChars ?? inputChars}</dd>
            </div>
            <div>
              <dt>프롬프트</dt>
              <dd>{latestProgress.promptChars ?? "-"}</dd>
            </div>
            <div>
              <dt>raw event types</dt>
              <dd>{Object.keys(latestProgress.eventTypeCounts).length}</dd>
            </div>
          </dl>
        </details>
      )}
    </div>
  );
}

function buildTimeline(events: AnalyzerProgressEvent[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const openByTool = new Map<string, number[]>();

  events.forEach((event, index) => {
    const traceKind = event.traceKind;
    if (!traceKind || traceKind === "lifecycle") {
      return;
    }

    if (traceKind === "tool_call") {
      const key = `call-${event.sequence ?? `${event.toolName ?? "tool"}-${index}`}`;
      const row: TimelineRow = {
        key,
        traceKind: "tool_call",
        status: event.status ?? "running",
        toolName: event.toolName,
        title: event.title,
        snippet: event.snippet,
        snippetFull: event.snippetFull,
        startElapsedMs: event.elapsedMs,
        phase: event.phase
      };
      const queue = openByTool.get(event.toolName ?? "tool") ?? [];
      queue.push(rows.length);
      openByTool.set(event.toolName ?? "tool", queue);
      rows.push(row);
      return;
    }

    if (traceKind === "tool_result") {
      const tool = event.toolName ?? "tool";
      const queue = openByTool.get(tool);
      const matchIdx = queue && queue.length > 0 ? queue.shift() : undefined;
      if (matchIdx !== undefined) {
        const target = rows[matchIdx];
        target.status = event.status ?? "completed";
        target.snippet = event.snippet ?? target.snippet;
        target.snippetFull = event.snippetFull ?? target.snippetFull;
        target.durationMs = Math.max(0, event.elapsedMs - target.startElapsedMs);
        target.title = event.title ?? target.title;
        return;
      }
      rows.push({
        key: `result-${event.sequence ?? index}`,
        traceKind: "tool_result",
        status: event.status ?? "completed",
        toolName: event.toolName,
        title: event.title,
        snippet: event.snippet,
        snippetFull: event.snippetFull,
        startElapsedMs: event.elapsedMs,
        phase: event.phase
      });
      return;
    }

    rows.push({
      key: `${traceKind}-${event.sequence ?? index}`,
      traceKind,
      status: event.status ?? "info",
      toolName: event.toolName,
      title: event.title,
      snippet: event.snippet,
      snippetFull: event.snippetFull,
      startElapsedMs: event.elapsedMs,
      phase: event.phase
    });
  });

  return rows;
}

function countTools(rows: TimelineRow[]): number {
  return rows.filter((row) => row.traceKind === "tool_call" || row.traceKind === "tool_result").length;
}

function inferPipelineStage(latest: AnalyzerProgressEvent | null, timeline: TimelineRow[]): PipelineStageId {
  if (!latest) return "started";
  if (latest.phase === "completed") return "completed";
  if (latest.phase === "failed" || latest.phase === "timeout") return "completed";
  if (latest.phase === "started") return "started";

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const kind = timeline[i].traceKind;
    if (kind === "assistant_message" || kind === "reasoning_summary") {
      return "model";
    }
    if (kind === "tool_call" || kind === "tool_result") {
      return "cli";
    }
  }
  return "cli";
}

function pipelineStateFor(
  stage: PipelineStageId,
  active: PipelineStageId,
  phase: AnalyzerProgressPhase
): "done" | "active" | "pending" {
  const order: PipelineStageId[] = ["started", "cli", "model", "completed"];
  const stageIdx = order.indexOf(stage);
  const activeIdx = order.indexOf(active);
  if (stage === "completed") {
    if (phase === "completed") return "done";
    if (phase === "failed" || phase === "timeout") return "active";
    return "pending";
  }
  if (stageIdx < activeIdx) return "done";
  if (stageIdx === activeIdx) return phase === "completed" ? "done" : "active";
  return "pending";
}

function rowLabel(row: TimelineRow): string {
  const base = (() => {
    switch (row.traceKind) {
      case "tool_call":
      case "tool_result":
        return "툴";
      case "assistant_message":
        return "모델 메모";
      case "reasoning_summary":
        return "Reasoning 요약";
      case "diagnostic":
        return row.phase === "failed" ? "실패" : row.phase === "timeout" ? "타임아웃" : "진단";
      default:
        return row.title ?? "이벤트";
    }
  })();
  if (row.toolName && (row.traceKind === "tool_call" || row.traceKind === "tool_result")) {
    return `${base} · ${row.toolName}`;
  }
  return row.title ? `${base}: ${row.title}` : base;
}

function hasExpandableSnippet(row: TimelineRow): boolean {
  const full = row.snippetFull;
  const snippet = row.snippet;
  if (full && full.length > (snippet?.length ?? 0)) return true;
  if (snippet && snippet.length >= 180) return true;
  return false;
}

function statusGlyph(status: AnalyzerTraceStatus): string {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✕";
    case "timeout":
      return "⌛";
    case "running":
      return "●";
    case "info":
    default:
      return "•";
  }
}

function statusAria(status: AnalyzerTraceStatus): string {
  switch (status) {
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "timeout":
      return "타임아웃";
    case "running":
      return "진행 중";
    default:
      return "기록";
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}분 ${remainingSeconds}초` : `${minutes}분`;
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = ms / 1_000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}
