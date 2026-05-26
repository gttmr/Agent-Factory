import { CategoryBadge, SubtypeBadge } from "../components/CategoryBadge";
import { Button } from "../ui/primitives";
import type { CatalogHubEntry } from "../state/useCatalog";

interface CatalogCardProps {
  entry: CatalogHubEntry;
  onPin?: (entry: CatalogHubEntry) => void;
  pinDisabledReason?: string;
}

export function CatalogCard({ entry, onPin, pinDisabledReason }: CatalogCardProps) {
  return (
    <article className="af-catalog-card">
      <header className="af-catalog-card-header">
        <CategoryBadge category={entry.category} />
        {entry.subtype ? <SubtypeBadge value={entry.subtype} /> : null}
        <strong>{entry.name}</strong>
        {entry.owner_domain ? <span className="af-catalog-owner">{entry.owner_domain}</span> : null}
      </header>
      {entry.responsibility ? <p className="af-catalog-responsibility">{entry.responsibility}</p> : null}
      <dl className="af-catalog-io">
        <div>
          <dt>inputs</dt>
          <dd>
            {(entry.inputs ?? []).length === 0
              ? "—"
              : (entry.inputs ?? []).map((field) => `${field.name}:${field.type}`).join(", ")}
          </dd>
        </div>
        <div>
          <dt>outputs</dt>
          <dd>
            {(entry.outputs ?? []).length === 0
              ? "—"
              : (entry.outputs ?? []).map((field) => `${field.name}:${field.type}`).join(", ")}
          </dd>
        </div>
      </dl>
      <footer className="af-catalog-card-footer">
        <div className="af-catalog-flags">
          {entry.status ? <span className={`af-catalog-flag af-catalog-flag-${entry.status}`}>{entry.status}</span> : null}
          {entry.contract_status ? (
            <span className="af-catalog-flag af-catalog-flag-contract">{entry.contract_status}</span>
          ) : null}
          {entry.runtime_binding ? (
            <span className="af-catalog-flag af-catalog-flag-binding">{entry.runtime_binding}</span>
          ) : null}
        </div>
        {onPin ? (
          <Button
            type="button"
            variant="primary"
            disabled={Boolean(pinDisabledReason)}
            onClick={() => onPin(entry)}
            title={pinDisabledReason ?? "현재 root 의 모듈 후보에 catalog 바인딩을 추가합니다."}
          >
            현재 root 에 핀
          </Button>
        ) : null}
      </footer>
      {pinDisabledReason ? <small className="af-catalog-disabled-hint">{pinDisabledReason}</small> : null}
    </article>
  );
}
