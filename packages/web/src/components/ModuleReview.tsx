import {
  adapterKindLabels,
  agentKindLabels,
  getCandidateSubtype,
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
  type FieldSpec,
  type ModuleCandidate,
  type ModuleCategory,
  type ModuleStatus,
  type RemoteContractKind,
  type WorkflowKind
} from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, categoryClass, getSubtypeValue } from "./CategoryBadge";

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
  onModuleCandidatesChange: (candidates: ModuleCandidate[]) => void;
  onContinue: () => void;
}

export function ModuleReview({ moduleCandidates, onModuleCandidatesChange, onContinue }: ModuleReviewProps) {
  function updateCandidate(id: string, changes: Partial<ModuleCandidate>) {
    onModuleCandidatesChange(
      moduleCandidates.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate))
    );
  }

  function updateCategory(candidate: ModuleCandidate, module_category: ModuleCategory) {
    updateCandidate(candidate.id, {
      module_category,
      agent_kind: module_category === "agent" ? candidate.agent_kind ?? "specialist" : null,
      workflow_kind: module_category === "workflow" ? candidate.workflow_kind ?? "sequential" : null,
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

      <div className="table-wrap">
        <table className="module-table">
          <colgroup>
            <col className="module-name-col" />
            <col className="module-type-col" />
            <col className="module-subtype-col" />
            <col className="module-confidence-col" />
            <col className="module-reuse-col" />
            <col className="module-risk-col" />
            <col className="module-risk-signal-col" />
            <col className="module-status-col" />
            <col className="module-rationale-col" />
            <col className="module-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th>이름</th>
              <th>모듈 분류</th>
              <th>세부 유형</th>
              <th>신뢰도</th>
              <th>재사용</th>
              <th>위험도</th>
              <th>Risk Gate</th>
              <th>상태</th>
              <th>판단 근거</th>
              <th>후속 검토 항목</th>
            </tr>
          </thead>
          <tbody>
            {moduleCandidates.map((candidate) => (
              <tr key={candidate.id} className={`row-${categoryClass(candidate.module_category)} ${candidate.module_category === "remote_a2a" ? "remote-review-row" : ""}`}>
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
                <td>{Math.round(candidate.confidence * 100)}%</td>
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
                <td>
                  <span className={`risk-pill ${candidate.risk_level}`}>{riskLabels[candidate.risk_level]}</span>
                </td>
                <td>
                  <div className="risk-signal-list">
                    {candidate.risk_signals.map((signal) => (
                      <span className="tag compact-tag" key={signal}>
                        {formatRiskSignal(signal)}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
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
                </td>
                <td className="rationale-cell">{candidate.rationale}</td>
                <td>
                  <NextAction candidate={candidate} />
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

function formatRiskSignal(signal: string): string {
  const labels: Record<string, string> = {
    personal_data: "개인정보",
    financial_data: "금융정보",
    credit_decision_support: "신용판단 보조",
    customer_impact: "고객 영향",
    external_message: "외부 메시지",
    transaction_write: "거래 쓰기",
    human_approval_required: "사람 승인",
    audit_required: "감사"
  };

  return labels[signal] ?? signal;
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

function NextAction({ candidate }: { candidate: ModuleCandidate }) {
  const subtype = getCandidateSubtype(candidate);
  const fields = candidate.module_category === "remote_a2a" ? remoteA2AFields : candidateNextFields(candidate);

  return (
    <div className="next-action">
      <strong>{subtype ?? moduleCategoryLabels[candidate.module_category]}</strong>
      <FieldList fields={fields} />
    </div>
  );
}

function candidateNextFields(candidate: ModuleCandidate): FieldSpec[] {
  if (candidate.module_category === "adapter") {
    if (candidate.adapter_kind === "retrieval") {
      return [
        { name: "출처 표기", type: "required" },
        { name: "근거 연결", type: "required" },
        { name: "원천 접근 권한", type: "required" }
      ];
    }
    if (candidate.adapter_kind === "rule_registry") {
      return [
        { name: "소유자", type: "required" },
        { name: "버전", type: "required" },
        { name: "적용일", type: "required" },
        { name: "감사", type: "required" }
      ];
    }
    return [
      { name: "계약", type: "required" },
      { name: "인증", type: "review" },
      { name: "부수 효과", type: "review" }
    ];
  }
  if (candidate.module_category === "workflow") {
    return [
      { name: "단계 순서", type: "required" },
      { name: "인계", type: "required" }
    ];
  }
  return [
    { name: "입력 계약", type: "required" },
    { name: "eval placeholder", type: "required" }
  ];
}

const remoteA2AFields: FieldSpec[] = [
  { name: "소유자", type: "required" },
  { name: "생명주기", type: "required" },
  { name: "계약", type: "required" },
  { name: "인증", type: "required" },
  { name: "타임아웃", type: "required" },
  { name: "재시도", type: "required" },
  { name: "폴백", type: "required" },
  { name: "감사", type: "required" }
];

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
