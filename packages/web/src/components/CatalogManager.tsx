import { useMemo, useState } from "react";
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
  type ComponentSource,
  moduleCategories,
  remoteContractKinds,
  workflowKinds
} from "../analyzer/types";
import type {
  AccessProtocol,
  AdapterKind,
  AgentKind,
  FieldSpec,
  ModuleCandidate,
  ModuleCategory,
  RemoteContractKind,
  WorkflowKind
} from "../analyzer/types";
import type { CatalogEntry, CatalogEntrySnapshot } from "../catalog/types";
import { buildChangeSet, snapshotOf } from "../catalog/diff";
import { CategoryBadge, ProtocolBadge, SubtypeBadge, categoryClass } from "./CategoryBadge";

type CatalogTab = "registered" | "new" | "fromAnalysis";

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

const componentSources: ComponentSource[] = ["python_package", "mcp", "stub"];

export function CatalogManager({ entries, onEntriesChange, moduleCandidates, onContinue }: CatalogManagerProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>("registered");
  const [filterCategory, setFilterCategory] = useState<ModuleCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogEntry | null>(null);

  const changeSet = useMemo(() => buildChangeSet(entries), [entries]);
  const totalChanges = changeSet.added.length + changeSet.updated.length + changeSet.removed.length;

  const filteredEntries = useMemo(() => {
    if (filterCategory === "all") return entries;
    return entries.filter((entry) => entry.module_category === filterCategory);
  }, [entries, filterCategory]);

  const reusableCandidates = useMemo(
    () => moduleCandidates.filter((candidate) => candidate.reuse_candidate || candidate.module_category === "remote_a2a"),
    [moduleCandidates]
  );

  function startEdit(entry: CatalogEntry) {
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
        if (entry.provenance === "session_added") {
          return { ...draft, provenance: "session_added" };
        }
        const baseSnapshot = entry.originalSnapshot ?? snapshotOf(entry);
        return { ...draft, provenance: "session_edited", originalSnapshot: baseSnapshot };
      })
    );
    cancelEdit();
  }

  function startNew(category: ModuleCategory) {
    const id = `session-${category}-${Date.now()}`;
    const empty: CatalogEntry = {
      id,
      name: "",
      module_category: category,
      provenance: "session_added"
    };
    setEditingId(id);
    setDraft(empty);
    setActiveTab("registered");
    onEntriesChange([...entries, empty]);
  }

  function deleteEntry(entry: CatalogEntry) {
    if (entry.provenance === "session_added") {
      onEntriesChange(entries.filter((e) => e.id !== entry.id));
      return;
    }
    onEntriesChange(
      entries.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              provenance: "session_deleted",
              originalSnapshot: e.originalSnapshot ?? snapshotOf(e)
            }
          : e
      )
    );
  }

  function restoreEntry(entry: CatalogEntry) {
    if (entry.provenance === "session_added") return;
    if (!entry.originalSnapshot) return;
    const snap = entry.originalSnapshot;
    onEntriesChange(
      entries.map((e) =>
        e.id === entry.id
          ? { ...snap, id: entry.id, provenance: "seeded" }
          : e
      )
    );
  }

  function promoteCandidate(candidate: ModuleCandidate) {
    const id = `session-${candidate.module_category}-${candidate.id}-${Date.now()}`;
    const newEntry: CatalogEntry = {
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
      owner_domain: candidate.owner_domain,
      status: "candidate",
      responsibility: candidate.rationale,
      inputs: candidate.inputs,
      outputs: candidate.outputs,
      risk_signals: candidate.risk_signals,
      provenance: "session_added"
    };
    onEntriesChange([...entries, newEntry]);
    setActiveTab("registered");
  }

  return (
    <section className="panel catalog-manager">
      <div className="section-heading">
        <p className="eyebrow">공통 자산 카탈로그</p>
        <h2>카탈로그 관리</h2>
        <p className="muted">
          요구사항이 없어도 공통 spec을 직접 등록할 수 있고, 분석 결과의 재사용 후보를 카탈로그로 승격하거나 기존 항목을 수정·삭제할 수
          있습니다. 변경 내용은 export 단계에서 <code>catalog-changes.yaml</code>로 내보냅니다.
        </p>
      </div>

      <div className="catalog-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "registered"}
          className={activeTab === "registered" ? "tab active" : "tab"}
          onClick={() => setActiveTab("registered")}
        >
          등록된 항목 <span className="counter">{entries.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "new"}
          className={activeTab === "new" ? "tab active" : "tab"}
          onClick={() => setActiveTab("new")}
        >
          새 항목 등록
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "fromAnalysis"}
          className={activeTab === "fromAnalysis" ? "tab active" : "tab"}
          onClick={() => setActiveTab("fromAnalysis")}
          disabled={!reusableCandidates.length}
        >
          분석 결과에서 가져오기 <span className="counter">{reusableCandidates.length}</span>
        </button>
      </div>

      <div className="catalog-summary">
        <span>
          변경 대기: <strong>{totalChanges}</strong>
        </span>
        <span>추가 {changeSet.added.length}</span>
        <span>수정 {changeSet.updated.length}</span>
        <span>삭제 {changeSet.removed.length}</span>
      </div>

      {activeTab === "registered" && (
        <RegisteredTab
          entries={filteredEntries}
          allEntries={entries}
          filterCategory={filterCategory}
          onFilterChange={setFilterCategory}
          editingId={editingId}
          draft={draft}
          onDraftChange={setDraft}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onDelete={deleteEntry}
          onRestore={restoreEntry}
        />
      )}

      {activeTab === "new" && <NewTab onCreate={startNew} />}

      {activeTab === "fromAnalysis" && (
        <PromoteTab candidates={reusableCandidates} entries={entries} onPromote={promoteCandidate} />
      )}

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          아티팩트 내보내기로 이동
        </button>
      </div>
    </section>
  );
}

interface RegisteredTabProps {
  entries: CatalogEntry[];
  allEntries: CatalogEntry[];
  filterCategory: ModuleCategory | "all";
  onFilterChange: (value: ModuleCategory | "all") => void;
  editingId: string | null;
  draft: CatalogEntry | null;
  onDraftChange: (entry: CatalogEntry) => void;
  onStartEdit: (entry: CatalogEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (entry: CatalogEntry) => void;
  onRestore: (entry: CatalogEntry) => void;
}

function RegisteredTab({
  entries,
  allEntries,
  filterCategory,
  onFilterChange,
  editingId,
  draft,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRestore
}: RegisteredTabProps) {
  return (
    <div className="catalog-registered">
      <div className="catalog-filter">
        <label>
          <span>카테고리 필터</span>
          <select value={filterCategory} onChange={(event) => onFilterChange(event.target.value as ModuleCategory | "all")}>
            <option value="all">전체 ({allEntries.length})</option>
            {moduleCategories.map((category) => {
              const count = allEntries.filter((entry) => entry.module_category === category).length;
              return (
                <option key={category} value={category}>
                  {moduleCategoryLabels[category]} ({count})
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {entries.length ? (
        <div className="catalog-list">
          {entries.map((entry) => {
            const isEditing = editingId === entry.id && draft;
            return (
              <article key={entry.id} className={`catalog-row ${categoryClass(entry.module_category)}`}>
                <span className={`row-stripe ${categoryClass(entry.module_category)}`} aria-hidden="true" />
                <div className="catalog-row-head">
                  <CategoryBadge category={entry.module_category} />
                  {subtypeForEntry(entry) ? <SubtypeBadge value={subtypeForEntry(entry)!} /> : null}
                  {entry.access_protocol ? <ProtocolBadge value={entry.access_protocol} /> : null}
                  <span className={`prov-badge ${provenanceClass[entry.provenance]}`}>
                    {provenanceLabel[entry.provenance]}
                  </span>
                </div>
                {isEditing ? (
                  <EntryForm
                    draft={draft}
                    onChange={onDraftChange}
                    onCancel={onCancelEdit}
                    onSave={onSaveEdit}
                  />
                ) : (
                  <EntrySummary
                    entry={entry}
                    onEdit={() => onStartEdit(entry)}
                    onDelete={() => onDelete(entry)}
                    onRestore={() => onRestore(entry)}
                  />
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">선택한 카테고리에 등록된 항목이 없습니다.</p>
      )}
    </div>
  );
}

interface EntrySummaryProps {
  entry: CatalogEntry;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}

function EntrySummary({ entry, onEdit, onDelete, onRestore }: EntrySummaryProps) {
  const isDeleted = entry.provenance === "session_deleted";
  return (
    <div className="catalog-row-body">
      <strong className="catalog-name">{entry.name || "(이름 없음)"}</strong>
      {entry.responsibility ? <p className="catalog-desc">{entry.responsibility}</p> : null}
      <dl className="catalog-meta">
        {entry.owner_domain ? (
          <>
            <dt>소유 도메인</dt>
            <dd>{entry.owner_domain}</dd>
          </>
        ) : null}
        {entry.status ? (
          <>
            <dt>상태</dt>
            <dd>{entry.status}</dd>
          </>
        ) : null}
        {entry.access_protocol === "mcp" && entry.mcp_server ? (
          <>
            <dt>MCP 서버</dt>
            <dd>
              {entry.mcp_server}
              {entry.mcp_tool_name ? ` / ${entry.mcp_tool_name}` : ""}
            </dd>
          </>
        ) : null}
        {entry.component_source ? (
          <>
            <dt>컴포넌트 소스</dt>
            <dd>{entry.component_source}</dd>
          </>
        ) : null}
        {entry.component_source === "python_package" && (entry.package_name || entry.import_path || entry.callable_name) ? (
          <>
            <dt>Python import</dt>
            <dd>
              {entry.package_name ?? "(package 미지정)"}
              {entry.package_version ? `==${entry.package_version}` : ""} / {entry.import_path ?? "(import path 미지정)"}
              {entry.callable_name ? `.${entry.callable_name}` : ".(callable 미지정)"}
            </dd>
          </>
        ) : null}
        {entry.contract_status ? (
          <>
            <dt>계약 상태</dt>
            <dd>{entry.contract_status}</dd>
          </>
        ) : null}
        {entry.inputs?.length ? (
          <>
            <dt>입력</dt>
            <dd>{formatFieldSpecs(entry.inputs)}</dd>
          </>
        ) : null}
        {entry.outputs?.length ? (
          <>
            <dt>출력</dt>
            <dd>{formatFieldSpecs(entry.outputs)}</dd>
          </>
        ) : null}
        {entry.module_category === "workflow" && entry.composition?.length ? (
          <>
            <dt>조합</dt>
            <dd>
              <ol className="catalog-composition">
                {entry.composition.map((step, index) => (
                  <li key={`${entry.id}-composition-${index}`}>{step}</li>
                ))}
              </ol>
            </dd>
          </>
        ) : null}
        {entry.scaffold_output ? (
          <>
            <dt>스캐폴드 출력</dt>
            <dd>{entry.scaffold_output}</dd>
          </>
        ) : null}
        {entry.risk_signals?.length ? (
          <>
            <dt>위험 신호</dt>
            <dd>{entry.risk_signals.join(", ")}</dd>
          </>
        ) : null}
        {entry.required_before_approval?.length ? (
          <>
            <dt>승인 전 필요</dt>
            <dd>{entry.required_before_approval.join(", ")}</dd>
          </>
        ) : null}
        {entry.notes ? (
          <>
            <dt>비고</dt>
            <dd>{entry.notes}</dd>
          </>
        ) : null}
      </dl>
      <div className="actions compact align-end">
        {isDeleted ? (
          <button type="button" onClick={onRestore}>
            삭제 취소
          </button>
        ) : (
          <>
            <button type="button" onClick={onEdit}>
              수정
            </button>
            <button type="button" onClick={onDelete}>
              삭제
            </button>
            {entry.provenance === "session_edited" ? (
              <button type="button" onClick={onRestore}>
                원복
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

interface EntryFormProps {
  draft: CatalogEntry;
  onChange: (entry: CatalogEntry) => void;
  onCancel: () => void;
  onSave: () => void;
}

function EntryForm({ draft, onChange, onCancel, onSave }: EntryFormProps) {
  function update<K extends keyof CatalogEntry>(key: K, value: CatalogEntry[K]) {
    onChange({ ...draft, [key]: value });
  }

  function updateRiskSignals(text: string) {
    const list = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean) as CatalogEntry["risk_signals"];
    onChange({ ...draft, risk_signals: list });
  }

  function updateRequiredBeforeApproval(text: string) {
    const list = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    onChange({ ...draft, required_before_approval: list });
  }

  function updateInputs(text: string) {
    onChange({ ...draft, inputs: parseFieldSpecLines(text) });
  }

  function updateOutputs(text: string) {
    onChange({ ...draft, outputs: parseFieldSpecLines(text) });
  }

  function updateComposition(text: string) {
    onChange({ ...draft, composition: parseCompositionLines(text) });
  }

  const isAdapter = draft.module_category === "adapter";
  const isMcp = draft.access_protocol === "mcp";
  const isPythonPackage = draft.component_source === "python_package";

  return (
    <div className="catalog-form">
      <div className="form-grid">
        <label>
          <span>이름</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="예: customer_profile_lookup"
          />
        </label>
        <label>
          <span>카테고리</span>
          <select
            value={draft.module_category}
            onChange={(event) => update("module_category", event.target.value as ModuleCategory)}
          >
            {moduleCategories.map((category) => (
              <option key={category} value={category}>
                {moduleCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        {draft.module_category === "agent" && (
          <label>
            <span>agent_kind</span>
            <select
              value={draft.agent_kind ?? ""}
              onChange={(event) => update("agent_kind", (event.target.value || null) as AgentKind | null)}
            >
              <option value="">미지정</option>
              {agentKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {agentKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        {draft.module_category === "workflow" && (
          <label>
            <span>workflow_kind</span>
            <select
              value={draft.workflow_kind ?? ""}
              onChange={(event) => update("workflow_kind", (event.target.value || null) as WorkflowKind | null)}
            >
              <option value="">미지정</option>
              {workflowKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {workflowKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        {draft.module_category === "adapter" && (
          <label>
            <span>adapter_kind</span>
            <select
              value={draft.adapter_kind ?? ""}
              onChange={(event) => update("adapter_kind", (event.target.value || null) as AdapterKind | null)}
            >
              <option value="">미지정</option>
              {adapterKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {adapterKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        {draft.module_category === "remote_a2a" && (
          <label>
            <span>remote_contract_kind</span>
            <select
              value={draft.remote_contract_kind ?? ""}
              onChange={(event) =>
                update("remote_contract_kind", (event.target.value || null) as RemoteContractKind | null)
              }
            >
              <option value="">미지정</option>
              {remoteContractKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {remoteContractKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>소유 도메인</span>
          <input
            type="text"
            value={draft.owner_domain ?? ""}
            onChange={(event) => update("owner_domain", event.target.value)}
            placeholder="예: 고객"
          />
        </label>
        <label>
          <span>상태</span>
          <input
            type="text"
            value={draft.status ?? ""}
            onChange={(event) => update("status", event.target.value)}
            placeholder="proposed | candidate | approved"
          />
        </label>
        <label className="span-2">
          <span>책임 / 설명</span>
          <textarea
            rows={2}
            value={draft.responsibility ?? ""}
            onChange={(event) => update("responsibility", event.target.value)}
            placeholder="이 항목의 역할을 한 줄로 적습니다."
          />
        </label>
        <label>
          <span>component_source</span>
          <select
            value={draft.component_source ?? ""}
            onChange={(event) => update("component_source", (event.target.value || undefined) as ComponentSource | undefined)}
          >
            <option value="">미지정</option>
            {componentSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>package_name</span>
          <input
            type="text"
            value={draft.package_name ?? ""}
            onChange={(event) => update("package_name", event.target.value)}
            placeholder="예: agent-factory-components"
            disabled={!isPythonPackage}
          />
        </label>
        {isPythonPackage && (
          <>
            <label>
              <span>package_version</span>
              <input
                type="text"
                value={draft.package_version ?? ""}
                onChange={(event) => update("package_version", event.target.value)}
                placeholder="예: 0.1.0"
              />
            </label>
            <label>
              <span>import_path</span>
              <input
                type="text"
                value={draft.import_path ?? ""}
                onChange={(event) => update("import_path", event.target.value)}
                placeholder="예: agent_factory_components.vision"
              />
            </label>
            <label>
              <span>callable_name</span>
              <input
                type="text"
                value={draft.callable_name ?? ""}
                onChange={(event) => update("callable_name", event.target.value)}
                placeholder="예: extract_text_from_image"
              />
            </label>
          </>
        )}
        {isAdapter && (
          <>
            <label>
              <span>access_protocol</span>
              <select
                value={draft.access_protocol ?? ""}
                onChange={(event) => update("access_protocol", (event.target.value || null) as AccessProtocol | null)}
              >
                <option value="">미지정</option>
                {accessProtocols.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {accessProtocolLabels[protocol]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>contract_status</span>
              <input
                type="text"
                value={draft.contract_status ?? ""}
                onChange={(event) => update("contract_status", event.target.value)}
                placeholder="stub_only | source_acl_required ..."
              />
            </label>
            {isMcp && (
              <>
                <label>
                  <span>mcp_server *</span>
                  <input
                    type="text"
                    value={draft.mcp_server ?? ""}
                    onChange={(event) => update("mcp_server", event.target.value)}
                    placeholder="예: chrome-devtools"
                  />
                </label>
                <label>
                  <span>mcp_tool_name *</span>
                  <input
                    type="text"
                    value={draft.mcp_tool_name ?? ""}
                    onChange={(event) => update("mcp_tool_name", event.target.value)}
                    placeholder="예: take_screenshot"
                  />
                </label>
                <label>
                  <span>mcp_schema_ref</span>
                  <input
                    type="text"
                    value={draft.mcp_schema_ref ?? ""}
                    onChange={(event) => update("mcp_schema_ref", event.target.value)}
                    placeholder="schema 식별자 (선택)"
                  />
                </label>
                <label>
                  <span>mcp_auth_mode</span>
                  <input
                    type="text"
                    value={draft.mcp_auth_mode ?? ""}
                    onChange={(event) => update("mcp_auth_mode", event.target.value)}
                    placeholder="예: oauth | api_key"
                  />
                </label>
              </>
            )}
          </>
        )}
        <label className="span-2">
          <span>입력 필드 (name:type:required)</span>
          <textarea
            rows={3}
            value={formatFieldSpecLines(draft.inputs)}
            onChange={(event) => updateInputs(event.target.value)}
            placeholder="document_uri:string:true"
          />
        </label>
        <label className="span-2">
          <span>출력 필드 (name:type:required)</span>
          <textarea
            rows={3}
            value={formatFieldSpecLines(draft.outputs)}
            onChange={(event) => updateOutputs(event.target.value)}
            placeholder="ocr_text:text:false"
          />
        </label>
        {draft.module_category === "workflow" && (
          <label className="span-2">
            <span>워크플로우 조합 (한 줄에 한 단계)</span>
            <textarea
              rows={5}
              value={formatCompositionLines(draft.composition)}
              onChange={(event) => updateComposition(event.target.value)}
              placeholder="parallel: ocr_text_extraction_adapter + stt_transcription_adapter"
            />
          </label>
        )}
        {draft.module_category === "remote_a2a" && (
          <label className="span-2">
            <span>승인 전 필요 (콤마 구분)</span>
            <input
              type="text"
              value={draft.required_before_approval?.join(", ") ?? ""}
              onChange={(event) => updateRequiredBeforeApproval(event.target.value)}
              placeholder="remote_owner, agent_card_or_discovery, ..."
            />
          </label>
        )}
        <label>
          <span>scaffold_output</span>
          <input
            type="text"
            value={draft.scaffold_output ?? ""}
            onChange={(event) => update("scaffold_output", event.target.value)}
            placeholder="agent_shell_only ..."
          />
        </label>
        <label>
          <span>위험 신호 (콤마 구분)</span>
          <input
            type="text"
            value={draft.risk_signals?.join(", ") ?? ""}
            onChange={(event) => updateRiskSignals(event.target.value)}
            placeholder="personal_data, audit_required"
          />
        </label>
        <label className="span-2">
          <span>비고</span>
          <textarea
            rows={2}
            value={draft.notes ?? ""}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="자유 메모"
          />
        </label>
      </div>
      <div className="actions compact align-end">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="primary" onClick={onSave} disabled={!draft.name.trim()}>
          저장
        </button>
      </div>
    </div>
  );
}

interface NewTabProps {
  onCreate: (category: ModuleCategory) => void;
}

function NewTab({ onCreate }: NewTabProps) {
  return (
    <div className="catalog-new">
      <p className="muted">
        먼저 어떤 카테고리로 등록할지 선택하세요. 카테고리에 따라 필요한 필드(예: adapter는 access_protocol, MCP 사용 시 server/tool 이름)가 자동으로 노출됩니다.
      </p>
      <div className="new-grid">
        {moduleCategories.map((category) => (
          <button key={category} type="button" className={`new-tile ${categoryClass(category)}`} onClick={() => onCreate(category)}>
            <CategoryBadge category={category} />
            <span className="new-tile-desc">{moduleCategoryLabels[category]} 항목 만들기</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatFieldSpecs(fields: FieldSpec[]): string {
  return fields
    .map((field) => `${field.name}: ${field.type}${field.required ? " (required)" : ""}`)
    .join(", ");
}

function formatFieldSpecLines(fields: FieldSpec[] | undefined): string {
  return (fields ?? [])
    .map((field) => `${field.name}:${field.type}:${field.required === true ? "true" : "false"}`)
    .join("\n");
}

function parseFieldSpecLines(text: string): FieldSpec[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawName, rawType, rawRequired] = line.split(":");
      const name = rawName?.trim() ?? "";
      const type = rawType?.trim() ?? "unknown";
      const required = rawRequired?.trim().toLowerCase() === "true";
      return { name, type, required };
    })
    .filter((field) => field.name.length > 0);
}

function formatCompositionLines(composition: string[] | undefined): string {
  return (composition ?? []).join("\n");
}

function parseCompositionLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface PromoteTabProps {
  candidates: ModuleCandidate[];
  entries: CatalogEntry[];
  onPromote: (candidate: ModuleCandidate) => void;
}

function PromoteTab({ candidates, entries, onPromote }: PromoteTabProps) {
  const existingNames = new Set(entries.map((entry) => entry.name));
  return (
    <div className="catalog-promote">
      <p className="muted">현재 분석에서 재사용 후보로 표시된 모듈을 카탈로그에 새 항목으로 추가합니다.</p>
      {candidates.length ? (
        <div className="catalog-list">
          {candidates.map((candidate) => {
            const subtype = candidate.adapter_kind ?? candidate.agent_kind ?? candidate.workflow_kind ?? candidate.remote_contract_kind ?? null;
            const alreadyAdded = existingNames.has(candidate.name);
            return (
              <article key={candidate.id} className={`catalog-row ${categoryClass(candidate.module_category)}`}>
                <span className={`row-stripe ${categoryClass(candidate.module_category)}`} aria-hidden="true" />
                <div className="catalog-row-head">
                  <CategoryBadge category={candidate.module_category} />
                  {subtype ? <SubtypeBadge value={subtype} /> : null}
                  {candidate.access_protocol ? <ProtocolBadge value={candidate.access_protocol} /> : null}
                </div>
                <div className="catalog-row-body">
                  <strong className="catalog-name">{candidate.name}</strong>
                  <p className="catalog-desc">{candidate.rationale}</p>
                  <div className="actions compact align-end">
                    <button type="button" className="primary" onClick={() => onPromote(candidate)} disabled={alreadyAdded}>
                      {alreadyAdded ? "이미 등록됨" : "카탈로그에 추가"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">현재 분석 결과에 재사용 후보가 없습니다.</p>
      )}
    </div>
  );
}

function subtypeForEntry(entry: CatalogEntry): string | null {
  if (entry.module_category === "adapter") return entry.adapter_kind ?? null;
  if (entry.module_category === "agent") return entry.agent_kind ?? null;
  if (entry.module_category === "workflow") return entry.workflow_kind ?? null;
  if (entry.module_category === "remote_a2a") return entry.remote_contract_kind ?? null;
  return null;
}

export type { CatalogEntrySnapshot };
