import { useMemo, useState } from "react";
import { parseCatalogDelta, type ProposedAddition } from "../catalog/catalogDelta";
import { buildPublishProposal } from "../catalog/catalogPublishProposal";
import { CategoryBadge } from "../components/CategoryBadge";
import { AfApiError } from "../state/apiClient";
import { useCatalogDelta } from "../state/useCatalogDelta";
import { useCatalogPublish } from "../state/useCatalogPublish";
import { Button } from "../ui/primitives";

interface PublishApprovalDrawerProps {
  reqId: string;
  onClose: () => void;
  onPublished: (message: string) => void;
}

type RowFeedback = { tone: "success" | "error"; message: string };

export function PublishApprovalDrawer({ reqId, onClose, onPublished }: PublishApprovalDrawerProps) {
  const publish = useCatalogPublish();
  const catalogDelta = useCatalogDelta(reqId);
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const deltaText = catalogDelta.data?.content ?? null;
  const loadError = catalogDelta.error
    ? catalogDelta.error instanceof Error ? catalogDelta.error.message : "catalog-delta 조회 실패"
    : null;
  const parsedDelta = useMemo(() => parseCatalogDelta(deltaText ?? ""), [deltaText]);

  async function handlePublish(proposal: ProposedAddition, rowKey: string) {
    setPendingKey(rowKey);
    setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "success", message: "등록 승인 요청 중…" } }));
    try {
      const result = await publish.mutateAsync({ reqId, proposal: buildPublishProposal(proposal) });
      const message = result.already_published
        ? `${result.name} v${result.version} 은 이미 ${result.file} 에 등록되어 있습니다.`
        : `${result.name} v${result.version} 을 ${result.file} 에 등록했습니다.`;
      setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "success", message } }));
      onPublished(message);
    } catch (error) {
      setRowFeedback((current) => ({ ...current, [rowKey]: { tone: "error", message: formatPublishError(error) } }));
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <aside className="af-drawer" role="dialog" aria-modal="true" aria-label="catalog 등록 승인">
      <header className="af-drawer-header">
        <h2>등록 승인</h2>
        <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>×</button>
      </header>
      <div className="af-drawer-body">
        <p className="af-drawer-hint">
          활성 root의 <code>catalog-delta.yaml</code>에서 명시적 asset_id와 Target 계약을 검토한 뒤 항목별로 승인합니다.
        </p>
        {loadError ? <p className="af-landing-error">{loadError}</p> : null}
        {deltaText === null && !loadError ? <p className="af-landing-message">catalog-delta 불러오는 중…</p> : null}
        {deltaText !== null && parsedDelta.error ? <p className="af-landing-error">catalog-delta.yaml 파싱 실패: {parsedDelta.error}</p> : null}
        {deltaText !== null && !parsedDelta.error && parsedDelta.proposals.length === 0 ? (
          <p className="af-landing-message">승인할 Target proposed_additions 항목이 없습니다.</p>
        ) : null}
        {!parsedDelta.error && parsedDelta.proposals.length > 0 ? (
          <ul className="af-publish-list">
            {parsedDelta.proposals.map((proposal, index) => {
              const rowKey = `${proposal.asset_id}:${index}`;
              const feedback = rowFeedback[rowKey];
              const isPending = pendingKey === rowKey && publish.isPending;
              const isPublished = feedback?.tone === "success" && feedback.message !== "등록 승인 요청 중…";
              return (
                <li key={rowKey} className="af-publish-row">
                  <header className="af-publish-row-header">
                    <CategoryBadge category={proposal.asset_type} />
                    <strong>{proposal.name}</strong>
                    <code>{proposal.asset_id}</code>
                    <span className="af-catalog-owner">{proposal.owner}</span>
                  </header>
                  {proposal.responsibility ? <p className="af-catalog-responsibility">{proposal.responsibility}</p> : null}
                  <div className="af-publish-controls">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handlePublish(proposal, rowKey)}
                      disabled={isPending || isPublished}
                    >
                      {isPending ? "등록 중…" : isPublished ? "등록 완료" : "승인 · catalog 등록"}
                    </Button>
                  </div>
                  {feedback ? <p className={feedback.tone === "error" ? "af-landing-error" : "af-landing-message"}>{feedback.message}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <footer className="af-drawer-footer"><Button type="button" variant="ghost" onClick={onClose}>닫기</Button></footer>
    </aside>
  );
}

function formatPublishError(error: unknown): string {
  if (error instanceof AfApiError) {
    const details = Array.isArray(error.details) ? error.details.filter((item): item is string => typeof item === "string") : [];
    return details.length > 0 ? `${error.message}: ${details.join(" / ")}` : error.message;
  }
  return error instanceof Error ? error.message : "catalog 등록 승인 실패";
}
