import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "secondary", className, ...props }: ButtonProps) {
  return <button {...props} className={["ui-button", `ui-button-${variant}`, className].filter(Boolean).join(" ")} />;
}

interface PanelProps {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}

export function Panel({ children, className, tone = "default" }: PanelProps) {
  return <section className={["ui-panel", `ui-panel-${tone}`, className].filter(Boolean).join(" ")}>{children}</section>;
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="ui-section-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="ui-section-description">{description}</p> : null}
      </div>
      {action ? <div className="ui-section-action">{action}</div> : null}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function SelectField({ label, children, ...props }: SelectFieldProps) {
  return (
    <Field label={label}>
      <select {...props}>{children}</select>
    </Field>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
}

export function TextareaField({ label, hint, ...props }: TextareaFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <textarea {...props} />
    </Field>
  );
}

interface FileFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

export function FileField({ label, hint, ...props }: FileFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <input {...props} type="file" className={["file-input", props.className].filter(Boolean).join(" ")} />
    </Field>
  );
}

interface MetricPillProps {
  label: string;
  value: ReactNode;
}

export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <span className="metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state ui-empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
