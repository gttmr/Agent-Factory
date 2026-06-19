import { useState } from "react";
import { fetchAuditLog, smokeToolsCall, smokeToolsList } from "../api/mockLabClient";
import StatusBadge from "./StatusBadge";

export default function SmokeTestPanel({
  mockId,
  canTest,
  blockedReason,
  onMessage
}: {
  mockId: string;
  canTest: boolean;
  blockedReason?: string;
  onMessage: (message: string) => void;
}) {
  const [toolsListResult, setToolsListResult] = useState<unknown>(null);
  const [toolsCallResult, setToolsCallResult] = useState<unknown>(null);
  const [auditResult, setAuditResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function runSmoke(kind: "list" | "call" | "audit") {
    setBusy(true);
    try {
      if (kind === "list") setToolsListResult(await smokeToolsList(mockId));
      if (kind === "call") setToolsCallResult(await smokeToolsCall(mockId));
      if (kind === "audit") setAuditResult(await fetchAuditLog(mockId));
      onMessage(`${kind} smoke 완료`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : `${kind} smoke 실패`);
    } finally {
      setBusy(false);
    }
  }

  async function runSmokeSuite() {
    setBusy(true);
    try {
      const list = await smokeToolsList(mockId);
      setToolsListResult(list);
      const call = await smokeToolsCall(mockId);
      setToolsCallResult(call);
      const audit = await fetchAuditLog(mockId);
      setAuditResult(audit);
      onMessage("Run smoke test 완료");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Run smoke test 실패");
    } finally {
      setBusy(false);
    }
  }

  const listOk = isOk(toolsListResult);
  const callOk = isOk(toolsCallResult);

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Smoke Test / Audit Preview</h2>
          <p>tools/list · tools/call · audit-log</p>
        </div>
        <div className="badge-row">
          <StatusBadge tone={listOk ? "success" : "neutral"}>list</StatusBadge>
          <StatusBadge tone={callOk ? "success" : "neutral"}>call</StatusBadge>
        </div>
      </div>
      <div className="button-row">
        <button className="button primary" type="button" disabled={busy || !canTest} onClick={() => void runSmokeSuite()}>
          Run smoke test
        </button>
        <button className="button secondary" type="button" disabled={busy || !canTest} onClick={() => void runSmoke("list")}>
          tools/list
        </button>
        <button className="button secondary" type="button" disabled={busy || !canTest} onClick={() => void runSmoke("call")}>
          tools/call
        </button>
        <button className="button secondary" type="button" disabled={busy} onClick={() => void runSmoke("audit")}>
          audit-log
        </button>
      </div>
      {blockedReason ? <p className="warning-line">Next action: {blockedReason}</p> : null}
      <div className="result-grid">
        <ResultBlock title="tools/list" value={toolsListResult} />
        <ResultBlock title="tools/call" value={toolsCallResult} />
        <ResultBlock title="audit-log" value={auditResult} />
      </div>
    </div>
  );
}

function ResultBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className={`result-block ${isOk(value) ? "ok" : ""}`}>
      <strong>{title}</strong>
      <details className="details-box">
        <summary>{value ? "Result JSON" : "not run"}</summary>
        <pre>{value ? JSON.stringify(value, null, 2) : "not run"}</pre>
      </details>
    </div>
  );
}

function isOk(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === true);
}
