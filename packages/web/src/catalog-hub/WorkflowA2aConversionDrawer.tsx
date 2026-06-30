import { useEffect, useMemo, useState } from "react";
import type { CatalogHubEntry } from "../catalog/catalogIndex";
import type { ArtifactRootSummary } from "../state/apiClient";
import { useCatalogDelta, useSaveCatalogDelta } from "../state/useCatalogDelta";
import { fetchRuntimeA2aAgentCard, type RuntimeA2aAgentCardResult } from "../state/useRuntimeA2a";
import { Button } from "../ui/primitives";
import {
  appendWorkflowA2aConversionProposal,
  chooseWorkflowA2aProviderReqId,
  getEligibleA2aProviderRoots
} from "./workflowA2aConversionDrawerModel";

interface WorkflowA2aConversionDrawerProps {
  readonly reqId: string;
  readonly entry: CatalogHubEntry;
  readonly roots: readonly ArtifactRootSummary[];
  readonly onClose: () => void;
  readonly onSaved: (message: string) => void;
}

export function WorkflowA2aConversionDrawer({
  reqId,
  entry,
  roots,
  onClose,
  onSaved
}: WorkflowA2aConversionDrawerProps) {
  const catalogDelta = useCatalogDelta(reqId);
  const saveCatalogDelta = useSaveCatalogDelta(reqId);
  const providerRoots = useMemo(() => getEligibleA2aProviderRoots(roots), [roots]);
  const [providerReqId, setProviderReqId] = useState(() => chooseWorkflowA2aProviderReqId(entry, providerRoots));
  const [agentCard, setAgentCard] = useState<RuntimeA2aAgentCardResult | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setProviderReqId((current) => {
      if (current && providerRoots.some((root) => root.requirement_id === current)) return current;
      return chooseWorkflowA2aProviderReqId(entry, providerRoots);
    });
  }, [entry, providerRoots]);

  useEffect(() => {
    if (!providerReqId) {
      setAgentCard(null);
      setCardError(null);
      setCardLoading(false);
      return;
    }

    let cancelled = false;
    setAgentCard(null);
    setCardError(null);
    setCardLoading(true);
    fetchRuntimeA2aAgentCard(providerReqId)
      .then((result) => {
        if (cancelled) return;
        setAgentCard(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCardError(error instanceof Error ? error.message : "Agent Card 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setCardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerReqId]);

  const existing = catalogDelta.data ?? null;
  const loadError = catalogDelta.error
    ? catalogDelta.error instanceof Error
      ? catalogDelta.error.message
      : "catalog-delta 조회 실패"
    : null;
  const saveDisabled =
    !existing || !providerReqId || !agentCard || cardLoading || saveCatalogDelta.isPending || Boolean(loadError);

  async function handleSave() {
    if (!existing || !agentCard || !providerReqId) return;
    setSaveError(null);
    try {
      const next = appendWorkflowA2aConversionProposal({
        existingCatalogDelta: existing.content,
        entry,
        providerReqId,
        agentCard
      });
      await saveCatalogDelta.mutateAsync({ content: next, etag: existing.etag });
      onSaved(`${entry.name} 을 A2A 가능 workflow 제안으로 catalog-delta.yaml 에 추가했습니다.`);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "A2A 전환 제안 저장 실패");
    }
  }

  return (
    <aside className="af-drawer" role="dialog" aria-modal="true" aria-label="Workflow A2A 전환 제안">
      <header className="af-drawer-header">
        <h2>A2A 가능하게 변경</h2>
        <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="af-drawer-body">
        <p className="af-drawer-hint">
          <strong>{entry.name}</strong> workflow 를 직접 catalog seed 로 바꾸지 않고, 활성 root 의{" "}
          <code>catalog-delta.yaml</code> 에 Remote A2A runtime binding 제안으로 추가합니다.
        </p>
        {loadError ? <p className="af-landing-error">{loadError}</p> : null}
        {saveError ? <p className="af-landing-error">{saveError}</p> : null}
        {providerRoots.length === 0 ? (
          <p className="af-landing-error">stub_ready_for_followup 승인된 provider artifact root 가 없습니다.</p>
        ) : (
          <label className="ui-field">
            <span>provider artifact root</span>
            <select value={providerReqId} onChange={(event) => setProviderReqId(event.target.value)}>
              {providerRoots.map((root) => (
                <option key={root.requirement_id} value={root.requirement_id}>
                  {root.requirement_id}
                </option>
              ))}
            </select>
          </label>
        )}

        <dl className="af-catalog-io">
          <div>
            <dt>workflow</dt>
            <dd>{entry.name}</dd>
          </div>
          <div>
            <dt>runtime_binding</dt>
            <dd>remote_a2a</dd>
          </div>
          <div>
            <dt>provider</dt>
            <dd>{providerReqId || "선택 필요"}</dd>
          </div>
        </dl>

        {cardLoading ? <p className="af-landing-message">Agent Card 조회 중…</p> : null}
        {cardError ? <p className="af-landing-error">Agent Card 조회 실패: {cardError}</p> : null}
        {agentCard ? (
          <section className="af-publish-row">
            <header className="af-publish-row-header">
              <strong>Agent Card</strong>
              <span className="af-catalog-owner">{agentCard.app_name}</span>
            </header>
            <dl className="af-catalog-io">
              <div>
                <dt>provider app</dt>
                <dd>{agentCard.card.name || agentCard.app_name}</dd>
              </div>
              <div>
                <dt>Agent Card URL</dt>
                <dd>{agentCard.agent_card_url}</dd>
              </div>
              <div>
                <dt>RPC URL</dt>
                <dd>{agentCard.rpc_url}</dd>
              </div>
            </dl>
            {agentCard.card.description ? (
              <p className="af-catalog-responsibility">{agentCard.card.description}</p>
            ) : null}
          </section>
        ) : null}
      </div>
      <footer className="af-drawer-footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saveDisabled}>
          {saveCatalogDelta.isPending ? "저장 중…" : "catalog-delta 에 제안 저장"}
        </Button>
      </footer>
    </aside>
  );
}
