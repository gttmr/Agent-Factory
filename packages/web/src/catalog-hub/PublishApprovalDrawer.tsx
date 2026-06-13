import { useEffect, useMemo, useState } from "react";
import { adapterKinds, agentKinds, remoteContractKinds, workflowKinds } from "../analyzer/types";
import type { AdapterKind, AgentKind, RemoteContractKind, WorkflowKind } from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, formatSubtypeLabel } from "../components/CategoryBadge";
import { AfApiError } from "../state/apiClient";
import { useCatalogPublish, type CatalogPublishProposal } from "../state/useCatalogPublish";
import { Button } from "../ui/primitives";
import { parseCatalogDelta, type ProposedAddition } from "./catalogDelta";

interface PublishApprovalDrawerProps {
  reqId: string;
  onClose: () => void;
  onPublished: (message: string) => void;
}

type RowFeedback = { tone: "success" | "error"; message: string };

export function PublishApprovalDrawer({ reqId, onClose, onPublished }: PublishApprovalDrawerProps) {
  const publish = useCatalogPublish();
  const [deltaText, setDeltaText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSubtypes, setSelectedSubtypes] = useState<Record<string, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDeltaText(null);
    setLoadError(null);
    fetch(`/api/af/${encodeURIComponent(reqId)}/catalog-delta.yaml`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 404) {
          setDeltaText("");
          return;
        }
        if (!response.ok) {
          throw new AfApiError(response.status, "catalog-delta 조회 실패");
        }
        setDeltaText(await response.text());
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "catalog-delta 조회 실패");
      });
    return () => {
      cancelled = true;
    };
  }, [reqId]);

  const parsedDelta = useMemo(() => parseCatalogDelta(deltaText ?? ""), [deltaText]);
  const proposals = parsedDelta.proposals;
  const parseError = parsedDelta.error;

  async function handlePublish(proposal: ProposedAddition, rowKey: string) {
    const request = buildPublishProposal(proposal, selectedSubtypes[rowKey] ?? "");
    setPendingKey(rowKey);
    setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "success", message: "등록 승인 요청 중…" } }));
    try {
      const result = await publish.mutateAsync({ reqId, proposal: request });
      const message = `${result.name} v${result.version} 을 ${result.file} 에 등록했습니다.`;
      setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "success", message } }));
      onPublished(message);
    } catch (err) {
      setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "error", message: formatPublishError(err) } }));
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <aside className="af-drawer" role="dialog" aria-modal="true" aria-label="catalog 등록 승인">
      <header className="af-drawer-header">
        <h2>등록 승인</h2>
        <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="af-drawer-body">
        <p className="af-drawer-hint">
          활성 root 의 <code>catalog-delta.yaml</code> 제안을 검토한 뒤 항목별로 승인합니다. 승인된 항목만
          versioned catalog entry 로 등록되며, delta 파일은 변경하지 않습니다.
        </p>
        {loadError ? <p className="af-landing-error">{loadError}</p> : null}
        {deltaText === null && !loadError ? <p className="af-landing-message">catalog-delta 불러오는 중…</p> : null}
        {deltaText !== null && parseError ? (
          <p className="af-landing-error">catalog-delta.yaml 파싱 실패: {parseError}</p>
        ) : null}
        {deltaText !== null && !parseError && proposals.length === 0 ? (
          <p className="af-landing-message">승인할 proposed_additions 항목이 없습니다.</p>
        ) : null}
        {!parseError && proposals.length > 0 ? (
          <ul className="af-publish-list">
            {proposals.map((proposal, index) => {
              const rowKey = `${proposal.module_category}:${proposal.name}:${index}`;
              const subtype = getRequiredSubtype(proposal);
              const selectedSubtype = subtype ?? selectedSubtypes[rowKey] ?? "";
              const needsSubtype = !subtype;
              const feedback = rowFeedback[rowKey];
              const isPending = pendingKey === rowKey && publish.isPending;
              const isPublished = feedback?.tone === "success" && feedback.message !== "등록 승인 요청 중…";
              return (
                <li key={rowKey} className="af-publish-row">
                  <header className="af-publish-row-header">
                    <CategoryBadge category={proposal.module_category} />
                    <strong>{proposal.name}</strong>
                    {proposal.owner_domain ? <span className="af-catalog-owner">{proposal.owner_domain}</span> : null}
                  </header>
                  {proposal.responsibility ? <p className="af-catalog-responsibility">{proposal.responsibility}</p> : null}
                  <div className="af-publish-controls">
                    {needsSubtype ? (
                      <label className="ui-field af-publish-subtype">
                        <span>subtype</span>
                        <select
                          value={selectedSubtype}
                          onChange={(event) =>
                            setSelectedSubtypes((current) => ({ ...current, [rowKey]: event.target.value }))
                          }
                        >
                          <option value="">선택 필요</option>
                          {subtypeOptions(proposal).map((option) => (
                            <option key={option} value={option}>
                              {formatSubtypeLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <SubtypeBadge value={subtype} />
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handlePublish(proposal, rowKey)}
                      disabled={isPending || isPublished || !selectedSubtype}
                    >
                      {isPending ? "등록 중…" : isPublished ? "등록 완료" : "승인 · catalog 등록"}
                    </Button>
                  </div>
                  {feedback ? (
                    <p className={feedback.tone === "error" ? "af-landing-error" : "af-landing-message"}>
                      {feedback.message}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <footer className="af-drawer-footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>
    </aside>
  );
}

function buildPublishProposal(proposal: ProposedAddition, selectedSubtype: string): CatalogPublishProposal {
  const request: CatalogPublishProposal = {
    category: proposal.module_category,
    module_category: proposal.module_category,
    name: proposal.name,
    owner_domain: proposal.owner_domain,
    responsibility: proposal.responsibility,
    inputs: proposal.inputs,
    outputs: proposal.outputs,
    composition: proposal.composition,
    notes: proposal.notes ?? proposal.rationale,
    source_candidate_id: proposal.source_candidate_id
  };
  const subtype = getRequiredSubtype(proposal) ?? selectedSubtype;
  if (proposal.module_category === "agent") request.agent_kind = subtype as AgentKind;
  if (proposal.module_category === "workflow") request.workflow_kind = subtype as WorkflowKind;
  if (proposal.module_category === "adapter") request.adapter_kind = subtype as AdapterKind;
  if (proposal.module_category === "remote_a2a") request.remote_contract_kind = subtype as RemoteContractKind;
  return request;
}

function getRequiredSubtype(proposal: ProposedAddition): string | null {
  if (proposal.module_category === "agent") return proposal.agent_kind ?? null;
  if (proposal.module_category === "workflow") return proposal.workflow_kind ?? null;
  if (proposal.module_category === "adapter") return proposal.adapter_kind ?? null;
  return proposal.remote_contract_kind ?? null;
}

function subtypeOptions(proposal: ProposedAddition): readonly string[] {
  if (proposal.module_category === "agent") return agentKinds;
  if (proposal.module_category === "workflow") return workflowKinds;
  if (proposal.module_category === "adapter") return adapterKinds;
  return remoteContractKinds;
}

function formatPublishError(error: unknown): string {
  if (error instanceof AfApiError) {
    const details = Array.isArray(error.details) ? error.details.filter((item): item is string => typeof item === "string") : [];
    return details.length > 0 ? `${error.message}: ${details.join(" / ")}` : error.message;
  }
  return error instanceof Error ? error.message : "catalog 등록 승인 실패";
}
