import type { AfRunManifest } from "../analyzer/afRunManifest";

type ApprovalKey = keyof AfRunManifest["approvals"];

const labels: Record<ApprovalKey, string> = {
  analysis_reviewed: "분석 검토 완료",
  boundaries_approved: "경계 승인",
  runtime_contracts_approved: "Runtime 계약 승인",
  stub_ready_for_followup: "Stub 인계 준비"
};

interface ApprovalChipProps {
  gate: ApprovalKey;
  value: boolean;
  pending?: boolean;
}

export function ApprovalChip({ gate, value, pending = false }: ApprovalChipProps) {
  const className = ["af-approval-chip", value ? "af-approval-chip-on" : "af-approval-chip-off", pending ? "af-approval-chip-pending" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={className} aria-live="polite">
      <span className="af-approval-chip-glyph" aria-hidden="true">
        {value ? "●" : "○"}
      </span>
      <span>{labels[gate]}</span>
    </span>
  );
}
