import { useState } from "react";
import type { AssetCandidate } from "../../analyzer/types";
import { CandidateCategoryBadge } from "../../components/CategoryBadge";
import { Button, EmptyState, Field } from "../../ui/primitives";
import { statusLabel } from "./designStageModel";

interface AssetSidebarProps {
  assets: AssetCandidate[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function AssetSidebar({ assets, selectedAssetId, onSelectAsset }: AssetSidebarProps) {
  if (!assets.length) return <p className="af-design-empty">Asset 후보가 없습니다.</p>;
  return (
    <ul className="af-asset-list">
      {assets.map((asset) => (
        <li key={asset.asset_id} className={`af-asset-item af-asset-item-${asset.status}${selectedAssetId === asset.asset_id ? " af-asset-item-active" : ""}`}>
          <button type="button" className="af-asset-item-button" onClick={() => onSelectAsset(asset.asset_id)}>
            <span className="af-asset-item-header"><CandidateCategoryBadge candidate={asset} /></span>
            <strong>{asset.name}</strong>
            <small className="af-asset-item-rationale">{asset.rationale}</small>
            <span className="af-asset-item-status">{statusLabel(asset.status)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface AssetReviewDetailProps {
  asset: AssetCandidate | null;
  saving: boolean;
  onResolveMissing: (asset: AssetCandidate, item: string, note: string) => void;
  onApprove: (asset: AssetCandidate) => void;
  onDefer: (asset: AssetCandidate) => void;
  onReject: (asset: AssetCandidate) => void;
}

export function AssetReviewDetail({ asset, saving, onResolveMissing, onApprove, onDefer, onReject }: AssetReviewDetailProps) {
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  if (!asset) return <section className="af-asset-review-detail" aria-label="Asset 검토 상세"><EmptyState title="선택한 Asset 없음" description="왼쪽 목록에서 검토할 Asset을 선택하세요." /></section>;
  const missingItems = asset.missing_information;
  const resolvedItems = asset.resolved_missing_information ?? [];
  const approveDisabled = saving || missingItems.some((item) => !resolvedItems.includes(item));
  return (
    <section className="af-asset-review-detail" aria-label={`${asset.name} Asset 검토`}>
      <header className="af-asset-review-header"><div><div className="af-asset-review-badges"><CandidateCategoryBadge candidate={asset} /></div><h3>{asset.name}</h3></div><span className={`af-asset-review-status af-asset-review-status-${asset.status}`}>{statusLabel(asset.status)}</span></header>
      <div className="af-asset-review-section">
        <h4>Target 분류와 근거</h4><p>{asset.rationale || "근거 설명이 없습니다."}</p>
        <dl className="af-asset-review-meta">
          <div><dt>asset_id</dt><dd>{asset.asset_id}</dd></div>
          <div><dt>asset_type</dt><dd>{asset.asset_type}</dd></div>
          <div><dt>binding</dt><dd>{asset.binding?.kind ?? "미정"}</dd></div>
          <div><dt>risk_level</dt><dd>{asset.risk_level}</dd></div>
          <div><dt>risk_signals</dt><dd>{asset.risk_signals.join(", ") || "없음"}</dd></div>
        </dl>
      </div>
      <div className="af-asset-review-section">
        <h4>누락 항목</h4>
        {missingItems.length ? <ul className="af-asset-review-missing-list">{missingItems.map((item) => (
          <li key={item} className="af-asset-review-missing-item"><span>{item}</span><Field label="해소 메모"><input value={resolutionNotes[item] ?? ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [item]: event.target.value }))} disabled={saving} /></Field><Button type="button" variant="secondary" disabled={saving} onClick={() => { onResolveMissing(asset, item, resolutionNotes[item] ?? ""); setResolutionNotes((current) => ({ ...current, [item]: "" })); }}>해소</Button></li>
        ))}</ul> : <p className="af-asset-review-empty">남은 누락 항목이 없습니다.</p>}
      </div>
      {resolvedItems.length ? <div className="af-asset-review-section"><h4>해소된 항목</h4><ul className="af-asset-review-resolved-list">{resolvedItems.map((item) => <li key={item}><span>{item}</span><small>해소됨</small></li>)}</ul></div> : null}
      <div className="af-action-row af-asset-review-actions">
        <Button type="button" variant="primary" disabled={approveDisabled} onClick={() => onApprove(asset)}>승인</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onDefer(asset)}>보류</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onReject(asset)}>반려</Button>
        {approveDisabled && !saving ? <small>누락 항목을 모두 해소해야 승인할 수 있습니다.</small> : null}
      </div>
    </section>
  );
}
