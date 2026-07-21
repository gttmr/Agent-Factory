import { useState } from "react";
import { appendCatalogDeltaProposal } from "../catalog/catalogDelta";
import type { DomainScope } from "../analyzer/types";
import { useCatalogDelta, useSaveCatalogDelta } from "../state/useCatalogDelta";
import { Button } from "../ui/primitives";

interface RegisterProposalDrawerProps {
  reqId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const CATEGORY_OPTIONS = ["agent", "workflow", "tool"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_OPTIONS)[number], string> = {
  agent: "Agent",
  workflow: "Workflow",
  tool: "Tool"
};

export function RegisterProposalDrawer({ reqId, onClose, onSaved }: RegisterProposalDrawerProps) {
  const catalogDelta = useCatalogDelta(reqId);
  const saveCatalogDelta = useSaveCatalogDelta(reqId);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("tool");
  const [assetId, setAssetId] = useState("");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [domainScope, setDomainScope] = useState<DomainScope>("domain_neutral");
  const [businessDomains, setBusinessDomains] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [rationale, setRationale] = useState("");
  const existing = catalogDelta.data ?? null;
  const loadError = catalogDelta.error
    ? catalogDelta.error instanceof Error
      ? catalogDelta.error.message
      : "catalog-delta 조회 실패"
    : null;
  const isPending = saveCatalogDelta.isPending;

  async function handleSave() {
    if (!assetId.trim()) {
      setError("asset_id 는 필수입니다.");
      return;
    }
    if (!name.trim()) {
      setError("name 은 필수입니다.");
      return;
    }
    if (!owner.trim()) {
      setError("owner 는 필수입니다.");
      return;
    }
    const domainValues = businessDomains
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (domainScope !== "domain_neutral" && domainValues.length === 0) {
      setError(`${domainScope} 자산에는 business domains가 하나 이상 필요합니다.`);
      return;
    }
    if (!existing) return;
    setError(null);
    try {
      const proposal = {
        asset_id: assetId.trim(),
        asset_type: category,
        domain_scope: domainScope,
        business_domains: domainScope === "domain_neutral" ? [] : domainValues,
        owner: owner.trim(),
        reuse_status: "publish_candidate",
        capability_tags: [],
        binding: category === "tool" ? { kind: "unresolved" } : null,
        connection: category === "tool" ? { transport: "unknown" } : null,
        workflow_profile:
          category === "workflow"
            ? { representation: "unresolved", coordination: "explicit", template_ref: null }
            : null,
        exposure: null,
        name: name.trim(),
        ...(responsibility.trim() ? { responsibility: responsibility.trim() } : {}),
        ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
        proposed_by: "reuse_hub",
        proposed_at: new Date().toISOString()
      };
      const next = appendCatalogDeltaProposal(existing.content, proposal);
      await saveCatalogDelta.mutateAsync({ content: next, etag: existing.etag });
      onSaved(`${name.trim()} 을 catalog-delta.yaml 에 제안으로 추가했습니다.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "catalog-delta 저장 실패");
    }
  }

  return (
    <aside className="af-drawer" role="dialog" aria-modal="true" aria-label="신규 catalog 등록 제안">
      <header className="af-drawer-header">
        <h2>신규 catalog 등록 제안</h2>
        <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="af-drawer-body">
        <p className="af-drawer-hint">
          catalog/*.yaml 은 직접 편집하지 않습니다. 이 제안은 활성 root 의 <code>catalog-delta.yaml</code> 에만 기록되며,
          이후 Reuse Hub 의 등록 승인 흐름에서 검토자가 versioned catalog entry 로 publish 합니다.
        </p>
        {error || loadError ? <p className="af-landing-error">{error ?? loadError}</p> : null}
        <label className="ui-field">
          <span>asset type</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {CATEGORY_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>asset_id</span>
          <input type="text" value={assetId} onChange={(event) => setAssetId(event.target.value)} placeholder="예: agent.loan.document-review" />
        </label>
        <label className="ui-field">
          <span>display name</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 여신 문서 검토 Agent" />
        </label>
        <label className="ui-field">
          <span>owner</span>
          <input type="text" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="예: 여신AI팀" />
        </label>
        <label className="ui-field">
          <span>domain scope</span>
          <select value={domainScope} onChange={(event) => setDomainScope(event.target.value as DomainScope)}>
            <option value="domain_neutral">domain_neutral</option>
            <option value="domain_specific">domain_specific</option>
            <option value="cross_domain">cross_domain</option>
          </select>
        </label>
        <label className="ui-field">
          <span>business domains (쉼표로 구분)</span>
          <input
            type="text"
            value={businessDomains}
            onChange={(event) => setBusinessDomains(event.target.value)}
            placeholder={domainScope === "domain_neutral" ? "domain_neutral에서는 비워 둡니다" : "예: 여신, 리스크"}
            disabled={domainScope === "domain_neutral"}
          />
        </label>
        <label className="ui-field">
          <span>responsibility</span>
          <textarea value={responsibility} onChange={(event) => setResponsibility(event.target.value)} rows={3} />
        </label>
        <label className="ui-field">
          <span>rationale (왜 등록이 필요한가)</span>
          <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} />
        </label>
      </div>
      <footer className="af-drawer-footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={isPending || !existing}>
          {isPending ? "저장 중…" : "catalog-delta 에 추가"}
        </Button>
      </footer>
    </aside>
  );
}
