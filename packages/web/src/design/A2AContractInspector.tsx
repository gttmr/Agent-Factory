import type { A2AContract, AssetCandidate } from "../analyzer/types";
import { SectionHeader } from "../ui/primitives";
import { A2AContractEditor } from "./A2AContractEditor";

interface A2AContractInspectorProps {
  candidate: AssetCandidate | null;
  contract: A2AContract | null;
  saving: boolean;
  onSave: (next: A2AContract) => void;
  onCancel: () => void;
}

export function A2AContractInspector({ candidate, contract, saving, onSave, onCancel }: A2AContractInspectorProps) {
  if (!candidate) {
    return (
      <SectionHeader
        eyebrow="선택 없음"
        title="A2A Agent 계약 검토"
        description="A2A protocol boundary가 있는 Agent asset을 선택해 Agent Card와 runtime policy를 검토합니다."
      />
    );
  }
  if (!contract) {
    return (
      <div className="af-a2a-inspector">
        <SectionHeader
          eyebrow={`A2A Agent · ${candidate.asset_id}`}
          title={candidate.name}
          description="이 후보와 매칭되는 a2aContracts 항목이 없습니다. 분석 결과를 다시 정규화하거나 a2aContracts 항목을 추가해야 합니다."
        />
        <p className="af-a2a-warning">matching A2A contract is missing</p>
      </div>
    );
  }
  return (
    <A2AContractEditor
      key={`${candidate.asset_id}:${contract.contract_id}`}
      candidate={candidate}
      contract={contract}
      saving={saving}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}
