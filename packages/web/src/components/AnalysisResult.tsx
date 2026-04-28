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
          <p className="eyebrow">Evidence</p>
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
            <p className="eyebrow">Review</p>
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
                  <span>{item}</span>
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
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">감지된 모순이 없습니다.</p>
            )}
          </div>
          <div className="tag-row">
            {evidence.risk_signals.map((risk) => (
              <span className="tag risk" key={risk}>
                {risk}
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
            <p className="eyebrow">Draft</p>
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
      <strong>{values.filter(Boolean).join(", ") || "unknown"}</strong>
    </div>
  );
}
