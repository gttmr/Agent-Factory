import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { CatalogCard } from "../catalog-hub/CatalogCard";
import { PinTargetDialog } from "../catalog-hub/PinTargetDialog";
import { PublishApprovalDrawer } from "../catalog-hub/PublishApprovalDrawer";
import { RegisterProposalDrawer } from "../catalog-hub/RegisterProposalDrawer";
import type { CatalogHubEntry, TargetCatalogCategory } from "../catalog/catalogIndex";
import { useCatalog } from "../state/useCatalog";
import { useArtifactRoots } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { buildMockLabRoute } from "../mock-lab/mockLabIntegration";

const CATEGORY_TABS: Array<{ id: TargetCatalogCategory; label: string }> = [
  { id: "agent", label: "Agent" },
  { id: "workflow", label: "Workflow" },
  { id: "tool", label: "Tool" }
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

  const [tab, setTab] = useState<TargetCatalogCategory>("agent");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [pinTarget, setPinTarget] = useState<CatalogHubEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const bucket = useMemo<CatalogHubEntry[]>(() => {
    if (!catalog.data) return [];
    if (tab === "agent") return catalog.data.agents;
    if (tab === "workflow") return catalog.data.workflows;
    return catalog.data.tools ?? [];
  }, [catalog.data, tab]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    bucket.forEach((entry) => {
      set.add(entry.owner);
    });
    return Array.from(set).sort();
  }, [bucket]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return bucket.filter((entry) => {
      if (ownerFilter && entry.owner !== ownerFilter) return false;
      if (!lower) return true;
      const haystack = [entry.name, entry.responsibility, entry.owner, ...entry.business_domains, ...entry.capability_tags]
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
          description="등록된 Agent/Workflow/Tool 자산을 검색해 활성 root에 바인딩하고, 신규 등록 제안과 승인 publish를 관리합니다. A2A는 Agent의 Binding 또는 Exposure로 표시됩니다."
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
              <Button type="button" variant="secondary" onClick={() => setApprovalDrawerOpen(true)} disabled={!activeReqId}>
                등록 승인
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
              aria-label="owner 필터"
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
          <EmptyState title="조건에 맞는 catalog 항목이 없습니다" description="검색어/필터를 비우고 다시 시도하세요." />
        ) : null}

        <div className="af-catalog-grid">
          {filtered.map((entry) => (
            <CatalogCard
              key={entry.asset_id}
              entry={entry}
              onPin={(item) => setPinTarget(item)}
              pinDisabledReason={pinDisabledReason}
              mockLabHref={
                entry.asset_type === "tool"
                  ? buildMockLabRoute({ toolName: entry.name, reqId: activeReqId || null })
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
      {approvalDrawerOpen && activeReqId ? (
        <PublishApprovalDrawer
          reqId={activeReqId}
          onClose={() => setApprovalDrawerOpen(false)}
          onPublished={(msg) => setMessage(msg)}
        />
      ) : null}
    </div>
  );
}
