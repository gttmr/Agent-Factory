import { useMemo } from "react";
import { SectionHeader } from "../ui/primitives";
import type { AnalysisResult, RuntimeContract } from "../analyzer/types";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts";
import { RuntimeContractEditor } from "./RuntimeContractEditor";

interface ContractSummary {
  contract: RuntimeContract;
  issues: string[];
  reviewable: boolean;
}

function summarize(contract: RuntimeContract): ContractSummary {
  const issues = runtimeContractReadinessIssues(contract);
  return {
    contract,
    issues,
    reviewable: contract.contract_status !== "rejected"
  };
}

export function runtimeContractsGateReady(analysis: AnalysisResult | null | undefined): boolean {
  if (!analysis) return false;
  const contracts = analysis.runtimeContracts ?? [];
  if (contracts.length === 0) return true;
  return contracts
    .filter((contract) => contract.contract_status !== "rejected")
    .every((contract) => runtimeContractReadinessIssues(contract).length === 0);
}

interface RuntimeContractSidebarProps {
  contracts: RuntimeContract[];
  selectedContractId: string | null;
  onSelect: (contractId: string) => void;
}

export function RuntimeContractSidebar({ contracts, selectedContractId, onSelect }: RuntimeContractSidebarProps) {
  const rows = useMemo(() => contracts.map(summarize), [contracts]);
  if (!rows.length) {
    return (
      <p className="af-design-empty">
        Runtime 계약 후보가 없습니다. 분석에 callback/legacy/async resume 경계가 없으면 비어있을 수 있습니다.
      </p>
    );
  }
  return (
    <ul className="af-runtime-list">
      {rows.map(({ contract, issues, reviewable }) => {
        const active = selectedContractId === contract.contract_id;
        return (
          <li key={contract.contract_id} className={`af-runtime-item${active ? " af-runtime-item-active" : ""}`}>
            <button type="button" className="af-runtime-item-button" onClick={() => onSelect(contract.contract_id)}>
              <span className="af-runtime-item-header">
                <span className={`af-runtime-status af-runtime-status-${contract.contract_status}`}>
                  {contract.contract_status}
                </span>
                <small className="af-runtime-kind">{contract.contract_kind}</small>
              </span>
              <strong>{contract.title}</strong>
              <small className="af-runtime-item-meta">
                {contract.module_id ? `module: ${contract.module_id}` : "module: —"}
              </small>
              {reviewable ? (
                <span className={`af-runtime-readiness${issues.length === 0 ? " af-runtime-readiness-ready" : " af-runtime-readiness-pending"}`}>
                  {issues.length === 0 ? "readiness OK" : `readiness ${issues.length}건`}
                </span>
              ) : (
                <span className="af-runtime-readiness af-runtime-readiness-skipped">rejected · 게이트 제외</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface RuntimeContractInspectorProps {
  contract: RuntimeContract | null;
  saving: boolean;
  onSave: (next: RuntimeContract) => void;
  onCancel: () => void;
}

export function RuntimeContractInspector(props: RuntimeContractInspectorProps) {
  if (!props.contract) {
    return (
      <SectionHeader
        eyebrow="선택 없음"
        title="Runtime 계약 검토"
        description="좌측 사이드바에서 검토할 계약을 선택하세요. 모든 필수 계약이 approved 가 되면 boundaries Gate 옆의 runtime_contracts_approved 토글이 활성화됩니다."
      />
    );
  }
  // The parent mounts this component with `key={contract.contract_id}` so
  // switching contracts unmounts and remounts, giving us a clean draft state.
  return (
    <RuntimeContractEditor
      contract={props.contract}
      saving={props.saving}
      onSave={props.onSave}
      onCancel={props.onCancel}
    />
  );
}
