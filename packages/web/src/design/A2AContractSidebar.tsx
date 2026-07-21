import { useMemo } from "react";
import type { A2AContract, AssetCandidate } from "../analyzer/types";
import { buildA2AReviewRows } from "./A2AContractPanelModel";

interface A2AContractSidebarProps {
  assets: AssetCandidate[];
  contracts: A2AContract[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
}

export function A2AContractSidebar({ assets, contracts, selectedAssetId, onSelect }: A2AContractSidebarProps) {
  const rows = useMemo(() => buildA2AReviewRows(assets, contracts), [assets, contracts]);
  if (!rows.length) {
    return (
      <p className="af-design-empty">
        A2A binding 또는 exposure를 가진 Agent asset이 없습니다.
      </p>
    );
  }
  return (
    <table className="af-a2a-table">
      <thead>
        <tr>
          <th>Agent asset</th>
          <th>contract</th>
          <th>ready</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ candidate, contract, issues }) => {
          const active = selectedAssetId === candidate.asset_id;
          return (
            <tr key={candidate.asset_id} className={active ? "af-a2a-row-active" : ""}>
              <td>
                <button type="button" className="af-a2a-row-button" onClick={() => onSelect(candidate.asset_id)}>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.asset_id}</small>
                </button>
              </td>
              <td>
                <code>{contract?.contract_id ?? "missing"}</code>
                <small>{contract?.contract_status ?? "needs_info"}</small>
              </td>
              <td>
                <span className={`af-a2a-readiness${issues.length === 0 ? " af-a2a-readiness-ready" : " af-a2a-readiness-pending"}`}>
                  {issues.length === 0 ? "OK" : `${issues.length}건`}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
