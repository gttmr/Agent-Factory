import type { ReactNode } from "react";
import {
  A2A_CONTRACT_STATUSES,
  type A2AContractStatus,
  type A2APartField,
  type A2ARole,
  type A2AStreamWrapper,
  type TaskState
} from "../../analyzer/types";
import { isNeedsInfoValue } from "./helpers";

export const contractStatusLabels: Record<A2AContractStatus, string> = {
  draft: "초안",
  needs_info: "정보 필요",
  approved: "승인됨"
};

export const partFieldLabels: Record<A2APartField, string> = {
  text: "text",
  raw: "raw",
  url: "url",
  data: "data"
};

export const roleLabels: Record<A2ARole, string> = {
  ROLE_USER: "ROLE_USER (사용자)",
  ROLE_AGENT: "ROLE_AGENT (에이전트)"
};

export const streamWrapperLabels: Record<A2AStreamWrapper, string> = {
  task: "task",
  message: "message",
  taskStatusUpdate: "taskStatusUpdate",
  taskArtifactUpdate: "taskArtifactUpdate"
};

export function ContractStatusSelect({
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

export function ReviewSection({
  title,
  children,
  hint,
  highlight,
  defaultOpen = true
}: {
  title: string;
  children: ReactNode;
  hint?: string;
  highlight?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <details className={`a2a-section ${highlight ? "is-highlight" : ""}`} open={defaultOpen}>
      <summary className="a2a-section-header">
        <span className="a2a-section-title">{title}</span>
        {hint ? <span className="a2a-section-hint inline">{hint}</span> : null}
      </summary>
      <div className="a2a-section-body">{children}</div>
    </details>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="a2a-field-row">
      <span className="a2a-field-label">{label}</span>
      <div className="a2a-field-value">{children}</div>
    </div>
  );
}

export function NeedsInfoText({
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

export function PillList({ values, emptyText }: { values: string[]; emptyText: string }) {
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

export function renderTextValue(value: string) {
  if (isNeedsInfoValue(value)) {
    return <span className="a2a-needs-info-tag">정보 필요</span>;
  }
  return <span className="a2a-text-value">{value}</span>;
}

export function renderTaskState(state: TaskState) {
  return state;
}
