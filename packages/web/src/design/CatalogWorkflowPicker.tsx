import { useMemo, useState } from "react";
import { Button, Field } from "../ui/primitives";
import { useCatalog, type CatalogHubEntry } from "../state/useCatalog";

interface CatalogWorkflowPickerProps {
  inserting?: boolean;
  onClose: () => void;
  onInsert: (entry: CatalogHubEntry) => void;
}

export function CatalogWorkflowPicker({ inserting = false, onClose, onInsert }: CatalogWorkflowPickerProps) {
  const { data, isLoading, error } = useCatalog();
  const [query, setQuery] = useState("");
  const workflows = data?.workflows ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workflows;
    return workflows.filter((entry) =>
      [entry.name, entry.owner_domain, entry.status, entry.responsibility]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [query, workflows]);

  return (
    <div className="af-modal-backdrop" role="dialog" aria-modal="true" aria-label="카탈로그 워크플로우 삽입">
      <div className="af-modal af-catalog-workflow-modal">
        <header className="af-modal-header">
          <h2>카탈로그 워크플로우 삽입</h2>
          <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="af-modal-body">
          <Field label="검색">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 도메인, 책임"
            />
          </Field>
          {isLoading ? <p className="af-landing-message">카탈로그 불러오는 중…</p> : null}
          {error ? <p className="af-landing-error">카탈로그 워크플로우를 불러오지 못했습니다.</p> : null}
          {!isLoading && !error && filtered.length === 0 ? (
            <p className="af-landing-message">선택할 수 있는 workflow 항목이 없습니다.</p>
          ) : null}
          {filtered.length > 0 ? (
            <ul className="af-catalog-workflow-list">
              {filtered.map((entry) => (
                <li key={entry.id} className="af-catalog-workflow-row">
                  <div className="af-catalog-workflow-main">
                    <div className="af-catalog-workflow-title">
                      <strong>{entry.name}</strong>
                      {typeof entry.version === "number" ? <span>v{entry.version}</span> : null}
                      {entry.status ? <span>{entry.status}</span> : null}
                    </div>
                    <small>{entry.owner_domain ?? "owner_domain 미지정"}</small>
                    <p>{entry.responsibility ?? "responsibility 미지정"}</p>
                  </div>
                  <Button type="button" variant="primary" onClick={() => onInsert(entry)} disabled={inserting}>
                    선택
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <footer className="af-modal-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </footer>
      </div>
    </div>
  );
}
