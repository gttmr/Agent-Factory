import { useEffect, useMemo, useState } from "react";
import {
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import {
  adapterKinds,
  agentKinds,
  moduleCategories,
  remoteContractKinds,
  workflowKinds,
  type AdapterKind,
  type AgentKind,
  type ModuleCandidate,
  type ModuleCategory,
  type ModuleStatus,
  type RemoteContractKind,
  type WorkflowKind
} from "../analyzer/types";
import type { CatalogEntry } from "../catalog/types";
import { SelectableTableRow } from "../ui/review";
import { CategoryBadge, SubtypeBadge, categoryClass, getSubtypeValue } from "./CategoryBadge";
import { ModuleReviewInspector, candidateReviewIssues } from "./ModuleReviewInspector";

const statuses: ModuleStatus[] = ["needs_info", "approved", "deferred", "rejected"];
const statusLabels: Record<ModuleStatus, string> = {
  needs_info: "정보 필요",
  approved: "승인됨",
  deferred: "보류",
  rejected: "반려"
};

const riskLabels = {
  low: "낮음",
  medium: "중간",
  high: "높음"
} as const;

interface ModuleReviewProps {
  moduleCandidates: ModuleCandidate[];
  catalogEntries: CatalogEntry[];
  onModuleCandidatesChange: (candidates: ModuleCandidate[]) => void;
  onContinue: () => void;
  onNavigateToA2AContracts?: () => void;
}

export function ModuleReview({
  moduleCandidates,
  catalogEntries,
  onModuleCandidatesChange,
  onContinue,
  onNavigateToA2AContracts
}: ModuleReviewProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(moduleCandidates[0]?.id ?? null);

  useEffect(() => {
    if (moduleCandidates.length === 0) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !moduleCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(moduleCandidates[0].id);
    }
  }, [moduleCandidates, selectedCandidateId]);

  const selectedCandidate = useMemo(
    () => moduleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? moduleCandidates[0] ?? null,
    [moduleCandidates, selectedCandidateId]
  );

  function updateCandidate(id: string, changes: Partial<ModuleCandidate>) {
    onModuleCandidatesChange(
      moduleCandidates.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate))
    );
  }

  function updateCategory(candidate: ModuleCandidate, module_category: ModuleCategory) {
    updateCandidate(candidate.id, {
      module_category,
      agent_kind: module_category === "agent" ? candidate.agent_kind ?? "specialist" : null,
      workflow_kind: module_category === "workflow" ? candidate.workflow_kind ?? "graph" : null,
      adapter_kind: module_category === "adapter" ? candidate.adapter_kind ?? "unknown" : null,
      remote_contract_kind: module_category === "remote_a2a" ? candidate.remote_contract_kind ?? "a2a" : null,
      risk_level: module_category === "remote_a2a" ? "high" : candidate.risk_level,
      risk_signals:
        module_category === "remote_a2a"
          ? Array.from(new Set([...candidate.risk_signals, "human_approval_required", "audit_required"]))
          : candidate.risk_signals,
      status: module_category === "remote_a2a" && candidate.status === "approved" ? "needs_info" : candidate.status
    });
  }

  return (
    <section className="panel module-review-panel">
      <div className="section-heading">
        <p className="eyebrow">아키텍처 분류</p>
        <h2>모듈 검토</h2>
      </div>

      <div className="review-console module-review-console">
        <div className="review-table-region">
          <div className="table-wrap review-table-wrap">
            <table className="module-table">
              <colgroup>
                <col className="module-name-col" />
                <col className="module-type-col" />
                <col className="module-subtype-col" />
                <col className="module-status-col" />
                <col className="module-risk-col" />
                <col className="module-reuse-col" />
                <col className="module-confidence-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>분류</th>
                  <th>세부 유형</th>
                  <th>상태</th>
                  <th>위험도</th>
                  <th>재사용</th>
                  <th>신뢰도</th>
                </tr>
              </thead>
              <tbody>
                {moduleCandidates.map((candidate) => {
                  const issues = candidateReviewIssues(candidate, catalogEntries);
                  return (
                    <SelectableTableRow
                      key={candidate.id}
                      selected={selectedCandidate?.id === candidate.id}
                      onSelect={() => setSelectedCandidateId(candidate.id)}
                      className={`row-${categoryClass(candidate.module_category)} ${
                        candidate.module_category === "remote_a2a" ? "remote-review-row" : ""
                      }`}
                    >
                      <td className="row-name-cell">
                        <span className={`row-stripe ${categoryClass(candidate.module_category)}`} aria-hidden="true" />
                        <textarea
                          className="table-name-field"
                          value={candidate.name}
                          onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                          rows={2}
                        />
                      </td>
                      <td>
                        <div className="cell-stack">
                          <CategoryBadge category={candidate.module_category} />
                          <select
                            className="table-select"
                            value={candidate.module_category}
                            onChange={(event) => updateCategory(candidate, event.target.value as ModuleCategory)}
                          >
                            {moduleCategories.map((category) => (
                              <option key={category} value={category}>
                                {moduleCategoryLabels[category]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate)!} /> : null}
                          <SubtypeControl candidate={candidate} onChange={(changes) => updateCandidate(candidate.id, changes)} />
                        </div>
                      </td>
                      <td>
                        <div className="status-cell compact-status-cell">
                          <select
                            className="status-select"
                            value={candidate.status}
                            onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as ModuleStatus })}
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {statusLabels[status]}
                              </option>
                            ))}
                          </select>
                          {issues.length > 0 ? (
                            <span className="review-issue-badge">{issues.length}개 확인 필요</span>
                          ) : (
                            <span className="review-issue-badge is-clear">blocker 없음</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`risk-pill ${candidate.risk_level}`}>{riskLabels[candidate.risk_level]}</span>
                      </td>
                      <td>
                        <label className="toggle-cell">
                          <input
                            type="checkbox"
                            checked={candidate.reuse_candidate}
                            onChange={(event) => updateCandidate(candidate.id, { reuse_candidate: event.target.checked })}
                          />
                          <span>{candidate.reuse_candidate ? "예" : "아니요"}</span>
                        </label>
                      </td>
                      <td>{Math.round(candidate.confidence * 100)}%</td>
                    </SelectableTableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ModuleReviewInspector
          candidate={selectedCandidate}
          catalogEntries={catalogEntries}
          onNavigateToA2AContracts={onNavigateToA2AContracts}
        />
      </div>

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          프로세스 플로우로 이동
        </button>
      </div>
    </section>
  );
}

function SubtypeControl({
  candidate,
  onChange
}: {
  candidate: ModuleCandidate;
  onChange: (changes: Partial<ModuleCandidate>) => void;
}) {
  if (candidate.module_category === "adapter") {
    return (
      <select
        className="table-select"
        value={candidate.adapter_kind ?? "unknown"}
        onChange={(event) => onChange({ adapter_kind: event.target.value as AdapterKind })}
      >
        {adapterKinds.map((kind) => (
          <option key={kind} value={kind}>
            {adapterKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  if (candidate.module_category === "agent") {
    return (
      <select
        className="table-select"
        value={candidate.agent_kind ?? "specialist"}
        onChange={(event) => onChange({ agent_kind: event.target.value as AgentKind })}
      >
        {agentKinds.map((kind) => (
          <option key={kind} value={kind}>
            {agentKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  if (candidate.module_category === "workflow") {
    return (
      <select
        className="table-select"
        value={candidate.workflow_kind ?? "unknown"}
        onChange={(event) => onChange({ workflow_kind: event.target.value as WorkflowKind })}
      >
        {workflowKinds.map((kind) => (
          <option key={kind} value={kind}>
            {workflowKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      className="table-select remote-select"
      value={candidate.remote_contract_kind ?? "a2a"}
      onChange={(event) => onChange({ remote_contract_kind: event.target.value as RemoteContractKind })}
    >
      {remoteContractKinds.map((kind) => (
        <option key={kind} value={kind}>
          {remoteContractKindLabels[kind]}
        </option>
      ))}
    </select>
  );
}
