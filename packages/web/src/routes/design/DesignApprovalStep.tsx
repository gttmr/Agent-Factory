import type { AnalysisResult } from "../../analyzer/types";
import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";

interface DesignApprovalStepProps {
  manifest: { approvals: Record<string, boolean> } | null | undefined;
  analysis: AnalysisResult | null;
  approvalPending: boolean;
  boundariesGateEnabled: boolean;
  runtimeGateEnabled: boolean;
  allCandidatesApproved: boolean;
  errorCount: number;
  warningCount: number;
  commentCount: number;
  highlightCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  a2aRowCount: number;
  onToggleBoundariesApproved: () => void;
  onToggleRuntimeContractsApproved: () => void;
}

export function DesignApprovalStep({
  manifest,
  analysis,
  approvalPending,
  boundariesGateEnabled,
  runtimeGateEnabled,
  allCandidatesApproved,
  errorCount,
  warningCount,
  commentCount,
  highlightCount,
  runtimeContractsReady,
  a2aContractsReady,
  a2aRowCount,
  onToggleBoundariesApproved,
  onToggleRuntimeContractsApproved
}: DesignApprovalStepProps) {
  if (!manifest) {
    return (
      <Panel>
        <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
      </Panel>
    );
  }

  const runtimeContracts = analysis?.runtimeContracts ?? [];
  return (
    <Panel tone="muted">
      <SectionHeader
        title="Gate: boundaries_approved"
        description={
          !manifest.approvals.analysis_reviewed
            ? "먼저 Analyze 단계에서 analysis_reviewed 를 토글하세요."
            : !allCandidatesApproved
              ? "모든 모듈 후보가 approved 상태여야 합니다. 하단 '모듈' 탭에서 후보를 선택해 누락 항목을 해소하고 승인하세요."
              : errorCount > 0
                ? `Graph IR 오류가 ${errorCount}건 있습니다. 검증 배너를 먼저 해소하세요.`
                : "조건이 충족되었습니다. 게이트를 토글하여 Build 단계로 진행하세요."
        }
        action={
          <Button
            variant={manifest.approvals.boundaries_approved ? "secondary" : "primary"}
            type="button"
            onClick={onToggleBoundariesApproved}
            disabled={approvalPending || (!manifest.approvals.boundaries_approved && !boundariesGateEnabled)}
          >
            {approvalPending ? "갱신 중…" : manifest.approvals.boundaries_approved ? "승인 취소" : "경계 승인"}
          </Button>
        }
      />
      <ul className="af-gate-summary">
        <li>analysis_reviewed: {manifest.approvals.analysis_reviewed ? "예" : "아니오"}</li>
        <li>
          Asset approved {analysis ? analysis.assetCandidates.filter((candidate) => candidate.status === "approved").length : 0} /{" "}
          {analysis?.assetCandidates.length ?? 0}
        </li>
        <li>Graph IR errors: {errorCount} · warnings: {warningCount}</li>
        <li>코멘트: {commentCount}건 · highlights: {highlightCount}건</li>
      </ul>
      <SectionHeader
        title="Gate: runtime_contracts_approved"
        description={
          runtimeContracts.length === 0 && a2aRowCount === 0
            ? "Runtime/A2A 계약 후보가 없습니다. 토글만 누르면 통과로 처리됩니다."
            : !manifest.approvals.boundaries_approved
              ? "boundaries_approved 가 먼저 활성화되어야 합니다."
              : runtimeContractsReady && a2aContractsReady
                ? "모든 필수 Runtime/A2A 계약이 approved 입니다. 토글을 눌러 design 단계를 마무리하세요."
                : "Stage Runner 재실행 또는 외부 편집으로 계약을 보완하세요."
        }
        action={
          <Button
            variant={manifest.approvals.runtime_contracts_approved ? "secondary" : "primary"}
            type="button"
            onClick={onToggleRuntimeContractsApproved}
            disabled={approvalPending || (!manifest.approvals.runtime_contracts_approved && !runtimeGateEnabled)}
          >
            {approvalPending ? "갱신 중…" : manifest.approvals.runtime_contracts_approved ? "계약 승인 취소" : "Runtime/A2A 계약 승인"}
          </Button>
        }
      />
      <ul className="af-gate-summary">
        <li>
          Runtime 계약 {runtimeContracts.length}개 — approved {runtimeContracts.filter((contract) => contract.contract_status === "approved").length} ·
          rejected {runtimeContracts.filter((contract) => contract.contract_status === "rejected").length}
        </li>
        <li>A2A Binding Agent 후보 {a2aRowCount}개</li>
        <li>
          계약 readiness:{" "}
          {runtimeContracts.length === 0 && a2aRowCount === 0
            ? "—"
            : runtimeContractsReady && a2aContractsReady
              ? "모든 Runtime/A2A 계약 OK"
              : "남은 issue 있음"}
        </li>
      </ul>
    </Panel>
  );
}
