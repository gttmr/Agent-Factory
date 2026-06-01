import { useMemo, useState } from "react";
import type { CatalogPrefillPayload, MockSpec } from "../types/mockSpec";
import StatusBadge from "./StatusBadge";

export default function CatalogPrefillPanel({
  catalog,
  mocks,
  selectedMockId,
  onSelectMock,
  onPrefill
}: {
  catalog: CatalogPrefillPayload;
  mocks: Array<{ mock_id: string; server_name: string }>;
  selectedMockId: string;
  onSelectMock: (mockId: string) => void;
  onPrefill: (prefill: MockSpec) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return catalog.entries;
    return catalog.entries.filter((entry) =>
      [entry.name, entry.adapter_kind, entry.owner_domain, entry.access_protocol, entry.contract_status]
        .join(" ")
        .toLowerCase()
        .includes(lower)
    );
  }, [catalog.entries, query]);

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Catalog Prefill</h2>
          <p>{catalog.source_file || "catalog/adapters.yaml"} read-only</p>
        </div>
        <StatusBadge tone="purple">{filtered.length}</StatusBadge>
      </div>

      <label className="field">
        <span>저장된 Mock</span>
        <select value={selectedMockId} onChange={(event) => onSelectMock(event.target.value)}>
          <option value={selectedMockId}>{selectedMockId}</option>
          {mocks
            .filter((mock) => mock.mock_id !== selectedMockId)
            .map((mock) => (
              <option key={mock.mock_id} value={mock.mock_id}>
                {mock.mock_id}
              </option>
            ))}
        </select>
      </label>

      <label className="field">
        <span>검색</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="adapter, domain, protocol" />
      </label>

      <div className="prefill-list">
        {filtered.map((entry) => (
          <button className="prefill-item" key={entry.name} type="button" onClick={() => onPrefill(entry.prefill)}>
            <span className="prefill-title">{entry.name}</span>
            <span className="prefill-meta">
              {entry.adapter_kind} · {entry.owner_domain} · {entry.access_protocol}
            </span>
            <span className="badge-row">
              <StatusBadge tone={entry.has_runtime_mock ? "success" : "warning"}>
                {entry.has_runtime_mock ? "runtime_mock" : "schema only"}
              </StatusBadge>
              <StatusBadge>{entry.contract_status}</StatusBadge>
            </span>
            <span className="compact-json">
              in {entry.inputs.length} · out {entry.outputs.length} · risk {entry.risk_signals.length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
