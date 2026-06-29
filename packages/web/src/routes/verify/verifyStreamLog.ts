import type { ProcessStreamEvent } from "../../state/useStreamingProcess";

export interface StreamLogEntry {
  readonly id: number;
  readonly text: string;
}

export function formatProcessStreamLogLine(event: ProcessStreamEvent): string {
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
