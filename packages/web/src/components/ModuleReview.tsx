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

  function updateCategory(candidate: ModuleCandidate, module_category: ModuleCategory) {
    updateCandidate(candidate.id, {
      module_category,
      agent_kind: module_category === "agent" ? candidate.agent_kind ?? "specialist" : null,
      workflow_kind: module_category === "workflow" ? candidate.workflow_kind ?? "sequential" : null,
      adapter_kind: module_category === "adapter" ? candidate.adapter_kind ?? "unknown" : null,
      remote_contract_kind: module_category === "remote_a2a" ? candidate.remote_contract_kind ?? "a2a" : null,
      risk_level: module_category === "remote_a2a" ? "high" : candidate.risk_level
    });
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
            <col className="module-subtype-col" />
            <col className="module-confidence-col" />
            <col className="module-reuse-col" />
            <col className="module-risk-col" />
            <col className="module-status-col" />
            <col className="module-rationale-col" />
            <col className="module-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>module_category</th>
              <th>Subtype</th>
              <th>Confidence</th>
              <th>Reuse</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Rationale</th>
              <th>next_action</th>
            </tr>
          </thead>
          <tbody>
            {moduleCandidates.map((candidate) => (
              <tr key={candidate.id} className={candidate.module_category === "remote_a2a" ? "remote-review-row" : ""}>
                <td>
                  <textarea
                    className="table-name-field"
                    value={candidate.name}
                    onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                    rows={2}
                  />
                  {candidate.legacy_recommended_type && (
                    <span className="legacy-chip">legacy_recommended_type: {candidate.legacy_recommended_type}</span>
                  )}
                </td>
                <td>
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
                </td>
                <td>
                  <SubtypeControl candidate={candidate} onChange={(changes) => updateCandidate(candidate.id, changes)} />
                </td>
                <td>{Math.round(candidate.confidence * 100)}%</td>
                <td>
                  <label className="toggle-cell">
                    <input
                      type="checkbox"
                      checked={candidate.reuse_candidate}
                      onChange={(event) => updateCandidate(candidate.id, { reuse_candidate: event.target.checked })}
                    />
                    <span>{candidate.reuse_candidate ? "Yes" : "No"}</span>
                  </label>
                </td>
                <td>
                  <span className={`risk-pill ${candidate.risk_level}`}>{candidate.risk_level}</span>
                </td>
                <td>
                  <select
                    className="status-select"
                    value={candidate.status}
                    onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as ModuleStatus })}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
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
        { name: "citations", type: "required" },
        { name: "grounding", type: "required" },
        { name: "source ACL", type: "required" }
      ];
    }
    if (candidate.adapter_kind === "rule_registry") {
      return [
        { name: "owner", type: "required" },
        { name: "version", type: "required" },
        { name: "effective date", type: "required" },
        { name: "audit", type: "required" }
      ];
    }
    return [
      { name: "contract", type: "required" },
      { name: "auth", type: "review" },
      { name: "side effect", type: "review" }
    ];
  }
  if (candidate.module_category === "workflow") {
    return [
      { name: "step order", type: "required" },
      { name: "handoff", type: "required" }
    ];
  }
  return [
    { name: "input contract", type: "required" },
    { name: "eval placeholder", type: "required" }
  ];
}

const remoteA2AFields: FieldSpec[] = [
  { name: "owner", type: "required" },
  { name: "lifecycle", type: "required" },
  { name: "contract", type: "required" },
  { name: "auth", type: "required" },
  { name: "timeout", type: "required" },
  { name: "retry", type: "required" },
  { name: "fallback", type: "required" },
  { name: "audit", type: "required" }
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
