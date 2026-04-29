import { buildDomainCapabilityMap } from "../analyzer/commonization";
import { bankDomains, type ModuleCandidate } from "../analyzer/types";
import { CategoryBadge, SubtypeBadge } from "./CategoryBadge";

interface DomainCapabilityMapProps {
  moduleCandidates: ModuleCandidate[];
  onContinue: () => void;
}

export function DomainCapabilityMap({ moduleCandidates, onContinue }: DomainCapabilityMapProps) {
  const rows = buildDomainCapabilityMap(moduleCandidates);

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">도메인 공통화</p>
        <h2>Domain × Capability Map</h2>
      </div>

      {rows.length ? (
        <div className="table-wrap">
          <table className="domain-map-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>분류</th>
                {bankDomains.map((domain) => (
                  <th key={domain}>{domain}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.capability}>
                  <td>
                    <strong className="capability-name">{row.capability}</strong>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <CategoryBadge category={row.module_category} />
                      {row.subtype ? <SubtypeBadge value={row.subtype} /> : null}
                    </div>
                  </td>
                  {bankDomains.map((domain) => (
                    <td key={domain} className="affinity-cell">
                      <span className={`affinity ${affinityClass(row.domains[domain])}`}>{row.domains[domain]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">도메인 매핑 대상 capability가 아직 없습니다.</p>
      )}

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          아티팩트 내보내기로 이동
        </button>
      </div>
    </section>
  );
}

function affinityClass(value: string): string {
  if (value === "높음") {
    return "high";
  }
  if (value === "중간") {
    return "medium";
  }
  return "low";
}
