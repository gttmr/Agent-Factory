import type { AnalysisResult as AnalyzerResult } from "../analyzer/types";

interface AnalysisResultProps {
  analysis: AnalyzerResult;
  acceptedMissing: string[];
  onToggleAcceptedMissing: (item: string) => void;
  onRerun: () => void;
  onContinue: () => void;
}

export function AnalysisResult({
  analysis,
  acceptedMissing,
  onToggleAcceptedMissing,
  onRerun,
  onContinue
}: AnalysisResultProps) {
  const { evidence, normalizedRequirement } = analysis;

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">근거</p>
          <h2>분석 결과</h2>
        </div>
        <div className="evidence-grid">
          <EvidenceBlock label="요청 목표" values={[evidence.requested_goal]} />
          <EvidenceBlock label="도메인" values={[evidence.business_domain_hint]} />
          <EvidenceBlock label="역할" values={[evidence.user_role]} />
          <EvidenceBlock label="입력" values={evidence.input_data} />
          <EvidenceBlock label="출력" values={evidence.output_data} />
          <EvidenceBlock label="시스템" values={evidence.systems_mentioned} />
          <EvidenceBlock label="판단" values={evidence.decisions_implied} />
          <EvidenceBlock label="가정" values={evidence.assumptions} />
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">검토</p>
            <h2>검토 항목</h2>
          </div>
          <div className="review-list">
            <h3>부족한 정보</h3>
            {evidence.missing_information.length ? (
              evidence.missing_information.map((item) => (
                <label className="check-row" key={item}>
                  <input
                    type="checkbox"
                    checked={acceptedMissing.includes(item)}
                    onChange={() => onToggleAcceptedMissing(item)}
                  />
                  <span>{formatDisplayValue(item)}</span>
                </label>
              ))
            ) : (
              <p className="empty-state">감지된 부족 정보가 없습니다.</p>
            )}
          </div>
          <div className="review-list">
            <h3>모순</h3>
            {evidence.contradictions.length ? (
              <ul className="plain-list">
                {evidence.contradictions.map((item) => (
                  <li key={item}>{formatDisplayValue(item)}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">감지된 모순이 없습니다.</p>
            )}
          </div>
          <div className="tag-row">
            {evidence.risk_signals.map((risk) => (
              <span className="tag risk" key={risk}>
                {formatDisplayValue(risk)}
              </span>
            ))}
          </div>
          <div className="actions">
            <button type="button" onClick={onRerun}>
              다시 분석
            </button>
            <button type="button" className="primary" onClick={onContinue}>
              모듈 검토로 이동
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">초안</p>
            <h2>정규화된 요구사항</h2>
          </div>
          <pre className="json-preview">{JSON.stringify(normalizedRequirement, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}

function EvidenceBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="evidence-block">
      <span>{label}</span>
      <strong>{values.filter(Boolean).map(formatDisplayValue).join(", ") || "알 수 없음"}</strong>
    </div>
  );
}

function formatDisplayValue(value: string): string {
  const labels: Record<string, string> = {
    raw_requirement_text: "원문 요구사항 텍스트",
    complaint_text: "불만 텍스트",
    customer_id: "고객 ID",
    knowledge_query: "지식 검색어",
    classification: "분류",
    recommended_next_step: "추천 다음 단계",
    draft_response_outline: "응답 초안 개요",
    normalized_recommendation: "정규화된 추천",
    customer_profile_system: "고객 프로필 시스템",
    response_template_library: "응답 템플릿 라이브러리",
    capability_registry: "역량 레지스트리",
    personal_data: "personal_data",
    financial_data: "financial_data",
    customer_impact: "customer_impact",
    credit_decision_support: "credit_decision_support",
    external_message: "external_message",
    transaction_write: "transaction_write",
    human_approval_required: "human_approval_required",
    audit_required: "audit_required",
    "System access method": "System access method",
    "Final classification taxonomy": "Final classification taxonomy",
    "Success metric": "Success metric",
    "Domain boundary": "도메인 경계",
    "Requester team": "요청 팀",
    "Expected output contract": "예상 출력 계약"
  };

  return labels[value] ?? value;
}
