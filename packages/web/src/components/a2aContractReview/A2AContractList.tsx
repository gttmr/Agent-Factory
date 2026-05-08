import type { A2AContract, ModuleCandidate } from "../../analyzer/types";
import { CategoryBadge, SubtypeBadge } from "../CategoryBadge";
import { contractStatusLabels } from "./A2AFieldControls";
import { contractReadinessIssues, remoteA2ARequiredReviewFields } from "./helpers";

export interface ContractListItem {
  contract: A2AContract;
  candidate: ModuleCandidate | null;
  orphan: boolean;
}

interface A2AContractListProps {
  items: ContractListItem[];
  selectedContractId: string | null;
  remoteCandidatesMissingContract: ModuleCandidate[];
  onSelect: (contractId: string) => void;
}

export function A2AContractList({
  items,
  selectedContractId,
  remoteCandidatesMissingContract,
  onSelect
}: A2AContractListProps) {
  return (
    <aside className="a2a-contract-list-panel">
      <div className="a2a-list-heading">
        <p className="eyebrow">A2A Contract</p>
        <h3>계약 목록</h3>
      </div>

      {items.length === 0 ? <p className="a2a-empty">검토할 계약이 없습니다.</p> : null}

      <div className="a2a-contract-list" role="listbox" aria-label="Remote A2A 계약 목록">
        {items.map(({ contract, candidate, orphan }) => {
          const issueCount = contractReadinessIssues(contract).length;
          return (
            <button
              type="button"
              key={contract.contract_id}
              className={`a2a-list-item ${selectedContractId === contract.contract_id ? "is-selected" : ""}`}
              onClick={() => onSelect(contract.contract_id)}
              role="option"
              aria-selected={selectedContractId === contract.contract_id}
            >
              <span className="a2a-list-title">
                <CategoryBadge category="remote_a2a" />
                <SubtypeBadge value="a2a" />
                <strong>{candidate ? candidate.name : "(미연결 후보)"}</strong>
              </span>
              <span className="a2a-list-meta">
                <span>{contract.contract_id}</span>
                <span>{contract.target_agent_name}</span>
              </span>
              <span className="a2a-list-status">
                <span className={`a2a-list-status-pill status-${contract.contract_status}`}>
                  {contractStatusLabels[contract.contract_status]}
                </span>
                <span className={issueCount > 0 || orphan ? "a2a-list-issue" : "a2a-list-issue is-clear"}>
                  {orphan ? "연결 확인" : issueCount > 0 ? `${issueCount}개 issue` : "ready"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {remoteCandidatesMissingContract.length > 0 ? (
        <section className="a2a-orphan-section">
          <h3 className="a2a-orphan-heading">계약이 없는 Remote A2A 후보</h3>
          <p className="a2a-orphan-note">
            Remote A2A 후보는 독립 원격 agent 경계이므로 계약 없이 승인하거나 소스 생성 대상으로 넘길 수 없습니다.
          </p>
          <div className="a2a-missing-list">
            {remoteCandidatesMissingContract.map((candidate) => (
              <article className="a2a-missing-card" key={candidate.id}>
                <div>
                  <CategoryBadge category="remote_a2a" />
                  <h3>{candidate.name}</h3>
                  <p>{candidate.rationale}</p>
                </div>
                <ul>
                  {remoteA2ARequiredReviewFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
