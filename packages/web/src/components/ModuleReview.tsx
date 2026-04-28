import { moduleTypeLabels } from "../analyzer/classificationRules";
import { moduleTypes, type FieldSpec, type ModuleCandidate, type ModuleStatus, type ModuleType } from "../analyzer/types";

const statuses: ModuleStatus[] = ["needs_review", "approved", "deferred", "rejected"];

interface ModuleReviewProps {
  moduleCandidates: ModuleCandidate[];
  onModuleCandidatesChange: (candidates: ModuleCandidate[]) => void;
  onContinue: () => void;
}

export function ModuleReview({ moduleCandidates, onModuleCandidatesChange, onContinue }: ModuleReviewProps) {
  function updateCandidate(id: string, changes: Partial<ModuleCandidate>) {
    onModuleCandidatesChange(
      moduleCandidates.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate))
    );
  }

  return (
    <section className="panel module-review-panel">
      <div className="section-heading">
        <p className="eyebrow">Architecture taxonomy</p>
        <h2>모듈 검토</h2>
      </div>

      <div className="table-wrap">
        <table className="module-table">
          <colgroup>
            <col className="module-name-col" />
            <col className="module-type-col" />
            <col className="module-rationale-col" />
            <col className="module-fields-col" />
            <col className="module-fields-col" />
            <col className="module-reuse-col" />
            <col className="module-risk-col" />
            <col className="module-status-col" />
          </colgroup>
          <thead>
            <tr>
              <th>모듈</th>
              <th>권장 유형</th>
              <th>근거</th>
              <th>입력</th>
              <th>출력</th>
              <th>재사용</th>
              <th>위험</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {moduleCandidates.map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <textarea
                    className="table-name-field"
                    value={candidate.name}
                    onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                    rows={2}
                  />
                </td>
                <td>
                  <select
                    className="table-select"
                    value={candidate.recommended_type}
                    onChange={(event) =>
                      updateCandidate(candidate.id, { recommended_type: event.target.value as ModuleType })
                    }
                  >
                    {moduleTypes.map((type) => (
                      <option key={type} value={type}>
                        {moduleTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="rationale-cell">{candidate.rationale}</td>
                <td>
                  <FieldList fields={candidate.inputs} />
                </td>
                <td>
                  <FieldList fields={candidate.outputs} />
                </td>
                <td>
                  <label className="toggle-cell">
                    <input
                      type="checkbox"
                      checked={candidate.reuse_candidate}
                      onChange={(event) => updateCandidate(candidate.id, { reuse_candidate: event.target.checked })}
                    />
                    <span>{candidate.reuse_candidate ? "예" : "아니오"}</span>
                  </label>
                </td>
                <td>
                  <span className={`risk-pill ${candidate.risk_level}`}>{candidate.risk_level}</span>
                </td>
                <td>
                  <select
                    className="status-select"
                    value={candidate.status}
                    onChange={(event) =>
                      updateCandidate(candidate.id, { status: event.target.value as ModuleStatus })
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          프로세스 플로우로 이동
        </button>
      </div>
    </section>
  );
}

function FieldList({ fields }: { fields: FieldSpec[] }) {
  return (
    <div className="field-chip-list">
      {fields.map((field) => (
        <span className="field-chip" key={`${field.name}-${field.type}`}>
          {field.name}
        </span>
      ))}
    </div>
  );
}
