import { useEffect, useState } from "react";
import { applyRun, cancelRun, generateMock, listRuns, readRun } from "../api/mockLabClient";
import type { MockGenerateStatus, MockGenerateSummary, MockRunDetail } from "../types/mockSpec";
import StatusBadge from "./StatusBadge";

export default function CodexGeneratePanel({
  mockId,
  specValid,
  blockedReason,
  onMessage
}: {
  mockId: string;
  specValid: boolean;
  blockedReason?: string;
  onMessage: (message: string) => void;
}) {
  const [model, setModel] = useState("gpt-5.5");
  const [runs, setRuns] = useState<MockGenerateSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<MockRunDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = runs[0];
  const selectedSummary = runs.find((run) => run.run_id === selectedRunId) ?? latest;
  const activeRun = runs.find((run) => run.status === "running");

  useEffect(() => {
    setRuns([]);
    setSelectedRunId(null);
    setRunDetail(null);
    void refreshRuns();
  }, [mockId]);

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => {
      void refreshRuns(activeRun.run_id);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [mockId, activeRun?.run_id]);

  useEffect(() => {
    if (!selectedSummary) {
      setRunDetail(null);
      return;
    }
    let cancelled = false;
    readRun(mockId, selectedSummary.run_id)
      .then((detail) => {
        if (!cancelled) setRunDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setRunDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mockId, selectedSummary?.run_id, selectedSummary?.status, selectedSummary?.elapsed_ms, selectedSummary?.proposed_files.length]);

  async function refreshRuns(preferredRunId?: string) {
    const nextRuns = await listRuns(mockId);
    setRuns(nextRuns);
    setSelectedRunId((current) => {
      if (preferredRunId && nextRuns.some((run) => run.run_id === preferredRunId)) return preferredRunId;
      if (current && nextRuns.some((run) => run.run_id === current)) return current;
      return nextRuns[0]?.run_id ?? null;
    });
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const summary = await generateMock(mockId, model);
      setSelectedRunId(summary.run_id);
      await refreshRuns(summary.run_id);
      onMessage(`Codex generation 시작: ${summary.run_id}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Codex generation 실패");
      await refreshRuns().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    const run = selectedSummary;
    if (!run?.run_id) return;
    setBusy(true);
    try {
      await applyRun(mockId, run.run_id);
      onMessage("proposed-files apply 완료");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "apply 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!activeRun?.run_id) return;
    setBusy(true);
    try {
      const summary = await cancelRun(mockId, activeRun.run_id);
      setSelectedRunId(summary.run_id);
      await refreshRuns(summary.run_id);
      onMessage(`Codex generation 취소: ${summary.run_id}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "cancel 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Codex Run</h2>
          <p>{activeRun ? `running ${activeRun.run_id}` : "proposed-files only"}</p>
        </div>
        <StatusBadge tone={statusTone(selectedSummary?.status)}>
          {selectedSummary?.status ?? "no run"}
        </StatusBadge>
      </div>
      <label className="field">
        <span>model</span>
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>
      <div className="button-row">
        <button className="button primary" type="button" disabled={!specValid || busy || Boolean(activeRun)} onClick={() => void handleGenerate()}>
          Mock Server 생성
        </button>
        <button className="button secondary" type="button" disabled={!activeRun || busy} onClick={() => void handleCancel()}>
          cancel
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={!selectedSummary || selectedSummary.status !== "completed" || !selectedSummary.validation.ok || busy}
          onClick={() => void handleApply()}
        >
          apply
        </button>
      </div>
      {blockedReason ? <p className="warning-line">{blockedReason}</p> : null}
      {selectedSummary ? (
        <div className="run-detail">
          <div className="meta-grid">
            <span>run</span>
            <strong>{selectedSummary.run_id}</strong>
            <span>pid</span>
            <strong>{selectedSummary.pid ?? "-"}</strong>
            <span>elapsed</span>
            <strong>{formatElapsed(selectedSummary)}</strong>
            <span>files</span>
            <strong>{runDetail?.proposed_files.length ?? selectedSummary.proposed_files.length}</strong>
          </div>
          {selectedSummary.last_error ? <p className="error-line">{selectedSummary.last_error}</p> : null}
          {latestEvent(runDetail) ? <p className="compact-json">latest event: {latestEvent(runDetail)}</p> : null}
          {runDetail?.proposed_files.length ? (
            <div className="file-list">
              {runDetail.proposed_files.slice(0, 6).map((file) => (
                <span key={file.path}>{file.path}</span>
              ))}
            </div>
          ) : null}
          {(runDetail?.stdout || runDetail?.stderr) ? (
            <div className="tail-grid">
              <pre>{tail(runDetail.stdout) || "stdout empty"}</pre>
              <pre>{tail(runDetail.stderr) || "stderr empty"}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="run-list">
        {runs.slice(0, 5).map((run) => (
          <button
            className={`run-row ${run.run_id === selectedSummary?.run_id ? "active" : ""}`}
            key={run.run_id}
            type="button"
            onClick={() => setSelectedRunId(run.run_id)}
          >
            <span>{run.run_id}</span>
            <StatusBadge tone={statusTone(run.status)}>{run.status}</StatusBadge>
          </button>
        ))}
      </div>
    </div>
  );
}

function statusTone(status?: MockGenerateStatus): "success" | "error" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "neutral";
}

function formatElapsed(summary: MockGenerateSummary): string {
  const startedAt = new Date(summary.started_at).getTime();
  const finishedAt = summary.finished_at ? new Date(summary.finished_at).getTime() : Date.now();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return `${summary.elapsed_ms}ms`;
  const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  return `${seconds}s`;
}

function latestEvent(detail: MockRunDetail | null): string | null {
  const event = detail?.events.at(-1);
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const phase = "phase" in event && typeof event.phase === "string" ? event.phase : "event";
  const message = "message" in event && typeof event.message === "string" ? event.message : "";
  return message ? `${phase}: ${message}` : phase;
}

function tail(value: string): string {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-10)
    .map((line) => (line.length > 640 ? `${line.slice(0, 640)} ... [truncated]` : line))
    .join("\n");
}
