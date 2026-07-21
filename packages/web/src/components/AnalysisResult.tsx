import type { AnalysisResult as AnalyzerResult } from "../analyzer/types";

interface AnalysisResultProps {
  analysis: AnalyzerResult;
  onRerun: () => void;
  onContinue: () => void;
  acceptedMissing: string[];
  onToggleAcceptedMissing: (item: string) => void;
}

export function AnalysisResult({
  analysis,
  onRerun,
  onContinue,
  acceptedMissing,
  onToggleAcceptedMissing
}: AnalysisResultProps) {
  const { evidence, normalizedRequirement } = analysis;
  const assetCounts = analysis.assetCandidates.reduce(
    (counts, candidate) => {
      counts[candidate.asset_type] += 1;
      return counts;
    },
    { agent: 0, workflow: 0, tool: 0 }
  );
  const missingItems = uniqueValues(evidence.missing_information);
  const acceptedSet = new Set(acceptedMissing);
  const acceptedCount = missingItems.filter((item) => acceptedSet.has(item)).length;
  const metrics = [
    { label: "자산 후보", value: `${analysis.assetCandidates.length}개` },
    { label: "Agent · Workflow · Tool", value: `${assetCounts.agent} · ${assetCounts.workflow} · ${assetCounts.tool}` },
    { label: "누락 정보", value: `${missingItems.length}건 / 수용 ${acceptedCount}건` }
  ];
  const contractRows = [
    {
      label: "목표",
      values: [evidence.requested_goal, normalizedRequirement.business_goal],
      source: "요청 목표 + 정규화 목표"
    },
    {
      label: "도메인",
      values: [normalizedRequirement.domain, evidence.business_domain_hint],
      source: "정규화 도메인 + 분석 힌트"
    },
    {
      label: "입력",
      values: [...evidence.input_data, ...normalizedRequirement.inputs.map((field) => field.name)],
      source: "입력 데이터"
    },
    {
      label: "출력",
      values: [...evidence.output_data, ...normalizedRequirement.outputs.map((field) => field.name)],
      source: "출력 데이터"
    },
    {
      label: "시스템",
      values: [...evidence.systems_mentioned, ...normalizedRequirement.systems.map((system) => system.name)],
      source: "언급 시스템"
    }
  ];

  return (
    <div className="stack">
      <section className="ui-panel analysis-brief">
        <div className="analysis-brief-hero">
          <div>
            <p className="eyebrow">이해 확인</p>
            <h2>분석 이해 확인</h2>
            <p className="analysis-brief-copy">
              아래 계약이 요구사항과 맞으면 자산 검토로 이동합니다. 위험 신호와 가정은 보조 근거에서 확인할 수 있습니다.
            </p>
          </div>
          <div className="analysis-brief-actions">
            <button type="button" onClick={onRerun}>
              다시 분석
            </button>
            <button type="button" className="primary" onClick={onContinue}>
              자산 검토로 이동
            </button>
          </div>
        </div>

        <div className="analysis-brief-metrics" aria-label="분석 상태 요약">
          {metrics.map((metric) => (
            <div className="analysis-brief-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="contract-list" aria-label="핵심 계약">
          {contractRows.map((row) => (
            <ContractRow key={row.label} label={row.label} source={row.source} values={row.values} />
          ))}
        </div>
      </section>

      <section className="ui-panel evidence-drawer">
        <div className="section-heading">
          <p className="eyebrow">보조 근거</p>
          <h2>검토자가 필요할 때 펼쳐보는 정보</h2>
        </div>
        <EvidenceDetail label="가정" values={evidence.assumptions} />
        <MissingInfoDetail
          items={missingItems}
          acceptedSet={acceptedSet}
          onToggle={onToggleAcceptedMissing}
        />
        <EvidenceDetail label="모순" values={evidence.contradictions} />
        <EvidenceDetail label="위험 신호" values={evidence.risk_signals} tagRisk />
        <details className="evidence-detail">
          <summary>
            <span className="evidence-summary-main">
              <span>정규화 JSON</span>
              <small>
                {normalizedRequirement.title || normalizedRequirement.id} · {formatDisplayValue(normalizedRequirement.domain)} ·{" "}
                {normalizedRequirement.status}
              </small>
            </span>
            <strong>{Object.keys(normalizedRequirement).length}개 필드</strong>
          </summary>
          <div className="evidence-detail-body">
            <pre className="json-preview">{JSON.stringify(normalizedRequirement, null, 2)}</pre>
          </div>
        </details>
      </section>
    </div>
  );
}

function ContractRow({ label, values, source }: { label: string; values: string[]; source: string }) {
  const preview = previewValues(values);

  return (
    <div className="contract-row">
      <div className="contract-label">
        <strong>{label}</strong>
        <span>{source}</span>
      </div>
      <div className="contract-values">
        {preview.visible.length ? (
          preview.visible.map((value) => (
            <span className="value-chip" key={value}>
              {value}
            </span>
          ))
        ) : (
          <span className="value-chip muted">알 수 없음</span>
        )}
        {preview.overflow > 0 ? <span className="value-overflow">+{preview.overflow}</span> : null}
      </div>
    </div>
  );
}

function MissingInfoDetail({
  items,
  acceptedSet,
  onToggle
}: {
  items: string[];
  acceptedSet: Set<string>;
  onToggle: (item: string) => void;
}) {
  const acceptedCount = items.filter((item) => acceptedSet.has(item)).length;
  const preview = items.length
    ? `${items.slice(0, 2).join(", ")}${items.length > 2 ? ` +${items.length - 2}` : ""}`
    : "감지 항목 없음";

  return (
    <details className="evidence-detail">
      <summary>
        <span className="evidence-summary-main">
          <span>누락 정보</span>
          <small>{preview}</small>
        </span>
        <strong>
          {items.length}건 / 수용 {acceptedCount}건
        </strong>
      </summary>
      <div className="evidence-detail-body">
        {items.length ? (
          <ul className="missing-info-list">
            {items.map((item) => {
              const accepted = acceptedSet.has(item);
              return (
                <li className={accepted ? "missing-info-row is-accepted" : "missing-info-row"} key={item}>
                  <label>
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={() => onToggle(item)}
                    />
                    <span>{item}</span>
                  </label>
                  <span className="missing-info-status">{accepted ? "수용" : "미처리"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">감지된 항목이 없습니다.</p>
        )}
        {items.length ? (
          <p className="review-muted">
            "수용"은 reviewer attestation입니다. 자산 후보의 missing_information은 자산 검토에서 직접 정리해야 승인할 수 있습니다.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function EvidenceDetail({ label, values, tagRisk = false }: { label: string; values: string[]; tagRisk?: boolean }) {
  const formatted = uniqueValues(values);
  const preview = formatted.length ? `${formatted.slice(0, 2).join(", ")}${formatted.length > 2 ? ` +${formatted.length - 2}` : ""}` : "감지 항목 없음";

  return (
    <details className="evidence-detail">
      <summary>
        <span className="evidence-summary-main">
          <span>{label}</span>
          <small>{preview}</small>
        </span>
        <strong>{formatted.length}개</strong>
      </summary>
      <div className="evidence-detail-body">
        {formatted.length ? (
          tagRisk ? (
            <div className="tag-row compact">
              {formatted.map((value) => (
                <span className="tag risk" key={value}>
                  {value}
                </span>
              ))}
            </div>
          ) : (
            <ul className="plain-list">
              {formatted.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          )
        ) : (
          <p className="empty-state">감지된 항목이 없습니다.</p>
        )}
      </div>
    </details>
  );
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean).map(formatDisplayValue)));
}

function previewValues(values: string[], limit = 3) {
  const formatted = uniqueValues(values);
  return {
    visible: formatted.slice(0, limit),
    overflow: Math.max(formatted.length - limit, 0)
  };
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
