import type { RefObject } from "react";
import type { StreamLogEntry } from "./processLog";

interface StreamLogPanelProps {
  readonly entries: readonly StreamLogEntry[];
  readonly isRunning: boolean;
  readonly logRef: RefObject<HTMLPreElement | null>;
}

export function StreamLogPanel({ entries, isRunning, logRef }: StreamLogPanelProps) {
  if (entries.length === 0) return null;

  return (
    <div className="af-stream-log-panel">
      <div className="af-stream-log-header">
        <strong>실시간 로그</strong>
        <span>{isRunning ? "실행 중" : "마지막 실행"}</span>
      </div>
      <pre ref={logRef} className="af-stream-log">
        {entries.map((entry) => entry.text).join("")}
      </pre>
    </div>
  );
}
