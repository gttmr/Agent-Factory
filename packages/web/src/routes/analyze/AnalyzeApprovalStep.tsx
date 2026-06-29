import type { AnalysisResult } from "../../analyzer/types";
import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";

interface AnalyzeApprovalStepProps {
  manifestPresent: boolean;
  reviewReady: boolean;
  approved: boolean;
  pending: boolean;
  analysis: AnalysisResult | null;
  needsInfoCount: number;
  missingInfoCount: number;
  acceptedMissingCount: number;
  onToggle: () => void;
}

export function AnalyzeApprovalStep({
  manifestPresent,
  reviewReady,
  approved,
  pending,
  analysis,
  needsInfoCount,
  missingInfoCount,
  acceptedMissingCount,
  onToggle
}: AnalyzeApprovalStepProps) {
  if (!manifestPresent) {
    return (
      <Panel>
        <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
      </Panel>
    );
  }

  return (
    <Panel tone="muted">
      <SectionHeader
        title="Gate: analysis_reviewed"
        description={
          reviewReady
            ? "요구사항 수준 누락 정보 항목이 ‘수용’ 처리되었습니다. gate를 토글하여 모듈 검토(설계) 단계로 진행하세요."
            : "다음 단계로 넘어가려면 ‘2. 검토’에서 요구사항 수준 missing_information 항목을 모두 ‘수용’ 처리해야 합니다."
        }
        action={
          <Button variant={approved ? "secondary" : "primary"} type="button" onClick={onToggle} disabled={pending || (!approved && !reviewReady)}>
            {pending ? "갱신 중…" : approved ? "검토 완료 취소" : "검토 완료로 표시"}
          </Button>
        }
      />
      <ul className="af-gate-summary">
        <li>모듈 후보: {analysis ? `${analysis.moduleCandidates.length}개` : "—"}</li>
        <li>needs_info 후보: {needsInfoCount}</li>
        <li>누락 정보: {missingInfoCount}건 / 수용 {acceptedMissingCount}건</li>
      </ul>
    </Panel>
  );
}
