import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";

interface InspectorPanelProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function InspectorPanel({ title, eyebrow, children, meta, actions, className }: InspectorPanelProps) {
  return (
    <aside className={["review-inspector", className].filter(Boolean).join(" ")}>
      <header className="review-inspector-header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {meta ? <div className="review-inspector-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="review-inspector-actions">{actions}</div> : null}
      </header>
      <div className="review-inspector-body">{children}</div>
    </aside>
  );
}

interface ReadinessListProps {
  title: string;
  issues: string[];
  emptyText?: string;
  tone?: "default" | "warning" | "success";
}

export function ReadinessList({ title, issues, emptyText = "확인된 blocker가 없습니다.", tone = "default" }: ReadinessListProps) {
  const resolvedTone = issues.length > 0 ? tone : "success";
  return (
    <section className={`readiness-list readiness-${resolvedTone}`}>
      <h4>{title}</h4>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

interface SelectableTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

export function SelectableTableRow({
  selected,
  onSelect,
  children,
  className,
  onKeyDown,
  ...props
}: SelectableTableRowProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <tr
      {...props}
      className={["selectable-table-row", selected ? "is-selected" : "", className].filter(Boolean).join(" ")}
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {children}
    </tr>
  );
}

interface FieldGroupProps {
  title: string;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function FieldGroup({ title, description, children, className }: FieldGroupProps) {
  return (
    <section className={["review-field-group", className].filter(Boolean).join(" ")}>
      <header>
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="review-field-group-body">{children}</div>
    </section>
  );
}
