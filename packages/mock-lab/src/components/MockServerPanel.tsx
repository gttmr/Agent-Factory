import { fetchServerStatus, startServer, stopServer } from "../api/mockLabClient";
import type { MockServerStatus } from "../types/mockSpec";
import StatusBadge from "./StatusBadge";

export default function MockServerPanel({
  mockId,
  status,
  onStatus,
  onMessage
}: {
  mockId: string;
  status: MockServerStatus | null;
  onStatus: (status: MockServerStatus) => void;
  onMessage: (message: string) => void;
}) {
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
          <h2>Server Control</h2>
          <p>{status?.pid ? `PID ${status.pid}` : "local stdio"}</p>
        </div>
        <StatusBadge tone={status?.status === "running" ? "success" : status?.status === "failed" ? "error" : "neutral"}>
          {status?.status ?? "unknown"}
        </StatusBadge>
      </div>
      <div className="button-row">
        <button className="button primary" type="button" onClick={() => void run("start")}>
          start
        </button>
        <button className="button secondary" type="button" onClick={() => void run("stop")}>
          stop
        </button>
        <button className="button secondary" type="button" onClick={() => void run("refresh")}>
          status
        </button>
      </div>
      <pre className="tail-box">{[...(status?.stdout_tail ?? []), ...(status?.stderr_tail ?? [])].slice(-8).join("\n") || "no process output"}</pre>
    </div>
  );
}
