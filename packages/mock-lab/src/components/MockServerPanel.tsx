import { fetchServerStatus, startServer, stopServer } from "../api/mockLabClient";
import type { MockServerStatus } from "../types/mockSpec";
import StatusBadge from "./StatusBadge";

export default function MockServerPanel({
  mockId,
  status,
  canRun,
  blockedReason,
  onStatus,
  onMessage
}: {
  mockId: string;
  status: MockServerStatus | null;
  canRun: boolean;
  blockedReason?: string;
  onStatus: (status: MockServerStatus) => void;
  onMessage: (message: string) => void;
}) {
  const isRunning = status?.status === "running";
  const isStarting = status?.status === "starting";
  const canStop = isRunning || isStarting;

  async function run(action: "start" | "stop" | "refresh") {
    try {
      const next =
        action === "start" ? await startServer(mockId) : action === "stop" ? await stopServer(mockId) : await fetchServerStatus(mockId);
      onStatus(next);
      onMessage(`server ${action}: ${next.status}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "server action 실패");
    }
  }

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Run Saved Spec</h2>
          <p>{status?.pid ? `PID ${status.pid}` : "generic stdio runtime"}</p>
        </div>
        <StatusBadge tone={status?.status === "running" ? "success" : status?.status === "failed" ? "error" : "neutral"}>
          {status?.status ?? "unknown"}
        </StatusBadge>
      </div>
      <div className="button-row">
        <button className="button primary" type="button" disabled={!canRun || isRunning || isStarting} onClick={() => void run("start")}>
          Run saved spec
        </button>
        <button className="button secondary" type="button" disabled={!canStop} onClick={() => void run("stop")}>
          Stop
        </button>
        <button className="button secondary" type="button" onClick={() => void run("refresh")}>
          Refresh
        </button>
      </div>
      {blockedReason ? <p className="warning-line">Next action: {blockedReason}</p> : null}
      {status?.last_error ? <p className="error-line">Last error: {status.last_error}</p> : null}
      <details className="details-box">
        <summary>Runtime output</summary>
        <pre className="tail-box">{[...(status?.stdout_tail ?? []), ...(status?.stderr_tail ?? [])].slice(-8).join("\n") || "no process output"}</pre>
      </details>
    </div>
  );
}
