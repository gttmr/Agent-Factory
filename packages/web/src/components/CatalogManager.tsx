import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  accessProtocolLabels,
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import {
  accessProtocols,
  adapterKinds,
  agentKinds,
  moduleCategories,
  remoteContractKinds,
  workflowKinds
} from "../analyzer/types";
import type {
  AccessProtocol,
  AdapterKind,
  AgentKind,
  ComponentSource,
  FieldSpec,
  ModuleCandidate,
  ModuleCategory,
  RemoteContractKind,
  RiskSignal,
  WorkflowKind
} from "../analyzer/types";
import { runtimeBindings, type CatalogEntry, type RuntimeBinding } from "../catalog/types";
import { buildChangeSet, snapshotOf } from "../catalog/diff";
import { refreshRuntimeBinding } from "../catalog/runtimeBinding";
import { CategoryBadge, ProtocolBadge, SubtypeBadge } from "./CategoryBadge";
import { FieldGroup, InspectorPanel, ReadinessList, SelectableTableRow } from "../ui/review";

interface CatalogManagerProps {
  entries: CatalogEntry[];
  onEntriesChange: (entries: CatalogEntry[]) => void;
  moduleCandidates: ModuleCandidate[];
  onContinue: () => void;
}

const provenanceLabel: Record<CatalogEntry["provenance"], string> = {
  seeded: "기존",
  session_added: "추가",
  session_edited: "수정",
  session_deleted: "삭제 예정"
};

const provenanceClass: Record<CatalogEntry["provenance"], string> = {
  seeded: "prov-seeded",
  session_added: "prov-added",
  session_edited: "prov-edited",
  session_deleted: "prov-deleted"
};

const runtimeBindingLabels: Record<RuntimeBinding, string> = {
  unresolved: "미정",
  mcp: "MCP",
  stub: "Stub",
  remote_a2a: "Remote A2A"
};

const componentSources: ComponentSource[] = ["mcp", "stub"];
const componentSourceLabels: Record<ComponentSource, string> = {
  mcp: "MCP",
  stub: "Stub/TODO"
};

const riskSignalOptions: RiskSignal[] = [
  "personal_data",
  "financial_data",
  "credit_decision_support",
  "customer_impact",
  "external_message",
  "transaction_write",
  "human_approval_required",
  "audit_required"
];

export function CatalogManager({ entries, onEntriesChange, moduleCandidates, onContinue }: CatalogManagerProps) {
  const [filterCategory, setFilterCategory] = useState<ModuleCategory | "all">("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(entries[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogEntry | null>(null);

  const changeSet = useMemo(() => buildChangeSet(entries), [entries]);
  const totalChanges = changeSet.added.length + changeSet.updated.length + changeSet.removed.length;

  const filteredEntries = useMemo(() => {
    const visible = filterCategory === "all" ? entries : entries.filter((entry) => entry.module_category === filterCategory);
    return [...visible].sort((a, b) => {
      if (a.provenance === "session_deleted" && b.provenance !== "session_deleted") return 1;
      if (a.provenance !== "session_deleted" && b.provenance === "session_deleted") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [entries, filterCategory]);

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? entries.find(Boolean) ?? null;
  const candidateRows = useMemo(
    () => moduleCandidates.map((candidate) => ({ candidate, match: findMatchingEntry(candidate, entries) })),
    [moduleCandidates, entries]
  );

  useEffect(() => {
    if (!selectedEntry && filteredEntries[0]) {
      setSelectedEntryId(filteredEntries[0].id);
      return;
    }
    if (selectedEntry && filterCategory !== "all" && selectedEntry.module_category !== filterCategory && filteredEntries[0]) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [filterCategory, filteredEntries, selectedEntry]);

  function startEdit(entry: CatalogEntry) {
    setSelectedEntryId(entry.id);
    setEditingId(entry.id);
    setDraft({ ...entry });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft || !editingId) return;
    onEntriesChange(
      entries.map((entry) => {
        if (entry.id !== editingId) return entry;
        const cleaned = normalizeEntryDraft(draft);
        if (entry.provenance === "session_added") {
          return refreshRuntimeBinding({ ...cleaned, provenance: "session_added" });
        }
        const baseSnapshot = entry.originalSnapshot ?? snapshotOf(entry);
        return refreshRuntimeBinding({ ...cleaned, provenance: "session_edited", originalSnapshot: baseSnapshot });
      })
    );
    setSelectedEntryId(editingId);
    cancelEdit();
  }

  function startNew(category: ModuleCategory) {
    const id = `session-${category}-${Date.now()}`;
    const empty = refreshRuntimeBinding({
      id,
      name: "",
      module_category: category,
      component_source: "stub",
      provenance: "session_added"
    });
    setSelectedEntryId(id);
    setEditingId(id);
    setDraft(empty);
    setFilterCategory(category);
    onEntriesChange([...entries, empty]);
  }

  function deleteEntry(entry: CatalogEntry) {
    if (entry.provenance === "session_added") {
      const nextEntries = entries.filter((candidate) => candidate.id !== entry.id);
      onEntriesChange(nextEntries);
      setSelectedEntryId(nextEntries[0]?.id ?? null);
      return;
    }
    onEntriesChange(
      entries.map((candidate) =>
        candidate.id === entry.id
          ? {
              ...candidate,
              provenance: "session_deleted",
              originalSnapshot: candidate.originalSnapshot ?? snapshotOf(candidate)
            }
          : candidate
      )
    );
  }

  function restoreEntry(entry: CatalogEntry) {
    if (entry.provenance === "session_added" || !entry.originalSnapshot) return;
    const snap = entry.originalSnapshot;
    onEntriesChange(entries.map((candidate) => (candidate.id === entry.id ? { ...snap, id: entry.id, provenance: "seeded" } : candidate)));
  }

  function promoteCandidate(candidate: ModuleCandidate) {
    const id = `session-${candidate.module_category}-${candidate.id}-${Date.now()}`;
    const newEntry = refreshRuntimeBinding({
      id,
      name: candidate.name,
      module_category: candidate.module_category,
      agent_kind: candidate.agent_kind ?? null,
      workflow_kind: candidate.workflow_kind ?? null,
      adapter_kind: candidate.adapter_kind ?? null,
      remote_contract_kind: candidate.remote_contract_kind ?? null,
      access_protocol: candidate.access_protocol ?? null,
      mcp_server: candidate.mcp_server,
      mcp_tool_name: candidate.mcp_tool_name,
      mcp_schema_ref: candidate.mcp_schema_ref,
      mcp_auth_mode: candidate.mcp_auth_mode,
      component_source: candidate.access_protocol === "mcp" ? "mcp" : "stub",
      owner_domain: candidate.owner_domain,
      status: "candidate",
      responsibility: candidate.rationale,
      inputs: candidate.inputs,
      outputs: candidate.outputs,
      risk_signals: candidate.risk_signals,
      provenance: "session_added"
    });
    onEntriesChange([...entries, newEntry]);
    setFilterCategory(candidate.module_category);
    setSelectedEntryId(id);
    setEditingId(id);
    setDraft(newEntry);
  }

  return (
    <section className="panel catalog-manager">
      <div className="section-heading">
        <p className="eyebrow">공통 자산 카탈로그</p>
        <h2>카탈로그 중심 재사용 결정</h2>
        <p className="muted">
          등록된 Agent, Workflow, Adapter, Remote A2A spec을 검토하고 분석 후보를 카탈로그에 등록할지 결정합니다. 카탈로그는 실행
          import 계약이 아니라 리뷰된 재사용 spec의 기준입니다.
        </p>
      </div>

      <div className="catalog-summary">
        <span>
          등록 항목 <strong>{entries.filter((entry) => entry.provenance !== "session_deleted").length}</strong>
        </span>
        <span>
          변경 대기 <strong>{totalChanges}</strong>
        </span>
        <span>추가 {changeSet.added.length}</span>
        <span>수정 {changeSet.updated.length}</span>
        <span>삭제 {changeSet.removed.length}</span>
      </div>

      <div className="catalog-review-console">
        <div className="catalog-review-main">
          <div className="catalog-toolbar">
            <label>
              <span>분류</span>
              <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as ModuleCategory | "all")}>
                <option value="all">전체 ({entries.length})</option>
                {moduleCategories.map((category) => (
                  <option key={category} value={category}>
                    {moduleCategoryLabels[category]} ({entries.filter((entry) => entry.module_category === category).length})
                  </option>
                ))}
              </select>
            </label>
            <div className="catalog-create-actions">
              {moduleCategories.map((category) => (
                <button key={category} type="button" onClick={() => startNew(category)}>
                  새 {moduleCategoryLabels[category]}
                </button>
              ))}
            </div>
          </div>

          <CatalogTable
            entries={filteredEntries}
            selectedEntryId={selectedEntry?.id ?? null}
            onSelect={setSelectedEntryId}
            onEdit={startEdit}
            onDelete={deleteEntry}
            onRestore={restoreEntry}
          />

          <section className="catalog-candidate-section">
            <header>
              <div>
                <p className="eyebrow">분석 후보</p>
                <h3>등록 결정</h3>
              </div>
              <span>{candidateRows.length}개 후보</span>
            </header>
            <CandidateDecisionTable rows={candidateRows} onPromote={promoteCandidate} />
          </section>
        </div>

        {editingId && draft ? (
          <CatalogEditInspector draft={draft} onDraftChange={setDraft} onSave={saveEdit} onCancel={cancelEdit} />
        ) : (
          <CatalogInspector entry={selectedEntry} onEdit={startEdit} onDelete={deleteEntry} onRestore={restoreEntry} />
        )}
      </div>

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          ADK 소스 생성으로 이동
        </button>
      </div>
    </section>
  );
}

interface CatalogTableProps {
  entries: CatalogEntry[];
  selectedEntryId: string | null;
  onSelect: (id: string) => void;
  onEdit: (entry: CatalogEntry) => void;
  onDelete: (entry: CatalogEntry) => void;
  onRestore: (entry: CatalogEntry) => void;
}

function CatalogTable({ entries, selectedEntryId, onSelect, onEdit, onDelete, onRestore }: CatalogTableProps) {
  if (!entries.length) {
    return <p className="empty-state">선택한 분류에 등록된 카탈로그 항목이 없습니다.</p>;
  }

  return (
    <div className="review-table-wrap catalog-table-wrap">
      <table className="review-table catalog-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>분류</th>
            <th>세부 유형</th>
            <th>Binding</th>
            <th>Owner</th>
            <th>Status</th>
            <th>변경</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <SelectableTableRow
              key={entry.id}
              selected={entry.id === selectedEntryId}
              onSelect={() => onSelect(entry.id)}
              className={entry.provenance === "session_deleted" ? "is-muted" : ""}
            >
              <td>
                <strong>{entry.name || "(이름 미지정)"}</strong>
                {entry.responsibility ? <small>{entry.responsibility}</small> : null}
              </td>
              <td>
                <CategoryBadge category={entry.module_category} />
              </td>
              <td>
                {subtypeForEntry(entry) ? <SubtypeBadge value={subtypeForEntry(entry) ?? "unknown"} /> : "미정"}
              </td>
              <td>{bindingLabel(entry)}</td>
              <td>{entry.owner_domain || "미지정"}</td>
              <td>{entry.status || "미지정"}</td>
              <td>
                <span className={`provenance-pill ${provenanceClass[entry.provenance]}`}>
                  {provenanceLabel[entry.provenance]}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  {entry.provenance === "session_deleted" ? (
                    <button type="button" onClick={(event) => stopRowAction(event, () => onRestore(entry))}>
                      원복
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={(event) => stopRowAction(event, () => onEdit(entry))}>
                        수정
                      </button>
                      <button type="button" className="danger" onClick={(event) => stopRowAction(event, () => onDelete(entry))}>
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </td>
            </SelectableTableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CandidateDecisionTableProps {
  rows: Array<{ candidate: ModuleCandidate; match: CatalogEntry | undefined }>;
  onPromote: (candidate: ModuleCandidate) => void;
}

function CandidateDecisionTable({ rows, onPromote }: CandidateDecisionTableProps) {
  if (!rows.length) return <p className="empty-state">분석 후보가 아직 없습니다.</p>;
  return (
    <div className="review-table-wrap catalog-candidate-table-wrap">
      <table className="review-table catalog-candidate-table">
        <thead>
          <tr>
            <th>후보</th>
            <th>분류</th>
            <th>Analyzer 제안</th>
            <th>카탈로그 상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ candidate, match }) => (
            <tr key={candidate.id}>
              <td>
                <strong>{candidate.name}</strong>
                <small>{candidate.rationale}</small>
              </td>
              <td>
                <CategoryBadge category={candidate.module_category} />
              </td>
              <td>
                {candidate.reuse_candidate ? (
                  <span className="status-pill approved">reuse 후보</span>
                ) : (
                  <span className="status-pill neutral">신규 후보</span>
                )}
              </td>
              <td>{match ? `등록됨: ${match.name}` : "미등록"}</td>
              <td>
                <button type="button" disabled={Boolean(match)} onClick={() => onPromote(candidate)}>
                  카탈로그에 등록
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CatalogInspectorProps {
  entry: CatalogEntry | null;
  onEdit: (entry: CatalogEntry) => void;
  onDelete: (entry: CatalogEntry) => void;
  onRestore: (entry: CatalogEntry) => void;
}

function CatalogInspector({ entry, onEdit, onDelete, onRestore }: CatalogInspectorProps) {
  if (!entry) {
    return (
      <InspectorPanel title="선택된 항목 없음" eyebrow="Inspector">
        <p className="review-muted">왼쪽 테이블에서 카탈로그 항목을 선택하세요.</p>
      </InspectorPanel>
    );
  }

  const readinessIssues = catalogReadinessIssues(entry);
  return (
    <InspectorPanel
      title={entry.name || "(이름 미지정)"}
      eyebrow="Catalog Inspector"
      meta={
        <>
          <CategoryBadge category={entry.module_category} />
          {subtypeForEntry(entry) ? <SubtypeBadge value={subtypeForEntry(entry) ?? "unknown"} /> : null}
          {entry.access_protocol ? <ProtocolBadge value={entry.access_protocol} /> : null}
        </>
      }
      actions={
        entry.provenance === "session_deleted" ? (
          <button type="button" onClick={() => onRestore(entry)}>
            원복
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(entry)}>
              수정
            </button>
            <button type="button" className="danger" onClick={() => onDelete(entry)}>
              삭제
            </button>
          </>
        )
      }
    >
      <ReadinessList title="승인 전 확인" issues={readinessIssues} tone="warning" emptyText="카탈로그 spec으로 검토 가능합니다." />

      <FieldGroup title="Spec">
        <dl className="review-kv">
          <div>
            <dt>Runtime binding</dt>
            <dd>{bindingLabel(entry)}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{entry.owner_domain || "미지정"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{entry.status || "미지정"}</dd>
          </div>
          <div>
            <dt>Scaffold output</dt>
            <dd>{entry.scaffold_output || "기본값"}</dd>
          </div>
        </dl>
        {entry.responsibility ? <p>{entry.responsibility}</p> : <p className="review-muted">책임 설명이 없습니다.</p>}
      </FieldGroup>

      <FieldGroup title="계약">
        <FieldList title="Inputs" fields={entry.inputs ?? []} />
        <FieldList title="Outputs" fields={entry.outputs ?? []} />
      </FieldGroup>

      <FieldGroup title="MCP / Remote A2A">
        <dl className="review-kv">
          <div>
            <dt>MCP server</dt>
            <dd>{entry.mcp_server || "미지정"}</dd>
          </div>
          <div>
            <dt>MCP tool</dt>
            <dd>{entry.mcp_tool_name || "미지정"}</dd>
          </div>
          <div>
            <dt>Remote readiness</dt>
            <dd>{entry.required_before_approval?.join(", ") || "해당 없음"}</dd>
          </div>
        </dl>
      </FieldGroup>

      <FieldGroup title="Risk / Notes">
        <p>{entry.risk_signals?.length ? entry.risk_signals.join(", ") : "등록된 risk signal 없음"}</p>
        <p>{entry.notes || "메모 없음"}</p>
      </FieldGroup>
    </InspectorPanel>
  );
}

interface CatalogEditInspectorProps {
  draft: CatalogEntry;
  onDraftChange: (entry: CatalogEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}

function CatalogEditInspector({ draft, onDraftChange, onSave, onCancel }: CatalogEditInspectorProps) {
  function update<K extends keyof CatalogEntry>(key: K, value: CatalogEntry[K]) {
    const next = normalizeSubtypeFields({ ...draft, [key]: value }, key);
    onDraftChange(refreshRuntimeBinding(next));
  }

  return (
    <InspectorPanel
      title={draft.name || "새 카탈로그 항목"}
      eyebrow="Edit"
      actions={
        <>
          <button type="button" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="primary" onClick={onSave}>
            저장
          </button>
        </>
      }
    >
      <FieldGroup title="기본 정보">
        <label className="form-field">
          <span>이름</span>
          <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
        </label>
        <label className="form-field">
          <span>분류</span>
          <select value={draft.module_category} onChange={(event) => update("module_category", event.target.value as ModuleCategory)}>
            {moduleCategories.map((category) => (
              <option key={category} value={category}>
                {moduleCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        <SubtypeSelect draft={draft} update={update} />
        <label className="form-field">
          <span>Status</span>
          <input value={draft.status ?? ""} onChange={(event) => update("status", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>Owner domain</span>
          <input value={draft.owner_domain ?? ""} onChange={(event) => update("owner_domain", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>책임 설명</span>
          <textarea value={draft.responsibility ?? ""} onChange={(event) => update("responsibility", emptyToUndefined(event.target.value))} />
        </label>
      </FieldGroup>

      <FieldGroup title="Binding">
        <label className="form-field">
          <span>component_source</span>
          <select
            value={draft.component_source ?? ""}
            onChange={(event) => update("component_source", emptyToUndefined(event.target.value) as ComponentSource | undefined)}
          >
            <option value="">미정</option>
            {componentSources.map((source) => (
              <option key={source} value={source}>
                {componentSourceLabels[source]}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>runtime_binding</span>
          <select
            value={draft.runtime_binding ?? "unresolved"}
            onChange={(event) => update("runtime_binding", event.target.value as RuntimeBinding)}
          >
            {runtimeBindings.map((binding) => (
              <option key={binding} value={binding}>
                {runtimeBindingLabels[binding]}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>scaffold_output</span>
          <input value={draft.scaffold_output ?? ""} onChange={(event) => update("scaffold_output", emptyToUndefined(event.target.value))} />
        </label>
      </FieldGroup>

      <FieldGroup title="MCP / Remote A2A">
        <label className="form-field">
          <span>access_protocol</span>
          <select
            value={draft.access_protocol ?? ""}
            onChange={(event) => update("access_protocol", emptyToUndefined(event.target.value) as AccessProtocol | undefined)}
          >
            <option value="">미정</option>
            {accessProtocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {accessProtocolLabels[protocol]}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>mcp_server</span>
          <input value={draft.mcp_server ?? ""} onChange={(event) => update("mcp_server", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>mcp_tool_name</span>
          <input value={draft.mcp_tool_name ?? ""} onChange={(event) => update("mcp_tool_name", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>mcp_schema_ref</span>
          <input value={draft.mcp_schema_ref ?? ""} onChange={(event) => update("mcp_schema_ref", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>mcp_auth_mode</span>
          <input value={draft.mcp_auth_mode ?? ""} onChange={(event) => update("mcp_auth_mode", emptyToUndefined(event.target.value))} />
        </label>
        <label className="form-field">
          <span>required_before_approval</span>
          <textarea
            value={(draft.required_before_approval ?? []).join("\n")}
            onChange={(event) => update("required_before_approval", parseLines(event.target.value))}
          />
        </label>
      </FieldGroup>

      <FieldGroup title="계약">
        <label className="form-field">
          <span>Inputs</span>
          <textarea value={formatFieldSpecs(draft.inputs)} onChange={(event) => update("inputs", parseFieldSpecs(event.target.value))} />
        </label>
        <label className="form-field">
          <span>Outputs</span>
          <textarea value={formatFieldSpecs(draft.outputs)} onChange={(event) => update("outputs", parseFieldSpecs(event.target.value))} />
        </label>
        <label className="form-field">
          <span>Composition</span>
          <textarea value={(draft.composition ?? []).join("\n")} onChange={(event) => update("composition", parseLines(event.target.value))} />
        </label>
      </FieldGroup>

      <FieldGroup title="Risk / Notes">
        <label className="form-field">
          <span>risk_signals</span>
          <select
            multiple
            value={draft.risk_signals ?? []}
            onChange={(event) => update("risk_signals", Array.from(event.target.selectedOptions, (option) => option.value as RiskSignal))}
          >
            {riskSignalOptions.map((signal) => (
              <option key={signal} value={signal}>
                {signal}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>notes</span>
          <textarea value={draft.notes ?? ""} onChange={(event) => update("notes", emptyToUndefined(event.target.value))} />
        </label>
      </FieldGroup>
    </InspectorPanel>
  );
}

function SubtypeSelect({
  draft,
  update
}: {
  draft: CatalogEntry;
  update: <K extends keyof CatalogEntry>(key: K, value: CatalogEntry[K]) => void;
}) {
  if (draft.module_category === "agent") {
    return (
      <label className="form-field">
        <span>agent_kind</span>
        <select value={draft.agent_kind ?? ""} onChange={(event) => update("agent_kind", emptyToNull(event.target.value) as AgentKind | null)}>
          <option value="">미정</option>
          {agentKinds.map((kind) => (
            <option key={kind} value={kind}>
              {agentKindLabels[kind]}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (draft.module_category === "workflow") {
    return (
      <label className="form-field">
        <span>workflow_kind</span>
        <select
          value={draft.workflow_kind ?? ""}
          onChange={(event) => update("workflow_kind", emptyToNull(event.target.value) as WorkflowKind | null)}
        >
          <option value="">미정</option>
          {workflowKinds.map((kind) => (
            <option key={kind} value={kind}>
              {workflowKindLabels[kind]}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (draft.module_category === "adapter") {
    return (
      <label className="form-field">
        <span>adapter_kind</span>
        <select value={draft.adapter_kind ?? ""} onChange={(event) => update("adapter_kind", emptyToNull(event.target.value) as AdapterKind | null)}>
          <option value="">미정</option>
          {adapterKinds.map((kind) => (
            <option key={kind} value={kind}>
              {adapterKindLabels[kind]}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="form-field">
      <span>remote_contract_kind</span>
      <select
        value={draft.remote_contract_kind ?? ""}
        onChange={(event) => update("remote_contract_kind", emptyToNull(event.target.value) as RemoteContractKind | null)}
      >
        <option value="">미정</option>
        {remoteContractKinds.map((kind) => (
          <option key={kind} value={kind}>
            {remoteContractKindLabels[kind]}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldList({ title, fields }: { title: string; fields: FieldSpec[] }) {
  return (
    <div className="catalog-field-list">
      <strong>{title}</strong>
      {fields.length ? (
        <ul>
          {fields.map((field, index) => (
            <li key={`${field.name}-${index}`}>
              {field.name}: {field.type}
              {field.required ? " required" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="review-muted">미등록</p>
      )}
    </div>
  );
}

function findMatchingEntry(candidate: ModuleCandidate, entries: CatalogEntry[]): CatalogEntry | undefined {
  const normalized = normalizeName(candidate.name);
  return entries.find(
    (entry) =>
      entry.provenance !== "session_deleted" &&
      entry.module_category === candidate.module_category &&
      normalizeName(entry.name) === normalized
  );
}

function catalogReadinessIssues(entry: CatalogEntry): string[] {
  const issues: string[] = [];
  if (!entry.name.trim()) issues.push("이름 필요");
  if (!entry.inputs?.length) issues.push("입력 계약 필요");
  if (!entry.outputs?.length) issues.push("출력 계약 필요");
  if (entry.runtime_binding === "mcp" && (!entry.mcp_server || !entry.mcp_tool_name)) {
    issues.push("MCP server/tool 필요");
  }
  if (entry.module_category === "remote_a2a" && !entry.required_before_approval?.length) {
    issues.push("Remote A2A 승인 조건 필요");
  }
  return issues;
}

function subtypeForEntry(entry: CatalogEntry): AgentKind | WorkflowKind | AdapterKind | RemoteContractKind | null {
  if (entry.module_category === "agent") return entry.agent_kind ?? null;
  if (entry.module_category === "workflow") return entry.workflow_kind ?? null;
  if (entry.module_category === "adapter") return entry.adapter_kind ?? null;
  if (entry.module_category === "remote_a2a") return entry.remote_contract_kind ?? null;
  return null;
}

function bindingLabel(entry: CatalogEntry): string {
  const runtime = entry.runtime_binding ?? "unresolved";
  if (entry.module_category === "remote_a2a") return "Remote A2A";
  if (entry.access_protocol === "mcp" || runtime === "mcp") return "MCP";
  if (entry.component_source === "stub" || runtime === "stub") return "Stub/TODO";
  return runtimeBindingLabels[runtime];
}

function normalizeEntryDraft(entry: CatalogEntry): CatalogEntry {
  const normalized = normalizeSubtypeFields(entry, "module_category");
  return refreshRuntimeBinding({
    ...normalized,
    name: normalized.name.trim(),
    risk_signals: normalized.risk_signals ?? [],
    inputs: normalized.inputs ?? [],
    outputs: normalized.outputs ?? []
  });
}

function normalizeSubtypeFields(entry: CatalogEntry, changedKey: keyof CatalogEntry): CatalogEntry {
  if (changedKey !== "module_category") return entry;
  return {
    ...entry,
    agent_kind: entry.module_category === "agent" ? entry.agent_kind ?? "specialist" : null,
    workflow_kind: entry.module_category === "workflow" ? entry.workflow_kind ?? "unknown" : null,
    adapter_kind: entry.module_category === "adapter" ? entry.adapter_kind ?? "unknown" : null,
    remote_contract_kind: entry.module_category === "remote_a2a" ? entry.remote_contract_kind ?? "a2a" : null
  };
}

function formatFieldSpecs(fields: FieldSpec[] | undefined): string {
  return (fields ?? []).map((field) => `${field.name}:${field.type}${field.required ? ":required" : ""}`).join("\n");
}

function parseFieldSpecs(value: string): FieldSpec[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type = "string", required] = line.split(":").map((part) => part.trim());
      return { name, type, required: required === "required" || required === "true" };
    });
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stopRowAction(event: MouseEvent, action: () => void) {
  event.stopPropagation();
  action();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
