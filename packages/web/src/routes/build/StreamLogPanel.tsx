import type { RefObject } from "react";
import type { StreamLogEntry } from "./processLog";

interface StreamLogPanelProps {
  readonly entries: readonly StreamLogEntry[];
  readonly isRunning: boolean;
  readonly logRef: RefObject<HTMLPreElement | null>;
}

export function StreamLogPanel({ entries, isRunning, logRef }: StreamLogPanelProps) {
  return (
    <div className="af-stream-log-panel">
      <div className="af-stream-log-header">
        <strong>실시간 로그</strong>
        <span>{isRunning ? "실행 중" : entries.length > 0 ? "마지막 실행" : "대기"}</span>
      </div>
      {entries.length > 0 ? (
        <pre ref={logRef} className="af-stream-log">
          {entries.map((entry) => entry.text).join("")}
        </pre>
      ) : (
        <div className="af-stream-log-empty">
          compound run을 시작하면 artifact sync, runtime-stub 생성, validation 출력이 시간순으로 표시됩니다.
        </div>
      )}
    </div>
  );
}
