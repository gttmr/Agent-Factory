import { useMemo, useState } from "react";
import { Button, Field, SectionHeader, SelectField, TextareaField } from "../ui/primitives";
import { RUNTIME_CONTRACT_STATUSES, type AnalysisResult, type RuntimeContract, type RuntimeContractStatus } from "../analyzer/types";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts";

const POLICY_FIELDS = [
  ["auth_policy", "Auth policy"],
  ["timeout_policy", "Timeout policy"],
  ["retry_policy", "Retry policy"],
  ["fallback_policy", "Fallback policy"],
  ["masking_policy", "Masking policy"],
  ["data_policy", "Data policy"]
] as const;

type PolicyKey = (typeof POLICY_FIELDS)[number][0];

interface ContractSummary {
  contract: RuntimeContract;
  issues: string[];
  reviewable: boolean;
}

function summarize(contract: RuntimeContract): ContractSummary {
  const issues = runtimeContractReadinessIssues(contract);
  return {
    contract,
    issues,
    reviewable: contract.contract_status !== "rejected"
  };
}

export function runtimeContractsGateReady(analysis: AnalysisResult | null | undefined): boolean {
  if (!analysis) return false;
  const contracts = analysis.runtimeContracts ?? [];
  if (contracts.length === 0) return true;
  return contracts
    .filter((contract) => contract.contract_status !== "rejected")
    .every((contract) => runtimeContractReadinessIssues(contract).length === 0);
}

interface RuntimeContractSidebarProps {
  contracts: RuntimeContract[];
  selectedContractId: string | null;
  onSelect: (contractId: string) => void;
}

export function RuntimeContractSidebar({ contracts, selectedContractId, onSelect }: RuntimeContractSidebarProps) {
  const rows = useMemo(() => contracts.map(summarize), [contracts]);
  if (!rows.length) {
    return (
      <p className="af-design-empty">
        Runtime 계약 후보가 없습니다. 분석에 callback/legacy/async resume 경계가 없으면 비어있을 수 있습니다.
      </p>
    );
  }
  return (
    <ul className="af-runtime-list">
      {rows.map(({ contract, issues, reviewable }) => {
        const active = selectedContractId === contract.contract_id;
        return (
          <li key={contract.contract_id} className={`af-runtime-item${active ? " af-runtime-item-active" : ""}`}>
            <button type="button" className="af-runtime-item-button" onClick={() => onSelect(contract.contract_id)}>
              <span className="af-runtime-item-header">
                <span className={`af-runtime-status af-runtime-status-${contract.contract_status}`}>
                  {contract.contract_status}
                </span>
                <small className="af-runtime-kind">{contract.contract_kind}</small>
              </span>
              <strong>{contract.title}</strong>
              <small className="af-runtime-item-meta">
                {contract.module_id ? `module: ${contract.module_id}` : "module: —"}
              </small>
              {reviewable ? (
                <span className={`af-runtime-readiness${issues.length === 0 ? " af-runtime-readiness-ready" : " af-runtime-readiness-pending"}`}>
                  {issues.length === 0 ? "readiness OK" : `readiness ${issues.length}건`}
                </span>
              ) : (
                <span className="af-runtime-readiness af-runtime-readiness-skipped">rejected · 게이트 제외</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface RuntimeContractInspectorProps {
  contract: RuntimeContract | null;
  saving: boolean;
  onSave: (next: RuntimeContract) => void;
  onCancel: () => void;
}

export function RuntimeContractInspector(props: RuntimeContractInspectorProps) {
  if (!props.contract) {
    return (
      <SectionHeader
        eyebrow="선택 없음"
        title="Runtime 계약 검토"
        description="좌측 사이드바에서 검토할 계약을 선택하세요. 모든 필수 계약이 approved 가 되면 boundaries Gate 옆의 runtime_contracts_approved 토글이 활성화됩니다."
      />
    );
  }
  // The parent mounts this component with `key={contract.contract_id}` so
  // switching contracts unmounts and remounts, giving us a clean draft state.
  return <RuntimeContractEditor {...(props as Required<RuntimeContractInspectorProps>)} contract={props.contract} />;
}

interface RuntimeContractEditorProps {
  contract: RuntimeContract;
  saving: boolean;
  onSave: (next: RuntimeContract) => void;
  onCancel: () => void;
}

function RuntimeContractEditor({ contract, saving, onSave, onCancel }: RuntimeContractEditorProps) {
  const [draftStatus, setDraftStatus] = useState<RuntimeContractStatus>(contract.contract_status);
  const [draftPolicies, setDraftPolicies] = useState<RuntimeContract["policies"]>(contract.policies);
  const [draftNotes, setDraftNotes] = useState(contract.reviewer_notes);

  const draft: RuntimeContract = {
    ...contract,
    contract_status: draftStatus,
    policies: draftPolicies,
    reviewer_notes: draftNotes
  };
  const issues = runtimeContractReadinessIssues(draft);
  const hasChanges =
    draftStatus !== contract.contract_status ||
    draftNotes !== contract.reviewer_notes ||
    POLICY_FIELDS.some(([key]) => draftPolicies[key] !== contract.policies[key]);

  const blockApproval = draftStatus === "approved" && issues.some((issue) => !issue.startsWith("contract_status"));

  function updatePolicy(key: PolicyKey, value: string) {
    setDraftPolicies((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (blockApproval) return;
    onSave({
      ...contract,
      contract_status: draftStatus,
      reviewer_notes: draftNotes,
      policies: draftPolicies
    });
  }

  function handleRevert() {
    setDraftStatus(contract.contract_status);
    setDraftPolicies(contract.policies);
    setDraftNotes(contract.reviewer_notes);
    onCancel();
  }

  return (
    <div className="af-runtime-inspector">
      <SectionHeader
        eyebrow={`${contract.contract_kind} · ${contract.contract_id}`}
        title={contract.title}
        description={contract.summary || "summary 가 비어있습니다."}
      />

      <dl className="af-runtime-meta">
        <div>
          <dt>module_id</dt>
          <dd>{contract.module_id ?? "—"}</dd>
        </div>
        <div>
          <dt>operation</dt>
          <dd>
            {contract.operation.operation_type} · {contract.operation.side_effect_level}
            {contract.operation.callback_expected ? " · callback" : ""}
            {contract.operation.async_resume_required ? " · async_resume" : ""}
          </dd>
        </div>
        <div>
          <dt>runtime_support</dt>
          <dd>{summarizeRuntimeSupport(contract.runtime_support)}</dd>
        </div>
        <div>
          <dt>identifiers</dt>
          <dd>{contract.identifiers.length ? contract.identifiers.join(", ") : "—"}</dd>
        </div>
      </dl>

      <SelectField
        label="contract_status"
        value={draftStatus}
        onChange={(event) => setDraftStatus(event.target.value as RuntimeContractStatus)}
      >
        {RUNTIME_CONTRACT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>

      <fieldset className="af-runtime-policies">
        <legend>Policies</legend>
        {POLICY_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="text"
              value={draftPolicies[key]}
              onChange={(event) => updatePolicy(key, event.target.value)}
              placeholder={contract.policies[key]}
            />
          </Field>
        ))}
      </fieldset>

      <TextareaField
        label="reviewer_notes"
        rows={4}
        value={draftNotes}
        onChange={(event) => setDraftNotes(event.target.value)}
        placeholder="검토 결정 근거, 외부 producer 와의 합의, 후속 작업 메모 등"
      />

      <div className="af-runtime-required">
        <h4>required_review_fields</h4>
        {contract.required_review_fields.length === 0 ? (
          <p className="af-design-empty">필수 검토 필드가 없습니다.</p>
        ) : (
          <ul>
            {contract.required_review_fields.map((field) => (
              <li key={field}>
                <code>{field}</code>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="af-runtime-readiness-block">
        <h4>Readiness issues ({issues.length})</h4>
        {issues.length === 0 ? (
          <p className="af-runtime-readiness-ready">readiness OK — 모든 필드가 채워졌습니다.</p>
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>

      {blockApproval ? (
        <p className="af-runtime-warning">
          contract_status 를 approved 로 저장하려면 readiness issue 를 먼저 모두 해소하세요.
        </p>
      ) : null}

      <div className="af-action-row">
        <Button variant="ghost" type="button" onClick={handleRevert} disabled={!hasChanges || saving}>
          되돌리기
        </Button>
        <Button variant="primary" type="button" onClick={handleSave} disabled={!hasChanges || saving || blockApproval}>
          {saving ? "저장 중…" : "이 계약 저장"}
        </Button>
      </div>

      {contract.developer_todos.length > 0 ? (
        <details className="af-runtime-todos">
          <summary>developer_todos ({contract.developer_todos.length})</summary>
          <ul>
            {contract.developer_todos.map((todo) => (
              <li key={todo}>{todo}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function summarizeRuntimeSupport(support: RuntimeContract["runtime_support"]): string {
  const flags: string[] = [];
  if (support.context_manager_required) flags.push("context_manager");
  if (support.callback_broker_required) flags.push("callback_broker");
  if (support.human_approval_required) flags.push("human_approval");
  if (support.idempotency_required) flags.push("idempotency");
  if (support.audit_required) flags.push("audit");
  if (support.compensation_required) flags.push("compensation");
  return flags.length ? flags.join(", ") : "none";
}
