import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { GraphEditState, Selection } from "../components/GraphCanvas";
import type { GraphEdge, GraphNode, ModuleCandidate } from "../analyzer/types";
import { CatalogWorkflowPicker } from "../design/CatalogWorkflowPicker";
import { buildA2AReviewRows } from "../design/A2AContractPanel";
import { a2aContractsGateReady } from "../design/a2aContractValidator";
import { runtimeContractsGateReady } from "../design/RuntimeContractPanel";
import { commentAnchorFromSelection } from "../design/reviewNotesModel";
import { StageShell, useStageStep } from "../layout/StageShell";
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
  type CommentAnchor
} from "../state/useCollaboration";
import { useGraphIR } from "../state/useGraphIR";
import { graphEdgeId } from "../graph/graphDisplay";
import { useRecentRoots } from "../state/useRecentRoots";
import { DesignApprovalStep } from "./design/DesignApprovalStep";
import { DesignReviewStep, type DesignReviewHandlers } from "./design/DesignReviewStep";
import { DesignRunStep } from "./design/DesignRunStep";
import { createDesignWorkbenchActions } from "./design/designWorkbenchActions";
import { DesignNotice, DesignSummary, MissingAnalysis, MissingRequirement, createDesignComment } from "./design/designWorkbenchChrome";
import {
  DESIGN_STEP_IDS,
  buildDesignNextAction,
  buildDesignSteps,
  type DesignStepId,
  type SidebarTab
} from "./design/designStageModel";

export default function DesignWorkbench() {
  const { reqId } = useParams<{ reqId: string }>();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData, isLoading: manifestLoading } = useArtifactRoot(reqId);
  const { data: analysisData, isLoading: analysisLoading } = useAnalysisArtifact(reqId);
  const queryClient = useQueryClient();
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
  const analysis = analysisData?.data ?? null;
  const { graphIR, errorCount, warningCount } = useGraphIR(analysis);
  const comments = commentsFile?.comments ?? [];
  const highlights = highlightsFile?.highlights ?? [];
  const runtimeContracts = analysis?.runtimeContracts ?? [];
  const a2aContracts = analysis?.a2aContracts ?? [];
  const selectedContract = runtimeContracts.find((item) => item.contract_id === selectedContractId) ?? null;
  const runtimeContractsReady = runtimeContractsGateReady(analysis);
  const a2aContractsReady = a2aContractsGateReady(analysis);
  const a2aRows = useMemo(
    () => (analysis ? buildA2AReviewRows(analysis.moduleCandidates, a2aContracts) : []),
    [analysis, a2aContracts]
  );
  const selectedA2ARow = a2aRows.find((row) => row.candidate.id === selectedA2AModuleId) ?? a2aRows[0] ?? null;
  const selectedReviewCandidate =
    (selectedReviewModuleId ? analysis?.moduleCandidates.find((item) => item.id === selectedReviewModuleId) ?? null : null) ??
    analysis?.moduleCandidates[0] ??
    null;
  const approvedCandidateCount = analysis ? analysis.moduleCandidates.filter((item) => item.status === "approved").length : 0;
  const allCandidatesApproved = Boolean(analysis?.moduleCandidates.length) && approvedCandidateCount === analysis?.moduleCandidates.length;
  const unapprovedCandidateCount = analysis ? analysis.moduleCandidates.length - approvedCandidateCount : 0;
  const boundariesGateEnabled = Boolean(manifest?.approvals.analysis_reviewed) && allCandidatesApproved && errorCount === 0;
  const runtimeGateEnabled = Boolean(manifest?.approvals.boundaries_approved) && runtimeContractsReady && a2aContractsReady;
  const hasGraph = Boolean(graphIR);
  const reviewReady = allCandidatesApproved && errorCount === 0 && runtimeContractsReady && a2aContractsReady;
  const boundariesApproved = Boolean(manifest?.approvals.boundaries_approved);
  const runtimeApproved = Boolean(manifest?.approvals.runtime_contracts_approved);
  const defaultStep: DesignStepId = !hasGraph ? "run" : !boundariesApproved ? "review" : "approve";
  const [rawActiveStep, setActiveStep] = useStageStep(DESIGN_STEP_IDS, defaultStep);
  const activeStep = rawActiveStep as DesignStepId;
  const bothApproved = boundariesApproved && runtimeApproved;
  const anchor = useMemo<CommentAnchor | null>(() => commentAnchorFromSelection(selection), [selection]);
  const nodeById = useMemo(() => new Map<string, GraphNode>((graphIR?.nodes ?? []).map((node) => [node.id, node])), [graphIR]);
  const edgeById = useMemo(
    () => new Map<string, GraphEdge>((graphIR?.edges ?? []).map((edge, index) => [graphEdgeId(edge, index), edge])),
    [graphIR]
  );
  const candidateById = useMemo(() => {
    const map = new Map<string, ModuleCandidate>();
    for (const candidate of analysis?.moduleCandidates ?? []) map.set(candidate.id, candidate);
    return map;
  }, [analysis]);
  const selectedNode = selection.nodeId ? nodeById.get(selection.nodeId) ?? null : null;
  const selectedEdge = selection.edgeId ? edgeById.get(selection.edgeId) ?? null : null;
  const selectedCandidate = selectedNode?.module_id ? candidateById.get(selectedNode.module_id) ?? null : null;
  const nodeLabel = (id: string) => nodeById.get(id)?.label ?? id;

  if (!reqId) return <MissingRequirement />;

  const actions = createDesignWorkbenchActions({
    reqId,
    analysis,
    runtimeContracts,
    a2aContracts,
    queryClient,
    setActionMessage,
    setSelectedA2AModuleId,
    setSelectedReviewModuleId,
    setActiveTab,
    setCatalogWorkflowPickerOpen,
    saveAnalysis: (next, options) => saveAnalysisMutation.mutate({ analysis: next, etag: analysisData?.etag ?? null }, options),
    approveGate: (gate, value, options) => approvalMutation.mutate({ gate, value, etag: manifestData?.etag ?? null }, options)
  });
  const reviewHandlers = {
    onSelectionChange: setSelection, onEditStateChange: setGraphEditState,
    onSaveGraphIR: actions.saveGraphIR,
    onOpenCatalogWorkflowPicker: () => setCatalogWorkflowPickerOpen(true),
    onSaveRuntimeContract: actions.saveRuntimeContract, onSaveA2AContract: actions.saveA2AContract,
    onSelectReviewModule: setSelectedReviewModuleId, onSaveCandidate: actions.saveCandidate,
    onSelectContract: setSelectedContractId, onSelectA2AModule: setSelectedA2AModuleId,
    onCreateA2AContract: actions.createA2AContract,
    onImportLocalA2AProvider: actions.importLocalA2AProvider,
    onAuthorNameChange: setAuthorName, onAuthorRoleChange: setAuthorRole,
    onCreateComment: (input) =>
      createDesignComment({ input, authorName, authorRole, mutate: createComment.mutate, setActionMessage }),
    onUpdateComment: (id, body) => updateComment.mutate({ id, body }),
    onDeleteComment: (id) => deleteComment.mutate(id),
    onCreateHighlight: (input) =>
      createHighlight.mutate(input, {
        onSuccess: () => setActionMessage("경로 하이라이트 저장 완료"),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "경로 하이라이트 저장 실패")
      }),
    onDeleteHighlight: (id) => deleteHighlight.mutate(id)
  } satisfies DesignReviewHandlers;
  const nextAction = buildDesignNextAction({
    activeStep, reqId, hasGraph, reviewReady, bothApproved, unapprovedCandidateCount, errorCount,
    hasAnalysis: Boolean(analysis), analysisReviewed: Boolean(manifest?.approvals.analysis_reviewed),
    runtimeContractsReady, a2aContractsReady,
    runtimeContractCount: runtimeContracts.length,
    a2aContractCount: a2aRows.length,
    onAdvance: (id) => setActiveStep(id)
  });

  return (
    <StageShell
      eyebrow={`설계 · ${reqId}`}
      title="설계"
      steps={buildDesignSteps({ hasGraph, boundariesApproved, runtimeContractsApproved: runtimeApproved, activeStep })}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      summary={
        <DesignSummary
          analysis={analysis} graphNodes={graphIR?.nodes?.length ?? 0} errorCount={errorCount}
          runtimeCount={runtimeContracts.length} a2aCount={a2aContracts.length}
          boundariesApproved={boundariesApproved} runtimeApproved={runtimeApproved}
        />
      }
      nextAction={nextAction}
    >
      <DesignNotice reqId={reqId} loading={manifestLoading || analysisLoading} actionMessage={actionMessage} />
      {activeStep === "run" ? (
        <DesignRunStep
          reqId={reqId} analysis={analysis}
          analysisReviewed={Boolean(manifest?.approvals.analysis_reviewed)}
          allCandidatesApproved={allCandidatesApproved} graphNodeCount={graphIR?.nodes?.length ?? 0}
          errorCount={errorCount} runtimeContractCount={runtimeContracts.length} a2aContractCount={a2aContracts.length}
          runtimeContractsReady={runtimeContractsReady} a2aContractsReady={a2aContractsReady}
          analysisEtag={analysisData?.etag ?? null}
        />
      ) : null}
      {activeStep === "review" ? (
        analysis ? (
          <DesignReviewStep
            reqId={reqId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            analysis={analysis}
            graphIR={graphIR}
            errorCount={errorCount}
            selection={selection}
            graphEditState={graphEditState}
            selected={{ node: selectedNode, edge: selectedEdge, candidate: selectedCandidate, reviewCandidate: selectedReviewCandidate }}
            contracts={{ selectedContract, selectedContractId, selectedA2ARow, runtimeContracts, a2aContracts }}
            collaboration={{
              comments, highlights, anchor, authorName, authorRole,
              commentPending: createComment.isPending, highlightPending: createHighlight.isPending
            }}
            saving={saveAnalysisMutation.isPending}
            nodeLabel={nodeLabel}
            handlers={reviewHandlers}
          />
        ) : (
          <MissingAnalysis reqId={reqId} />
        )
      ) : null}
      {activeStep === "approve" ? (
        <DesignApprovalStep
          manifest={manifest}
          analysis={analysis}
          approvalPending={approvalMutation.isPending}
          boundariesGateEnabled={boundariesGateEnabled}
          runtimeGateEnabled={runtimeGateEnabled}
          allCandidatesApproved={allCandidatesApproved}
          errorCount={errorCount}
          warningCount={warningCount}
          commentCount={comments.length}
          highlightCount={highlights.length}
          runtimeContractsReady={runtimeContractsReady}
          a2aContractsReady={a2aContractsReady}
          a2aRowCount={a2aRows.length}
          onToggleBoundariesApproved={() => actions.toggleApproval("boundaries_approved", !boundariesApproved)}
          onToggleRuntimeContractsApproved={() => actions.toggleApproval("runtime_contracts_approved", !runtimeApproved)}
        />
      ) : null}
      {catalogWorkflowPickerOpen ? (
        <CatalogWorkflowPicker
          inserting={saveAnalysisMutation.isPending}
          onClose={() => setCatalogWorkflowPickerOpen(false)}
          onInsert={actions.insertCatalogWorkflow}
        />
      ) : null}
    </StageShell>
  );
}
