import { useEffect, useMemo, useState } from "react";
import type { A2AContract, ModuleCandidate } from "../analyzer/types";
import { A2AContractDetail } from "./a2aContractReview/A2AContractDetail";
import { A2AContractList, type ContractListItem } from "./a2aContractReview/A2AContractList";
import { contractReadinessIssues } from "./a2aContractReview/helpers";

interface A2AContractReviewProps {
  contracts: A2AContract[];
  moduleCandidates: ModuleCandidate[];
  onContractsChange: (contracts: A2AContract[]) => void;
  onContinue: () => void;
}

export function A2AContractReview({
  contracts,
  moduleCandidates,
  onContractsChange,
  onContinue
}: A2AContractReviewProps) {
  const { items, remoteCandidatesMissingContract } = useMemo(
    () => buildContractListItems(contracts, moduleCandidates),
    [contracts, moduleCandidates]
  );
  const [selectedContractId, setSelectedContractId] = useState<string | null>(items[0]?.contract.contract_id ?? null);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedContractId(null);
      return;
    }
    if (!selectedContractId || !items.some((item) => item.contract.contract_id === selectedContractId)) {
      setSelectedContractId(items[0].contract.contract_id);
    }
  }, [items, selectedContractId]);

  const selectedItem =
    items.find((item) => item.contract.contract_id === selectedContractId) ?? items[0] ?? null;
  const hasNeedsInfo =
    contracts.some((contract) => contractReadinessIssues(contract).length > 0) ||
    remoteCandidatesMissingContract.length > 0;

  function updateContract(contractId: string, changes: Partial<A2AContract>) {
    onContractsChange(
      contracts.map((entry) => (entry.contract_id === contractId ? { ...entry, ...changes } : entry))
    );
  }

  function updateAgentCard(contractId: string, changes: Partial<A2AContract["agent_card"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { agent_card: { ...target.agent_card, ...changes } });
  }

  function updateMessageContract(contractId: string, changes: Partial<A2AContract["message_contract"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { message_contract: { ...target.message_contract, ...changes } });
  }

  function updateTaskLifecycle(contractId: string, changes: Partial<A2AContract["task_lifecycle"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { task_lifecycle: { ...target.task_lifecycle, ...changes } });
  }

  function updateStreaming(contractId: string, changes: Partial<A2AContract["streaming"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { streaming: { ...target.streaming, ...changes } });
  }

  function updateArtifactContract(contractId: string, changes: Partial<A2AContract["artifact_contract"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { artifact_contract: { ...target.artifact_contract, ...changes } });
  }

  return (
    <section className="panel a2a-contract-review">
      <div className="section-heading">
        <p className="eyebrow">Remote A2A 1.0 검토</p>
        <h2>Remote A2A 계약 검토</h2>
      </div>

      {hasNeedsInfo ? (
        <div className="a2a-banner needs-info" role="status">
          이 계약은 아직 검토가 부족합니다. 누락 항목을 확인해주세요.
        </div>
      ) : null}

      {items.length === 0 && remoteCandidatesMissingContract.length === 0 ? (
        <p className="empty-state">검토할 Remote A2A 계약이 없습니다.</p>
      ) : null}

      <div className="a2a-review-console">
        <A2AContractList
          items={items}
          selectedContractId={selectedItem?.contract.contract_id ?? null}
          remoteCandidatesMissingContract={remoteCandidatesMissingContract}
          onSelect={setSelectedContractId}
        />
        <A2AContractDetail
          contract={selectedItem?.contract ?? null}
          candidate={selectedItem?.candidate ?? null}
          onStatusChange={(status) =>
            selectedItem ? updateContract(selectedItem.contract.contract_id, { contract_status: status }) : undefined
          }
          onScalarChange={(field, value) =>
            selectedItem
              ? updateContract(selectedItem.contract.contract_id, { [field]: value } as Partial<A2AContract>)
              : undefined
          }
          onAgentCardChange={(changes) =>
            selectedItem ? updateAgentCard(selectedItem.contract.contract_id, changes) : undefined
          }
          onMessageContractChange={(changes) =>
            selectedItem ? updateMessageContract(selectedItem.contract.contract_id, changes) : undefined
          }
          onTaskLifecycleChange={(changes) =>
            selectedItem ? updateTaskLifecycle(selectedItem.contract.contract_id, changes) : undefined
          }
          onStreamingChange={(changes) =>
            selectedItem ? updateStreaming(selectedItem.contract.contract_id, changes) : undefined
          }
          onArtifactContractChange={(changes) =>
            selectedItem ? updateArtifactContract(selectedItem.contract.contract_id, changes) : undefined
          }
        />
      </div>

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          재사용 히트맵으로 이동
        </button>
      </div>
    </section>
  );
}

function buildContractListItems(contracts: A2AContract[], moduleCandidates: ModuleCandidate[]) {
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const items: ContractListItem[] = [];
  const pairedCandidateIds = new Set<string>();

  for (const contract of contracts) {
    const candidate = candidateById.get(contract.remote_module_id) ?? null;
    const paired = candidate?.module_category === "remote_a2a";
    if (paired && candidate) pairedCandidateIds.add(candidate.id);
    items.push({ contract, candidate: paired ? candidate : null, orphan: !paired });
  }

  const remoteCandidatesMissingContract = moduleCandidates.filter(
    (candidate) => candidate.module_category === "remote_a2a" && !pairedCandidateIds.has(candidate.id)
  );

  return { items, remoteCandidatesMissingContract };
}
