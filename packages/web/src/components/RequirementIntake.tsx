import type { ChangeEvent } from "react";
import {
  codexAnalyzerModels,
  type AnalyzerProgressEvent,
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
              <span>{formatElapsed(latestProgress.elapsedMs)}</span>
            </div>
            <p>{latestProgress.lastTraceTitle ?? latestProgress.title ?? latestProgress.message}</p>
            <dl className="progress-metrics">
              <div>
                <dt>현재 단계</dt>
                <dd>{progressPhaseLabel(latestProgress.phase)}</dd>
              </div>
              <div>
                <dt>툴 호출</dt>
                <dd>{countToolCalls(analysisProgress)}</dd>
              </div>
              <div>
                <dt>이벤트</dt>
                <dd>{latestProgress.eventCount ?? 0}</dd>
              </div>
              <div>
                <dt>모델</dt>
                <dd>{latestProgress.model ?? analyzerModel}</dd>
              </div>
            </dl>
            <ol className="trace-list">
              {traceEvents(analysisProgress).map((event, index) => (
                <li
                  key={`${event.phase}-${event.sequence ?? event.elapsedMs}-${event.eventCount ?? index}`}
                  className={`trace-${event.traceKind ?? "diagnostic"}`}
                >
                  <span className="trace-time">{formatElapsed(event.elapsedMs)}</span>
                  <div className="trace-body">
                    <div className="trace-row">
                      <strong>{traceLabel(event)}</strong>
                      <span>{traceStatusLabel(event.status)}</span>
                    </div>
                    {event.snippet && <p>{event.snippet}</p>}
                    {event.snippet && event.snippet.length >= 180 && (
                      <details>
                        <summary>요약 더보기</summary>
                        <p>{event.snippet}</p>
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

function progressPhaseLabel(phase: AnalyzerProgressEvent["phase"]): string {
  switch (phase) {
    case "started":
      return "시작";
    case "cli_event":
      return "진행";
    case "diagnostic":
      return "계측";
    case "completed":
      return "완료";
    case "timeout":
      return "타임아웃";
    case "failed":
      return "실패";
  }
}

function traceEvents(events: AnalyzerProgressEvent[]): AnalyzerProgressEvent[] {
  const traces = events.filter((event) => event.traceKind && event.traceKind !== "lifecycle");
  const lifecycle = events.filter((event) => event.traceKind === "lifecycle").slice(-1);
  const visible = traces.length ? traces : lifecycle;
  return visible.slice(-10);
}

function countToolCalls(events: AnalyzerProgressEvent[]): number {
  return events.filter((event) => event.traceKind === "tool_call").length;
}

function traceLabel(event: AnalyzerProgressEvent): string {
  const label = (() => {
    switch (event.traceKind) {
      case "tool_call":
        return "툴 호출";
      case "tool_result":
        return "툴 결과";
      case "assistant_message":
        return "모델 메모";
      case "reasoning_summary":
        return "Reasoning 요약";
      case "lifecycle":
        return event.phase === "completed" ? "완료" : "내부 단계";
      case "diagnostic":
      default:
        return event.phase === "failed" || event.phase === "timeout" ? progressPhaseLabel(event.phase) : "진단";
    }
  })();
  return event.toolName ? `${label}: ${event.toolName}` : event.title ?? label;
}

function traceStatusLabel(status: AnalyzerProgressEvent["status"]): string {
  switch (status) {
    case "running":
      return "진행 중";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "timeout":
      return "타임아웃";
    case "info":
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
