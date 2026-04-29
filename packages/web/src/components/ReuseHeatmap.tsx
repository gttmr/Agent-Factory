import { buildReuseHeatmap } from "../analyzer/commonization";
import type { ModuleCandidate } from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, categoryClass } from "./CategoryBadge";

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

const statusClass: Record<keyof typeof statusLabels, string> = {
  needs_info: "status-needs-info",
  approved: "status-approved",
  deferred: "status-deferred",
  rejected: "status-rejected"
};

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
            <article className={`heatmap-row ${categoryClass(item.module_category)}`} key={item.capability}>
              <span className={`row-stripe ${categoryClass(item.module_category)}`} aria-hidden="true" />
              <div className="heatmap-row-main">
                <div className="heatmap-row-head">
                  <CategoryBadge category={item.module_category} />
                  {item.subtype ? <SubtypeBadge value={item.subtype} /> : null}
                </div>
                <strong className="heatmap-row-name">{item.capability}</strong>
                <em>{item.rationale}</em>
              </div>
              <div className="heatmap-score-block">
                <div className={`heatmap-score ${categoryClass(item.module_category)}`} aria-label={`${item.capability} reuse score`}>
                  <span style={{ inlineSize: `${item.reuse_score}%` }} />
                </div>
                <span className="heatmap-score-label">{item.reuse_score}점</span>
              </div>
              <div className="domain-chip-row">
                {item.domains.map((domain) => (
                  <span className="tag compact-tag" key={domain}>
                    {domain}
                  </span>
                ))}
              </div>
              <span className={`status-badge ${statusClass[item.candidate_status]}`}>
                {statusLabels[item.candidate_status]}
              </span>
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
