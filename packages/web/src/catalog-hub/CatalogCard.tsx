import { Link } from "react-router-dom";
import type { CatalogHubEntry } from "../catalog/catalogIndex";
import { CategoryBadge, ProtocolBadge } from "../components/CategoryBadge";
import { Button } from "../ui/primitives";

interface CatalogCardProps {
  entry: CatalogHubEntry;
  onPin?: (entry: CatalogHubEntry) => void;
  pinDisabledReason?: string;
  mockLabHref?: string;
}

export function CatalogCard({ entry, onPin, pinDisabledReason, mockLabHref }: CatalogCardProps) {
  const protocol = entry.binding?.kind === "a2a" || entry.exposure?.protocol === "a2a"
    ? "a2a"
    : entry.binding?.kind === "mcp"
      ? "mcp"
      : null;
  return (
    <article className="af-catalog-card">
      <header className="af-catalog-card-header">
        <CategoryBadge category={entry.asset_type} />
        {protocol ? <ProtocolBadge value={protocol} /> : null}
        <strong>{entry.name}</strong>
        <span className="af-catalog-owner">{entry.owner}</span>
      </header>
      {entry.responsibility ? <p className="af-catalog-responsibility">{entry.responsibility}</p> : null}
      <dl className="af-catalog-io">
        <div>
          <dt>inputs</dt>
          <dd>{(entry.inputs ?? []).length === 0 ? "—" : entry.inputs!.map((field) => `${field.name}:${field.type}`).join(", ")}</dd>
        </div>
        <div>
          <dt>outputs</dt>
          <dd>{(entry.outputs ?? []).length === 0 ? "—" : entry.outputs!.map((field) => `${field.name}:${field.type}`).join(", ")}</dd>
        </div>
      </dl>
      <footer className="af-catalog-card-footer">
        <div className="af-catalog-flags">
          {entry.status ? <span className={`af-catalog-flag af-catalog-flag-${entry.status}`}>{entry.status}</span> : null}
          {entry.contract_status ? <span className="af-catalog-flag af-catalog-flag-contract">{entry.contract_status}</span> : null}
          {entry.binding ? <span className="af-catalog-flag af-catalog-flag-binding">{entry.binding.kind}</span> : null}
        </div>
        <div className="af-catalog-card-actions">
          {mockLabHref ? <Link className="ui-button ui-button-secondary" to={mockLabHref}>Mock Lab</Link> : null}
          {onPin ? (
            <Button
              type="button"
              variant="primary"
              disabled={Boolean(pinDisabledReason)}
              onClick={() => onPin(entry)}
              title={pinDisabledReason ?? "현재 root의 자산 후보에 Catalog binding을 추가합니다."}
            >
              현재 root에 핀
            </Button>
          ) : null}
        </div>
      </footer>
      {pinDisabledReason ? <small className="af-catalog-disabled-hint">{pinDisabledReason}</small> : null}
    </article>
  );
}
