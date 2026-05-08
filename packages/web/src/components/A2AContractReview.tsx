import {
  A2A_CONTRACT_STATUSES,
  A2A_PART_FIELDS,
  A2A_ROLES,
  A2A_STREAM_WRAPPERS,
  type A2AContract,
  type A2AContractStatus,
  type A2APartField,
  type A2ARole,
  type A2AStreamWrapper,
  type ModuleCandidate,
  type TaskState
} from "../analyzer/types";
import { CategoryBadge, SubtypeBadge } from "./CategoryBadge";

interface A2AContractReviewProps {
  contracts: A2AContract[];
  moduleCandidates: ModuleCandidate[];
  onContractsChange: (contracts: A2AContract[]) => void;
  onContinue: () => void;
}

const NEEDS_INFO_TOKEN = "needs_info";

const contractStatusLabels: Record<A2AContractStatus, string> = {
  draft: "초안",
  needs_info: "정보 필요",
  approved: "승인됨"
};

const partFieldLabels: Record<A2APartField, string> = {
  text: "text",
  raw: "raw",
  url: "url",
  data: "data"
};

const roleLabels: Record<A2ARole, string> = {
  ROLE_USER: "ROLE_USER (사용자)",
  ROLE_AGENT: "ROLE_AGENT (에이전트)"
};

const streamWrapperLabels: Record<A2AStreamWrapper, string> = {
  task: "task",
  message: "message",
  taskStatusUpdate: "taskStatusUpdate",
  taskArtifactUpdate: "taskArtifactUpdate"
};

export function A2AContractReview({
  contracts,
  moduleCandidates,
  onContractsChange,
  onContinue
}: A2AContractReviewProps) {
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));

  const pairedContracts: Array<{ contract: A2AContract; candidate: ModuleCandidate }> = [];
  const orphanContracts: A2AContract[] = [];

  for (const contract of contracts) {
    const candidate = candidateById.get(contract.remote_module_id);
    if (candidate && candidate.module_category === "remote_a2a") {
      pairedContracts.push({ contract, candidate });
    } else {
      orphanContracts.push(contract);
    }
  }

  const hasNeedsInfo = contracts.some((contract) => contractHasNeedsInfo(contract));

  function updateContract(contractId: string, changes: Partial<A2AContract>) {
    onContractsChange(
      contracts.map((entry) => (entry.contract_id === contractId ? { ...entry, ...changes } : entry))
    );
  }

  function updateAgentCard(contractId: string, changes: Partial<A2AContract["agent_card"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { agent_card: { ...target.agent_card, ...changes } });
  }

  function updateMessageContract(contractId: string, changes: Partial<A2AContract["message_contract"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { message_contract: { ...target.message_contract, ...changes } });
  }

  function updateTaskLifecycle(contractId: string, changes: Partial<A2AContract["task_lifecycle"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { task_lifecycle: { ...target.task_lifecycle, ...changes } });
  }

  function updateStreaming(contractId: string, changes: Partial<A2AContract["streaming"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { streaming: { ...target.streaming, ...changes } });
  }

  function updateArtifactContract(contractId: string, changes: Partial<A2AContract["artifact_contract"]>) {
    const target = contracts.find((entry) => entry.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { artifact_contract: { ...target.artifact_contract, ...changes } });
  }

  return (
    <section className="panel a2a-contract-review">
      <div className="section-heading">
        <p className="eyebrow">Remote A2A 1.0 검토</p>
        <h2>Remote A2A 계약 검토</h2>
      </div>

      {hasNeedsInfo ? (
        <div className="a2a-banner needs-info" role="status">
          이 계약은 아직 검토가 부족합니다 — 누락 항목을 확인해주세요.
        </div>
      ) : null}

      {pairedContracts.length === 0 && orphanContracts.length === 0 ? (
        <p className="empty-state">검토할 Remote A2A 계약이 없습니다.</p>
      ) : null}

      <div className="a2a-card-list">
        {pairedContracts.map(({ contract, candidate }) => (
          <ContractCard
            key={contract.contract_id}
            contract={contract}
            candidate={candidate}
            onStatusChange={(status) => updateContract(contract.contract_id, { contract_status: status })}
            onScalarChange={(field, value) => updateContract(contract.contract_id, { [field]: value } as Partial<A2AContract>)}
            onAgentCardChange={(changes) => updateAgentCard(contract.contract_id, changes)}
            onMessageContractChange={(changes) => updateMessageContract(contract.contract_id, changes)}
            onTaskLifecycleChange={(changes) => updateTaskLifecycle(contract.contract_id, changes)}
            onStreamingChange={(changes) => updateStreaming(contract.contract_id, changes)}
            onArtifactContractChange={(changes) => updateArtifactContract(contract.contract_id, changes)}
          />
        ))}
      </div>

      {orphanContracts.length > 0 ? (
        <div className="a2a-orphan-section">
          <h3 className="a2a-orphan-heading">미연결 계약</h3>
          <p className="a2a-orphan-note">
            이 계약은 매칭되는 Remote A2A 후보 모듈을 찾지 못했습니다. 연결 후보를 확인해주세요.
          </p>
          <div className="a2a-card-list">
            {orphanContracts.map((contract) => (
              <ContractCard
                key={contract.contract_id}
                contract={contract}
                candidate={null}
                onStatusChange={(status) => updateContract(contract.contract_id, { contract_status: status })}
                onScalarChange={(field, value) => updateContract(contract.contract_id, { [field]: value } as Partial<A2AContract>)}
                onAgentCardChange={(changes) => updateAgentCard(contract.contract_id, changes)}
                onMessageContractChange={(changes) => updateMessageContract(contract.contract_id, changes)}
                onTaskLifecycleChange={(changes) => updateTaskLifecycle(contract.contract_id, changes)}
                onStreamingChange={(changes) => updateStreaming(contract.contract_id, changes)}
                onArtifactContractChange={(changes) => updateArtifactContract(contract.contract_id, changes)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          재사용 히트맵으로 이동
        </button>
      </div>
    </section>
  );
}

interface ContractCardProps {
  contract: A2AContract;
  candidate: ModuleCandidate | null;
  onStatusChange: (status: A2AContractStatus) => void;
  onScalarChange: <K extends keyof A2AContract>(field: K, value: A2AContract[K]) => void;
  onAgentCardChange: (changes: Partial<A2AContract["agent_card"]>) => void;
  onMessageContractChange: (changes: Partial<A2AContract["message_contract"]>) => void;
  onTaskLifecycleChange: (changes: Partial<A2AContract["task_lifecycle"]>) => void;
  onStreamingChange: (changes: Partial<A2AContract["streaming"]>) => void;
  onArtifactContractChange: (changes: Partial<A2AContract["artifact_contract"]>) => void;
}

function ContractCard({
  contract,
  candidate,
  onStatusChange,
  onScalarChange,
  onAgentCardChange,
  onMessageContractChange,
  onTaskLifecycleChange,
  onStreamingChange,
  onArtifactContractChange
}: ContractCardProps) {
  return (
    <article className="a2a-contract-card" data-contract-id={contract.contract_id}>
      <header className="a2a-card-header">
        <div className="a2a-card-title">
          <CategoryBadge category="remote_a2a" />
          <SubtypeBadge value="a2a" />
          <h3 className="a2a-card-name">
            {candidate ? candidate.name : "(미연결 후보)"}
            {candidate ? <span className="a2a-card-mod-id"> · {candidate.id}</span> : null}
          </h3>
        </div>
        <div className="a2a-card-meta">
          <span className="a2a-meta-pair">
            <span className="a2a-meta-label">계약 ID</span>
            <span className="a2a-meta-value">{contract.contract_id}</span>
          </span>
          <ContractStatusChip
            value={contract.contract_status}
            onChange={onStatusChange}
          />
        </div>
      </header>

      <div className="a2a-card-body">
        <Section title="대상 에이전트">
          <FieldRow label="이름">
            <NeedsInfoText
              value={contract.target_agent_name}
              onChange={(value) => onScalarChange("target_agent_name", value)}
            />
          </FieldRow>
          <FieldRow label="목적">
            <NeedsInfoText
              value={contract.target_agent_purpose}
              onChange={(value) => onScalarChange("target_agent_purpose", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="ADK 호스트 매핑">
            <NeedsInfoText
              value={contract.adk_host_mapping}
              onChange={(value) => onScalarChange("adk_host_mapping", value)}
            />
          </FieldRow>
        </Section>

        <Section title="Discovery / Agent Card">
          <FieldRow label="discovery_method">
            <NeedsInfoText
              value={contract.agent_card.discovery_method}
              onChange={(value) => onAgentCardChange({ discovery_method: value })}
            />
          </FieldRow>
          <FieldRow label="agent_card_url">
            <NeedsInfoText
              value={contract.agent_card.agent_card_url}
              onChange={(value) => onAgentCardChange({ agent_card_url: value })}
            />
          </FieldRow>
          <FieldRow label="version">
            <NeedsInfoText
              value={contract.agent_card.version}
              onChange={(value) => onAgentCardChange({ version: value })}
            />
          </FieldRow>
          <FieldRow label="notes">
            <NeedsInfoText
              value={contract.agent_card.notes}
              onChange={(value) => onAgentCardChange({ notes: value })}
              multiline
            />
          </FieldRow>
        </Section>

        <Section title="Supported Interfaces">
          {contract.supported_interfaces.length === 0 ? (
            <p className="a2a-empty">등록된 인터페이스가 없습니다.</p>
          ) : (
            <div className="a2a-table-wrap">
              <table className="a2a-interface-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>protocol_binding</th>
                    <th>protocol_version</th>
                    <th>tenant_policy</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.supported_interfaces.map((iface, index) => (
                    <tr key={`${contract.contract_id}-iface-${index}`}>
                      <td>{renderTextValue(iface.url)}</td>
                      <td>{renderTextValue(iface.protocol_binding)}</td>
                      <td>{renderTextValue(iface.protocol_version)}</td>
                      <td>{renderTextValue(iface.tenant_policy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="a2a-grid-two">
          <Section title="Skills">
            <PillList values={contract.skills} emptyText="등록된 skill 이 없습니다." />
          </Section>
          <Section title="Extensions">
            <PillList values={contract.extensions} emptyText="등록된 extension 이 없습니다." />
          </Section>
        </div>

        <div className="a2a-grid-two">
          <Section title="Security Schemes">
            {contract.security_schemes.length === 0 ? (
              <p className="a2a-empty">등록된 보안 스킴이 없습니다.</p>
            ) : (
              <ul className="a2a-key-list">
                {contract.security_schemes.map((scheme, index) => (
                  <li key={`${contract.contract_id}-sec-scheme-${index}`}>
                    <span className="a2a-key">{scheme.name}</span>
                    <span className="a2a-value">{renderTextValue(scheme.scheme)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Security Requirements">
            {contract.security_requirements.length === 0 ? (
              <p className="a2a-empty">등록된 보안 요구사항이 없습니다.</p>
            ) : (
              <ul className="a2a-key-list">
                {contract.security_requirements.map((req, index) => (
                  <li key={`${contract.contract_id}-sec-req-${index}`}>
                    <span className="a2a-key">{req.scheme_name}</span>
                    <span className="a2a-value">
                      {req.scopes.length > 0 ? req.scopes.join(", ") : "(scopes 없음)"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section
          title="Message Part Fields"
          hint="`file` 은 A2A 1.0 에서 금지된 Part 필드입니다."
        >
          <div className="a2a-checkbox-row" role="group" aria-label="허용된 Part 필드">
            {A2A_PART_FIELDS.map((field) => {
              const checked = contract.message_contract.allowed_part_fields.includes(field);
              return (
                <label
                  key={field}
                  className={`a2a-check ${checked ? "is-checked" : "is-muted"}`}
                  title={`Part.${field}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = new Set<A2APartField>(contract.message_contract.allowed_part_fields);
                      if (event.target.checked) next.add(field);
                      else next.delete(field);
                      onMessageContractChange({
                        allowed_part_fields: A2A_PART_FIELDS.filter((value) => next.has(value))
                      });
                    }}
                  />
                  <span>{partFieldLabels[field]}</span>
                </label>
              );
            })}
            <span className="a2a-forbidden-note" title="A2A 1.0 에서 file 필드는 금지">file 금지</span>
          </div>
        </Section>

        <Section title="Role Policy">
          <div className="a2a-checkbox-row" role="group" aria-label="허용된 메시지 role">
            {A2A_ROLES.map((role) => {
              const checked = contract.message_contract.allowed_roles.includes(role);
              return (
                <label
                  key={role}
                  className={`a2a-check ${checked ? "is-checked" : "is-muted"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = new Set<A2ARole>(contract.message_contract.allowed_roles);
                      if (event.target.checked) next.add(role);
                      else next.delete(role);
                      onMessageContractChange({
                        allowed_roles: A2A_ROLES.filter((value) => next.has(value))
                      });
                    }}
                  />
                  <span>{roleLabels[role]}</span>
                </label>
              );
            })}
          </div>
        </Section>

        <div className="a2a-grid-two">
          <Section title="Output Modes">
            <PillList values={contract.output_modes} emptyText="등록된 output mode 가 없습니다." />
          </Section>
          <Section title="Input Modes">
            <PillList values={contract.input_modes} emptyText="등록된 input mode 가 없습니다." />
          </Section>
        </div>

        <Section title="Streaming">
          <div className="a2a-streaming-row">
            <label className="a2a-toggle">
              <input
                type="checkbox"
                checked={contract.streaming.supported}
                onChange={(event) => onStreamingChange({ supported: event.target.checked })}
              />
              <span>supported</span>
            </label>
            <div className="a2a-stream-wrappers">
              <span className="a2a-inline-label">wrappers</span>
              <div className="a2a-checkbox-row">
                {A2A_STREAM_WRAPPERS.map((wrapper) => {
                  const checked = contract.streaming.wrappers.includes(wrapper);
                  return (
                    <label
                      key={wrapper}
                      className={`a2a-check ${checked ? "is-checked" : "is-muted"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = new Set<A2AStreamWrapper>(contract.streaming.wrappers);
                          if (event.target.checked) next.add(wrapper);
                          else next.delete(wrapper);
                          onStreamingChange({
                            wrappers: A2A_STREAM_WRAPPERS.filter((value) => next.has(value))
                          });
                        }}
                      />
                      <span>{streamWrapperLabels[wrapper]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <FieldRow label="non_streaming_fallback">
            <NeedsInfoText
              value={contract.streaming.non_streaming_fallback}
              onChange={(value) => onStreamingChange({ non_streaming_fallback: value })}
              multiline
            />
          </FieldRow>
        </Section>

        <Section title="TASK_STATE_INPUT_REQUIRED 후속 처리" highlight>
          <NeedsInfoText
            value={contract.task_lifecycle.input_required_followup}
            onChange={(value) => onTaskLifecycleChange({ input_required_followup: value })}
            multiline
          />
          <p className="a2a-section-hint">
            사용자 입력 재요청 시점의 reviewer 정책. 비워둘 수 없습니다.
          </p>
        </Section>

        <div className="a2a-grid-two">
          <Section title="Timeout">
            <NeedsInfoText
              value={contract.timeout}
              onChange={(value) => onScalarChange("timeout", value)}
            />
          </Section>
          <Section title="Retry">
            <NeedsInfoText
              value={contract.retry}
              onChange={(value) => onScalarChange("retry", value)}
              multiline
            />
          </Section>
        </div>

        <div className="a2a-grid-two">
          <Section title="Fallback">
            <NeedsInfoText
              value={contract.fallback}
              onChange={(value) => onScalarChange("fallback", value)}
              multiline
            />
          </Section>
          <Section title="Cancellation">
            <NeedsInfoText
              value={contract.cancellation}
              onChange={(value) => onScalarChange("cancellation", value)}
              multiline
            />
          </Section>
        </div>

        <div className="a2a-grid-two">
          <Section title="Unsupported Operation">
            <NeedsInfoText
              value={contract.unsupported_operation}
              onChange={(value) => onScalarChange("unsupported_operation", value)}
              multiline
            />
          </Section>
          <Section title="GetTask Fallback">
            <NeedsInfoText
              value={contract.get_task_fallback}
              onChange={(value) => onScalarChange("get_task_fallback", value)}
              multiline
            />
          </Section>
        </div>

        <Section title="Auth / Audit">
          <FieldRow label="auth">
            <NeedsInfoText
              value={contract.auth}
              onChange={(value) => onScalarChange("auth", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="token_handling">
            <NeedsInfoText
              value={contract.token_handling}
              onChange={(value) => onScalarChange("token_handling", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="audit">
            <NeedsInfoText
              value={contract.audit}
              onChange={(value) => onScalarChange("audit", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="data_policy">
            <NeedsInfoText
              value={contract.data_policy}
              onChange={(value) => onScalarChange("data_policy", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="push_notification_policy">
            {contract.push_notification_policy === null ? (
              <span className="a2a-na">n/a</span>
            ) : (
              <NeedsInfoText
                value={contract.push_notification_policy}
                onChange={(value) => onScalarChange("push_notification_policy", value)}
                multiline
              />
            )}
          </FieldRow>
        </Section>

        <Section title="Artifact Contract">
          <FieldRow label="mutation_rules">
            <NeedsInfoText
              value={contract.artifact_contract.mutation_rules}
              onChange={(value) => onArtifactContractChange({ mutation_rules: value })}
              multiline
            />
          </FieldRow>
          <FieldRow label="chunking_policy">
            <NeedsInfoText
              value={contract.artifact_contract.chunking_policy}
              onChange={(value) => onArtifactContractChange({ chunking_policy: value })}
              multiline
            />
          </FieldRow>
        </Section>

        <Section title="Task Lifecycle">
          <FieldRow label="states">
            <PillList values={contract.task_lifecycle.states} emptyText="states 없음." />
          </FieldRow>
          <FieldRow label="terminal_states">
            <PillList
              values={contract.task_lifecycle.terminal_states}
              emptyText="terminal_states 없음."
            />
          </FieldRow>
          <FieldRow label="allowed_transitions">
            {contract.task_lifecycle.allowed_transitions.length === 0 ? (
              <p className="a2a-empty">등록된 전이가 없습니다.</p>
            ) : (
              <ul className="a2a-transition-list">
                {contract.task_lifecycle.allowed_transitions.map((transition, index) => (
                  <li key={`${contract.contract_id}-tx-${index}`}>
                    <span className="a2a-task-state">{renderTaskState(transition.from)}</span>
                    <span className="a2a-arrow" aria-hidden="true">→</span>
                    <span className="a2a-task-state">{renderTaskState(transition.to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </FieldRow>
          <FieldRow label="auth_required_followup">
            <NeedsInfoText
              value={contract.task_lifecycle.auth_required_followup}
              onChange={(value) => onTaskLifecycleChange({ auth_required_followup: value })}
              multiline
            />
          </FieldRow>
        </Section>

        <div className="a2a-grid-two">
          <Section title="Operations">
            <PillList values={contract.operations} emptyText="등록된 operation 이 없습니다." />
          </Section>
          <Section title="HTTP Paths">
            <PillList values={contract.http_paths} emptyText="등록된 HTTP path 가 없습니다." />
          </Section>
        </div>
      </div>
    </article>
  );
}

function ContractStatusChip({
  value,
  onChange
}: {
  value: A2AContractStatus;
  onChange: (status: A2AContractStatus) => void;
}) {
  return (
    <label className={`a2a-status-chip status-${value}`}>
      <span className="a2a-status-dot" aria-hidden="true" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as A2AContractStatus)}
        aria-label="계약 상태"
      >
        {A2A_CONTRACT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {contractStatusLabels[status]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({
  title,
  children,
  hint,
  highlight
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <section className={`a2a-section ${highlight ? "is-highlight" : ""}`}>
      <header className="a2a-section-header">
        <h4 className="a2a-section-title">{title}</h4>
        {hint ? <span className="a2a-section-hint inline">{hint}</span> : null}
      </header>
      <div className="a2a-section-body">{children}</div>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="a2a-field-row">
      <span className="a2a-field-label">{label}</span>
      <div className="a2a-field-value">{children}</div>
    </div>
  );
}

function NeedsInfoText({
  value,
  onChange,
  multiline
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const isNeedsInfo = isNeedsInfoValue(value);
  const className = `a2a-input ${isNeedsInfo ? "is-needs-info" : ""}`;
  if (multiline) {
    return (
      <textarea
        className={className}
        value={value}
        rows={2}
        onChange={(event) => onChange(event.target.value)}
        aria-label={isNeedsInfo ? "정보 필요" : undefined}
      />
    );
  }
  return (
    <input
      type="text"
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={isNeedsInfo ? "정보 필요" : undefined}
    />
  );
}

function PillList({ values, emptyText }: { values: string[]; emptyText: string }) {
  if (values.length === 0) {
    return <p className="a2a-empty">{emptyText}</p>;
  }
  return (
    <div className="a2a-pill-list">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`a2a-pill ${isNeedsInfoValue(value) ? "is-needs-info" : ""}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function renderTextValue(value: string) {
  if (isNeedsInfoValue(value)) {
    return <span className="a2a-needs-info-tag">정보 필요</span>;
  }
  return <span className="a2a-text-value">{value}</span>;
}

function renderTaskState(state: TaskState) {
  return state;
}

function isNeedsInfoValue(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return value.trim() === NEEDS_INFO_TOKEN;
}

function contractHasNeedsInfo(contract: A2AContract): boolean {
  if (contract.contract_status === "needs_info") return true;
  const scalarFields: Array<keyof A2AContract> = [
    "target_agent_name",
    "target_agent_purpose",
    "adk_host_mapping",
    "timeout",
    "retry",
    "fallback",
    "cancellation",
    "unsupported_operation",
    "get_task_fallback",
    "auth",
    "token_handling",
    "audit",
    "data_policy"
  ];
  for (const field of scalarFields) {
    const v = contract[field];
    if (typeof v === "string" && isNeedsInfoValue(v)) return true;
  }
  if (typeof contract.push_notification_policy === "string" && isNeedsInfoValue(contract.push_notification_policy)) {
    return true;
  }
  const card = contract.agent_card;
  if (
    isNeedsInfoValue(card.discovery_method) ||
    isNeedsInfoValue(card.agent_card_url) ||
    isNeedsInfoValue(card.version) ||
    isNeedsInfoValue(card.notes)
  ) {
    return true;
  }
  if (
    isNeedsInfoValue(contract.task_lifecycle.input_required_followup) ||
    isNeedsInfoValue(contract.task_lifecycle.auth_required_followup)
  ) {
    return true;
  }
  if (isNeedsInfoValue(contract.streaming.non_streaming_fallback)) return true;
  if (
    isNeedsInfoValue(contract.artifact_contract.mutation_rules) ||
    isNeedsInfoValue(contract.artifact_contract.chunking_policy)
  ) {
    return true;
  }
  return false;
}
