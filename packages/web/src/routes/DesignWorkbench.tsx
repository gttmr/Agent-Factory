import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import type { Selection } from "../components/GraphCanvas";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "../components/CategoryBadge";
import type { AnalysisResult, ModuleCandidate, RuntimeContract } from "../analyzer/types";
import {
  A2AContractInspector,
  A2AContractSidebar,
  buildA2AReviewRows
} from "../design/A2AContractPanel";
import { CommentThread } from "../design/CommentThread";
import { PathTracePanel } from "../design/PathTracePanel";
import {
  RuntimeContractInspector,
  RuntimeContractSidebar,
  runtimeContractsGateReady
} from "../design/RuntimeContractPanel";
import { a2aContractsGateReady } from "../design/a2aContractValidator";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useApprovalGate } from "../state/useApprovalGate";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useAuthor } from "../state/useAuthor";
import {
  useComments,
  useCreateComment,
  useCreateHighlight,
  useDeleteComment,
  useHighlights,
  useUpdateComment,
  type CommentAnchor,
  type CommentStage
} from "../state/useCollaboration";
import { useGraphIR } from "../state/useGraphIR";
import { useRecentRoots } from "../state/useRecentRoots";

const SIDEBAR_TABS = [
  { id: "modules", label: "모듈" },
  { id: "graph", label: "Graph IR" },
  { id: "runtime", label: "Runtime 계약" },
  { id: "a2a", label: "Remote A2A" },
  { id: "path", label: "경로" },
  { id: "comments", label: "Comments" }
] as const;
type SidebarTab = (typeof SIDEBAR_TABS)[number]["id"];

const GraphCanvas = lazy(async () => {
  const module = await import("../components/GraphCanvas");
  return { default: module.GraphCanvas };
});

export default function DesignWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const navigate = useNavigate();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData, isLoading: manifestLoading } = useArtifactRoot(reqId);
  const { data: analysisData, isLoading: analysisLoading } = useAnalysisArtifact(reqId);
  const approvalMutation = useApprovalGate(reqId);
  const saveAnalysisMutation = useSaveAnalysisArtifact(reqId);
  const { name: authorName, role: authorRole, setName: setAuthorName, setRole: setAuthorRole } = useAuthor();

  const { data: commentsFile } = useComments(reqId);
  const { data: highlightsFile } = useHighlights(reqId);
  const createComment = useCreateComment(reqId);
  const createHighlight = useCreateHighlight(reqId);
  const updateComment = useUpdateComment(reqId);
  const deleteComment = useDeleteComment(reqId);

  const [activeTab, setActiveTab] = useState<SidebarTab>("modules");
  const [selection, setSelection] = useState<Selection>({ nodeId: null, edgeId: null });
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedA2AModuleId, setSelectedA2AModuleId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;
  const analysisEtag = analysisData?.etag ?? null;
  const { graphIR, errorCount, warningCount } = useGraphIR(analysis);
  const comments = commentsFile?.comments ?? [];
  const highlights = highlightsFile?.highlights ?? [];

  const runtimeContracts = analysis?.runtimeContracts ?? [];
  const a2aContracts = analysis?.a2aContracts ?? [];
  const selectedContract =
    runtimeContracts.find((contract) => contract.contract_id === selectedContractId) ?? null;
  const runtimeContractsReady = runtimeContractsGateReady(analysis);
  const a2aContractsReady = a2aContractsGateReady(analysis);
  const a2aRows = useMemo(
    () => (analysis ? buildA2AReviewRows(analysis.moduleCandidates, a2aContracts) : []),
    [analysis, a2aContracts]
  );
  const selectedA2ARow =
    a2aRows.find((row) => row.candidate.id === selectedA2AModuleId) ?? a2aRows[0] ?? null;

  const allCandidatesApproved = useMemo(() => {
    if (!analysis?.moduleCandidates?.length) return false;
    return analysis.moduleCandidates.every((candidate) => candidate.status === "approved");
  }, [analysis]);

  const boundariesGateEnabled =
    Boolean(manifest?.approvals.analysis_reviewed) && allCandidatesApproved && errorCount === 0;
  const runtimeGateEnabled =
    Boolean(manifest?.approvals.boundaries_approved) && runtimeContractsReady && a2aContractsReady;

  const anchor = useMemo<CommentAnchor | null>(() => {
    if (selection.nodeId) return { kind: "node", node_id: selection.nodeId };
    if (selection.edgeId) return { kind: "edge", edge_id: selection.edgeId };
    return null;
  }, [selection]);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 먼저 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">
          Landing 으로
        </Link>
      </Panel>
    );
  }

  function handleToggleBoundariesApproved() {
    if (!manifest) return;
    approvalMutation.mutate(
      {
        gate: "boundaries_approved",
        value: !manifest.approvals.boundaries_approved,
        etag: manifestEtag
      },
      {
        onSuccess: () => setActionMessage("boundaries_approved 갱신 완료"),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "approval gate 갱신 실패")
      }
    );
  }

  function handleToggleRuntimeContractsApproved() {
    if (!manifest) return;
    approvalMutation.mutate(
      {
        gate: "runtime_contracts_approved",
        value: !manifest.approvals.runtime_contracts_approved,
        etag: manifestEtag
      },
      {
        onSuccess: () => setActionMessage("runtime_contracts_approved 갱신 완료"),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "approval gate 갱신 실패")
      }
    );
  }

  function handleSaveRuntimeContract(next: RuntimeContract) {
    if (!analysis) return;
    const nextAnalysis: AnalysisResult = {
      ...analysis,
      runtimeContracts: runtimeContracts.map((contract) =>
        contract.contract_id === next.contract_id ? next : contract
      )
    };
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => setActionMessage(`${next.contract_id} 저장 완료`),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "runtime contract 저장 실패")
      }
    );
  }

  function handleSaveA2AContract(next: AnalysisResult["a2aContracts"][number]) {
    if (!analysis) return;
    const replaced = a2aContracts.some((contract) => contract.contract_id === next.contract_id);
    const nextAnalysis: AnalysisResult = {
      ...analysis,
      a2aContracts: replaced
        ? a2aContracts.map((contract) => (contract.contract_id === next.contract_id ? next : contract))
        : [...a2aContracts, next]
    };
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => setActionMessage(`${next.contract_id} 저장 완료`),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "A2A contract 저장 실패")
      }
    );
  }

  function handleCreateComment(input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) {
    if (!authorName.trim()) return;
    createComment.mutate(
      {
        stage: input.stage,
        anchor: input.anchor,
        body_md: input.body_md,
        author: authorName.trim(),
        author_role: authorRole
      },
      {
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "comment 생성 실패")
      }
    );
  }

  return (
    <div className="af-design-shell">
      <StageRunnerPanel
        reqId={reqId}
        stage="design"
        skillName="af-design-boundaries"
        title="Design Skill Runner"
        description="reviewed analysis-result.json 을 기준으로 모듈 경계, Graph IR, Runtime 계약, A2A 계약 변경 제안을 생성합니다. 성공한 run 도 approval gate 를 자동으로 켜지 않습니다."
        headerAction={
          <div className="af-action-row">
            <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/analyze`}>
              Analyze 로
            </Link>
            <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/build`}>
              Build 로
            </Link>
          </div>
        }
        metrics={[
          {
            label: "analysis_reviewed",
            value: manifest?.approvals.analysis_reviewed ? "true" : "false",
            tone: manifest?.approvals.analysis_reviewed ? "ok" : "danger"
          },
          {
            label: "module status",
            value: analysis
              ? `approved ${analysis.moduleCandidates.filter((c) => c.status === "approved").length} / ${analysis.moduleCandidates.length}`
              : "없음",
            tone: allCandidatesApproved ? "ok" : "warn"
          },
          { label: "Graph IR", value: `nodes ${graphIR?.nodes?.length ?? 0} · errors ${errorCount}`, tone: errorCount ? "danger" : "ok" },
          {
            label: "Runtime/A2A",
            value: `runtime ${runtimeContracts.length} · A2A ${a2aContracts.length}`,
            tone: runtimeContractsReady && a2aContractsReady ? "ok" : "warn"
          }
        ]}
        disabledReason={
          !analysis
            ? "analysis-result.json 이 없어 Design runner 를 실행할 수 없습니다."
            : !manifest?.approvals.analysis_reviewed
              ? "analysis_reviewed=true 상태에서만 Design runner 를 실행할 수 있습니다."
              : null
        }
        currentArtifactEtag={analysisEtag}
        runButtonLabel="Design 실행"
        buildRunBody={(model) => ({ model })}
      />

      {manifestLoading || analysisLoading || actionMessage ? (
        <Panel>
          {manifestLoading || analysisLoading ? <p className="af-landing-message">데이터 불러오는 중…</p> : null}
          {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
        </Panel>
      ) : null}

      {!analysis ? (
        <Panel>
          <EmptyState
            title="analysis-result.json 이 없습니다"
            description="Analyze 단계에서 분석 결과를 먼저 import 하세요."
          />
          <Link className="ui-button ui-button-primary" to={`/af/${reqId}/analyze`}>
            Analyze 로 이동
          </Link>
        </Panel>
      ) : (
        <div className="af-design-grid">
          <aside className="af-design-sidebar" aria-label="설계 사이드바">
            <nav className="af-design-tabs" role="tablist">
              {SIDEBAR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`af-design-tab${activeTab === tab.id ? " af-design-tab-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === "comments" && comments.length > 0 ? (
                    <span className="af-design-tab-count">{comments.length}</span>
                  ) : null}
                  {tab.id === "path" && highlights.length > 0 ? (
                    <span className="af-design-tab-count">{highlights.length}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <div className="af-design-sidebar-body">
              {activeTab === "modules" ? (
                <ModuleSidebar
                  candidates={analysis.moduleCandidates}
                  selection={selection}
                  onSelectModule={(moduleId) => {
                    if (!graphIR) return;
                    const node = graphIR.nodes?.find((n) => n.module_id === moduleId);
                    setSelection({ nodeId: node?.id ?? null, edgeId: null });
                    setActiveTab("graph");
                  }}
                />
              ) : null}
              {activeTab === "graph" ? (
                <GraphSidebar
                  selection={selection}
                  errorCount={errorCount}
                  warningCount={warningCount}
                  nodes={graphIR?.nodes?.map((n) => ({ id: n.id, label: n.label, kind: n.node_kind })) ?? []}
                  edges={
                    graphIR?.edges?.map((e) => ({ id: e.id ?? "", from: e.from, to: e.to, kind: e.edge_kind })) ?? []
                  }
                  onSelectNode={(id) => setSelection({ nodeId: id, edgeId: null })}
                  onSelectEdge={(id) => setSelection({ nodeId: null, edgeId: id })}
                />
              ) : null}
              {activeTab === "runtime" ? (
                <RuntimeContractSidebar
                  contracts={runtimeContracts}
                  selectedContractId={selectedContractId}
                  onSelect={(contractId) => setSelectedContractId(contractId)}
                />
              ) : null}
              {activeTab === "a2a" ? (
                <A2AContractSidebar
                  candidates={analysis.moduleCandidates}
                  contracts={a2aContracts}
                  selectedModuleId={selectedA2ARow?.candidate.id ?? null}
                  onSelect={(moduleId) => setSelectedA2AModuleId(moduleId)}
                />
              ) : null}
              {activeTab === "comments" ? (
                <CommentThread
                  reqId={reqId}
                  comments={comments}
                  anchor={null}
                  authorName={authorName}
                  authorRole={authorRole}
                  isMutating={createComment.isPending}
                  onAuthorNameChange={setAuthorName}
                  onAuthorRoleChange={setAuthorRole}
                  onCreate={() => undefined}
                  onUpdate={(id, body) => updateComment.mutate({ id, body })}
                  onDelete={(id) => deleteComment.mutate(id)}
                  emptyHint="Graph IR 또는 모듈 탭에서 노드/엣지를 먼저 선택하세요."
                />
              ) : null}
              {activeTab === "path" ? (
                <PathTracePanel
                  graphIR={graphIR}
                  author={authorName}
                  saving={createHighlight.isPending}
                  onSelectNode={(id) => setSelection({ nodeId: id, edgeId: null })}
                  onCreateHighlight={(input) =>
                    createHighlight.mutate(input, {
                      onSuccess: () => setActionMessage("path highlight 저장 완료"),
                      onError: (error) =>
                        setActionMessage(error instanceof Error ? error.message : "highlight 저장 실패")
                    })
                  }
                />
              ) : null}
            </div>
          </aside>

          <section className="af-design-canvas-pane" aria-label="Graph IR">
            {graphIR ? (
              <Suspense fallback={<div className="af-design-canvas-loading">Graph IR 불러오는 중...</div>}>
                <GraphCanvas
                  graphIR={graphIR}
                  moduleCandidates={analysis.moduleCandidates}
                  a2aContracts={analysis.a2aContracts ?? []}
                  selection={selection}
                  onSelectionChange={setSelection}
                  comments={comments}
                  highlights={highlights}
                  hideInspector
                />
              </Suspense>
            ) : (
              <EmptyState title="Graph IR 가 없습니다" description="processFlow 가 분석 결과에 포함되어 있지 않습니다." />
            )}
          </section>

          <aside className="af-design-inspector" aria-label="선택 검토 패널">
            {activeTab === "runtime" ? (
              <RuntimeContractInspector
                key={selectedContract?.contract_id ?? "none"}
                contract={selectedContract}
                saving={saveAnalysisMutation.isPending}
                onSave={handleSaveRuntimeContract}
                onCancel={() => setActionMessage(null)}
              />
            ) : activeTab === "a2a" ? (
              <A2AContractInspector
                key={`${selectedA2ARow?.candidate.id ?? "none"}:${selectedA2ARow?.contract?.contract_id ?? "missing"}`}
                candidate={selectedA2ARow?.candidate ?? null}
                contract={selectedA2ARow?.contract ?? null}
                saving={saveAnalysisMutation.isPending}
                onSave={handleSaveA2AContract}
                onCancel={() => setActionMessage(null)}
              />
            ) : (
              <>
                <SelectionHeader selection={selection} graphIR={graphIR} />
                <CommentThread
                  reqId={reqId}
                  comments={comments}
                  anchor={anchor}
                  authorName={authorName}
                  authorRole={authorRole}
                  isMutating={createComment.isPending}
                  onAuthorNameChange={setAuthorName}
                  onAuthorRoleChange={setAuthorRole}
                  onCreate={handleCreateComment}
                  onUpdate={(id, body) => updateComment.mutate({ id, body })}
                  onDelete={(id) => deleteComment.mutate(id)}
                />
              </>
            )}
          </aside>
        </div>
      )}

      {manifest ? (
        <Panel tone="muted">
          <SectionHeader
            title="Gate: boundaries_approved"
            description={
              !manifest.approvals.analysis_reviewed
                ? "먼저 Analyze 단계에서 analysis_reviewed 를 토글하세요."
                : !allCandidatesApproved
                  ? "모든 모듈 후보가 approved 상태여야 합니다. Legacy 워크벤치의 모듈 검토에서 status 를 갱신하세요."
                  : errorCount > 0
                    ? `Graph IR 오류가 ${errorCount}건 있습니다. 검증 배너를 먼저 해소하세요.`
                    : "조건이 충족되었습니다. 게이트를 토글하여 Build 단계로 진행하세요."
            }
            action={
              <Button
                variant={manifest.approvals.boundaries_approved ? "secondary" : "primary"}
                type="button"
                onClick={handleToggleBoundariesApproved}
                disabled={
                  approvalMutation.isPending ||
                  (!manifest.approvals.boundaries_approved && !boundariesGateEnabled)
                }
              >
                {approvalMutation.isPending
                  ? "갱신 중…"
                  : manifest.approvals.boundaries_approved
                    ? "승인 취소"
                    : "경계 승인"}
              </Button>
            }
          />
          <ul className="af-gate-summary">
            <li>analysis_reviewed: {manifest.approvals.analysis_reviewed ? "예" : "아니오"}</li>
            <li>
              모듈 approved {analysis ? analysis.moduleCandidates.filter((c) => c.status === "approved").length : 0} /{" "}
              {analysis?.moduleCandidates.length ?? 0}
            </li>
            <li>Graph IR errors: {errorCount} · warnings: {warningCount}</li>
            <li>코멘트: {comments.length}건 · highlights: {highlights.length}건</li>
          </ul>
          <SectionHeader
            title="Gate: runtime_contracts_approved"
            description={
              runtimeContracts.length === 0 && a2aRows.length === 0
                ? "Runtime/A2A 계약 후보가 없습니다. 토글만 누르면 통과로 처리됩니다."
                : !manifest.approvals.boundaries_approved
                  ? "boundaries_approved 가 먼저 활성화되어야 합니다."
                  : runtimeContractsReady && a2aContractsReady
                    ? "모든 필수 Runtime/A2A 계약이 approved 입니다. 토글을 눌러 design 단계를 마무리하세요."
                    : "Runtime 계약 또는 Remote A2A 탭에서 readiness issue 가 남은 계약을 approved 로 만들어 주세요."
            }
            action={
              <Button
                variant={manifest.approvals.runtime_contracts_approved ? "secondary" : "primary"}
                type="button"
                onClick={handleToggleRuntimeContractsApproved}
                disabled={
                  approvalMutation.isPending ||
                  (!manifest.approvals.runtime_contracts_approved && !runtimeGateEnabled)
                }
              >
                {approvalMutation.isPending
                  ? "갱신 중…"
                  : manifest.approvals.runtime_contracts_approved
                    ? "계약 승인 취소"
                    : "Runtime/A2A 계약 승인"}
              </Button>
            }
          />
          <ul className="af-gate-summary">
            <li>
              Runtime 계약 {runtimeContracts.length}개 — approved{" "}
              {runtimeContracts.filter((contract) => contract.contract_status === "approved").length} · rejected{" "}
              {runtimeContracts.filter((contract) => contract.contract_status === "rejected").length}
            </li>
            <li>
              Remote A2A 후보 {a2aRows.length}개 — approved{" "}
              {a2aRows.filter((row) => row.contract?.contract_status === "approved").length} · missing{" "}
              {a2aRows.filter((row) => !row.contract).length}
            </li>
            <li>
              계약 readiness:{" "}
              {runtimeContracts.length === 0 && a2aRows.length === 0
                ? "—"
                : runtimeContractsReady && a2aContractsReady
                  ? "모든 Runtime/A2A 계약 OK"
                  : "남은 issue 있음"}
            </li>
          </ul>
          <div className="af-action-row">
            <Button
              type="button"
              variant="ghost"
              disabled={!manifest.approvals.boundaries_approved || !manifest.approvals.runtime_contracts_approved}
              onClick={() => navigate(`/af/${reqId}/build`)}
            >
              Build 워크벤치로 이동
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

interface ModuleSidebarProps {
  candidates: ModuleCandidate[];
  selection: Selection;
  onSelectModule: (moduleId: string) => void;
}

function ModuleSidebar({ candidates, onSelectModule }: ModuleSidebarProps) {
  if (!candidates.length) {
    return <p className="af-design-empty">모듈 후보가 없습니다.</p>;
  }
  return (
    <ul className="af-module-list">
      {candidates.map((candidate) => (
        <li
          key={candidate.id}
          className={`af-module-item af-module-item-${candidate.status}`}
        >
          <button type="button" className="af-module-item-button" onClick={() => onSelectModule(candidate.id)}>
            <span className="af-module-item-header">
              <CategoryBadge category={candidate.module_category} />
              {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate) as string} /> : null}
            </span>
            <strong>{candidate.name}</strong>
            <small className="af-module-item-rationale">{candidate.rationale}</small>
            <span className="af-module-item-status">{statusLabel(candidate.status)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface GraphSidebarProps {
  selection: Selection;
  errorCount: number;
  warningCount: number;
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ id: string; from: string; to: string; kind: string }>;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
}

function GraphSidebar({ selection, errorCount, warningCount, nodes, edges, onSelectNode, onSelectEdge }: GraphSidebarProps) {
  return (
    <div className="af-graph-sidebar">
      <p className="af-graph-sidebar-stats">
        노드 {nodes.length} · 엣지 {edges.length} · 오류 {errorCount} · 경고 {warningCount}
      </p>
      <details open>
        <summary>노드</summary>
        <ul className="af-graph-list">
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                className={`af-graph-list-button${selection.nodeId === node.id ? " af-graph-list-button-active" : ""}`}
                onClick={() => onSelectNode(node.id)}
              >
                <code>{node.id}</code>
                <span>{node.label}</span>
                <small>{node.kind}</small>
              </button>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>엣지</summary>
        <ul className="af-graph-list">
          {edges.map((edge) => (
            <li key={edge.id}>
              <button
                type="button"
                className={`af-graph-list-button${selection.edgeId === edge.id ? " af-graph-list-button-active" : ""}`}
                onClick={() => onSelectEdge(edge.id)}
              >
                <code>{edge.id}</code>
                <span>{edge.from} → {edge.to}</span>
                <small>{edge.kind}</small>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SelectionHeader({ selection, graphIR }: { selection: Selection; graphIR: ReturnType<typeof useGraphIR>["graphIR"] }) {
  if (!graphIR) {
    return (
      <SectionHeader eyebrow="선택 없음" title="Inspector" description="Graph IR 이 없어 인스펙터를 표시할 수 없습니다." />
    );
  }
  if (selection.nodeId) {
    const node = graphIR.nodes?.find((n) => n.id === selection.nodeId);
    return (
      <SectionHeader
        eyebrow={`Node ${selection.nodeId}`}
        title={node?.label ?? selection.nodeId}
        description={`node_kind ${node?.node_kind ?? "?"} · lane ${node?.lane_id ?? "?"}`}
      />
    );
  }
  if (selection.edgeId) {
    const edge = graphIR.edges?.find((e) => e.id === selection.edgeId);
    return (
      <SectionHeader
        eyebrow={`Edge ${selection.edgeId}`}
        title={edge ? `${edge.from} → ${edge.to}` : selection.edgeId}
        description={`edge_kind ${edge?.edge_kind ?? "?"} · ${edge?.execution_semantics ?? "?"}`}
      />
    );
  }
  return (
    <SectionHeader
      eyebrow="선택 없음"
      title="Inspector"
      description="Graph IR 에서 노드/엣지를 선택하면 여기에서 코멘트를 남길 수 있습니다."
    />
  );
}

function statusLabel(status: string): string {
  if (status === "approved") return "approved";
  if (status === "needs_info") return "needs_info";
  if (status === "deferred") return "deferred";
  if (status === "rejected") return "rejected";
  return status;
}
