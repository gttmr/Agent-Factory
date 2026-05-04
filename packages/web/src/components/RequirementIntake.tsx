import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  codexAnalyzerModels,
  type AnalyzerProgressEvent,
  type AnalyzerProgressPhase,
  type AnalyzerTraceKind,
  type AnalyzerTraceStatus,
  type CodexAnalyzerModel,
  type RequirementIntakeInput
} from "../analyzer/types";

interface RequirementIntakeProps {
  input: RequirementIntakeInput;
  onInputChange: (input: RequirementIntakeInput) => void;
  onAnalyze: () => void;
  onLoadExample: () => void;
  onClear: () => void;
  validationMessage: string;
  isAnalyzing: boolean;
  analysisProgress: AnalyzerProgressEvent[];
  analyzerModel: CodexAnalyzerModel;
  onAnalyzerModelChange: (model: CodexAnalyzerModel) => void;
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

export function RequirementIntake({
  input,
  onInputChange,
  onAnalyze,
  onLoadExample,
  onClear,
  validationMessage,
  isAnalyzing,
  analysisProgress,
  analyzerModel,
  onAnalyzerModelChange
}: RequirementIntakeProps) {
  const latestProgress = analysisProgress.length ? analysisProgress[analysisProgress.length - 1] : null;
  const isTerminal = latestProgress ? TERMINAL_PHASES.has(latestProgress.phase) : false;

  const baseTimeRef = useRef<number | null>(null);
  if (analysisProgress.length === 0) {
    baseTimeRef.current = null;
  } else if (baseTimeRef.current === null) {
    const first = analysisProgress[0];
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

  const headerElapsedMs = latestProgress
    ? isTerminal
      ? latestProgress.elapsedMs
      : Math.max(latestProgress.elapsedMs, liveElapsedMs)
    : 0;

  const timeline = useMemo(() => buildTimeline(analysisProgress), [analysisProgress]);
  const visibleTimeline = timeline.slice(-TIMELINE_LIMIT);
  const hiddenCount = Math.max(0, timeline.length - visibleTimeline.length);
  const activeStage = inferPipelineStage(latestProgress, timeline);
  const toolCount = useMemo(() => countTools(timeline), [timeline]);

  function updateField(field: keyof RequirementIntakeInput, value: string) {
    onInputChange({ ...input, [field]: value });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("rawText", String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <div className="two-column">
      <section className="panel intake-panel">
        <div className="section-heading">
          <p className="eyebrow">원천 입력</p>
          <h2>요구사항 접수</h2>
        </div>

        <label>
          <span>제목</span>
          <input
            value={input.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="복잡한 고객 불만 처리 흐름"
          />
        </label>

        <div className="field-grid">
          <label>
            <span>도메인 힌트</span>
            <input
              value={input.domainHint}
              onChange={(event) => updateField("domainHint", event.target.value)}
              placeholder="고객 / 수신 / 여신 / 카드 / 리스크"
            />
          </label>
          <label>
            <span>요청 팀</span>
            <input
              value={input.requesterTeam}
              onChange={(event) => updateField("requesterTeam", event.target.value)}
              placeholder="예시 운영팀"
            />
          </label>
          <label>
            <span>요청자 역할</span>
            <input
              value={input.requesterRole}
              onChange={(event) => updateField("requesterRole", event.target.value)}
              placeholder="업무 사용자"
            />
          </label>
          <label>
            <span>알려진 시스템</span>
            <input
              value={input.knownSystems}
              onChange={(event) => updateField("knownSystems", event.target.value)}
              placeholder="시스템 A, 시스템 B"
            />
          </label>
        </div>

        <label>
          <span>예상 출력</span>
          <input
            value={input.expectedOutput}
            onChange={(event) => updateField("expectedOutput", event.target.value)}
            placeholder="분류, 추천, 응답 초안"
          />
        </label>

        <label>
          <span>분석 모델</span>
          <select
            value={analyzerModel}
            onChange={(event) => onAnalyzerModelChange(event.target.value as CodexAnalyzerModel)}
            disabled={isAnalyzing}
          >
            {codexAnalyzerModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>원문 요구사항</span>
          <textarea
            value={input.rawText}
            onChange={(event) => updateField("rawText", event.target.value)}
            placeholder="이해관계자 요구사항 원문을 붙여넣으세요."
            rows={12}
          />
        </label>

        {validationMessage && <p className="validation">{validationMessage}</p>}

        <div className="actions">
          <button type="button" className="primary" onClick={onAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? "분석 중" : "요구사항 분석"}
          </button>
          <button type="button" onClick={onLoadExample}>
            예시 불러오기
          </button>
          <button type="button" onClick={onClear}>
            초기화
          </button>
        </div>
      </section>

      <aside className="panel side-panel">
        <div className="section-heading">
          <p className="eyebrow">가져오기</p>
          <h2>텍스트 파일</h2>
        </div>
        <input className="file-input" type="file" accept=".txt,.md,.yaml,.yml" onChange={handleUpload} />
        <dl className="metric-list">
          <div>
            <dt>문자 수</dt>
            <dd>{input.rawText.length}</dd>
          </div>
          <div>
            <dt>선택 필드</dt>
            <dd>{countOptionalFields(input)} / 6</dd>
          </div>
        </dl>
        {latestProgress && (
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

            {hiddenCount > 0 && (
              <p className="trace-overflow">최근 {visibleTimeline.length}개 표시 · 이전 {hiddenCount}개 생략</p>
            )}

            <ol className="trace-list">
              {visibleTimeline.map((row) => (
                <li key={row.key} className={`trace-${row.traceKind} status-${row.status}`}>
                  <span className="trace-time">{formatElapsed(row.startElapsedMs)}</span>
                  <div className="trace-body">
                    <div className="trace-row">
                      <strong>{rowLabel(row)}</strong>
                      <span className="trace-meta-right">
                        {row.durationMs !== undefined && (
                          <span className="trace-duration">{formatDuration(row.durationMs)}</span>
                        )}
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
                    <dd>{latestProgress.inputChars ?? input.rawText.length}</dd>
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
        )}
      </aside>
    </div>
  );
}

function countOptionalFields(input: RequirementIntakeInput): number {
  return [
    input.title,
    input.domainHint,
    input.requesterTeam,
    input.requesterRole,
    input.knownSystems,
    input.expectedOutput
  ].filter((value) => value.trim()).length;
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

function inferPipelineStage(
  latest: AnalyzerProgressEvent | null,
  timeline: TimelineRow[]
): PipelineStageId {
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
