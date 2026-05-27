import { useMemo, useState } from "react";
import { Button, Field, SectionHeader, SelectField, TextareaField } from "../ui/primitives";
import {
  A2A_CONTRACT_STATUSES,
  A2A_HTTP_PATHS,
  A2A_OPERATION_NAMES,
  A2A_PART_FIELDS,
  A2A_ROLES,
  A2A_STREAM_WRAPPERS,
  A2A_TASK_STATES,
  type A2AContract,
  type A2AContractStatus,
  type A2AHttpPath,
  type A2AOperationName,
  type A2APartField,
  type A2ARole,
  type A2AStreamWrapper,
  type A2ATaskState,
  type ModuleCandidate
} from "../analyzer/types";
import { a2aContractReadinessIssues, findMatchingA2AContract, remoteA2ACandidates } from "./a2aContractValidator";

interface A2AReviewRow {
  candidate: ModuleCandidate;
  contract: A2AContract | null;
  issues: string[];
}

export function buildA2AReviewRows(candidates: ModuleCandidate[], contracts: A2AContract[]): A2AReviewRow[] {
  return remoteA2ACandidates(candidates).map((candidate) => {
    const contract = findMatchingA2AContract(candidate, contracts);
    return {
      candidate,
      contract,
      issues: contract ? a2aContractReadinessIssues(contract) : ["matching A2A contract is missing"]
    };
  });
}

interface A2AContractSidebarProps {
  candidates: ModuleCandidate[];
  contracts: A2AContract[];
  selectedModuleId: string | null;
  onSelect: (moduleId: string) => void;
}

export function A2AContractSidebar({ candidates, contracts, selectedModuleId, onSelect }: A2AContractSidebarProps) {
  const rows = useMemo(() => buildA2AReviewRows(candidates, contracts), [candidates, contracts]);
  if (!rows.length) {
    return (
      <p className="af-design-empty">
        Remote A2A 후보가 없습니다. 독립 원격 Agent Card/A2A 경계가 확인될 때만 이 탭을 사용합니다.
      </p>
    );
  }
  return (
    <table className="af-a2a-table">
      <thead>
        <tr>
          <th>module</th>
          <th>contract</th>
          <th>ready</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ candidate, contract, issues }) => {
          const active = selectedModuleId === candidate.id;
          return (
            <tr key={candidate.id} className={active ? "af-a2a-row-active" : ""}>
              <td>
                <button type="button" className="af-a2a-row-button" onClick={() => onSelect(candidate.id)}>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.id}</small>
                </button>
              </td>
              <td>
                <code>{contract?.contract_id ?? "missing"}</code>
                <small>{contract?.contract_status ?? "needs_info"}</small>
              </td>
              <td>
                <span className={`af-a2a-readiness${issues.length === 0 ? " af-a2a-readiness-ready" : " af-a2a-readiness-pending"}`}>
                  {issues.length === 0 ? "OK" : `${issues.length}건`}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface A2AContractInspectorProps {
  candidate: ModuleCandidate | null;
  contract: A2AContract | null;
  saving: boolean;
  onSave: (next: A2AContract) => void;
  onCancel: () => void;
}

export function A2AContractInspector({ candidate, contract, saving, onSave, onCancel }: A2AContractInspectorProps) {
  if (!candidate) {
    return (
      <SectionHeader
        eyebrow="선택 없음"
        title="Remote A2A 계약 검토"
        description="Remote A2A 후보가 있으면 좌측 표에서 후보를 선택해 Agent Card, lifecycle, auth, retry, fallback, audit, data policy 를 검토합니다."
      />
    );
  }
  if (!contract) {
    return (
      <div className="af-a2a-inspector">
        <SectionHeader
          eyebrow={`remote_a2a · ${candidate.id}`}
          title={candidate.name}
          description="이 후보와 매칭되는 a2aContracts 항목이 없습니다. 분석 결과를 다시 정규화하거나 a2aContracts 항목을 추가해야 합니다."
        />
        <p className="af-a2a-warning">matching A2A contract is missing</p>
      </div>
    );
  }
  return (
    <A2AContractEditor
      key={`${candidate.id}:${contract.contract_id}`}
      candidate={candidate}
      contract={contract}
      saving={saving}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

interface A2AContractEditorProps {
  candidate: ModuleCandidate;
  contract: A2AContract;
  saving: boolean;
  onSave: (next: A2AContract) => void;
  onCancel: () => void;
}

function A2AContractEditor({ candidate, contract, saving, onSave, onCancel }: A2AContractEditorProps) {
  const [draft, setDraft] = useState<A2AContract>(contract);
  const issues = a2aContractReadinessIssues(draft);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(contract);
  const blockApproval = draft.contract_status === "approved" && issues.some((issue) => !issue.startsWith("contract_status"));

  function update<K extends keyof A2AContract>(field: K, value: A2AContract[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateAgentCard(changes: Partial<A2AContract["agent_card"]>) {
    setDraft((prev) => ({ ...prev, agent_card: { ...prev.agent_card, ...changes } }));
  }

  function updateMessageContract(changes: Partial<A2AContract["message_contract"]>) {
    setDraft((prev) => ({ ...prev, message_contract: { ...prev.message_contract, ...changes } }));
  }

  function updateTaskLifecycle(changes: Partial<A2AContract["task_lifecycle"]>) {
    setDraft((prev) => ({ ...prev, task_lifecycle: { ...prev.task_lifecycle, ...changes } }));
  }

  function updateStreaming(changes: Partial<A2AContract["streaming"]>) {
    setDraft((prev) => ({ ...prev, streaming: { ...prev.streaming, ...changes } }));
  }

  function updateArtifactContract(changes: Partial<A2AContract["artifact_contract"]>) {
    setDraft((prev) => ({ ...prev, artifact_contract: { ...prev.artifact_contract, ...changes } }));
  }

  function updateInterface(index: number, changes: Partial<A2AContract["supported_interfaces"][number]>) {
    setDraft((prev) => ({
      ...prev,
      supported_interfaces: prev.supported_interfaces.map((entry, i) => (i === index ? { ...entry, ...changes } : entry))
    }));
  }

  function updateSecurityScheme(index: number, changes: Partial<A2AContract["security_schemes"][number]>) {
    setDraft((prev) => ({
      ...prev,
      security_schemes: prev.security_schemes.map((entry, i) => (i === index ? { ...entry, ...changes } : entry))
    }));
  }

  function updateSecurityRequirement(index: number, changes: Partial<A2AContract["security_requirements"][number]>) {
    setDraft((prev) => ({
      ...prev,
      security_requirements: prev.security_requirements.map((entry, i) => (i === index ? { ...entry, ...changes } : entry))
    }));
  }

  function updateTransition(index: number, changes: Partial<A2AContract["task_lifecycle"]["allowed_transitions"][number]>) {
    setDraft((prev) => ({
      ...prev,
      task_lifecycle: {
        ...prev.task_lifecycle,
        allowed_transitions: prev.task_lifecycle.allowed_transitions.map((entry, i) =>
          i === index ? { ...entry, ...changes } : entry
        )
      }
    }));
  }

  function handleSave() {
    if (blockApproval) return;
    onSave(draft);
  }

  function handleRevert() {
    setDraft(contract);
    onCancel();
  }

  return (
    <div className="af-a2a-inspector">
      <SectionHeader
        eyebrow={`Remote A2A · ${draft.contract_id}`}
        title={candidate.name}
        description={candidate.rationale}
      />

      <dl className="af-a2a-meta">
        <div>
          <dt>remote_module_id</dt>
          <dd>{draft.remote_module_id}</dd>
        </div>
        <div>
          <dt>target_agent</dt>
          <dd>{draft.target_agent_name}</dd>
        </div>
        <div>
          <dt>candidate status</dt>
          <dd>{candidate.status}</dd>
        </div>
      </dl>

      <SelectField
        label="contract_status"
        value={draft.contract_status}
        onChange={(event) => update("contract_status", event.target.value as A2AContractStatus)}
      >
        {A2A_CONTRACT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>

      <section className="af-a2a-section">
        <h4>Agent Card</h4>
        <Field label="target_agent_name">
          <input value={draft.target_agent_name} onChange={(event) => update("target_agent_name", event.target.value)} />
        </Field>
        <TextareaField
          label="target_agent_purpose"
          rows={3}
          value={draft.target_agent_purpose}
          onChange={(event) => update("target_agent_purpose", event.target.value)}
        />
        <Field label="discovery_method">
          <input
            value={draft.agent_card.discovery_method}
            onChange={(event) => updateAgentCard({ discovery_method: event.target.value })}
          />
        </Field>
        <Field label="agent_card_url">
          <input
            value={draft.agent_card.agent_card_url}
            onChange={(event) => updateAgentCard({ agent_card_url: event.target.value })}
          />
        </Field>
        <Field label="version">
          <input value={draft.agent_card.version} onChange={(event) => updateAgentCard({ version: event.target.value })} />
        </Field>
        <TextareaField
          label="notes"
          rows={3}
          value={draft.agent_card.notes}
          onChange={(event) => updateAgentCard({ notes: event.target.value })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Message contract</h4>
        <CheckGroup
          label="allowed_part_fields"
          values={A2A_PART_FIELDS}
          selected={draft.message_contract.allowed_part_fields}
          onChange={(next) => updateMessageContract({ allowed_part_fields: next as A2APartField[] })}
        />
        <CheckGroup
          label="allowed_roles"
          values={A2A_ROLES}
          selected={draft.message_contract.allowed_roles}
          onChange={(next) => updateMessageContract({ allowed_roles: next as A2ARole[] })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Task lifecycle</h4>
        <CheckGroup
          label="states"
          values={A2A_TASK_STATES}
          selected={draft.task_lifecycle.states}
          onChange={(next) => updateTaskLifecycle({ states: next as A2ATaskState[] })}
        />
        <CheckGroup
          label="terminal_states"
          values={A2A_TASK_STATES}
          selected={draft.task_lifecycle.terminal_states}
          onChange={(next) => updateTaskLifecycle({ terminal_states: next as A2ATaskState[] })}
        />
        <div className="af-a2a-repeat">
          <div className="af-a2a-repeat-header">
            <strong>allowed_transitions</strong>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                updateTaskLifecycle({
                  allowed_transitions: [
                    ...draft.task_lifecycle.allowed_transitions,
                    { from: "TASK_STATE_SUBMITTED", to: "TASK_STATE_WORKING" }
                  ]
                })
              }
            >
              전이 추가
            </Button>
          </div>
          {draft.task_lifecycle.allowed_transitions.map((transition, index) => (
            <div key={`${transition.from}-${transition.to}-${index}`} className="af-a2a-transition-editor">
              <select value={transition.from} onChange={(event) => updateTransition(index, { from: event.target.value as A2ATaskState })}>
                {A2A_TASK_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select value={transition.to} onChange={(event) => updateTransition(index, { to: event.target.value as A2ATaskState })}>
                {A2A_TASK_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <TextareaField
          label="input_required_followup"
          rows={3}
          value={draft.task_lifecycle.input_required_followup}
          onChange={(event) => updateTaskLifecycle({ input_required_followup: event.target.value })}
        />
        <TextareaField
          label="auth_required_followup"
          rows={3}
          value={draft.task_lifecycle.auth_required_followup}
          onChange={(event) => updateTaskLifecycle({ auth_required_followup: event.target.value })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Task capability</h4>
        <InterfaceEditor contract={draft} onAdd={() => update("supported_interfaces", [...draft.supported_interfaces, emptyInterface()])} onUpdate={updateInterface} />
        <TextListField label="input_modes" values={draft.input_modes} onChange={(values) => update("input_modes", values)} />
        <TextListField label="output_modes" values={draft.output_modes} onChange={(values) => update("output_modes", values)} />
        <TextListField label="skills" values={draft.skills} onChange={(values) => update("skills", values)} />
        <TextListField label="extensions" values={draft.extensions} onChange={(values) => update("extensions", values)} />
        <CheckGroup
          label="operations"
          values={A2A_OPERATION_NAMES}
          selected={draft.operations}
          onChange={(next) => update("operations", next as A2AOperationName[])}
        />
        <CheckGroup
          label="http_paths"
          values={A2A_HTTP_PATHS}
          selected={draft.http_paths}
          onChange={(next) => update("http_paths", next as A2AHttpPath[])}
        />
        <Field label="adk_host_mapping">
          <input value={draft.adk_host_mapping} onChange={(event) => update("adk_host_mapping", event.target.value)} />
        </Field>
        <Field label="timeout">
          <input value={draft.timeout} onChange={(event) => update("timeout", event.target.value)} />
        </Field>
        <CheckGroup
          label="streaming.wrappers"
          values={A2A_STREAM_WRAPPERS}
          selected={draft.streaming.wrappers}
          onChange={(next) => updateStreaming({ wrappers: next as A2AStreamWrapper[] })}
        />
        <label className="af-a2a-toggle">
          <input
            type="checkbox"
            checked={draft.streaming.supported}
            onChange={(event) => updateStreaming({ supported: event.target.checked })}
          />
          <span>streaming.supported</span>
        </label>
        <TextareaField
          label="streaming.non_streaming_fallback"
          rows={3}
          value={draft.streaming.non_streaming_fallback}
          onChange={(event) => updateStreaming({ non_streaming_fallback: event.target.value })}
        />
        <TextareaField
          label="artifact_contract.mutation_rules"
          rows={3}
          value={draft.artifact_contract.mutation_rules}
          onChange={(event) => updateArtifactContract({ mutation_rules: event.target.value })}
        />
        <TextareaField
          label="artifact_contract.chunking_policy"
          rows={3}
          value={draft.artifact_contract.chunking_policy}
          onChange={(event) => updateArtifactContract({ chunking_policy: event.target.value })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Auth / Retry / Fallback / Audit / Data</h4>
        <SecurityEditor
          contract={draft}
          onAddScheme={() => update("security_schemes", [...draft.security_schemes, { name: "needs_info", scheme: "needs_info" }])}
          onAddRequirement={() =>
            update("security_requirements", [...draft.security_requirements, { scheme_name: "needs_info", scopes: [] }])
          }
          onUpdateScheme={updateSecurityScheme}
          onUpdateRequirement={updateSecurityRequirement}
        />
        <TextareaField label="auth" rows={3} value={draft.auth} onChange={(event) => update("auth", event.target.value)} />
        <TextareaField
          label="token_handling"
          rows={3}
          value={draft.token_handling}
          onChange={(event) => update("token_handling", event.target.value)}
        />
        <TextareaField label="retry" rows={3} value={draft.retry} onChange={(event) => update("retry", event.target.value)} />
        <TextareaField label="fallback" rows={3} value={draft.fallback} onChange={(event) => update("fallback", event.target.value)} />
        <TextareaField
          label="cancellation"
          rows={3}
          value={draft.cancellation}
          onChange={(event) => update("cancellation", event.target.value)}
        />
        <TextareaField
          label="unsupported_operation"
          rows={3}
          value={draft.unsupported_operation}
          onChange={(event) => update("unsupported_operation", event.target.value)}
        />
        <TextareaField
          label="get_task_fallback"
          rows={3}
          value={draft.get_task_fallback}
          onChange={(event) => update("get_task_fallback", event.target.value)}
        />
        <TextareaField label="audit" rows={3} value={draft.audit} onChange={(event) => update("audit", event.target.value)} />
        <TextareaField
          label="data_policy"
          rows={3}
          value={draft.data_policy}
          onChange={(event) => update("data_policy", event.target.value)}
        />
        <TextareaField
          label="push_notification_policy"
          rows={3}
          value={draft.push_notification_policy ?? ""}
          onChange={(event) => update("push_notification_policy", event.target.value.trim() ? event.target.value : null)}
          hint="비어 있으면 null 로 저장합니다."
        />
      </section>

      <div className="af-a2a-readiness-block">
        <h4>Readiness issues ({issues.length})</h4>
        {issues.length === 0 ? (
          <p className="af-a2a-readiness-ready">readiness OK — Remote A2A 계약이 approved 상태입니다.</p>
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>

      {blockApproval ? (
        <p className="af-a2a-warning">contract_status 를 approved 로 저장하려면 readiness issue 를 먼저 모두 해소하세요.</p>
      ) : null}

      <div className="af-action-row">
        <Button variant="ghost" type="button" onClick={handleRevert} disabled={!hasChanges || saving}>
          되돌리기
        </Button>
        <Button variant="primary" type="button" onClick={handleSave} disabled={!hasChanges || saving || blockApproval}>
          {saving ? "저장 중…" : "이 A2A 계약 저장"}
        </Button>
      </div>
    </div>
  );
}

function InterfaceEditor({
  contract,
  onAdd,
  onUpdate
}: {
  contract: A2AContract;
  onAdd: () => void;
  onUpdate: (index: number, changes: Partial<A2AContract["supported_interfaces"][number]>) => void;
}) {
  return (
    <div className="af-a2a-repeat">
      <div className="af-a2a-repeat-header">
        <strong>supported_interfaces</strong>
        <Button variant="ghost" type="button" onClick={onAdd}>
          인터페이스 추가
        </Button>
      </div>
      {contract.supported_interfaces.map((entry, index) => (
        <div className="af-a2a-grid" key={`${entry.url}-${index}`}>
          <Field label="url">
            <input value={entry.url} onChange={(event) => onUpdate(index, { url: event.target.value })} />
          </Field>
          <Field label="protocol_binding">
            <input value={entry.protocol_binding} onChange={(event) => onUpdate(index, { protocol_binding: event.target.value })} />
          </Field>
          <Field label="protocol_version">
            <input value={entry.protocol_version} onChange={(event) => onUpdate(index, { protocol_version: event.target.value })} />
          </Field>
          <Field label="tenant_policy">
            <input value={entry.tenant_policy} onChange={(event) => onUpdate(index, { tenant_policy: event.target.value })} />
          </Field>
        </div>
      ))}
    </div>
  );
}

function SecurityEditor({
  contract,
  onAddScheme,
  onAddRequirement,
  onUpdateScheme,
  onUpdateRequirement
}: {
  contract: A2AContract;
  onAddScheme: () => void;
  onAddRequirement: () => void;
  onUpdateScheme: (index: number, changes: Partial<A2AContract["security_schemes"][number]>) => void;
  onUpdateRequirement: (index: number, changes: Partial<A2AContract["security_requirements"][number]>) => void;
}) {
  return (
    <div className="af-a2a-repeat">
      <div className="af-a2a-repeat-header">
        <strong>security_schemes</strong>
        <Button variant="ghost" type="button" onClick={onAddScheme}>
          scheme 추가
        </Button>
      </div>
      {contract.security_schemes.map((entry, index) => (
        <div className="af-a2a-grid" key={`${entry.name}-${index}`}>
          <Field label="name">
            <input value={entry.name} onChange={(event) => onUpdateScheme(index, { name: event.target.value })} />
          </Field>
          <Field label="scheme">
            <input value={entry.scheme} onChange={(event) => onUpdateScheme(index, { scheme: event.target.value })} />
          </Field>
        </div>
      ))}
      <div className="af-a2a-repeat-header">
        <strong>security_requirements</strong>
        <Button variant="ghost" type="button" onClick={onAddRequirement}>
          requirement 추가
        </Button>
      </div>
      {contract.security_requirements.map((entry, index) => (
        <div className="af-a2a-grid" key={`${entry.scheme_name}-${index}`}>
          <Field label="scheme_name">
            <input value={entry.scheme_name} onChange={(event) => onUpdateRequirement(index, { scheme_name: event.target.value })} />
          </Field>
          <TextListField
            label="scopes"
            values={entry.scopes}
            onChange={(values) => onUpdateRequirement(index, { scopes: values })}
          />
        </div>
      ))}
    </div>
  );
}

function TextListField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <TextareaField
      label={label}
      rows={3}
      value={values.join("\n")}
      onChange={(event) => onChange(splitTextList(event.target.value))}
      hint="쉼표 또는 줄바꿈으로 여러 값을 입력합니다."
    />
  );
}

function CheckGroup<T extends string>({
  label,
  values,
  selected,
  onChange
}: {
  label: string;
  values: readonly T[];
  selected: readonly T[];
  onChange: (values: T[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <fieldset className="af-a2a-checks">
      <legend>{label}</legend>
      {values.map((value) => (
        <label key={value}>
          <input
            type="checkbox"
            checked={selectedSet.has(value)}
            onChange={(event) => {
              const next = new Set(selectedSet);
              if (event.target.checked) next.add(value);
              else next.delete(value);
              onChange(values.filter((item) => next.has(item)));
            }}
          />
          <span>{value}</span>
        </label>
      ))}
    </fieldset>
  );
}

function splitTextList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function emptyInterface(): A2AContract["supported_interfaces"][number] {
  return {
    url: "needs_info",
    protocol_binding: "HTTP+JSON",
    protocol_version: "A2A 1.0",
    tenant_policy: "needs_info"
  };
}
