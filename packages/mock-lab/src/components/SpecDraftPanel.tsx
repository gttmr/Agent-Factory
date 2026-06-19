import { useEffect, useState } from "react";
import { cancelDraft, draftMockSpec, listDrafts, readDraft } from "../api/mockLabClient";
import type { MockDraftDetail, MockDraftStatus, MockDraftSummary, MockSpec } from "../types/mockSpec";
import StatusBadge from "./StatusBadge";

export default function SpecDraftPanel({
  mockId,
  onUseDraft,
  onMessage
}: {
  mockId: string;
  onUseDraft: (spec: MockSpec) => void;
  onMessage: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-5.5");
  const [drafts, setDrafts] = useState<MockDraftSummary[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [draftDetail, setDraftDetail] = useState<MockDraftDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = drafts[0];
  const selectedSummary = drafts.find((draft) => draft.draft_id === selectedDraftId) ?? latest;
  const activeDraft = drafts.find((draft) => draft.status === "running");
  const canUseDraft = Boolean(draftDetail?.draft_spec && selectedSummary?.status === "completed" && selectedSummary.validation.ok);

  useEffect(() => {
    setDrafts([]);
    setSelectedDraftId(null);
    setDraftDetail(null);
    void refreshDrafts();
  }, [mockId]);

  useEffect(() => {
    if (!activeDraft) return;
    const timer = window.setInterval(() => {
      void refreshDrafts(activeDraft.draft_id);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [mockId, activeDraft?.draft_id]);

  useEffect(() => {
    if (!selectedSummary) {
      setDraftDetail(null);
      return;
    }
    let cancelled = false;
    readDraft(mockId, selectedSummary.draft_id)
      .then((detail) => {
        if (!cancelled) setDraftDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setDraftDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mockId, selectedSummary?.draft_id, selectedSummary?.status, selectedSummary?.elapsed_ms]);

  async function refreshDrafts(preferredDraftId?: string) {
    const nextDrafts = await listDrafts(mockId);
    setDrafts(nextDrafts);
    setSelectedDraftId((current) => {
      if (preferredDraftId && nextDrafts.some((draft) => draft.draft_id === preferredDraftId)) return preferredDraftId;
      if (current && nextDrafts.some((draft) => draft.draft_id === current)) return current;
      return nextDrafts[0]?.draft_id ?? null;
    });
  }

  async function handleDraft() {
    setBusy(true);
    try {
      const summary = await draftMockSpec(mockId, prompt, model);
      setSelectedDraftId(summary.draft_id);
      await refreshDrafts(summary.draft_id);
      onMessage(`Draft spec 시작: ${summary.draft_id}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Draft spec 실패");
      await refreshDrafts().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!activeDraft?.draft_id) return;
    setBusy(true);
    try {
      const summary = await cancelDraft(mockId, activeDraft.draft_id);
      setSelectedDraftId(summary.draft_id);
      await refreshDrafts(summary.draft_id);
      onMessage(`Draft spec 취소: ${summary.draft_id}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Draft cancel 실패");
    } finally {
      setBusy(false);
    }
  }

  function handleUseDraft() {
    if (!draftDetail?.draft_spec) return;
    onUseDraft(draftDetail.draft_spec);
    onMessage("Draft를 editor에 불러왔습니다. 저장 전 상태입니다.");
  }

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Draft Spec with Codex</h2>
          <p>{activeDraft ? `running ${activeDraft.draft_id}` : "prompt to MockSpec draft"}</p>
        </div>
        <StatusBadge tone={statusTone(selectedSummary?.status)}>
          {selectedSummary?.status ?? "no draft"}
        </StatusBadge>
      </div>

      <label className="field">
        <span>prompt</span>
        <textarea
          className="prompt-box"
          value={prompt}
          rows={5}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the MCP mock server, tools, inputs, responses, and error scenarios."
        />
      </label>
      <label className="field">
        <span>model</span>
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <div className="button-row">
        <button className="button primary" type="button" disabled={!prompt.trim() || busy || Boolean(activeDraft)} onClick={() => void handleDraft()}>
          Draft spec
        </button>
        <button className="button secondary" type="button" disabled={!activeDraft || busy} onClick={() => void handleCancel()}>
          Cancel draft
        </button>
        <button className="button secondary" type="button" disabled={!canUseDraft || busy} onClick={handleUseDraft}>
          Use draft in editor
        </button>
      </div>

      {selectedSummary?.last_error ? <p className="error-line">Next action: revise the prompt or inspect raw output. {selectedSummary.last_error}</p> : null}
      {selectedSummary && !selectedSummary.validation.ok && selectedSummary.validation.errors.length ? (
        <div className="validation-list compact">
          {selectedSummary.validation.errors.slice(0, 3).map((error) => (
            <p className="error-line" key={error}>
              {error}
            </p>
          ))}
        </div>
      ) : null}

      {selectedSummary ? (
        <div className="run-detail">
          <div className="meta-grid">
            <span>draft</span>
            <strong>{selectedSummary.draft_id}</strong>
            <span>pid</span>
            <strong>{selectedSummary.pid ?? "-"}</strong>
            <span>elapsed</span>
            <strong>{formatElapsed(selectedSummary)}</strong>
            <span>valid</span>
            <strong>{selectedSummary.validation.ok ? "yes" : "no"}</strong>
          </div>
          {latestEvent(draftDetail) ? <p className="compact-json">latest event: {latestEvent(draftDetail)}</p> : null}
          {draftDetail?.draft_spec ? (
            <details className="details-box">
              <summary>Draft JSON preview</summary>
              <pre>{JSON.stringify(draftDetail.draft_spec, null, 2)}</pre>
            </details>
          ) : null}
          {(draftDetail?.stdout || draftDetail?.stderr) ? (
            <details className="details-box">
              <summary>Raw Codex output</summary>
              <div className="tail-grid">
                <pre>{tail(draftDetail.stdout) || "stdout empty"}</pre>
                <pre>{tail(draftDetail.stderr) || "stderr empty"}</pre>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="run-list">
        {drafts.slice(0, 5).map((draft) => (
          <button
            className={`run-row ${draft.draft_id === selectedSummary?.draft_id ? "active" : ""}`}
            key={draft.draft_id}
            type="button"
            onClick={() => setSelectedDraftId(draft.draft_id)}
          >
            <span>{draft.draft_id}</span>
            <StatusBadge tone={statusTone(draft.status)}>{draft.status}</StatusBadge>
          </button>
        ))}
      </div>
    </div>
  );
}

function statusTone(status?: MockDraftStatus): "success" | "error" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "neutral";
}

function formatElapsed(summary: MockDraftSummary): string {
  const startedAt = new Date(summary.started_at).getTime();
  const finishedAt = summary.finished_at ? new Date(summary.finished_at).getTime() : Date.now();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return `${summary.elapsed_ms}ms`;
  const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  return `${seconds}s`;
}

function latestEvent(detail: MockDraftDetail | null): string | null {
  const event = detail?.events[detail.events.length - 1];
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
