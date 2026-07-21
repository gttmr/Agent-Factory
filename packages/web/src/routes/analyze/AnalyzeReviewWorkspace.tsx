import { AnalysisResult } from "../../components/AnalysisResult";
import type { AnalysisResult as AnalyzerResult } from "../../analyzer/types";
import { Button, Panel, SectionHeader } from "../../ui/primitives";

interface AnalyzeReviewWorkspaceProps {
  analysis: AnalyzerResult;
  missingInfo: string[];
  acceptedMissing: string[];
  reviewReady: boolean;
  approved: boolean;
  onRerun: () => void;
  onContinue: () => void;
  onToggleAcceptedMissing: (item: string) => void;
}

export function AnalyzeReviewWorkspace({
  analysis,
  missingInfo,
  acceptedMissing,
  reviewReady,
  approved,
  onRerun,
  onContinue,
  onToggleAcceptedMissing
}: AnalyzeReviewWorkspaceProps) {
  const acceptedSet = new Set(acceptedMissing);
  const acceptedRequirementMissing = missingInfo.filter((item) => acceptedSet.has(item)).length;
  const remainingRequirementMissing = Math.max(missingInfo.length - acceptedRequirementMissing, 0);
  const requirement = analysis.normalizedRequirement;
  const evidence = analysis.evidence;
  const reviewState = approved ? "승인 완료" : reviewReady ? "승인 대기" : "누락 정보 확인 필요";
  const riskSignalCount = new Set([...evidence.risk_signals, ...requirement.risk_signals]).size;

  return (
    <div className="af-analyze-review-workspace">
      <Panel className="af-analyze-review-command">
        <SectionHeader
          eyebrow="검토 워크스페이스"
          title="Evidence와 누락 정보가 분석 이후의 기준면입니다"
          description="요구사항 요약, 분석 근거, missing_information 수용 상태를 확인한 뒤 analysis_reviewed 게이트는 승인 단계에서만 토글합니다."
          action={
            <div className="af-action-row">
              <Button type="button" variant="secondary" onClick={onRerun}>
                입력·Runner로 이동
              </Button>
              <Button type="button" variant="primary" onClick={onContinue} disabled={!reviewReady}>
                승인 단계로
              </Button>
            </div>
          }
        />
        <div className="af-analyze-review-status" aria-label="분석 검토 상태">
          <ReviewStatusItem label="Review 상태" value={reviewState} tone={reviewReady ? "ok" : "warn"} />
          <ReviewStatusItem
            label="요구사항 누락 정보"
            value={`${missingInfo.length}건 / 남은 ${remainingRequirementMissing}건`}
            tone={remainingRequirementMissing === 0 ? "ok" : "warn"}
          />
          <ReviewStatusItem label="Risk signal" value={`${riskSignalCount}개`} tone={riskSignalCount > 0 ? "warn" : "ok"} />
          <ReviewStatusItem label="자산 후보" value={`${analysis.assetCandidates.length}개`} />
        </div>
      </Panel>

      <div className="af-analyze-review-grid">
        <Panel className="af-analyze-review-panel">
          <SectionHeader
            eyebrow="요구사항 요약"
            title={requirement.title || requirement.id}
            description={evidence.requested_goal || requirement.business_goal}
          />
          <dl className="af-analyze-review-facts">
            <div>
              <dt>도메인</dt>
              <dd>{requirement.domain}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{requirement.status}</dd>
            </div>
            <div>
              <dt>입력 계약</dt>
              <dd>{requirement.inputs.map((field) => field.name).join(", ") || "알 수 없음"}</dd>
            </div>
            <div>
              <dt>출력 계약</dt>
              <dd>{requirement.outputs.map((field) => field.name).join(", ") || "알 수 없음"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel className="af-analyze-review-panel">
          <SectionHeader
            eyebrow="Evidence 처리"
            title={reviewReady ? "승인 단계로 이동할 수 있습니다" : "요구사항 누락 정보 수용이 필요합니다"}
            description={
              reviewReady
                ? "누락 정보가 모두 수용되어 approval path가 열렸습니다. 아래 상세 근거는 설계 전 확인용입니다."
                : "아래 상세 근거의 ‘누락 정보’ 섹션에서 각 항목을 수용해야 analysis_reviewed 게이트를 열 수 있습니다."
            }
          />
          <ul className="af-analyze-review-checks">
            <li>
              <span>누락 정보</span>
              <strong>{`${acceptedRequirementMissing}/${missingInfo.length} 수용`}</strong>
            </li>
            <li>
              <span>가정</span>
              <strong>{`${evidence.assumptions.length}개`}</strong>
            </li>
            <li>
              <span>모순</span>
              <strong>{`${evidence.contradictions.length}개`}</strong>
            </li>
            <li>
              <span>위험 신호</span>
              <strong>{`${riskSignalCount}개`}</strong>
            </li>
          </ul>
        </Panel>
      </div>

      <AnalysisResult
        analysis={analysis}
        onRerun={onRerun}
        onContinue={onContinue}
        acceptedMissing={acceptedMissing}
        onToggleAcceptedMissing={onToggleAcceptedMissing}
      />
    </div>
  );
}

function ReviewStatusItem({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div className={`af-analyze-review-status-item af-analyze-review-status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
