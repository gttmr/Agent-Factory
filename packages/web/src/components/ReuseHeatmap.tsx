import { moduleCategoryLabels } from "../analyzer/classificationRules";
import { buildReuseHeatmap } from "../analyzer/commonization";
import type { ModuleCandidate } from "../analyzer/types";

interface ReuseHeatmapProps {
  moduleCandidates: ModuleCandidate[];
  onContinue: () => void;
}

const statusLabels = {
  needs_info: "정보 필요",
  approved: "승인됨",
  deferred: "보류",
  rejected: "반려"
} as const;

export function ReuseHeatmap({ moduleCandidates, onContinue }: ReuseHeatmapProps) {
  const heatmapItems = buildReuseHeatmap(moduleCandidates);

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">공통화 검토</p>
        <h2>Reuse Heatmap</h2>
      </div>

      {heatmapItems.length ? (
        <div className="heatmap-list">
          {heatmapItems.map((item) => (
            <article className="heatmap-row" key={item.capability}>
              <div>
                <span>
                  {moduleCategoryLabels[item.module_category]}
                  {item.subtype ? ` / ${item.subtype}` : ""}
                </span>
                <strong>{item.capability}</strong>
                <em>{item.rationale}</em>
              </div>
              <div className="heatmap-score" aria-label={`${item.capability} reuse score`}>
                <span style={{ inlineSize: `${item.reuse_score}%` }} />
              </div>
              <div className="domain-chip-row">
                {item.domains.map((domain) => (
                  <span className="tag compact-tag" key={domain}>
                    {domain}
                  </span>
                ))}
              </div>
              <strong className="status-badge">{statusLabels[item.candidate_status]}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">재사용 후보가 아직 없습니다.</p>
      )}

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          Domain × Capability Map으로 이동
        </button>
      </div>
    </section>
  );
}
