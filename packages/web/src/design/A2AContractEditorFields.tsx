import {
  A2A_RUNTIME_AUTH_MODES,
  A2A_RUNTIME_FALLBACK_MODES,
  type A2AContract,
  type A2ARuntimeAuthMode,
  type A2ARuntimeFallbackMode,
  type A2ARuntimePolicy
} from "../analyzer/types";
import { Button, Field, SelectField, TextareaField } from "../ui/primitives";
import {
  formatA2ANullableNumber,
  nullableA2AText,
  parseA2ANullableNumber,
  splitA2ATextList
} from "./A2AContractPanelModel";

export function A2ARuntimePolicyEditor({
  policy,
  onChange
}: {
  policy: A2ARuntimePolicy;
  onChange: (policy: A2ARuntimePolicy) => void;
}) {
  const authEnvDisabled = policy.auth.mode === "none";
  return (
    <div className="af-a2a-repeat">
      <div className="af-a2a-repeat-header">
        <strong>adk_runtime_policy</strong>
        <small>ADK timeout/auth만 생성하고 retry/fallback은 handoff로 남깁니다.</small>
      </div>
      <div className="af-a2a-grid">
        <Field label="timeout_seconds">
          <input
            type="number"
            min="1"
            value={formatA2ANullableNumber(policy.timeout_seconds)}
            onChange={(event) => onChange({ ...policy, timeout_seconds: parseA2ANullableNumber(event.target.value) })}
          />
        </Field>
        <SelectField
          label="auth.mode"
          value={policy.auth.mode}
          onChange={(event) =>
            onChange({
              ...policy,
              auth: { ...policy.auth, mode: event.target.value as A2ARuntimeAuthMode }
            })
          }
        >
          {A2A_RUNTIME_AUTH_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </SelectField>
        <Field label="auth.env_var">
          <input
            value={policy.auth.env_var ?? ""}
            disabled={authEnvDisabled}
            onChange={(event) =>
              onChange({
                ...policy,
                auth: { ...policy.auth, env_var: nullableA2AText(event.target.value) }
              })
            }
          />
        </Field>
        <Field label="auth.metadata_key">
          <input
            value={policy.auth.metadata_key ?? ""}
            disabled={policy.auth.mode !== "metadata_env"}
            onChange={(event) =>
              onChange({
                ...policy,
                auth: { ...policy.auth, metadata_key: nullableA2AText(event.target.value) }
              })
            }
          />
        </Field>
      </div>
      <div className="af-a2a-grid">
        <Field label="retry_handoff.max_attempts">
          <input
            type="number"
            min="1"
            value={formatA2ANullableNumber(policy.retry_handoff.max_attempts)}
            onChange={(event) =>
              onChange({
                ...policy,
                retry_handoff: {
                  ...policy.retry_handoff,
                  max_attempts: parseA2ANullableNumber(event.target.value)
                }
              })
            }
          />
        </Field>
        <Field label="retry_handoff.backoff_seconds">
          <input
            type="number"
            min="1"
            value={formatA2ANullableNumber(policy.retry_handoff.backoff_seconds)}
            onChange={(event) =>
              onChange({
                ...policy,
                retry_handoff: {
                  ...policy.retry_handoff,
                  backoff_seconds: parseA2ANullableNumber(event.target.value)
                }
              })
            }
          />
        </Field>
        <SelectField
          label="fallback_handoff.mode"
          value={policy.fallback_handoff.mode}
          onChange={(event) =>
            onChange({
              ...policy,
              fallback_handoff: {
                ...policy.fallback_handoff,
                mode: event.target.value as A2ARuntimeFallbackMode
              }
            })
          }
        >
          {A2A_RUNTIME_FALLBACK_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </SelectField>
      </div>
      <A2ATextListField
        label="retry_handoff.retry_on"
        values={policy.retry_handoff.retry_on}
        onChange={(values) => onChange({ ...policy, retry_handoff: { ...policy.retry_handoff, retry_on: values } })}
      />
      <TextareaField
        label="fallback_handoff.message"
        rows={3}
        value={policy.fallback_handoff.message ?? ""}
        onChange={(event) =>
          onChange({
            ...policy,
            fallback_handoff: { ...policy.fallback_handoff, message: nullableA2AText(event.target.value) }
          })
        }
      />
    </div>
  );
}

export function A2AInterfaceEditor({
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
            <input
              value={entry.protocol_binding}
              onChange={(event) => onUpdate(index, { protocol_binding: event.target.value })}
            />
          </Field>
          <Field label="protocol_version">
            <input
              value={entry.protocol_version}
              onChange={(event) => onUpdate(index, { protocol_version: event.target.value })}
            />
          </Field>
          <Field label="tenant_policy">
            <input
              value={entry.tenant_policy}
              onChange={(event) => onUpdate(index, { tenant_policy: event.target.value })}
            />
          </Field>
        </div>
      ))}
    </div>
  );
}

export function A2ASecurityEditor({
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
            <input
              value={entry.scheme_name}
              onChange={(event) => onUpdateRequirement(index, { scheme_name: event.target.value })}
            />
          </Field>
          <A2ATextListField
            label="scopes"
            values={entry.scopes}
            onChange={(values) => onUpdateRequirement(index, { scopes: values })}
          />
        </div>
      ))}
    </div>
  );
}

export function A2ATextListField({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <TextareaField
      label={label}
      rows={3}
      value={values.join("\n")}
      onChange={(event) => onChange(splitA2ATextList(event.target.value))}
      hint="쉼표 또는 줄바꿈으로 여러 값을 입력합니다."
    />
  );
}

export function A2ACheckGroup<T extends string>({
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
