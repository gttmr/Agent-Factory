import type { A2AContract, ModuleCandidate } from "../analyzer/types";
import { SectionHeader } from "../ui/primitives";
import { A2AContractEditor } from "./A2AContractEditor";

interface A2AContractInspectorProps {
  candidate: ModuleCandidate | null;
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
        title="Remote A2A 계약 검토"
        description="Remote A2A 후보가 있으면 좌측 표에서 후보를 선택해 Agent Card, lifecycle, auth, retry, fallback, audit, data policy 를 검토합니다."
      />
    );
  }
  if (!contract) {
    return (
      <div className="af-a2a-inspector">
        <SectionHeader
          eyebrow={`remote_a2a · ${candidate.id}`}
          title={candidate.name}
          description="이 후보와 매칭되는 a2aContracts 항목이 없습니다. 분석 결과를 다시 정규화하거나 a2aContracts 항목을 추가해야 합니다."
        />
        <p className="af-a2a-warning">matching A2A contract is missing</p>
      </div>
    );
  }
  return (
    <A2AContractEditor
      key={`${candidate.id}:${contract.contract_id}`}
      candidate={candidate}
      contract={contract}
      saving={saving}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}
