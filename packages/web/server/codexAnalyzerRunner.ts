export type AnalyzerProgressPhase = "started" | "cli_event" | "diagnostic" | "completed" | "failed" | "timeout";
export type AnalyzerTraceKind =
  | "tool_call"
  | "tool_result"
  | "assistant_message"
  | "reasoning_summary"
  | "lifecycle"
  | "diagnostic";
export type AnalyzerTraceStatus = "running" | "completed" | "failed" | "timeout" | "info";

export interface AnalyzerProgressEvent {
  phase: AnalyzerProgressPhase;
  message: string;
  at: string;
  elapsedMs: number;
  model?: string;
  timeoutMs?: number;
  inputChars?: number;
  promptChars?: number;
  eventCount?: number;
  eventType?: string;
  lastEventType?: string;
  eventTypeCounts?: Record<string, number>;
  traceKind?: AnalyzerTraceKind;
  title?: string;
  snippet?: string;
  snippetFull?: string;
  toolName?: string;
  status?: AnalyzerTraceStatus;
  durationMs?: number;
  rawEventType?: string;
  sequence?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
}

export interface AnalyzerDiagnostics {
  elapsedMs: number;
  eventCount: number;
  lastEventType?: string;
  eventTypeCounts: Record<string, number>;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
}

export interface ProcessRunResult {
  outputText: string;
  stdout: string;
  stderr: string;
  diagnostics: AnalyzerDiagnostics;
}

export interface CodexAnalyzerRunnerInput {
  repoRoot: string;
  model: string;
  prompt: string;
  outputSchema: unknown;
  timeoutMs: number;
  startedAt: number;
  onProgress?: (event: AnalyzerProgressEvent) => void;
}

export interface CodexAnalyzerRunner {
  run(input: CodexAnalyzerRunnerInput): Promise<ProcessRunResult>;
}

export class CodexAnalyzerRuntimeError extends Error {
  readonly analyzerPhase: "failed" | "timeout";
  readonly analyzerDiagnostics: AnalyzerDiagnostics;
  inputChars?: number;
  promptChars?: number;
  timeoutMs?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;

  constructor(
    phase: "failed" | "timeout",
    message: string,
    diagnostics: AnalyzerDiagnostics & { timeoutMs?: number }
  ) {
    super(message);
    this.name = "CodexAnalyzerRuntimeError";
    this.analyzerPhase = phase;
    this.analyzerDiagnostics = {
      elapsedMs: diagnostics.elapsedMs,
      eventCount: diagnostics.eventCount,
      lastEventType: diagnostics.lastEventType,
      eventTypeCounts: diagnostics.eventTypeCounts
    };
    this.timeoutMs = diagnostics.timeoutMs;
    this.lastTraceTitle = diagnostics.lastTraceTitle;
    this.lastTraceSnippet = diagnostics.lastTraceSnippet;
  }
}

export function createAnalyzerError(
  phase: "failed" | "timeout",
  message: string,
  diagnostics: AnalyzerDiagnostics & { timeoutMs?: number }
): CodexAnalyzerRuntimeError {
  return new CodexAnalyzerRuntimeError(phase, message, diagnostics);
}

export function isAnalyzerError(error: unknown): error is CodexAnalyzerRuntimeError {
  return error instanceof CodexAnalyzerRuntimeError;
}

export function progressFromError(error: unknown, model: string): AnalyzerProgressEvent {
  if (isAnalyzerError(error)) {
    return {
      phase: error.analyzerPhase,
      message: error.message,
      at: new Date().toISOString(),
      elapsedMs: error.analyzerDiagnostics.elapsedMs,
      model,
      timeoutMs: error.timeoutMs,
      inputChars: error.inputChars,
      promptChars: error.promptChars,
      eventCount: error.analyzerDiagnostics.eventCount,
      lastEventType: error.analyzerDiagnostics.lastEventType,
      eventTypeCounts: error.analyzerDiagnostics.eventTypeCounts,
      traceKind: "diagnostic",
      title: error.analyzerPhase === "timeout" ? "분석 타임아웃" : "분석 실패",
      snippet: error.lastTraceSnippet,
      status: error.analyzerPhase === "timeout" ? "timeout" : "failed",
      lastTraceTitle: error.lastTraceTitle,
      lastTraceSnippet: error.lastTraceSnippet
    };
  }
  return {
    phase: "failed",
    message: error instanceof Error ? error.message : "Codex SDK 분석을 완료하지 못했습니다.",
    at: new Date().toISOString(),
    elapsedMs: 0,
    model
  };
}

export function summarizeProcessFailure(stdout: string, stderr: string): { message: string; snippet: string } {
  const combined = `${stderr}\n${stdout}`.trim();
  const normalized = combined.replace(/\s+/g, " ");
  const classifications: string[] = [];
  if (/max_output_tokens/i.test(combined)) {
    classifications.push("max_output_tokens");
  }
  if (/context window|ran out of room/i.test(combined)) {
    classifications.push("context_window_exceeded");
  }
  if (/stream disconnected|Incomplete response/i.test(combined)) {
    classifications.push("stream_incomplete");
  }
  if (/turn\.failed/i.test(combined)) {
    classifications.push("turn_failed");
  }
  const prefix = classifications.length ? `[${classifications.join(", ")}] ` : "";
  const tail = normalized.length > 1200 ? normalized.slice(-1200) : normalized;
  return {
    message: `${prefix}${tail || "no process output"}`,
    snippet: tail
  };
}
