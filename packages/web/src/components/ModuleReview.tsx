import { useEffect, useMemo, useState } from "react";
import {
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import {
  buildConnectionDraftsFromGraphIR,
  buildGraphIRFromModuleReview,
  REVIEW_INPUT_ENDPOINT,
  REVIEW_OUTPUT_ENDPOINT,
  type ModuleConnectionDraft
} from "../analyzer/moduleReviewGraph";
import {
  adapterKinds,
  agentKinds,
  moduleCategories,
  type CodexAnalyzerModel,
  remoteContractKinds,
  workflowKinds,
  type AdapterKind,
  type AgentKind,
  type EdgeKind,
  type EvidenceSummary,
  type FieldSpec,
  type GraphIR,
  type JsonSchema,
  type ModuleCandidate,
  type ModuleCategory,
  type ModuleResolutionDraft,
  type ModuleStatus,
  type NormalizedRequirement,
  type RemoteContractKind,
  type WorkflowKind
} from "../analyzer/types";
import type { CatalogEntry } from "../catalog/types";
import { FieldGroup, InspectorPanel, SelectableTableRow } from "../ui/review";
import { CategoryBadge, ProtocolBadge, SubtypeBadge, categoryClass, getSubtypeValue } from "./CategoryBadge";
import { candidateReviewIssues } from "./ModuleReviewInspector";

type ModuleReviewTab = "new" | "catalog";

const statuses: ModuleStatus[] = ["needs_info", "approved", "deferred", "rejected"];
const statusLabels: Record<ModuleStatus, string> = {
  needs_info: "정보 필요",
  approved: "승인됨",
  deferred: "보류",
  rejected: "반려"
};

const emptyCatalogEntries: CatalogEntry[] = [];

const editableEdgeKinds: EdgeKind[] = ["event_output", "session_state", "artifact", "route", "remote_a2a"];

interface ModuleReviewProps {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  analyzerModel: CodexAnalyzerModel;
  moduleCandidates: ModuleCandidate[];
  catalogEntries: CatalogEntry[];
  processFlow: GraphIR | null;
  onReviewSave: (candidates: ModuleCandidate[], processFlow: GraphIR) => void;
  onContinue: () => void;
  onNavigateToA2AContracts?: () => void;
}

export function ModuleReview({
  normalizedRequirement,
  evidence,
  analyzerModel,
  moduleCandidates,
  catalogEntries,
  processFlow,
  onReviewSave,
  onContinue,
  onNavigateToA2AContracts
}: ModuleReviewProps) {
  const [activeTab, setActiveTab] = useState<ModuleReviewTab>("new");
  const [draftCandidates, setDraftCandidates] = useState<ModuleCandidate[]>(moduleCandidates);
  const [connectionDrafts, setConnectionDrafts] = useState<ModuleConnectionDraft[]>(() =>
    buildConnectionDraftsFromGraphIR(processFlow, moduleCandidates)
  );
  const [selectedNewId, setSelectedNewId] = useState<string | null>(moduleCandidates[0]?.id ?? null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(moduleCandidates[0]?.id ?? null);
  const [draftRequest, setDraftRequest] = useState<{ candidateId: string; status: "running" | "failed"; message?: string } | null>(null);

  useEffect(() => {
    setDraftCandidates(moduleCandidates);
    setConnectionDrafts(buildConnectionDraftsFromGraphIR(processFlow, moduleCandidates));
  }, [moduleCandidates, processFlow]);

  const catalogByCandidateId = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    draftCandidates.forEach((candidate) => {
      const entry = findCatalogEntryForCandidate(candidate, catalogEntries);
      if (entry) map.set(candidate.id, entry);
    });
    return map;
  }, [catalogEntries, draftCandidates]);

  const newCandidates = useMemo(
    () => draftCandidates.filter((candidate) => !catalogByCandidateId.has(candidate.id)),
    [catalogByCandidateId, draftCandidates]
  );
  const catalogCandidates = useMemo(
    () => draftCandidates.filter((candidate) => catalogByCandidateId.has(candidate.id)),
    [catalogByCandidateId, draftCandidates]
  );

  useEffect(() => {
    if (!newCandidates.length) {
      setSelectedNewId(null);
    } else if (!selectedNewId || !newCandidates.some((candidate) => candidate.id === selectedNewId)) {
      setSelectedNewId(newCandidates[0].id);
    }
  }, [newCandidates, selectedNewId]);

  useEffect(() => {
    if (!catalogCandidates.length) {
      setSelectedCatalogId(null);
    } else if (!selectedCatalogId || !catalogCandidates.some((candidate) => candidate.id === selectedCatalogId)) {
      setSelectedCatalogId(catalogCandidates[0].id);
    }
  }, [catalogCandidates, selectedCatalogId]);

  const selectedNewCandidate = useMemo(
    () => newCandidates.find((candidate) => candidate.id === selectedNewId) ?? newCandidates[0] ?? null,
    [newCandidates, selectedNewId]
  );
  const selectedCatalogCandidate = useMemo(
    () => catalogCandidates.find((candidate) => candidate.id === selectedCatalogId) ?? catalogCandidates[0] ?? null,
    [catalogCandidates, selectedCatalogId]
  );
  const reviewSummary = useMemo(() => buildReviewSummary(draftCandidates), [draftCandidates]);

  function updateCandidate(id: string, changes: Partial<ModuleCandidate>) {
    setDraftCandidates((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate)));
  }

  async function generateResolutionDraft(candidate: ModuleCandidate) {
    setDraftRequest({ candidateId: candidate.id, status: "running" });
    try {
      const response = await fetch("/api/resolve-module-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: analyzerModel,
          normalizedRequirement,
          evidence,
          candidate,
          catalogEntry: findCatalogEntryForCandidate(candidate, catalogEntries),
          processFlow,
          graphNeighbors: buildGraphNeighborSummary(candidate.id, processFlow)
        })
      });
      const payload = (await response.json()) as { draft?: ModuleResolutionDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "후보 해결 초안 생성 실패");
      }
      updateCandidate(candidate.id, {
        resolution_draft: payload.draft,
        schema_review_state: "drafted",
        missing_information_resolution: payload.draft.reviewer_note || payload.draft.summary
      });
      setDraftRequest(null);
    } catch (error) {
      setDraftRequest({
        candidateId: candidate.id,
        status: "failed",
        message: error instanceof Error ? error.message : "후보 해결 초안 생성 실패"
      });
    }
  }

  function updateCategory(candidate: ModuleCandidate, module_category: ModuleCategory) {
    updateCandidate(candidate.id, {
      module_category,
      agent_kind: module_category === "agent" ? candidate.agent_kind ?? "specialist" : null,
      workflow_kind: module_category === "workflow" ? candidate.workflow_kind ?? "graph" : null,
      adapter_kind: module_category === "adapter" ? candidate.adapter_kind ?? "unknown" : null,
      remote_contract_kind: module_category === "remote_a2a" ? candidate.remote_contract_kind ?? "a2a" : null,
      risk_level: module_category === "remote_a2a" ? "high" : candidate.risk_level,
      risk_signals:
        module_category === "remote_a2a"
          ? Array.from(new Set([...candidate.risk_signals, "human_approval_required", "audit_required"]))
          : candidate.risk_signals,
      status: module_category === "remote_a2a" && candidate.status === "approved" ? "needs_info" : candidate.status
    });
  }

  function updateConnection(id: string, changes: Partial<ModuleConnectionDraft>) {
    setConnectionDrafts((current) => current.map((connection) => (connection.id === id ? { ...connection, ...changes } : connection)));
  }

  function addConnection(fromModuleId: string, toModuleId: string) {
    setConnectionDrafts((current) => [
      ...current,
      {
        id: `edge-${String(current.length + 1).padStart(3, "0")}`,
        fromModuleId,
        toModuleId,
        edge_kind: "event_output",
        data_label: "event_output",
        schema_ref: null,
        route_condition: null,
        state_key: null,
        artifact_key: null,
        a2a_contract_id: null
      }
    ]);
  }

  function removeConnection(id: string) {
    setConnectionDrafts((current) => current.filter((connection) => connection.id !== id));
  }

  function saveReview() {
    const regenerated = buildGraphIRFromModuleReview({
      requirementId: processFlow?.requirement_id ?? "req-001",
      graphId: processFlow?.graph_id,
      moduleCandidates: draftCandidates,
      previousGraphIR: processFlow,
      connections: connectionDrafts
    });
    onReviewSave(draftCandidates, regenerated);
  }

  return (
    <section className="panel module-review-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">아키텍처 분류</p>
          <h2>모듈 검토</h2>
        </div>
        <div className="module-review-tabs" role="tablist" aria-label="모듈 검토 탭">
          <button
            type="button"
            className={activeTab === "new" ? "active" : ""}
            onClick={() => setActiveTab("new")}
            role="tab"
            aria-selected={activeTab === "new"}
          >
            신규 모듈 <span>{newCandidates.length}</span>
          </button>
          <button
            type="button"
            className={activeTab === "catalog" ? "active" : ""}
            onClick={() => setActiveTab("catalog")}
            role="tab"
            aria-selected={activeTab === "catalog"}
          >
            카탈로그 계약 <span>{catalogCandidates.length}</span>
          </button>
        </div>
      </div>

      <div className="module-review-summary" aria-label="모듈 검토 요약">
        <div>
          <span>정보 필요 후보</span>
          <strong>{reviewSummary.needsInfo}</strong>
        </div>
        <div>
          <span>승인 가능</span>
          <strong>{reviewSummary.approvable}</strong>
        </div>
        <div>
          <span>승인됨</span>
          <strong>{reviewSummary.approved}</strong>
        </div>
        <div>
          <span>반려/보류</span>
          <strong>{reviewSummary.closed}</strong>
        </div>
      </div>

      {activeTab === "new" ? (
        <div className="review-console module-review-console">
          <NewModuleTable
            candidates={newCandidates}
            catalogEntries={catalogEntries}
            selectedCandidate={selectedNewCandidate}
            onSelect={setSelectedNewId}
            onUpdateCandidate={updateCandidate}
            onUpdateCategory={updateCategory}
          />
          <NewModuleInspector
            candidate={selectedNewCandidate}
            catalogEntries={catalogEntries}
            onUpdateCandidate={updateCandidate}
            onNavigateToA2AContracts={onNavigateToA2AContracts}
            onGenerateResolutionDraft={generateResolutionDraft}
            draftRequest={draftRequest}
          />
        </div>
      ) : (
        <div className="review-console module-review-console">
          <CatalogContractTable
            candidates={catalogCandidates}
            catalogEntries={catalogEntries}
            catalogByCandidateId={catalogByCandidateId}
            selectedCandidate={selectedCatalogCandidate}
            connections={connectionDrafts}
            onSelect={setSelectedCatalogId}
          />
          <CatalogContractInspector
            candidate={selectedCatalogCandidate}
            catalogEntry={selectedCatalogCandidate ? catalogByCandidateId.get(selectedCatalogCandidate.id) ?? null : null}
            candidates={draftCandidates}
            connections={connectionDrafts}
            onUpdateCandidate={updateCandidate}
            onUpdateConnection={updateConnection}
            onAddConnection={addConnection}
            onRemoveConnection={removeConnection}
            onGenerateResolutionDraft={generateResolutionDraft}
            draftRequest={draftRequest}
          />
        </div>
      )}

      <div className="actions align-end">
        <button type="button" className="secondary" onClick={saveReview}>
          저장 및 Graph IR 재생성
        </button>
        <button type="button" className="primary" onClick={onContinue}>
          Graph IR로 이동
        </button>
      </div>
    </section>
  );
}

function NewModuleTable({
  candidates,
  catalogEntries,
  selectedCandidate,
  onSelect,
  onUpdateCandidate,
  onUpdateCategory
}: {
  candidates: ModuleCandidate[];
  catalogEntries: CatalogEntry[];
  selectedCandidate: ModuleCandidate | null;
  onSelect: (id: string) => void;
  onUpdateCandidate: (id: string, changes: Partial<ModuleCandidate>) => void;
  onUpdateCategory: (candidate: ModuleCandidate, category: ModuleCategory) => void;
}) {
  if (!candidates.length) {
    return (
      <div className="review-table-region module-empty-region">
        <p className="empty-state">새로 생성된 모듈 후보가 없습니다. 기존 카탈로그 계약 탭에서 입력과 출력 연결을 확인하세요.</p>
      </div>
    );
  }

  return (
    <div className="review-table-region">
      <div className="table-wrap review-table-wrap">
        <table className="module-table module-table-new">
          <colgroup>
            <col className="module-name-col" />
            <col className="module-type-col" />
            <col className="module-subtype-col" />
            <col className="module-status-col" />
            <col className="module-contract-col" />
          </colgroup>
          <thead>
            <tr>
              <th>이름</th>
              <th>분류</th>
              <th>세부 유형</th>
              <th>검토 상태</th>
              <th>계약</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const issues = candidateReviewIssues(candidate, catalogEntries);
              const unresolved = hasUnresolvedMissingInfo(candidate);
              const reviewLabel = missingInfoReviewLabel(candidate, catalogEntries);
              return (
                <SelectableTableRow
                  key={candidate.id}
                  selected={selectedCandidate?.id === candidate.id}
                  onSelect={() => onSelect(candidate.id)}
                  className={`row-${categoryClass(candidate.module_category)} ${
                    candidate.module_category === "remote_a2a" ? "remote-review-row" : ""
                  }`}
                >
                  <td className="row-name-cell">
                    <span className={`row-stripe ${categoryClass(candidate.module_category)}`} aria-hidden="true" />
                    <textarea
                      className="table-name-field"
                      value={candidate.name}
                      onChange={(event) => onUpdateCandidate(candidate.id, { name: event.target.value })}
                      rows={2}
                    />
                  </td>
                  <td>
                    <div className="cell-stack">
                      <CategoryBadge category={candidate.module_category} />
                      <select
                        className="table-select"
                        value={candidate.module_category}
                        onChange={(event) => onUpdateCategory(candidate, event.target.value as ModuleCategory)}
                      >
                        {moduleCategories.map((category) => (
                          <option key={category} value={category}>
                            {moduleCategoryLabels[category]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate)!} /> : null}
                      <SubtypeControl candidate={candidate} onChange={(changes) => onUpdateCandidate(candidate.id, changes)} />
                    </div>
                  </td>
                  <td>
                    <div className="status-cell compact-status-cell">
                      <select
                        className="status-select"
                        value={candidate.status}
                        onChange={(event) => {
                          const next = event.target.value as ModuleStatus;
                          if (next === "approved" && unresolved) {
                            return;
                          }
                          onUpdateCandidate(candidate.id, { status: next });
                        }}
                      >
                        {statuses.map((status) => {
                          const blocked = status === "approved" && unresolved;
                          return (
                            <option key={status} value={status} disabled={blocked}>
                              {statusLabels[status]}
                              {blocked ? " (초안 반영 필요)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {issues.length > 0 ? (
                        <span className="review-issue-badge">{issues.length}개 확인 필요</span>
                      ) : (
                        <span className="review-issue-badge is-clear">blocker 없음</span>
                      )}
                      <span className={`status-help ${unresolved ? "is-warning" : "is-clear"}`}>{reviewLabel}</span>
                    </div>
                  </td>
                  <td>
                    <span className="module-contract-count">
                      입력 {candidate.inputs.length} · 출력 {candidate.outputs.length}
                    </span>
                  </td>
                </SelectableTableRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogContractTable({
  candidates,
  catalogEntries,
  catalogByCandidateId,
  selectedCandidate,
  connections,
  onSelect
}: {
  candidates: ModuleCandidate[];
  catalogEntries: CatalogEntry[];
  catalogByCandidateId: Map<string, CatalogEntry>;
  selectedCandidate: ModuleCandidate | null;
  connections: ModuleConnectionDraft[];
  onSelect: (id: string) => void;
}) {
  if (!candidates.length) {
    return (
      <div className="review-table-region module-empty-region">
        <p className="empty-state">카탈로그에서 가져온 runtime contract가 없습니다. 신규 모듈 검토 탭에서 후보를 검토하세요.</p>
      </div>
    );
  }

  return (
    <div className="review-table-region">
      <div className="table-wrap review-table-wrap">
        <table className="module-table module-table-catalog">
          <colgroup>
            <col className="module-name-col" />
            <col className="module-type-col" />
            <col className="module-contract-col" />
            <col className="module-status-col" />
            <col className="module-contract-col" />
          </colgroup>
          <thead>
            <tr>
              <th>카탈로그 계약</th>
              <th>Runtime</th>
              <th>입출력</th>
              <th>검토 상태</th>
              <th>Graph 연결</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const entry = catalogByCandidateId.get(candidate.id);
              const linkedEdges = connections.filter(
                (connection) => connection.fromModuleId === candidate.id || connection.toModuleId === candidate.id
              );
              const issues = candidateReviewIssues(candidate, catalogEntries);
              return (
                <SelectableTableRow
                  key={candidate.id}
                  selected={selectedCandidate?.id === candidate.id}
                  onSelect={() => onSelect(candidate.id)}
                  className={`row-${categoryClass(candidate.module_category)}`}
                >
                  <td className="row-name-cell">
                    <span className={`row-stripe ${categoryClass(candidate.module_category)}`} aria-hidden="true" />
                    <div className="catalog-contract-name">
                      <strong>{candidate.name}</strong>
                      <small>{entry?.id ?? candidate.catalog_entry_id ?? "catalog binding"}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <CategoryBadge category={candidate.module_category} />
                      {candidate.access_protocol ? <ProtocolBadge value={candidate.access_protocol} /> : null}
                    </div>
                  </td>
                  <td>
                    <span className="module-contract-count">
                      입력 {candidate.inputs.length} · 출력 {candidate.outputs.length}
                    </span>
                  </td>
                  <td>
                    <div className="status-cell compact-status-cell">
                      <span className={`status-pill is-${candidate.status}`}>{statusLabels[candidate.status]}</span>
                      <span className={issues.length ? "review-issue-badge" : "review-issue-badge is-clear"}>
                        {issues.length ? `${issues.length}개 확인 필요` : "승인 가능"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={linkedEdges.length ? "review-issue-badge is-clear" : "review-issue-badge"}>
                      edge {linkedEdges.length}개
                    </span>
                  </td>
                </SelectableTableRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogContractInspector({
  candidate,
  catalogEntry,
  candidates,
  connections,
  onUpdateCandidate,
  onUpdateConnection,
  onAddConnection,
  onRemoveConnection,
  onGenerateResolutionDraft,
  draftRequest
}: {
  candidate: ModuleCandidate | null;
  catalogEntry: CatalogEntry | null;
  candidates: ModuleCandidate[];
  connections: ModuleConnectionDraft[];
  onUpdateCandidate: (id: string, changes: Partial<ModuleCandidate>) => void;
  onUpdateConnection: (id: string, changes: Partial<ModuleConnectionDraft>) => void;
  onAddConnection: (fromModuleId: string, toModuleId: string) => void;
  onRemoveConnection: (id: string) => void;
  onGenerateResolutionDraft: (candidate: ModuleCandidate) => void;
  draftRequest: { candidateId: string; status: "running" | "failed"; message?: string } | null;
}) {
  if (!candidate) {
    return (
      <InspectorPanel eyebrow="카탈로그 계약" title="선택 항목 없음">
        <p className="empty-state">입출력 연결을 확인할 catalog-bound contract가 없습니다.</p>
      </InspectorPanel>
    );
  }

  const linkedConnections = connections.filter(
    (connection) => connection.fromModuleId === candidate.id || connection.toModuleId === candidate.id
  );
  const unresolved = hasUnresolvedMissingInfo(candidate);
  const endpointOptions = [
    { value: REVIEW_INPUT_ENDPOINT, label: "요구사항 입력" },
    ...candidates
      .filter((item) => item.status !== "rejected")
      .map((item) => ({ value: item.id, label: item.name })),
    { value: REVIEW_OUTPUT_ENDPOINT, label: "워크플로우 출력" }
  ];

  return (
    <InspectorPanel
      eyebrow="카탈로그 계약"
      title={candidate.name}
      meta={
        <div className="module-inspector-badges">
          <CategoryBadge category={candidate.module_category} />
          {candidate.access_protocol ? <ProtocolBadge value={candidate.access_protocol} /> : null}
        </div>
      }
    >
      <FieldGroup title="Runtime contract" description="카탈로그 원본은 잠겨 있고, 현재 분석의 입출력 override와 Graph 연결만 수정합니다.">
        <dl className="review-definition-grid">
          <div>
            <dt>catalog id</dt>
            <dd>{catalogEntry?.id ?? candidate.catalog_entry_id ?? "-"}</dd>
          </div>
          <div>
            <dt>binding</dt>
            <dd>{catalogEntry?.runtime_binding ?? candidate.access_protocol ?? "-"}</dd>
          </div>
          <div>
            <dt>owner</dt>
            <dd>{candidate.owner_domain ?? catalogEntry?.owner_domain ?? "-"}</dd>
          </div>
          <div>
            <dt>edges</dt>
            <dd>{linkedConnections.length}개</dd>
          </div>
        </dl>
      </FieldGroup>

      <FieldGroup title="검토 상태">
        <select
          className="status-select"
          value={candidate.status}
          onChange={(event) => {
            const next = event.target.value as ModuleStatus;
            if (next === "approved" && unresolved) return;
            onUpdateCandidate(candidate.id, { status: next });
          }}
        >
          {statuses.map((status) => (
            <option key={status} value={status} disabled={status === "approved" && unresolved}>
              {statusLabels[status]}
              {status === "approved" && unresolved ? " (초안 반영 필요)" : ""}
            </option>
          ))}
        </select>
      </FieldGroup>

      <MissingInfoResolutionPanel
        candidate={candidate}
        onUpdateCandidate={onUpdateCandidate}
        onGenerateResolutionDraft={onGenerateResolutionDraft}
        draftRequest={draftRequest}
      />

      <FieldGroup title="입력 / 출력 override">
        <FieldSpecEditor title="입력" fields={candidate.inputs} onChange={(inputs) => onUpdateCandidate(candidate.id, { inputs })} />
        <FieldSpecEditor title="출력" fields={candidate.outputs} onChange={(outputs) => onUpdateCandidate(candidate.id, { outputs })} />
      </FieldGroup>

      <FieldGroup
        title="Graph 연결 편집"
        description="저장하면 아래 연결을 기준으로 Graph IR edge가 다시 생성됩니다."
        className="connection-editor-group"
      >
        <div className="connection-editor-list">
          {connections.map((connection) => (
            <div className="connection-editor-row" key={connection.id}>
              <select value={connection.fromModuleId} onChange={(event) => onUpdateConnection(connection.id, { fromModuleId: event.target.value })}>
                {endpointOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select value={connection.toModuleId} onChange={(event) => onUpdateConnection(connection.id, { toModuleId: event.target.value })}>
                {endpointOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={connection.edge_kind}
                onChange={(event) => onUpdateConnection(connection.id, { edge_kind: event.target.value as EdgeKind })}
              >
                {editableEdgeKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                value={connection.data_label}
                placeholder="data_label"
                onChange={(event) => onUpdateConnection(connection.id, { data_label: event.target.value })}
              />
              <input
                value={connection.schema_ref ?? ""}
                placeholder="schema_ref"
                onChange={(event) => onUpdateConnection(connection.id, { schema_ref: emptyToNull(event.target.value) })}
              />
              <button type="button" className="link danger" onClick={() => onRemoveConnection(connection.id)}>
                삭제
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="secondary compact-button" onClick={() => onAddConnection(candidate.id, REVIEW_OUTPUT_ENDPOINT)}>
          연결 추가
        </button>
      </FieldGroup>
    </InspectorPanel>
  );
}

function NewModuleInspector({
  candidate,
  catalogEntries,
  onUpdateCandidate,
  onNavigateToA2AContracts,
  onGenerateResolutionDraft,
  draftRequest
}: {
  candidate: ModuleCandidate | null;
  catalogEntries: CatalogEntry[];
  onUpdateCandidate: (id: string, changes: Partial<ModuleCandidate>) => void;
  onNavigateToA2AContracts?: () => void;
  onGenerateResolutionDraft: (candidate: ModuleCandidate) => void;
  draftRequest: { candidateId: string; status: "running" | "failed"; message?: string } | null;
}) {
  if (!candidate) {
    return (
      <InspectorPanel eyebrow="신규 모듈" title="선택 항목 없음">
        <p className="empty-state">검토할 신규 모듈 후보가 없습니다.</p>
      </InspectorPanel>
    );
  }

  const issues = candidateReviewIssues(candidate, catalogEntries);
  return (
    <InspectorPanel
      eyebrow="신규 모듈"
      title={candidate.name}
      meta={
        <div className="module-inspector-badges">
          <CategoryBadge category={candidate.module_category} />
          {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate)!} /> : null}
        </div>
      }
      actions={
        candidate.module_category === "remote_a2a" && onNavigateToA2AContracts ? (
          <button type="button" className="a2a-review-link" onClick={onNavigateToA2AContracts}>
            A2A Contract 검토
          </button>
        ) : null
      }
    >
      <FieldGroup title="승인 blocker">
        {issues.length ? (
          <ul className="graph-inspector-list">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="review-muted">현재 상태에서 즉시 표시할 blocker가 없습니다.</p>
        )}
      </FieldGroup>

      <MissingInfoResolutionPanel
        candidate={candidate}
        onUpdateCandidate={onUpdateCandidate}
        onGenerateResolutionDraft={onGenerateResolutionDraft}
        draftRequest={draftRequest}
      />

      <FieldGroup title="입력 / 출력 계약">
        <FieldSpecEditor title="입력" fields={candidate.inputs} onChange={(inputs) => onUpdateCandidate(candidate.id, { inputs })} />
        <FieldSpecEditor title="출력" fields={candidate.outputs} onChange={(outputs) => onUpdateCandidate(candidate.id, { outputs })} />
      </FieldGroup>

      <FieldGroup title="판단 근거">
        <textarea
          className="inspector-textarea"
          rows={5}
          value={candidate.rationale}
          onChange={(event) => onUpdateCandidate(candidate.id, { rationale: event.target.value })}
        />
      </FieldGroup>

      <FieldGroup title="누락 정보">
        <textarea
          className="inspector-textarea"
          rows={4}
          value={candidate.missing_information.join("\n")}
          onChange={(event) =>
            onUpdateCandidate(candidate.id, {
              missing_information: event.target.value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            })
          }
        />
      </FieldGroup>

      <FieldGroup title="보조 evidence">
        <dl className="review-definition-grid">
          <div>
            <dt>신뢰도</dt>
            <dd>{Math.round(candidate.confidence * 100)}%</dd>
          </div>
          <div>
            <dt>risk signals</dt>
            <dd>{candidate.risk_signals.length ? candidate.risk_signals.join(", ") : "-"}</dd>
          </div>
        </dl>
      </FieldGroup>
    </InspectorPanel>
  );
}

function MissingInfoResolutionPanel({
  candidate,
  onUpdateCandidate,
  onGenerateResolutionDraft,
  draftRequest
}: {
  candidate: ModuleCandidate;
  onUpdateCandidate: (id: string, changes: Partial<ModuleCandidate>) => void;
  onGenerateResolutionDraft: (candidate: ModuleCandidate) => void;
  draftRequest: { candidateId: string; status: "running" | "failed"; message?: string } | null;
}) {
  const unresolved = hasUnresolvedMissingInfo(candidate);
  const resolvedItems = candidate.resolved_missing_information ?? [];
  const draft = candidate.resolution_draft ?? null;
  const isGenerating = draftRequest?.candidateId === candidate.id && draftRequest.status === "running";
  const draftError = draftRequest?.candidateId === candidate.id && draftRequest.status === "failed" ? draftRequest.message : null;
  const canApplyDraft = Boolean(draft);
  const canApprove = candidateResolutionReady(candidate);

  function applyResolutionDraft() {
    if (!draft) return;
    onUpdateCandidate(candidate.id, {
      inputs: draft.input_schema,
      outputs: draft.output_schema,
      developer_todos: draft.developer_todos.length ? draft.developer_todos : candidate.developer_todos,
      missing_information: [],
      resolved_missing_information: mergeResolvedMissingInformation(resolvedItems, candidate.missing_information),
      missing_information_resolution: draft.reviewer_note || draft.summary,
      resolution_applied_at: new Date().toISOString(),
      schema_review_state: "applied",
      smoke_spec: draft.smoke_spec
    });
  }

  return (
    <FieldGroup
      title="Resolution Draft"
      description="LLM 초안은 바로 승인하지 않고, 스키마와 smoke 계약을 검토한 뒤 현재 분석 artifact에 반영합니다."
      className={`missing-resolution-panel ${unresolved ? "is-unresolved" : "is-resolved"}`}
    >
      {candidate.missing_information.length > 0 ? (
        <ul className="missing-resolution-list">
          {candidate.missing_information.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : unresolved ? (
        <p className="review-muted">정보 필요 상태입니다. 해결 초안을 생성하고 반영한 뒤 승인하세요.</p>
      ) : resolvedItems.length > 0 ? (
        <div className="resolved-missing-list">
          {resolvedItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : (
        <p className="review-muted">남은 정보 필요 항목이 없습니다.</p>
      )}

      <div className="resolution-actions">
        <button type="button" className="secondary compact-button" onClick={() => onGenerateResolutionDraft(candidate)} disabled={isGenerating}>
          {isGenerating ? "초안 생성 중" : "해결 초안 생성"}
        </button>
        {draftError ? <span className="status-help is-warning">{draftError}</span> : null}
      </div>

      {draft ? (
        <div className="resolution-draft-preview">
          <div className="resolution-draft-header">
            <div>
              <strong>{draft.summary}</strong>
              <span>{new Date(draft.generated_at).toLocaleString()}</span>
            </div>
            <span className={`review-issue-badge ${draft.smoke_spec.ready ? "is-clear" : ""}`}>
              {draft.smoke_spec.ready ? "chat smoke 준비" : "chat smoke 확인 필요"}
            </span>
          </div>
          <div className="resolution-answer-list">
            {draft.answers.map((answer) => (
              <div className="resolution-answer-row" key={answer.missing_item}>
                <span>{answer.missing_item}</span>
                <strong>{answer.resolved_value || "값 확인 필요"}</strong>
                <small>{answer.target_artifacts.join(", ")}</small>
              </div>
            ))}
          </div>
          <div className="patch-preview-grid">
            <FieldSpecTree title="입력 스키마 초안" fields={draft.input_schema} readOnly />
            <FieldSpecTree title="출력 스키마 초안" fields={draft.output_schema} readOnly />
          </div>
          <div className="smoke-contract-preview">
            <strong>Smoke 계약</strong>
            <dl className="review-definition-grid">
              <div>
                <dt>sample</dt>
                <dd>{draft.smoke_spec.sample_user_message}</dd>
              </div>
              <div>
                <dt>mock</dt>
                <dd>{draft.smoke_spec.mock_sources.join(", ") || "-"}</dd>
              </div>
              <div>
                <dt>markers</dt>
                <dd>{draft.smoke_spec.expected_event_markers.join(", ") || "-"}</dd>
              </div>
            </dl>
            <SchemaTree schema={draft.smoke_spec.expected_output_shape} name="expected_output_shape" />
          </div>
          {draft.graph_patch_notes.length || draft.developer_todos.length ? (
            <div className="patch-notes">
              {[...draft.graph_patch_notes, ...draft.developer_todos].map((note) => (
                <span key={note}>{note}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="resolution-actions">
        <span className={canApprove ? "review-muted" : "status-help is-warning"}>
          {canApprove
            ? "적용된 artifact 기준으로 승인할 수 있습니다."
            : unresolved
              ? "초안 생성 후 반영 적용이 필요합니다."
              : "승인 gate가 해소되었습니다."}
        </span>
        <button type="button" className="secondary compact-button" onClick={applyResolutionDraft} disabled={!canApplyDraft}>
          반영 적용
        </button>
        <button
          type="button"
          className="primary compact-button"
          onClick={() => onUpdateCandidate(candidate.id, { status: "approved" })}
          disabled={!canApprove || candidate.status === "approved"}
        >
          검토 승인
        </button>
      </div>
    </FieldGroup>
  );
}

function FieldSpecEditor({ title, fields, onChange }: { title: string; fields: FieldSpec[]; onChange: (fields: FieldSpec[]) => void }) {
  return <FieldSpecTree title={title} fields={fields} onChange={onChange} />;
}

function FieldSpecTree({
  title,
  fields,
  onChange,
  readOnly = false
}: {
  title: string;
  fields: FieldSpec[];
  onChange?: (fields: FieldSpec[]) => void;
  readOnly?: boolean;
}) {
  function updateField(index: number, changes: Partial<FieldSpec>) {
    if (!onChange) return;
    onChange(fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...changes } : field)));
  }

  return (
    <div className="field-spec-tree">
      <div className="field-spec-tree-heading">
        <strong>{title}</strong>
        {!readOnly && onChange ? (
          <button
            type="button"
            className="link"
            onClick={() => onChange([...fields, { name: "field", type: "string", required: true, schema: { type: "string" } }])}
          >
            필드 추가
          </button>
        ) : null}
      </div>
      {fields.length ? (
        fields.map((field, index) => (
          <div className="field-spec-row" key={`${field.name}-${index}`}>
            <div className="field-spec-controls">
              {readOnly ? (
                <strong>{field.name}</strong>
              ) : (
                <input value={field.name} onChange={(event) => updateField(index, { name: event.target.value })} />
              )}
              {readOnly ? (
                <span>{field.type}</span>
              ) : (
                <select
                  value={normalizeFieldType(field.type)}
                  onChange={(event) =>
                    updateField(index, {
                      type: event.target.value,
                      schema: schemaForType(event.target.value)
                    })
                  }
                >
                  {["string", "number", "boolean", "object", "array"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={field.required !== false}
                  disabled={readOnly}
                  onChange={(event) => updateField(index, { required: event.target.checked })}
                />
                required
              </label>
              {!readOnly && onChange ? (
                <button type="button" className="link danger" onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}>
                  삭제
                </button>
              ) : null}
            </div>
            <SchemaTree schema={schemaForField(field)} name={field.name} />
          </div>
        ))
      ) : (
        <p className="review-muted">등록된 필드가 없습니다.</p>
      )}
    </div>
  );
}

function SchemaTree({ schema, name }: { schema: JsonSchema | undefined; name: string }) {
  const [open, setOpen] = useState(false);
  const normalized = schema ?? { type: "string" };
  const childEntries = normalized.properties ? Object.entries(normalized.properties) : [];
  const hasChildren = childEntries.length > 0 || Boolean(normalized.items);
  const required = new Set(normalized.required ?? []);

  return (
    <div className="schema-tree-node">
      <button type="button" className="schema-tree-toggle" onClick={() => setOpen((current) => !current)} disabled={!hasChildren}>
        <span>{hasChildren ? (open ? "▾" : "▸") : "•"}</span>
        <strong>{name}</strong>
        <code>{normalized.type ?? "unknown"}</code>
      </button>
      {normalized.description ? <p className="review-muted">{normalized.description}</p> : null}
      {open ? (
        <div className="schema-tree-children">
          {childEntries.map(([childName, childSchema]) => (
            <SchemaTree key={childName} name={`${childName}${required.has(childName) ? " *" : ""}`} schema={childSchema} />
          ))}
          {normalized.items ? <SchemaTree name="items" schema={normalized.items} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function buildReviewSummary(candidates: ModuleCandidate[]) {
  return candidates.reduce(
    (summary, candidate) => {
      if (hasUnresolvedMissingInfo(candidate)) summary.needsInfo += 1;
      if (candidate.status === "approved") summary.approved += 1;
      if (candidate.status === "deferred" || candidate.status === "rejected") summary.closed += 1;
      if (!hasUnresolvedMissingInfo(candidate) && candidate.status !== "approved" && candidate.status !== "rejected") {
        summary.approvable += 1;
      }
      return summary;
    },
    { needsInfo: 0, approvable: 0, approved: 0, closed: 0 }
  );
}

function hasUnresolvedMissingInfo(candidate: ModuleCandidate): boolean {
  if (candidate.missing_information.length > 0) return true;
  return candidate.status === "needs_info" && !candidateResolutionReady(candidate);
}

function candidateResolutionReady(candidate: ModuleCandidate): boolean {
  return Boolean(
    candidate.resolution_applied_at &&
      candidate.schema_review_state === "applied" &&
      candidate.smoke_spec?.ready &&
      candidate.inputs.length > 0 &&
      candidate.outputs.length > 0
  );
}

function missingInfoReviewLabel(candidate: ModuleCandidate, catalogEntries: CatalogEntry[] = emptyCatalogEntries): string {
  if (hasUnresolvedMissingInfo(candidate)) {
    if (candidate.resolution_draft) return "초안 검토 필요";
    return "해결 초안 필요";
  }
  return candidateReviewIssues(candidate, catalogEntries).length ? "계약 확인 필요" : "승인 가능";
}

function schemaForField(field: FieldSpec): JsonSchema {
  return field.schema ?? schemaForType(field.type);
}

function schemaForType(type: string): JsonSchema {
  const normalized = normalizeFieldType(type);
  if (normalized === "object") return { type: "object", properties: {}, required: [] };
  if (normalized === "array") return { type: "array", items: { type: "object", properties: {}, required: [] } };
  return { type: normalized };
}

function normalizeFieldType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("object")) return "object";
  if (normalized.includes("array")) return "array";
  if (normalized.includes("number")) return "number";
  if (normalized.includes("boolean")) return "boolean";
  return "string";
}

function mergeResolvedMissingInformation(current: string[], missing: string[]): string[] {
  return Array.from(new Set([...current, ...missing].map((item) => item.trim()).filter(Boolean)));
}

function SubtypeControl({
  candidate,
  onChange
}: {
  candidate: ModuleCandidate;
  onChange: (changes: Partial<ModuleCandidate>) => void;
}) {
  if (candidate.module_category === "adapter") {
    return (
      <select
        className="table-select"
        value={candidate.adapter_kind ?? "unknown"}
        onChange={(event) => onChange({ adapter_kind: event.target.value as AdapterKind })}
      >
        {adapterKinds.map((kind) => (
          <option key={kind} value={kind}>
            {adapterKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  if (candidate.module_category === "agent") {
    return (
      <select
        className="table-select"
        value={candidate.agent_kind ?? "specialist"}
        onChange={(event) => onChange({ agent_kind: event.target.value as AgentKind })}
      >
        {agentKinds.map((kind) => (
          <option key={kind} value={kind}>
            {agentKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  if (candidate.module_category === "workflow") {
    return (
      <select
        className="table-select"
        value={candidate.workflow_kind ?? "unknown"}
        onChange={(event) => onChange({ workflow_kind: event.target.value as WorkflowKind })}
      >
        {workflowKinds.map((kind) => (
          <option key={kind} value={kind}>
            {workflowKindLabels[kind]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      className="table-select remote-select"
      value={candidate.remote_contract_kind ?? "a2a"}
      onChange={(event) => onChange({ remote_contract_kind: event.target.value as RemoteContractKind })}
    >
      {remoteContractKinds.map((kind) => (
        <option key={kind} value={kind}>
          {remoteContractKindLabels[kind]}
        </option>
      ))}
    </select>
  );
}

function findCatalogEntryForCandidate(candidate: ModuleCandidate, catalogEntries: CatalogEntry[]): CatalogEntry | null {
  if (candidate.catalog_entry_id) {
    const byId = catalogEntries.find((entry) => entry.id === candidate.catalog_entry_id && entry.provenance !== "session_deleted");
    if (byId) return byId;
  }
  if (!candidate.reuse_candidate) return null;
  const normalizedName = candidate.name.trim().toLowerCase();
  return (
    catalogEntries.find(
      (entry) =>
        entry.provenance !== "session_deleted" &&
        entry.module_category === candidate.module_category &&
        entry.name.trim().toLowerCase() === normalizedName
    ) ?? null
  );
}

function buildGraphNeighborSummary(candidateId: string, graph: GraphIR | null) {
  if (!graph) {
    return { incoming: [], outgoing: [] };
  }
  return {
    incoming: graph.edges
      .filter((edge) => edge.to === candidateId)
      .map((edge) => ({
        from: edge.from,
        data_label: edge.data_label,
        edge_kind: edge.edge_kind,
        schema_ref: edge.schema_ref
      })),
    outgoing: graph.edges
      .filter((edge) => edge.from === candidateId)
      .map((edge) => ({
        to: edge.to,
        data_label: edge.data_label,
        edge_kind: edge.edge_kind,
        schema_ref: edge.schema_ref
      }))
  };
}

function fieldsToText(fields: FieldSpec[]): string {
  return fields.map((field) => `${field.name}: ${field.type}${field.required === false ? "" : " required"}`).join("\n");
}

function textToFields(value: string): FieldSpec[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const required = /\brequired\b/i.test(line);
      const withoutRequired = line.replace(/\brequired\b/gi, "").trim();
      const [name, type = "string"] = withoutRequired.split(":").map((part) => part.trim());
      return { name: name || "field", type: type || "string", required };
    });
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
