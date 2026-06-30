import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import type { AnalysisResult, ModuleCandidate } from "../../analyzer/types";
import { A2AContractInspector, A2AContractSidebar } from "../../design/A2AContractPanel";
import type { buildA2AReviewRows } from "../../design/A2AContractPanel";
import { LocalA2AProviderImport as LocalA2AProviderImportControl } from "../../design/LocalA2AProviderImport";
import { Button } from "../../ui/primitives";

export type DesignA2AReviewRow = ReturnType<typeof buildA2AReviewRows>[number];

interface DesignA2ATabProps {
  readonly reqId: string;
  readonly analysis: AnalysisResult;
  readonly a2aContracts: AnalysisResult["a2aContracts"];
  readonly selectedA2ARow: DesignA2AReviewRow | null;
  readonly saving: boolean;
  readonly onSelectA2AModule: (moduleId: string) => void;
  readonly onCreateA2AContract: (candidate: ModuleCandidate) => void;
  readonly onImportLocalA2AProvider: (provider: LocalA2AProviderImport) => void;
  readonly onSaveA2AContract: (contract: AnalysisResult["a2aContracts"][number]) => void;
}

export function DesignA2ATab({
  reqId,
  analysis,
  a2aContracts,
  selectedA2ARow,
  saving,
  onSelectA2AModule,
  onCreateA2AContract,
  onImportLocalA2AProvider,
  onSaveA2AContract
}: DesignA2ATabProps) {
  return (
    <div className="af-a2a-tab-panel">
      <div className="af-a2a-tab-actions">
        <LocalA2AProviderImportControl currentReqId={reqId} saving={saving} onImport={onImportLocalA2AProvider} />
        <Button
          type="button"
          variant="secondary"
          disabled={!selectedA2ARow || Boolean(selectedA2ARow.contract) || saving}
          onClick={() => {
            if (selectedA2ARow) onCreateA2AContract(selectedA2ARow.candidate);
          }}
        >
          새 계약 생성
        </Button>
      </div>
      <A2AContractSidebar candidates={analysis.moduleCandidates} contracts={a2aContracts} selectedModuleId={selectedA2ARow?.candidate.id ?? null} onSelect={onSelectA2AModule} />
      <A2AContractInspector
        key={`${selectedA2ARow?.candidate.id ?? "none"}:${selectedA2ARow?.contract?.contract_id ?? "missing"}`}
        candidate={selectedA2ARow?.candidate ?? null}
        contract={selectedA2ARow?.contract ?? null}
        saving={saving}
        onSave={onSaveA2AContract}
        onCancel={() => undefined}
      />
    </div>
  );
}
