import {
  A2A_PART_FIELDS,
  A2A_ROLES,
  A2A_STREAM_WRAPPERS,
  type A2AContract,
  type A2AContractStatus,
  type A2APartField,
  type A2ARole,
  type A2AStreamWrapper,
  type ModuleCandidate
} from "../../analyzer/types";
import { ReadinessList } from "../../ui/review";
import { CategoryBadge, SubtypeBadge } from "../CategoryBadge";
import {
  ContractStatusSelect,
  FieldRow,
  NeedsInfoText,
  PillList,
  ReviewSection,
  partFieldLabels,
  renderTaskState,
  renderTextValue,
  roleLabels,
  streamWrapperLabels
} from "./A2AFieldControls";
import { contractReadinessIssues } from "./helpers";

interface A2AContractDetailProps {
  contract: A2AContract | null;
  candidate: ModuleCandidate | null;
  onStatusChange: (status: A2AContractStatus) => void;
  onScalarChange: <K extends keyof A2AContract>(field: K, value: A2AContract[K]) => void;
  onAgentCardChange: (changes: Partial<A2AContract["agent_card"]>) => void;
  onMessageContractChange: (changes: Partial<A2AContract["message_contract"]>) => void;
  onTaskLifecycleChange: (changes: Partial<A2AContract["task_lifecycle"]>) => void;
  onStreamingChange: (changes: Partial<A2AContract["streaming"]>) => void;
  onArtifactContractChange: (changes: Partial<A2AContract["artifact_contract"]>) => void;
}

export function A2AContractDetail({
  contract,
  candidate,
  onStatusChange,
  onScalarChange,
  onAgentCardChange,
  onMessageContractChange,
  onTaskLifecycleChange,
  onStreamingChange,
  onArtifactContractChange
}: A2AContractDetailProps) {
  if (!contract) {
    return (
      <section className="a2a-contract-detail">
        <p className="empty-state">선택된 A2A Contract가 없습니다.</p>
      </section>
    );
  }

  const readinessIssues = contractReadinessIssues(contract);

  return (
    <article className="a2a-contract-detail" data-contract-id={contract.contract_id}>
      <header className="a2a-detail-header">
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
          <ContractStatusSelect value={contract.contract_status} onChange={onStatusChange} />
        </div>
      </header>

      <div className="a2a-card-body">
        <ReadinessList title="계약 검토 필요" issues={readinessIssues} tone="warning" />

        <ReviewSection title="대상 에이전트">
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
        </ReviewSection>

        <ReviewSection title="Agent Card">
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
        </ReviewSection>

        <ReviewSection title="Interface / Security">
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

          <div className="a2a-grid-two">
            <FieldRow label="input_modes">
              <PillList values={contract.input_modes} emptyText="등록된 input mode 가 없습니다." />
            </FieldRow>
            <FieldRow label="output_modes">
              <PillList values={contract.output_modes} emptyText="등록된 output mode 가 없습니다." />
            </FieldRow>
          </div>

          <div className="a2a-grid-two">
            <FieldRow label="skills">
              <PillList values={contract.skills} emptyText="등록된 skill 이 없습니다." />
            </FieldRow>
            <FieldRow label="extensions">
              <PillList values={contract.extensions} emptyText="등록된 extension 이 없습니다." />
            </FieldRow>
          </div>

          <div className="a2a-grid-two">
            <FieldRow label="security_schemes">
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
            </FieldRow>
            <FieldRow label="security_requirements">
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
            </FieldRow>
          </div>
        </ReviewSection>

        <ReviewSection title="Message / Role" hint="`file` 은 A2A 1.0 에서 금지된 Part 필드입니다.">
          <FieldRow label="allowed_part_fields">
            <div className="a2a-checkbox-row" role="group" aria-label="허용된 Part 필드">
              {A2A_PART_FIELDS.map((field) => {
                const checked = contract.message_contract.allowed_part_fields.includes(field);
                return (
                  <label key={field} className={`a2a-check ${checked ? "is-checked" : "is-muted"}`} title={`Part.${field}`}>
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
          </FieldRow>
          <FieldRow label="allowed_roles">
            <div className="a2a-checkbox-row" role="group" aria-label="허용된 메시지 role">
              {A2A_ROLES.map((role) => {
                const checked = contract.message_contract.allowed_roles.includes(role);
                return (
                  <label key={role} className={`a2a-check ${checked ? "is-checked" : "is-muted"}`}>
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
          </FieldRow>
        </ReviewSection>

        <ReviewSection title="Streaming">
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
                    <label key={wrapper} className={`a2a-check ${checked ? "is-checked" : "is-muted"}`}>
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
        </ReviewSection>

        <ReviewSection title="Task Lifecycle">
          <div className="a2a-grid-two">
            <FieldRow label="states">
              <PillList values={contract.task_lifecycle.states} emptyText="states 없음." />
            </FieldRow>
            <FieldRow label="terminal_states">
              <PillList values={contract.task_lifecycle.terminal_states} emptyText="terminal_states 없음." />
            </FieldRow>
          </div>
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
          <FieldRow label="input_required_followup">
            <NeedsInfoText
              value={contract.task_lifecycle.input_required_followup}
              onChange={(value) => onTaskLifecycleChange({ input_required_followup: value })}
              multiline
            />
          </FieldRow>
          <FieldRow label="auth_required_followup">
            <NeedsInfoText
              value={contract.task_lifecycle.auth_required_followup}
              onChange={(value) => onTaskLifecycleChange({ auth_required_followup: value })}
              multiline
            />
          </FieldRow>
        </ReviewSection>

        <ReviewSection title="Operations / HTTP">
          <div className="a2a-grid-two">
            <FieldRow label="operations">
              <PillList values={contract.operations} emptyText="등록된 operation 이 없습니다." />
            </FieldRow>
            <FieldRow label="http_paths">
              <PillList values={contract.http_paths} emptyText="등록된 HTTP path 가 없습니다." />
            </FieldRow>
          </div>
          <div className="a2a-grid-two">
            <FieldRow label="timeout">
              <NeedsInfoText value={contract.timeout} onChange={(value) => onScalarChange("timeout", value)} />
            </FieldRow>
            <FieldRow label="retry">
              <NeedsInfoText value={contract.retry} onChange={(value) => onScalarChange("retry", value)} multiline />
            </FieldRow>
          </div>
          <div className="a2a-grid-two">
            <FieldRow label="fallback">
              <NeedsInfoText value={contract.fallback} onChange={(value) => onScalarChange("fallback", value)} multiline />
            </FieldRow>
            <FieldRow label="cancellation">
              <NeedsInfoText value={contract.cancellation} onChange={(value) => onScalarChange("cancellation", value)} multiline />
            </FieldRow>
          </div>
          <div className="a2a-grid-two">
            <FieldRow label="unsupported_operation">
              <NeedsInfoText
                value={contract.unsupported_operation}
                onChange={(value) => onScalarChange("unsupported_operation", value)}
                multiline
              />
            </FieldRow>
            <FieldRow label="get_task_fallback">
              <NeedsInfoText
                value={contract.get_task_fallback}
                onChange={(value) => onScalarChange("get_task_fallback", value)}
                multiline
              />
            </FieldRow>
          </div>
        </ReviewSection>

        <ReviewSection title="Auth / Audit / Data">
          <FieldRow label="auth">
            <NeedsInfoText value={contract.auth} onChange={(value) => onScalarChange("auth", value)} multiline />
          </FieldRow>
          <FieldRow label="token_handling">
            <NeedsInfoText
              value={contract.token_handling}
              onChange={(value) => onScalarChange("token_handling", value)}
              multiline
            />
          </FieldRow>
          <FieldRow label="audit">
            <NeedsInfoText value={contract.audit} onChange={(value) => onScalarChange("audit", value)} multiline />
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
        </ReviewSection>

        <ReviewSection title="Artifact">
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
        </ReviewSection>
      </div>
    </article>
  );
}
