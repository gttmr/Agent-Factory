import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Field, Panel, SectionHeader } from "../ui/primitives";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import type { GraphEditState, Selection } from "../components/GraphCanvas";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "../components/CategoryBadge";
import { GraphElementEditor } from "../components/GraphElementEditor";
import { GraphInspector } from "../components/GraphInspector";
import {
  applyNodeReviewStatus,
  approveCandidate,
  resolveMissingItem,
  setCandidateStatus
} from "../analyzer/moduleReview";
import { createA2AContractForCandidate } from "../analyzer/a2aNormalize";
import { insertCatalogWorkflowNode, pruneDetachedCatalogWorkflowCandidates } from "../analyzer/nestedWorkflowInsert";
import type {
  AnalysisResult,
  GraphEdge,
  GraphIR,
  GraphNode,
  ModuleCandidate,
  ModuleStatus,
  RuntimeContract
} from "../analyzer/types";
import { CatalogWorkflowPicker } from "../design/CatalogWorkflowPicker";
import {
  A2AContractInspector,
  A2AContractSidebar,
  buildA2AReviewRows
} from "../design/A2AContractPanel";
import { CommentThread } from "../design/CommentThread";
import {
  DESIGN_BOTTOM_TABS,
  nextDesignBottomTabAfterModuleSelect,
  type DesignBottomTab
} from "../design/designWorkbenchTabs";
import { ReviewNotesPanel } from "../design/ReviewNotesPanel";
import { commentAnchorFromSelection, reviewNotesBadgeCount } from "../design/reviewNotesModel";
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
  useDeleteHighlight,
  useHighlights,
  useUpdateComment,
  type CommentAnchor,
  type CommentStage
} from "../state/useCollaboration";
import { useGraphIR } from "../state/useGraphIR";
import { useRecentRoots } from "../state/useRecentRoots";

type SidebarTab = DesignBottomTab;

type DesignStepId = "run" | "review" | "approve";
const DESIGN_STEP_IDS: DesignStepId[] = ["run", "review", "approve"];

// ──────────────────────────────────────────────────────────────────────────
// 검토 스텝의 우측 Inspector 패널은 당분간 사용하지 않는다 (그래프 캔버스에 폭을
// 양보하기 위해). 코드는 삭제하지 않고 이 플래그로 비활성화만 했다 — 다시 켜려면
// INSPECTOR_ENABLED = true 로 바꾸면 3-pane(모듈 사이드바 | 캔버스 | Inspector)이
// 복원된다.
//
// 비활성 동안 함께 휴면 상태가 되는 것: Runtime 계약 / Remote A2A 탭의 *편집*
// 우측 인스펙터(RuntimeContractInspector / A2AContractInspector). 노드/엣지 앵커
// 코멘트 작성은 하단 검토 메모 탭에서 제공한다. Remote A2A 편집도 하단 탭에서 제공한다.
// 관련 핸들러(handleSaveRuntimeContract, handleSaveA2AContract, handleCreateComment)는 보존한다.
// ──────────────────────────────────────────────────────────────────────────
const INSPECTOR_ENABLED = false;

const GraphCanvas = lazy(async () => {
  const module = await import("../components/GraphCanvas");
  return { default: module.GraphCanvas };
});

export default function DesignWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
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
  const deleteHighlight = useDeleteHighlight(reqId);

  const [activeTab, setActiveTab] = useState<SidebarTab>("modules");
  const [selection, setSelection] = useState<Selection>({ nodeId: null, edgeId: null });
  const [graphEditState, setGraphEditState] = useState<GraphEditState | null>(null);
  const [selectedReviewModuleId, setSelectedReviewModuleId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedA2AModuleId, setSelectedA2AModuleId] = useState<string | null>(null);
  const [catalogWorkflowPickerOpen, setCatalogWorkflowPickerOpen] = useState(false);
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
  const selectedReviewCandidate =
    (selectedReviewModuleId
      ? analysis?.moduleCandidates.find((candidate) => candidate.id === selectedReviewModuleId) ?? null
      : null) ??
    analysis?.moduleCandidates[0] ??
    null;

  const allCandidatesApproved = useMemo(() => {
    if (!analysis?.moduleCandidates?.length) return false;
    return analysis.moduleCandidates.every((candidate) => candidate.status === "approved");
  }, [analysis]);
  const approvedCandidateCount = analysis
    ? analysis.moduleCandidates.filter((candidate) => candidate.status === "approved").length
    : 0;
  const unapprovedCandidateCount = analysis ? analysis.moduleCandidates.length - approvedCandidateCount : 0;

  const boundariesGateEnabled =
    Boolean(manifest?.approvals.analysis_reviewed) && allCandidatesApproved && errorCount === 0;
  const runtimeGateEnabled =
    Boolean(manifest?.approvals.boundaries_approved) && runtimeContractsReady && a2aContractsReady;

  // 스텝 상태 파생 — 게이트 재계산이 아니라 산출물/승인 상태에서 읽기만 한다.
  const hasGraph = Boolean(graphIR);
  const reviewReady =
    allCandidatesApproved && errorCount === 0 && runtimeContractsReady && a2aContractsReady;
  const boundariesApproved = Boolean(manifest?.approvals.boundaries_approved);
  const runtimeApproved = Boolean(manifest?.approvals.runtime_contracts_approved);
  const bothApproved = boundariesApproved && runtimeApproved;
  const defaultStep: DesignStepId = !hasGraph ? "run" : !reviewReady ? "review" : "approve";
  const [activeStep, setActiveStep] = useStageStep(DESIGN_STEP_IDS, defaultStep);

  const anchor = useMemo<CommentAnchor | null>(() => commentAnchorFromSelection(selection), [selection]);

  // 좌측 사이드바 상단에 선택한 노드/엣지 상세를 표시하기 위한 파생값.
  // (GraphCanvas 내부 inspector 와 동일한 derivation — id 매핑도 layout.ts 와 맞춘다.)
  const nodeById = useMemo(
    () => new Map<string, GraphNode>((graphIR?.nodes ?? []).map((n) => [n.id, n])),
    [graphIR]
  );
  const edgeById = useMemo(
    () => new Map<string, GraphEdge>((graphIR?.edges ?? []).map((e, i) => [e.id ?? `edge-${i}`, e])),
    [graphIR]
  );
  const candidateById = useMemo(() => {
    const map = new Map<string, ModuleCandidate>();
    for (const candidate of analysis?.moduleCandidates ?? []) map.set(candidate.id, candidate);
    return map;
  }, [analysis]);
  const selectedNode = selection.nodeId ? nodeById.get(selection.nodeId) ?? null : null;
  const selectedEdge = selection.edgeId ? edgeById.get(selection.edgeId) ?? null : null;
  const selectedCandidate =
    selectedNode && selectedNode.module_id ? candidateById.get(selectedNode.module_id) ?? null : null;
  const nodeLabel = (id: string) => nodeById.get(id)?.label ?? id;

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

  function handleCreateA2AContract(candidate: ModuleCandidate) {
    if (!analysis || candidate.module_category !== "remote_a2a") return;
    const nextAnalysis = createA2AContractForCandidate(analysis, candidate.id);
    const contractId = nextAnalysis.moduleCandidates.find((moduleCandidate) => moduleCandidate.id === candidate.id)?.a2a_contract_id;
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => {
          setSelectedA2AModuleId(candidate.id);
          setActionMessage(`${contractId} 새 계약 생성 완료`);
        },
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "A2A contract 생성 실패")
      }
    );
  }

  function handleInsertCatalogWorkflow(entry: Parameters<typeof insertCatalogWorkflowNode>[1]) {
    if (!analysis || !reqId) return;
    const nextAnalysis = insertCatalogWorkflowNode(analysis, entry, reqId);
    if (nextAnalysis === analysis) {
      setActionMessage("processFlow 가 없어 노드를 추가하지 못했습니다.");
      return;
    }
    const insertedCandidate = nextAnalysis.moduleCandidates[nextAnalysis.moduleCandidates.length - 1] ?? null;
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => {
          if (insertedCandidate) {
            setSelectedReviewModuleId(insertedCandidate.id);
            setActiveTab("modules");
          }
          setCatalogWorkflowPickerOpen(false);
          setActionMessage("노드가 추가되었습니다 — 엣지 연결과 모듈 승인이 필요합니다.");
        },
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "카탈로그 workflow 삽입 실패")
      }
    );
  }

  function handleSaveGraphIR(nextGraph: GraphIR) {
    if (!analysis) return;
    const nextAnalysis = pruneDetachedCatalogWorkflowCandidates({
      ...analysis,
      processFlow: nextGraph
    });
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => setActionMessage("Graph IR 저장 완료"),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "Graph IR 저장 실패")
      }
    );
  }

  function handleSaveCandidate(candidateId: string, nextCandidate: ModuleCandidate, syncStatus?: ModuleStatus) {
    if (!analysis) return;
    setSelectedReviewModuleId(candidateId);
    const nextAnalysis: AnalysisResult = {
      ...analysis,
      moduleCandidates: analysis.moduleCandidates.map((candidate) =>
        candidate.id === candidateId ? nextCandidate : candidate
      ),
      processFlow:
        syncStatus && analysis.processFlow
          ? applyNodeReviewStatus(analysis.processFlow, candidateId, syncStatus)
          : analysis.processFlow
    };
    saveAnalysisMutation.mutate(
      { analysis: nextAnalysis, etag: analysisEtag },
      {
        onSuccess: () => setActionMessage(`${nextCandidate.name} 모듈 검토 저장 완료`),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "모듈 검토 저장 실패")
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

  const steps: StageStep[] = [
    {
      id: "run",
      label: "1. 실행",
      hint: "경계·Graph IR 생성",
      status: hasGraph ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "모듈·그래프·계약",
      available: hasGraph,
      status: !hasGraph
        ? "todo"
        : reviewReady
          ? "done"
          : activeStep === "review"
            ? "current"
            : "blocked"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "경계·계약 게이트",
      available: hasGraph,
      status: bothApproved
        ? "done"
        : !reviewReady
          ? hasGraph
            ? "blocked"
            : "todo"
          : activeStep === "approve"
            ? "current"
            : "todo"
    }
  ];

  const nextAction = buildDesignNextAction({
    activeStep: activeStep as DesignStepId,
    reqId,
    hasAnalysis: Boolean(analysis),
    analysisReviewed: Boolean(manifest?.approvals.analysis_reviewed),
    hasGraph,
    reviewReady,
    bothApproved,
    unapprovedCandidateCount,
    errorCount,
    runtimeContractsReady,
    a2aContractsReady,
    runtimeContractCount: runtimeContracts.length,
    a2aContractCount: a2aRows.length,
    onAdvance: setActiveStep
  });

  const notice =
    manifestLoading || analysisLoading || actionMessage ? (
      <div className="af-stage-notice" role="status">
        {manifestLoading || analysisLoading ? <span>데이터 불러오는 중…</span> : null}
        {actionMessage ? <span>{actionMessage}</span> : null}
      </div>
    ) : null;

  return (
    <StageShell
      eyebrow={`설계 · ${reqId}`}
      title="설계"
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      summary={
        <>
          <DesignSummaryItem
            label="모듈"
            value={
              analysis
                ? `approved ${analysis.moduleCandidates.filter((c) => c.status === "approved").length}/${analysis.moduleCandidates.length}`
                : "—"
            }
          />
          <DesignSummaryItem label="Graph IR" value={`nodes ${graphIR?.nodes?.length ?? 0} · err ${errorCount}`} />
          <DesignSummaryItem
            label="Runtime/A2A"
            value={`runtime ${runtimeContracts.length} · A2A ${a2aContracts.length}`}
          />
          <DesignSummaryItem
            label="게이트"
            value={`${boundariesApproved ? "경계✓" : "경계·"} ${runtimeApproved ? "계약✓" : "계약·"}`}
          />
        </>
      }
      nextAction={nextAction}
    >
      {notice}

      {activeStep === "run" ? (
        <StageRunnerPanel
          reqId={reqId}
          stage="design"
          skillName="af-design-boundaries"
          title="Design Skill Runner"
          description="reviewed analysis-result.json 을 기준으로 모듈 경계, Graph IR, Runtime 계약, A2A 계약 변경 제안을 생성합니다. 성공한 run 도 approval gate 를 자동으로 켜지 않습니다."
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
      ) : null}

      {activeStep === "review" ? (
        !analysis ? (
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
          <div className="af-design-split">
          <div className={`af-design-grid${INSPECTOR_ENABLED ? "" : " af-design-grid--no-inspector"}`}>
          <aside className="af-design-sidebar" aria-label="선택 노드/엣지 정보">
            {graphEditState?.editModeActive && (graphEditState.selectedNode || graphEditState.selectedEdge) ? (
              <GraphElementEditor
                editState={graphEditState}
                moduleCandidates={analysis.moduleCandidates ?? []}
                a2aContracts={a2aContracts}
                onClose={() => setSelection({ nodeId: null, edgeId: null })}
              />
            ) : (
              <GraphInspector
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                nodeLabel={nodeLabel}
                candidate={selectedCandidate}
                a2aContracts={a2aContracts}
                onNavigateToA2AContracts={() => setActiveTab("a2a")}
                onClose={() => setSelection({ nodeId: null, edgeId: null })}
              />
            )}
          </aside>

          <section className="af-design-canvas-pane" aria-label="Graph IR">
            <div className="af-design-canvas-toolbar">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCatalogWorkflowPickerOpen(true)}
                disabled={saveAnalysisMutation.isPending || graphEditState?.editModeActive === true}
              >
                카탈로그 워크플로우 삽입
              </Button>
            </div>
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
                  editable
                  saving={saveAnalysisMutation.isPending}
                  onSaveGraph={handleSaveGraphIR}
                  onEditStateChange={setGraphEditState}
                />
              </Suspense>
            ) : (
              <EmptyState title="Graph IR 가 없습니다" description="processFlow 가 분석 결과에 포함되어 있지 않습니다." />
            )}
          </section>

          {/* 우측 Inspector 패널 — INSPECTOR_ENABLED 로 비활성화됨(상단 주석 참고).
              false 인 동안 캔버스가 이 영역까지 차지하도록 grid 는 2열로 전환된다. */}
          {INSPECTOR_ENABLED ? (
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
          ) : null}
          </div>

          <div className="af-design-bottom" aria-label="모듈·계약·검토 메모 패널">
            <nav className="af-design-tabs" role="tablist">
              {DESIGN_BOTTOM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`af-design-tab${activeTab === tab.id ? " af-design-tab-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === "reviewNotes" && reviewNotesBadgeCount(comments.length, highlights.length) > 0 ? (
                    <span className="af-design-tab-count">{reviewNotesBadgeCount(comments.length, highlights.length)}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <div className={`af-design-sidebar-body${activeTab === "modules" ? " af-design-sidebar-body--modules" : ""}`}>
              {activeTab === "modules" ? (
                <div className="af-module-review-layout">
                  <div className="af-module-review-list-pane">
                    <ModuleSidebar
                      candidates={analysis.moduleCandidates}
                      selectedModuleId={selectedReviewCandidate?.id ?? null}
                      onSelectModule={(moduleId) => {
                        setSelectedReviewModuleId(moduleId);
                        if (!graphIR) return;
                        const node = graphIR.nodes?.find((n) => n.module_id === moduleId);
                        setSelection({ nodeId: node?.id ?? null, edgeId: null });
                        setActiveTab((currentTab) => nextDesignBottomTabAfterModuleSelect(currentTab));
                      }}
                    />
                  </div>
                  <ModuleReviewDetail
                    key={selectedReviewCandidate?.id ?? "none"}
                    candidate={selectedReviewCandidate}
                    saving={saveAnalysisMutation.isPending}
                    onResolveMissing={(candidate, item, note) =>
                      handleSaveCandidate(candidate.id, resolveMissingItem(candidate, item, note))
                    }
                    onApprove={(candidate) => {
                      const nextCandidate = approveCandidate(candidate);
                      handleSaveCandidate(
                        candidate.id,
                        nextCandidate,
                        nextCandidate.status === "approved" ? "approved" : undefined
                      );
                    }}
                    onDefer={(candidate) =>
                      handleSaveCandidate(candidate.id, setCandidateStatus(candidate, "deferred"), "deferred")
                    }
                    onReject={(candidate) =>
                      handleSaveCandidate(candidate.id, setCandidateStatus(candidate, "rejected"), "rejected")
                    }
                  />
                </div>
              ) : null}
              {activeTab === "runtime" ? (
                <RuntimeContractSidebar
                  contracts={runtimeContracts}
                  selectedContractId={selectedContractId}
                  onSelect={(contractId) => setSelectedContractId(contractId)}
                />
              ) : null}
              {activeTab === "a2a" ? (
                <div className="af-a2a-tab-panel">
                  <div className="af-a2a-tab-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!selectedA2ARow || Boolean(selectedA2ARow.contract) || saveAnalysisMutation.isPending}
                      onClick={() => {
                        if (selectedA2ARow) handleCreateA2AContract(selectedA2ARow.candidate);
                      }}
                    >
                      새 계약 생성
                    </Button>
                  </div>
                  <A2AContractSidebar
                    candidates={analysis.moduleCandidates}
                    contracts={a2aContracts}
                    selectedModuleId={selectedA2ARow?.candidate.id ?? null}
                    onSelect={(moduleId) => setSelectedA2AModuleId(moduleId)}
                  />
                  <A2AContractInspector
                    key={`${selectedA2ARow?.candidate.id ?? "none"}:${selectedA2ARow?.contract?.contract_id ?? "missing"}`}
                    candidate={selectedA2ARow?.candidate ?? null}
                    contract={selectedA2ARow?.contract ?? null}
                    saving={saveAnalysisMutation.isPending}
                    onSave={handleSaveA2AContract}
                    onCancel={() => setActionMessage(null)}
                  />
                </div>
              ) : null}
              {activeTab === "reviewNotes" ? (
                <ReviewNotesPanel
                  reqId={reqId}
                  graphIR={graphIR}
                  comments={comments}
                  highlights={highlights}
                  commentAnchor={anchor}
                  authorName={authorName}
                  authorRole={authorRole}
                  isCommentMutating={createComment.isPending}
                  isHighlightMutating={createHighlight.isPending}
                  onAuthorNameChange={setAuthorName}
                  onAuthorRoleChange={setAuthorRole}
                  onCreateComment={handleCreateComment}
                  onUpdateComment={(id, body) => updateComment.mutate({ id, body })}
                  onDeleteComment={(id) => deleteComment.mutate(id)}
                  onSelectNode={(id) => setSelection({ nodeId: id, edgeId: null })}
                  onCreateHighlight={(input) =>
                    createHighlight.mutate(input, {
                      onSuccess: () => setActionMessage("경로 하이라이트 저장 완료"),
                      onError: (error) =>
                        setActionMessage(error instanceof Error ? error.message : "경로 하이라이트 저장 실패")
                    })
                  }
                  onDeleteHighlight={(id) => deleteHighlight.mutate(id)}
                />
              ) : null}
            </div>
          </div>
          </div>
        )
      ) : null}

      {activeStep === "approve" ? (
        manifest ? (
          <Panel tone="muted">
          <SectionHeader
            title="Gate: boundaries_approved"
            description={
              !manifest.approvals.analysis_reviewed
                ? "먼저 Analyze 단계에서 analysis_reviewed 를 토글하세요."
                : !allCandidatesApproved
                  ? "모든 모듈 후보가 approved 상태여야 합니다. 하단 '모듈' 탭에서 후보를 선택해 누락 항목을 해소하고 승인하세요."
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
                    : "Stage Runner 재실행 또는 외부 편집으로 계약을 보완하세요."
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
        </Panel>
        ) : (
          <Panel>
            <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
          </Panel>
        )
      ) : null}
      {catalogWorkflowPickerOpen ? (
        <CatalogWorkflowPicker
          inserting={saveAnalysisMutation.isPending}
          onClose={() => setCatalogWorkflowPickerOpen(false)}
          onInsert={handleInsertCatalogWorkflow}
        />
      ) : null}
    </StageShell>
  );
}

function DesignSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildDesignNextAction({
  activeStep,
  reqId,
  hasAnalysis,
  analysisReviewed,
  hasGraph,
  reviewReady,
  bothApproved,
  unapprovedCandidateCount,
  errorCount,
  runtimeContractsReady,
  a2aContractsReady,
  runtimeContractCount,
  a2aContractCount,
  onAdvance
}: {
  activeStep: DesignStepId;
  reqId: string;
  hasAnalysis: boolean;
  analysisReviewed: boolean;
  hasGraph: boolean;
  reviewReady: boolean;
  bothApproved: boolean;
  unapprovedCandidateCount: number;
  errorCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  runtimeContractCount: number;
  a2aContractCount: number;
  onAdvance: (id: DesignStepId) => void;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !hasGraph,
      hint: hasGraph
        ? "경계·Graph IR 제안이 준비됐습니다. ‘2. 검토’에서 모듈·그래프·계약을 확인하세요."
        : !hasAnalysis
          ? "Analyze 단계에서 분석 결과를 먼저 만들어야 Design 을 실행할 수 있습니다."
          : !analysisReviewed
            ? "Analyze 단계에서 analysis_reviewed 게이트를 먼저 통과하세요."
            : "Design 을 실행해 Graph IR·계약 제안을 생성하세요."
    };
  }
  if (activeStep === "review") {
    const unmetConditions = buildReviewUnmetConditions({
      hasGraph,
      unapprovedCandidateCount,
      errorCount,
      runtimeContractsReady,
      a2aContractsReady,
      runtimeContractCount,
      a2aContractCount
    });
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !hasGraph,
      hint: reviewReady
        ? "모든 모듈 approved · Graph IR 오류 0 · Runtime/A2A 계약 준비 완료. ‘3. 승인’에서 게이트를 토글하세요."
        : unmetConditions.join(" · ")
    };
  }
  return {
    label: "개발 단계로 →",
    to: `/af/${reqId}/build`,
    disabled: !bothApproved,
    hint: bothApproved
      ? "경계·계약 승인이 끝났습니다. 개발(Build) 단계로 이동하세요."
      : "boundaries_approved 와 runtime_contracts_approved 를 모두 통과해야 다음 단계로 갈 수 있습니다."
  };
}

function buildReviewUnmetConditions({
  hasGraph,
  unapprovedCandidateCount,
  errorCount,
  runtimeContractsReady,
  a2aContractsReady,
  runtimeContractCount,
  a2aContractCount
}: {
  hasGraph: boolean;
  unapprovedCandidateCount: number;
  errorCount: number;
  runtimeContractsReady: boolean;
  a2aContractsReady: boolean;
  runtimeContractCount: number;
  a2aContractCount: number;
}): string[] {
  const unmet: string[] = [];
  if (!hasGraph) unmet.push("Graph IR 없음 — Design 실행 필요");
  if (unapprovedCandidateCount > 0) {
    unmet.push(`미승인 모듈 ${unapprovedCandidateCount}개 — 하단 모듈 탭에서 승인`);
  }
  if (errorCount > 0) {
    unmet.push(`Graph IR 오류 ${errorCount}개 — 그래프 편집으로 해소`);
  }
  if (runtimeContractCount + a2aContractCount > 0) {
    if (!runtimeContractsReady) unmet.push("Runtime 계약 준비 필요");
    if (!a2aContractsReady) unmet.push("A2A 계약 준비 필요");
  }
  return unmet.length ? unmet : ["검토 조건을 다시 확인하세요."];
}

interface ModuleSidebarProps {
  candidates: ModuleCandidate[];
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string) => void;
}

function ModuleSidebar({ candidates, selectedModuleId, onSelectModule }: ModuleSidebarProps) {
  if (!candidates.length) {
    return <p className="af-design-empty">모듈 후보가 없습니다.</p>;
  }
  return (
    <ul className="af-module-list">
      {candidates.map((candidate) => (
        <li
          key={candidate.id}
          className={`af-module-item af-module-item-${candidate.status}${selectedModuleId === candidate.id ? " af-module-item-active" : ""}`}
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

interface ModuleReviewDetailProps {
  candidate: ModuleCandidate | null;
  saving: boolean;
  onResolveMissing: (candidate: ModuleCandidate, item: string, note: string) => void;
  onApprove: (candidate: ModuleCandidate) => void;
  onDefer: (candidate: ModuleCandidate) => void;
  onReject: (candidate: ModuleCandidate) => void;
}

function ModuleReviewDetail({
  candidate,
  saving,
  onResolveMissing,
  onApprove,
  onDefer,
  onReject
}: ModuleReviewDetailProps) {
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  if (!candidate) {
    return (
      <section className="af-module-review-detail" aria-label="모듈 검토 상세">
        <EmptyState title="선택한 모듈 없음" description="왼쪽 목록에서 검토할 모듈 후보를 선택하세요." />
      </section>
    );
  }

  const missingItems = candidate.missing_information ?? [];
  const resolvedItems = candidate.resolved_missing_information ?? [];
  const riskSignals = candidate.risk_signals ?? [];
  const subtype = getSubtypeValue(candidate);
  const approveDisabled = saving || missingItems.length > 0;

  return (
    <section className="af-module-review-detail" aria-label={`${candidate.name} 모듈 검토`}>
      <header className="af-module-review-header">
        <div>
          <div className="af-module-review-badges">
            <CategoryBadge category={candidate.module_category} />
            {subtype ? <SubtypeBadge value={subtype} /> : null}
          </div>
          <h3>{candidate.name}</h3>
        </div>
        <span className={`af-module-review-status af-module-review-status-${candidate.status}`}>
          {statusLabel(candidate.status)}
        </span>
      </header>

      <div className="af-module-review-section">
        <h4>검토 근거</h4>
        <p>{candidate.rationale || "근거 설명이 없습니다."}</p>
        <dl className="af-module-review-meta">
          <div>
            <dt>risk_level</dt>
            <dd>{candidate.risk_level}</dd>
          </div>
          <div>
            <dt>risk_signals</dt>
            <dd>{riskSignals.length ? riskSignals.join(", ") : "없음"}</dd>
          </div>
        </dl>
      </div>

      <div className="af-module-review-section">
        <h4>누락 항목</h4>
        {missingItems.length ? (
          <ul className="af-module-review-missing-list">
            {missingItems.map((item) => (
              <li key={item} className="af-module-review-missing-item">
                <span>{item}</span>
                <Field label="해소 메모">
                  <input
                    type="text"
                    value={resolutionNotes[item] ?? ""}
                    onChange={(event) =>
                      setResolutionNotes((current) => ({ ...current, [item]: event.target.value }))
                    }
                    placeholder="선택 입력"
                    disabled={saving}
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    onResolveMissing(candidate, item, resolutionNotes[item] ?? "");
                    setResolutionNotes((current) => ({ ...current, [item]: "" }));
                  }}
                >
                  해소
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="af-module-review-empty">남은 누락 항목이 없습니다.</p>
        )}
      </div>

      {resolvedItems.length ? (
        <div className="af-module-review-section">
          <h4>해소된 항목</h4>
          <ul className="af-module-review-resolved-list">
            {resolvedItems.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <small>해소됨</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="af-action-row af-module-review-actions">
        <Button type="button" variant="primary" disabled={approveDisabled} onClick={() => onApprove(candidate)}>
          승인
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onDefer(candidate)}>
          보류
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => onReject(candidate)}>
          반려
        </Button>
        {missingItems.length ? (
          <small>누락 항목을 모두 해소해야 승인할 수 있습니다.</small>
        ) : null}
      </div>
    </section>
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
