import { useEffect, useRef, useState } from "react";
import type { ProcessStreamEvent } from "../../state/useStreamingProcess";

export type BuildProcessLogOwner = "artifact-sync" | "runtime-stub";

export interface StreamLogEntry {
  readonly id: number;
  readonly text: string;
}

export function useBuildProcessLog() {
  const [entries, setEntries] = useState<readonly StreamLogEntry[]>([]);
  const [owner, setOwner] = useState<BuildProcessLogOwner | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries]);

  function reset(nextOwner: BuildProcessLogOwner) {
    setOwner(nextOwner);
    setEntries([]);
  }

  function append(event: ProcessStreamEvent) {
    const text = formatProcessStreamLogLine(event);
    if (!text) return;
    sequence.current += 1;
    setEntries((current) => [
      ...current.slice(-199),
      { id: sequence.current, text }
    ]);
  }

  return { append, entries, logRef, owner, reset };
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
