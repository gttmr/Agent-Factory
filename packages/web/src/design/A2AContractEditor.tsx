import { useState } from "react";
import { A2A_CONTRACT_STATUSES, type A2AContract, type A2AContractStatus, type ModuleCandidate } from "../analyzer/types";
import { Button, SectionHeader, SelectField } from "../ui/primitives";
import { A2AContractCapabilitySections } from "./A2AContractCapabilitySections";
import { A2AContractCoreSections } from "./A2AContractCoreSections";
import {
  createA2AContractDraft,
  hasA2AContractDraftChanges,
  isA2AContractApprovalBlocked
} from "./A2AContractPanelModel";
import { a2aContractReadinessIssues } from "./a2aContractValidator";

interface A2AContractEditorProps {
  candidate: ModuleCandidate;
  contract: A2AContract;
  saving: boolean;
  onSave: (next: A2AContract) => void;
  onCancel: () => void;
}

export function A2AContractEditor({ candidate, contract, saving, onSave, onCancel }: A2AContractEditorProps) {
  const [draft, setDraft] = useState<A2AContract>(() => createA2AContractDraft(contract));
  const issues = a2aContractReadinessIssues(draft);
  const hasChanges = hasA2AContractDraftChanges(contract, draft);
  const blockApproval = isA2AContractApprovalBlocked(draft, issues);

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
      supported_interfaces: prev.supported_interfaces.map((entry, i) =>
        i === index ? { ...entry, ...changes } : entry
      )
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
      security_requirements: prev.security_requirements.map((entry, i) =>
        i === index ? { ...entry, ...changes } : entry
      )
    }));
  }

  function updateTransition(
    index: number,
    changes: Partial<A2AContract["task_lifecycle"]["allowed_transitions"][number]>
  ) {
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

      <A2AContractCoreSections
        draft={draft}
        onUpdate={update}
        onUpdateAgentCard={updateAgentCard}
        onUpdateMessageContract={updateMessageContract}
        onUpdateTaskLifecycle={updateTaskLifecycle}
        onUpdateTransition={updateTransition}
      />
      <A2AContractCapabilitySections
        draft={draft}
        onUpdate={update}
        onUpdateStreaming={updateStreaming}
        onUpdateArtifactContract={updateArtifactContract}
        onUpdateInterface={updateInterface}
        onUpdateSecurityScheme={updateSecurityScheme}
        onUpdateSecurityRequirement={updateSecurityRequirement}
      />

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
