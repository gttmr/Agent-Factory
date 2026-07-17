import { useMemo } from "react";
import type { A2AContract, ModuleCandidate } from "../analyzer/types";
import { buildA2AReviewRows } from "./A2AContractPanelModel";

interface A2AContractSidebarProps {
  candidates: ModuleCandidate[];
  contracts: A2AContract[];
  selectedModuleId: string | null;
  onSelect: (moduleId: string) => void;
}

export function A2AContractSidebar({ candidates, contracts, selectedModuleId, onSelect }: A2AContractSidebarProps) {
  const rows = useMemo(() => buildA2AReviewRows(candidates, contracts), [candidates, contracts]);
  if (!rows.length) {
    return (
      <p className="af-design-empty">
        Remote A2A 후보가 없습니다. 독립 원격 Agent Card/A2A 경계가 확인될 때만 이 탭을 사용합니다.
      </p>
    );
  }
  return (
    <table className="af-a2a-table">
      <thead>
        <tr>
          <th>module</th>
          <th>contract</th>
          <th>ready</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ candidate, contract, issues }) => {
          const active = selectedModuleId === candidate.id;
          return (
            <tr key={candidate.id} className={active ? "af-a2a-row-active" : ""}>
              <td>
                <button type="button" className="af-a2a-row-button" onClick={() => onSelect(candidate.id)}>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.id}</small>
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
