import type { ThreadEvent, ThreadItem } from "@openai/codex-sdk";
import type { AnalyzerProgressEvent } from "./codexAnalyzerRunner";

export function mapSdkAnalyzerEvent(
  event: ThreadEvent,
  ctx: {
    model: string;
    timeoutMs: number;
    startedAt: number;
    eventCount: number;
    lastEventType: string;
    eventTypeCounts: Record<string, number>;
  }
): AnalyzerProgressEvent {
  const base = {
    phase: "cli_event" as const,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - ctx.startedAt,
    model: ctx.model,
    timeoutMs: ctx.timeoutMs,
    eventCount: ctx.eventCount,
    eventType: event.type,
    lastEventType: ctx.lastEventType,
    eventTypeCounts: { ...ctx.eventTypeCounts },
    rawEventType: event.type,
    sequence: ctx.eventCount
  };
  switch (event.type) {
    case "thread.started":
      return {
        ...base,
        message: "Codex SDK thread 를 시작했습니다.",
        traceKind: "lifecycle",
        title: "Thread 시작",
        snippet: event.thread_id,
        status: "running"
      };
    case "turn.started":
      return {
        ...base,
        message: "분석 턴을 시작했습니다.",
        traceKind: "lifecycle",
        title: "Turn 시작",
        status: "running"
      };
    case "turn.completed":
      return {
        ...base,
        message: "분석 턴이 완료되었습니다.",
        traceKind: "diagnostic",
        title: "Turn 완료",
        snippet: `input ${event.usage.input_tokens} · output ${event.usage.output_tokens}`,
        status: "completed"
      };
    case "turn.failed":
      return {
        ...base,
        message: event.error.message,
        traceKind: "diagnostic",
        title: "Turn 실패",
        snippet: event.error.message,
        status: "failed"
      };
    case "error":
      return {
        ...base,
        message: event.message,
        traceKind: "diagnostic",
        title: "SDK 오류",
        snippet: event.message,
        status: "failed"
      };
    case "item.started":
    case "item.updated":
    case "item.completed":
      return mapSdkAnalyzerItemEvent(base, event.item);
  }
}

export function stringifyRedacted(value: unknown): string {
  return JSON.stringify(redactSecrets(value)) ?? "null";
}

function mapSdkAnalyzerItemEvent(
  base: Omit<AnalyzerProgressEvent, "message"> & { message?: string },
  item: ThreadItem
): AnalyzerProgressEvent {
  switch (item.type) {
    case "command_execution": {
      const output = [item.command, item.aggregated_output].filter(Boolean).join("\n");
      return {
        ...base,
        message: `명령 실행 ${item.status}`,
        traceKind: "tool_call",
        title: "Command",
        snippet: summarizeText(output),
        snippetFull: summarizeFull(output),
        toolName: "command",
        status: item.status === "failed" ? "failed" : item.status === "completed" ? "completed" : "running"
      };
    }
    case "mcp_tool_call": {
      const previewSource = item.error?.message ?? stringifyRedacted(item.arguments);
      const fullSource = item.error?.message ?? stringifyRedacted(item.result ?? item.arguments);
      return {
        ...base,
        message: `MCP tool ${item.server}.${item.tool} ${item.status}`,
        traceKind: "tool_call",
        title: "MCP tool",
        snippet: summarizeText(previewSource),
        snippetFull: summarizeFull(fullSource),
        toolName: `${item.server}.${item.tool}`,
        status: item.status === "failed" ? "failed" : item.status === "completed" ? "completed" : "running"
      };
    }
    case "agent_message":
      return {
        ...base,
        message: "모델 메시지를 수신했습니다.",
        traceKind: "assistant_message",
        title: "모델 메시지",
        snippet: summarizeText(item.text),
        snippetFull: summarizeFull(item.text),
        status: "completed"
      };
    case "reasoning":
      return {
        ...base,
        message: "Reasoning 요약을 수신했습니다.",
        traceKind: "reasoning_summary",
        title: "Reasoning 요약",
        snippet: summarizeText(item.text),
        snippetFull: summarizeFull(item.text),
        status: "info"
      };
    case "file_change":
      return {
        ...base,
        message: `파일 변경 ${item.status}`,
        traceKind: "tool_result",
        title: "File change",
        snippet: item.changes.map((change) => `${change.kind} ${change.path}`).join(", "),
        status: item.status === "failed" ? "failed" : "completed"
      };
    case "web_search":
      return {
        ...base,
        message: "Web search 이벤트를 수신했습니다.",
        traceKind: "tool_call",
        title: "Web search",
        snippet: item.query,
        toolName: "web_search",
        status: "completed"
      };
    case "todo_list":
      return {
        ...base,
        message: "Todo list 이벤트를 수신했습니다.",
        traceKind: "diagnostic",
        title: "Todo",
        snippet: item.items.map((todo) => `${todo.completed ? "done" : "todo"} ${todo.text}`).join("\n"),
        status: "info"
      };
    case "error":
      return {
        ...base,
        message: item.message,
        traceKind: "diagnostic",
        title: "Item 오류",
        snippet: item.message,
        status: "failed"
      };
  }
}

function summarizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 360);
}

function summarizeFull(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4000) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4000)}\n...(${trimmed.length - 4000} more chars truncated)`;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (/token|secret|password|credential|authorization|api[_-]?key|private[_-]?key/i.test(key)) {
        result[key] = "[redacted]";
      } else {
        result[key] = redactSecrets(raw);
      }
    }
    return result;
  }
  if (typeof value === "string") {
    return value
      .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
      .replace(/(api[_-]?key[\"':=\s]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
      .replace(/(token[\"':=\s]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
