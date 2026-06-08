import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { CatalogCard } from "../catalog-hub/CatalogCard";
import { PinTargetDialog } from "../catalog-hub/PinTargetDialog";
import { RegisterProposalDrawer } from "../catalog-hub/RegisterProposalDrawer";
import { useCatalog, type CatalogCategory, type CatalogHubEntry } from "../state/useCatalog";
import { useArtifactRoots } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { buildMockLabRoute } from "../mock-lab/mockLabIntegration";

const CATEGORY_TABS: Array<{ id: CatalogCategory; label: string }> = [
  { id: "agent", label: "Agent" },
  { id: "workflow", label: "Workflow" },
  { id: "adapter", label: "Adapter" },
  { id: "remote_a2a", label: "Remote A2A" }
];

export default function ReuseHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries: recent } = useRecentRoots();
  const { data: roots = [] } = useArtifactRoots();
  const catalog = useCatalog();

  const activeReqId = useMemo(() => {
    const param = searchParams.get("req");
    if (param) return param;
    if (recent[0]) return recent[0].requirement_id;
    if (roots[0]) return roots[0].requirement_id;
    return "";
  }, [searchParams, recent, roots]);

  const [tab, setTab] = useState<CatalogCategory>("agent");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [pinTarget, setPinTarget] = useState<CatalogHubEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const bucket = useMemo<CatalogHubEntry[]>(() => {
    if (!catalog.data) return [];
    if (tab === "agent") return catalog.data.agents;
    if (tab === "workflow") return catalog.data.workflows;
    if (tab === "adapter") return catalog.data.adapters;
    return catalog.data.remoteA2A;
  }, [catalog.data, tab]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    bucket.forEach((entry) => {
      if (entry.owner_domain) set.add(entry.owner_domain);
    });
    return Array.from(set).sort();
  }, [bucket]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return bucket.filter((entry) => {
      if (ownerFilter && entry.owner_domain !== ownerFilter) return false;
      if (!lower) return true;
      const haystack = [entry.name, entry.responsibility, entry.subtype, entry.owner_domain]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [bucket, query, ownerFilter]);

  const pinDisabledReason = !activeReqId
    ? "활성 artifact root 가 없습니다. 우상단에서 선택하거나 Landing 에서 root 를 먼저 만드세요."
    : undefined;

  return (
    <div className="af-stage-workspace">
      <Panel>
        <SectionHeader
          eyebrow="Reuse Hub"
          title="공통 카탈로그 탐색"
          description="등록된 Agent/Workflow/Adapter/Remote A2A 컴포넌트를 검색·재사용 핀으로 활성 root 에 바인딩하거나, 신규 등록 제안을 catalog-delta.yaml 에 기록합니다."
          action={
            <div className="af-action-row">
              <label className="af-active-root-picker">
                <span>활성 root</span>
                <select
                  value={activeReqId}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next) setSearchParams({ req: next });
                    else setSearchParams({});
                  }}
                >
                  <option value="">(선택 없음)</option>
                  {roots.map((root) => (
                    <option key={root.requirement_id} value={root.requirement_id}>
                      {root.requirement_id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="primary" onClick={() => setDrawerOpen(true)} disabled={!activeReqId}>
                신규 등록 제안…
              </Button>
            </div>
          }
        />
        {message ? <p className="af-landing-message">{message}</p> : null}
        {!activeReqId ? (
          <p className="af-landing-message">
            활성 root 없이도 탐색은 가능합니다. 핀/제안은 활성 root 를 선택해야 합니다 (<Link to="/">Landing</Link>).
          </p>
        ) : null}
      </Panel>

      <Panel>
        <div className="af-catalog-toolbar">
          <nav className="af-catalog-tabs" role="tablist">
            {CATEGORY_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`af-catalog-tab${tab === entry.id ? " af-catalog-tab-active" : ""}`}
                onClick={() => {
                  setTab(entry.id);
                  setOwnerFilter("");
                }}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <input
            type="search"
            placeholder="검색 (이름, 책임, owner)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="af-catalog-search"
            aria-label="catalog 검색"
          />
          {owners.length > 0 ? (
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="af-catalog-filter"
              aria-label="owner_domain 필터"
            >
              <option value="">owner 전체</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {catalog.isLoading ? <p className="af-landing-message">catalog 불러오는 중…</p> : null}
        {catalog.error ? (
          <p className="af-landing-error">catalog 조회 실패: {(catalog.error as Error).message}</p>
        ) : null}
        {!catalog.isLoading && filtered.length === 0 ? (
          tab === "remote_a2a" ? (
            <EmptyState
              title="등록된 Remote A2A contract 가 없습니다"
              description="신규 등록 제안으로 첫 항목을 만들거나, templates/regression-scenarios/scenario-e-true-remote-a2a/ 의 예시를 참고하세요."
            />
          ) : (
            <EmptyState title="조건에 맞는 catalog 항목이 없습니다" description="검색어/필터를 비우고 다시 시도하세요." />
          )
        ) : null}

        <div className="af-catalog-grid">
          {filtered.map((entry) => (
            <CatalogCard
              key={entry.id}
              entry={entry}
              onPin={(item) => setPinTarget(item)}
              pinDisabledReason={pinDisabledReason}
              mockLabHref={
                entry.category === "adapter"
                  ? buildMockLabRoute({ adapterName: entry.name, reqId: activeReqId || null })
                  : undefined
              }
            />
          ))}
        </div>
      </Panel>

      {pinTarget && activeReqId ? (
        <PinTargetDialog
          reqId={activeReqId}
          entry={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={(msg) => setMessage(msg)}
        />
      ) : null}
      {drawerOpen && activeReqId ? (
        <RegisterProposalDrawer
          reqId={activeReqId}
          onClose={() => setDrawerOpen(false)}
          onSaved={(msg) => setMessage(msg)}
        />
      ) : null}
    </div>
  );
}
