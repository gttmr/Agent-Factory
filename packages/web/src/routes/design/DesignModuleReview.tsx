import { useState } from "react";
import type { ModuleCandidate } from "../../analyzer/types";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "../../components/CategoryBadge";
import { Button, EmptyState, Field } from "../../ui/primitives";
import { statusLabel } from "./designStageModel";

interface ModuleSidebarProps {
  candidates: ModuleCandidate[];
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string) => void;
}

export function ModuleSidebar({ candidates, selectedModuleId, onSelectModule }: ModuleSidebarProps) {
  if (!candidates.length) return <p className="af-design-empty">모듈 후보가 없습니다.</p>;
  return (
    <ul className="af-module-list">
      {candidates.map((candidate) => (
        <li
          key={candidate.id}
          className={`af-module-item af-module-item-${candidate.status}${selectedModuleId === candidate.id ? " af-module-item-active" : ""}`}
        >
          <button type="button" className="af-module-item-button" onClick={() => onSelectModule(candidate.id)}>
            <span className="af-module-item-header">
              <CategoryBadge category={candidate.module_category} />
              {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate) as string} /> : null}
            </span>
            <strong>{candidate.name}</strong>
            <small className="af-module-item-rationale">{candidate.rationale}</small>
            <span className="af-module-item-status">{statusLabel(candidate.status)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ModuleReviewDetailProps {
  candidate: ModuleCandidate | null;
  saving: boolean;
  onResolveMissing: (candidate: ModuleCandidate, item: string, note: string) => void;
  onApprove: (candidate: ModuleCandidate) => void;
  onDefer: (candidate: ModuleCandidate) => void;
  onReject: (candidate: ModuleCandidate) => void;
}

export function ModuleReviewDetail({
  candidate,
  saving,
  onResolveMissing,
  onApprove,
  onDefer,
  onReject
}: ModuleReviewDetailProps) {
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  if (!candidate) {
    return (
      <section className="af-module-review-detail" aria-label="모듈 검토 상세">
        <EmptyState title="선택한 모듈 없음" description="왼쪽 목록에서 검토할 모듈 후보를 선택하세요." />
      </section>
    );
  }

  const missingItems = candidate.missing_information ?? [];
  const resolvedItems = candidate.resolved_missing_information ?? [];
  const riskSignals = candidate.risk_signals ?? [];
  const subtype = getSubtypeValue(candidate);
  const approveDisabled = saving || missingItems.length > 0;

  return (
    <section className="af-module-review-detail" aria-label={`${candidate.name} 모듈 검토`}>
      <header className="af-module-review-header">
        <div>
          <div className="af-module-review-badges">
            <CategoryBadge category={candidate.module_category} />
            {subtype ? <SubtypeBadge value={subtype} /> : null}
          </div>
          <h3>{candidate.name}</h3>
        </div>
        <span className={`af-module-review-status af-module-review-status-${candidate.status}`}>{statusLabel(candidate.status)}</span>
      </header>

      <div className="af-module-review-section">
        <h4>검토 근거</h4>
        <p>{candidate.rationale || "근거 설명이 없습니다."}</p>
        <dl className="af-module-review-meta">
          <div>
            <dt>risk_level</dt>
            <dd>{candidate.risk_level}</dd>
          </div>
          <div>
            <dt>risk_signals</dt>
            <dd>{riskSignals.length ? riskSignals.join(", ") : "없음"}</dd>
          </div>
        </dl>
      </div>

      <div className="af-module-review-section">
        <h4>누락 항목</h4>
        {missingItems.length ? (
          <ul className="af-module-review-missing-list">
            {missingItems.map((item) => (
              <li key={item} className="af-module-review-missing-item">
                <span>{item}</span>
                <Field label="해소 메모">
                  <input
                    type="text"
                    value={resolutionNotes[item] ?? ""}
                    onChange={(event) => setResolutionNotes((current) => ({ ...current, [item]: event.target.value }))}
                    placeholder="선택 입력"
                    disabled={saving}
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    onResolveMissing(candidate, item, resolutionNotes[item] ?? "");
                    setResolutionNotes((current) => ({ ...current, [item]: "" }));
                  }}
                >
                  해소
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="af-module-review-empty">남은 누락 항목이 없습니다.</p>
        )}
      </div>

      {resolvedItems.length ? (
        <div className="af-module-review-section">
          <h4>해소된 항목</h4>
          <ul className="af-module-review-resolved-list">
            {resolvedItems.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <small>해소됨</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="af-action-row af-module-review-actions">
        <Button type="button" variant="primary" disabled={approveDisabled} onClick={() => onApprove(candidate)}>
          승인
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onDefer(candidate)}>
          보류
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onReject(candidate)}>
          반려
        </Button>
        {missingItems.length ? <small>누락 항목을 모두 해소해야 승인할 수 있습니다.</small> : null}
      </div>
    </section>
  );
}
