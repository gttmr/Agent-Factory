import { useState } from "react";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts";
import { RUNTIME_CONTRACT_STATUSES, type RuntimeContract } from "../analyzer/types";
import { Button, Field, SectionHeader, SelectField, TextareaField } from "../ui/primitives";
import {
  OPERATION_BOOLEAN_FIELDS,
  OPERATION_TYPE_OPTIONS,
  POLICY_FIELDS,
  RUNTIME_SUPPORT_FIELDS,
  SIDE_EFFECT_LEVEL_OPTIONS,
  applyRuntimeContractEditorDraft,
  createDefaultAsyncResumePolicy,
  createDefaultAsyncResumeSideEffectGuard,
  createRuntimeContractEditorDraft,
  hasRuntimeContractEditorDraftChanges,
  runtimeContractGraphAnnotationKeys,
  summarizeRuntimeSupport,
  updateRuntimeContractGraphAnnotation,
  type RuntimeContractEditorDraft
} from "./RuntimeContractEditorModel";

type PolicyKey = (typeof POLICY_FIELDS)[number][0];
type RuntimeSupportKey = (typeof RUNTIME_SUPPORT_FIELDS)[number][0];

interface RuntimeContractEditorProps {
  readonly contract: RuntimeContract;
  readonly saving: boolean;
  readonly onSave: (next: RuntimeContract) => void;
  readonly onCancel: () => void;
}

export function RuntimeContractEditor({ contract, saving, onSave, onCancel }: RuntimeContractEditorProps) {
  const [draft, setDraft] = useState(() => createRuntimeContractEditorDraft(contract));
  const nextContract = applyRuntimeContractEditorDraft(contract, draft);
  const issues = runtimeContractReadinessIssues(nextContract);
  const hasChanges = hasRuntimeContractEditorDraftChanges(contract, draft);
  const graphAnnotationKeys = runtimeContractGraphAnnotationKeys(contract);
  const blockApproval = draft.contract_status === "approved" && issues.some((issue) => !issue.startsWith("contract_status"));

  function updateDraft<Key extends keyof RuntimeContractEditorDraft>(key: Key, value: RuntimeContractEditorDraft[Key]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updatePolicy(key: PolicyKey, value: string) {
    setDraft((prev) => ({ ...prev, policies: { ...prev.policies, [key]: value } }));
  }

  function updateRuntimeSupport(key: RuntimeSupportKey, value: boolean) {
    setDraft((prev) => ({ ...prev, runtime_support: { ...prev.runtime_support, [key]: value } }));
  }

  function updateOperation<Key extends keyof RuntimeContract["operation"]>(
    key: Key,
    value: RuntimeContract["operation"][Key]
  ) {
    setDraft((prev) => ({ ...prev, operation: { ...prev.operation, [key]: value } }));
  }

  function updateResumePolicy<Key extends keyof NonNullable<RuntimeContract["resume_policy"]>>(
    key: Key,
    value: NonNullable<RuntimeContract["resume_policy"]>[Key]
  ) {
    setDraft((prev) => ({
      ...prev,
      resume_policy: { ...(prev.resume_policy ?? createDefaultAsyncResumePolicy(contract)), [key]: value }
    }));
  }

  function updateSideEffectGuard<Key extends keyof NonNullable<RuntimeContract["side_effect_guard"]>>(
    key: Key,
    value: NonNullable<RuntimeContract["side_effect_guard"]>[Key]
  ) {
    setDraft((prev) => ({
      ...prev,
      side_effect_guard: { ...(prev.side_effect_guard ?? createDefaultAsyncResumeSideEffectGuard()), [key]: value }
    }));
  }

  function updateGraphAnnotation(key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      graph_ir_annotations: updateRuntimeContractGraphAnnotation(prev.graph_ir_annotations, key, value)
    }));
  }

  function handleSave() {
    if (blockApproval) return;
    onSave(nextContract);
  }

  function handleRevert() {
    setDraft(createRuntimeContractEditorDraft(contract));
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
          <dt>asset_id</dt>
          <dd>{contract.asset_id ?? "—"}</dd>
        </div>
        <div>
          <dt>operation</dt>
          <dd>
            {draft.operation.operation_type} · {draft.operation.side_effect_level}
            {draft.operation.callback_expected ? " · callback" : ""}
            {draft.operation.async_resume_required ? " · async_resume" : ""}
          </dd>
        </div>
        <div>
          <dt>runtime_support</dt>
          <dd>{summarizeRuntimeSupport(draft.runtime_support)}</dd>
        </div>
        <div>
          <dt>identifiers</dt>
          <dd>{contract.identifiers.length ? contract.identifiers.join(", ") : "—"}</dd>
        </div>
      </dl>

      <SelectField
        label="contract_status"
        value={draft.contract_status}
        onChange={(event) => {
          const nextStatus = RUNTIME_CONTRACT_STATUSES.find((status) => status === event.target.value);
          if (nextStatus) updateDraft("contract_status", nextStatus);
        }}
      >
        {RUNTIME_CONTRACT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>

      <fieldset className="af-runtime-policies">
        <legend>Operation</legend>
        <SelectField
          label="operation_type"
          value={draft.operation.operation_type}
          onChange={(event) => {
            const nextType = OPERATION_TYPE_OPTIONS.find((value) => value === event.target.value);
            if (nextType) updateOperation("operation_type", nextType);
          }}
        >
          {OPERATION_TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="side_effect_level"
          value={draft.operation.side_effect_level}
          onChange={(event) => {
            const nextLevel = SIDE_EFFECT_LEVEL_OPTIONS.find((value) => value === event.target.value);
            if (nextLevel) updateOperation("side_effect_level", nextLevel);
          }}
        >
          {SIDE_EFFECT_LEVEL_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        {OPERATION_BOOLEAN_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} hint={<code>operation.{key}</code>}>
            <input
              type="checkbox"
              checked={draft.operation[key]}
              onChange={(event) => updateOperation(key, event.target.checked)}
            />
          </Field>
        ))}
      </fieldset>

      <fieldset className="af-runtime-policies">
        <legend>Runtime support</legend>
        {RUNTIME_SUPPORT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} hint={<code>runtime_support.{key}</code>}>
            <input
              type="checkbox"
              checked={draft.runtime_support[key]}
              onChange={(event) => updateRuntimeSupport(key, event.target.checked)}
            />
          </Field>
        ))}
      </fieldset>

      <fieldset className="af-runtime-policies">
        <legend>Policies</legend>
        {POLICY_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="text"
              value={draft.policies[key]}
              onChange={(event) => updatePolicy(key, event.target.value)}
              placeholder={contract.policies[key]}
            />
          </Field>
        ))}
      </fieldset>

      {contract.contract_kind === "async_resume" ? (
        <>
          <fieldset className="af-runtime-policies">
            <legend>Async resume policy</legend>
            {draft.resume_policy ? (
              <>
                <Field label="resume_policy.interrupt_id" hint="동일 invocation의 RequestInput / FunctionResponse correlation ID">
                  <input
                    type="text"
                    value={draft.resume_policy.interrupt_id}
                    onChange={(event) => updateResumePolicy("interrupt_id", event.target.value)}
                  />
                </Field>
                <Field label="resume_policy.timeout_seconds" hint="늦게 도착한 응답은 side effect 없이 만료됩니다.">
                  <input
                    type="number"
                    min={1}
                    value={draft.resume_policy.timeout_seconds}
                    onChange={(event) => updateResumePolicy("timeout_seconds", Number(event.target.value))}
                  />
                </Field>
                <SelectField
                  label="resume_policy.correlation_scope"
                  value={draft.resume_policy.correlation_scope}
                  onChange={(event) => updateResumePolicy("correlation_scope", event.target.value as "invocation")}
                >
                  <option value="invocation">invocation</option>
                </SelectField>
                <SelectField
                  label="resume_policy.on_timeout"
                  value={draft.resume_policy.on_timeout}
                  onChange={(event) => updateResumePolicy("on_timeout", event.target.value as "expire_without_side_effect")}
                >
                  <option value="expire_without_side_effect">expire_without_side_effect</option>
                </SelectField>
                <SelectField
                  label="resume_policy.duplicate_response"
                  value={draft.resume_policy.duplicate_response}
                  onChange={(event) => updateResumePolicy("duplicate_response", event.target.value as "return_recorded_result")}
                >
                  <option value="return_recorded_result">return_recorded_result</option>
                </SelectField>
                <SelectField
                  label="resume_policy.conflicting_response"
                  value={draft.resume_policy.conflicting_response}
                  onChange={(event) => updateResumePolicy("conflicting_response", event.target.value as "reject")}
                >
                  <option value="reject">reject</option>
                </SelectField>
                <SelectField
                  label="resume_policy.restart_policy"
                  value={draft.resume_policy.restart_policy}
                  onChange={(event) => updateResumePolicy("restart_policy", event.target.value as "resume_incomplete_replay_completed")}
                >
                  <option value="resume_incomplete_replay_completed">resume_incomplete_replay_completed</option>
                </SelectField>
              </>
            ) : (
              <>
                <p className="af-design-empty">stable correlation, timeout, duplicate/restart 정책이 아직 구조화되지 않았습니다.</p>
                <Button
                  type="button"
                  onClick={() => updateDraft("resume_policy", createDefaultAsyncResumePolicy(contract))}
                >
                  Resume 정책 구조화
                </Button>
              </>
            )}
          </fieldset>

          {draft.runtime_support.idempotency_required || draft.side_effect_guard ? (
            <fieldset className="af-runtime-policies">
              <legend>Side-effect guard</legend>
              {draft.side_effect_guard ? (
                <>
                  <Field label="side_effect_guard.tool_ref" hint="Graph IR side_effect_tool_node_id의 Tool asset">
                    <input
                      type="text"
                      value={draft.side_effect_guard.tool_ref}
                      onChange={(event) => updateSideEffectGuard("tool_ref", event.target.value)}
                    />
                  </Field>
                  <Field label="side_effect_guard.idempotency_key_input" hint="선택한 Tool inputs의 필드명">
                    <input
                      type="text"
                      value={draft.side_effect_guard.idempotency_key_input}
                      onChange={(event) => updateSideEffectGuard("idempotency_key_input", event.target.value)}
                    />
                  </Field>
                  <SelectField
                    label="side_effect_guard.delivery_semantics"
                    value={draft.side_effect_guard.delivery_semantics}
                    onChange={(event) => updateSideEffectGuard("delivery_semantics", event.target.value as "at_most_once")}
                  >
                    <option value="at_most_once">at_most_once</option>
                  </SelectField>
                  <SelectField
                    label="side_effect_guard.ledger_scope"
                    value={draft.side_effect_guard.ledger_scope}
                    onChange={(event) => updateSideEffectGuard("ledger_scope", event.target.value as "session_state")}
                  >
                    <option value="session_state">session_state</option>
                  </SelectField>
                </>
              ) : (
                <>
                  <p className="af-design-empty">승인 응답 뒤의 Tool side effect를 보호할 ledger 계약이 없습니다.</p>
                  <Button
                    type="button"
                    onClick={() => updateDraft("side_effect_guard", createDefaultAsyncResumeSideEffectGuard())}
                  >
                    Side-effect guard 구조화
                  </Button>
                </>
              )}
            </fieldset>
          ) : null}
        </>
      ) : null}

      <fieldset className="af-runtime-policies">
        <legend>Graph IR annotations</legend>
        {graphAnnotationKeys.length === 0 ? (
          <p className="af-design-empty">검토가 필요한 Graph IR annotation 이 없습니다.</p>
        ) : (
          graphAnnotationKeys.map((key) => (
            <Field key={key} label={`graph_ir_annotations.${key}`}>
              <input
                type="text"
                value={draft.graph_ir_annotations[key] ?? ""}
                onChange={(event) => updateGraphAnnotation(key, event.target.value)}
                placeholder={contract.graph_ir_annotations[key] ?? "needs_info"}
              />
            </Field>
          ))
        )}
      </fieldset>

      <TextareaField
        label="reviewer_notes"
        rows={4}
        value={draft.reviewer_notes}
        onChange={(event) => updateDraft("reviewer_notes", event.target.value)}
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
