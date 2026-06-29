import { lazy, Suspense } from "react";
import type { GraphEditState, Selection } from "../../components/GraphCanvas";
import { GraphElementEditor } from "../../components/GraphElementEditor";
import { GraphInspector } from "../../components/GraphInspector";
import type { AnalysisResult, GraphEdge, GraphIR, GraphNode, ModuleCandidate, RuntimeContract } from "../../analyzer/types";
import { A2AContractInspector } from "../../design/A2AContractPanel";
import type { buildA2AReviewRows } from "../../design/A2AContractPanel";
import { CommentThread } from "../../design/CommentThread";
import { RuntimeContractInspector } from "../../design/RuntimeContractPanel";
import type { CommentAnchor, CommentRecord, CommentStage, HighlightRecord } from "../../state/useCollaboration";
import type { AuthorRole } from "../../state/useAuthor";
import { Button, EmptyState } from "../../ui/primitives";
import { INSPECTOR_ENABLED, type SidebarTab } from "./designStageModel";
import { SelectionHeader } from "./DesignSelectionHeader";

const GraphCanvas = lazy(async () => {
  const module = await import("../../components/GraphCanvas");
  return { default: module.GraphCanvas };
});

type A2AReviewRow = ReturnType<typeof buildA2AReviewRows>[number];

interface DesignGraphPanelProps {
  reqId: string;
  activeTab: SidebarTab;
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  errorCount: number;
  selection: Selection;
  graphEditState: GraphEditState | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  selectedCandidate: ModuleCandidate | null;
  selectedContract: RuntimeContract | null;
  selectedA2ARow: A2AReviewRow | null;
  a2aContracts: AnalysisResult["a2aContracts"];
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  anchor: CommentAnchor | null;
  authorName: string;
  authorRole: AuthorRole;
  commentPending: boolean;
  saving: boolean;
  nodeLabel: (id: string) => string;
  onSelectionChange: (selection: Selection) => void;
  onEditStateChange: (state: GraphEditState | null) => void;
  onSaveGraphIR: (graphIR: GraphIR) => void;
  onOpenCatalogWorkflowPicker: () => void;
  onSetActiveTab: (tab: SidebarTab) => void;
  onSetActionMessage: (message: string | null) => void;
  onSaveRuntimeContract: (contract: RuntimeContract) => void;
  onSaveA2AContract: (contract: AnalysisResult["a2aContracts"][number]) => void;
  onAuthorNameChange: (value: string) => void;
  onAuthorRoleChange: (value: AuthorRole) => void;
  onCreateComment: (input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) => void;
  onUpdateComment: (id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>) => void;
  onDeleteComment: (id: string) => void;
}

export function DesignGraphPanel({
  reqId,
  activeTab,
  analysis,
  graphIR,
  errorCount,
  selection,
  graphEditState,
  selectedNode,
  selectedEdge,
  selectedCandidate,
  selectedContract,
  selectedA2ARow,
  a2aContracts,
  comments,
  highlights,
  anchor,
  authorName,
  authorRole,
  commentPending,
  saving,
  nodeLabel,
  onSelectionChange,
  onEditStateChange,
  onSaveGraphIR,
  onOpenCatalogWorkflowPicker,
  onSetActiveTab,
  onSetActionMessage,
  onSaveRuntimeContract,
  onSaveA2AContract,
  onAuthorNameChange,
  onAuthorRoleChange,
  onCreateComment,
  onUpdateComment,
  onDeleteComment
}: DesignGraphPanelProps) {
  return (
    <>
      <div className="af-design-review-head">
        <div>
          <p className="eyebrow">Graph IR Review</p>
          <h2>Graph IR 검토</h2>
          <p>그래프 구조, 선택 컨텍스트, 모듈·계약 readiness 를 한 화면에서 확인합니다.</p>
        </div>
        <div className="af-design-review-metrics" aria-label="Graph IR 검토 상태">
          <span>nodes <strong>{graphIR?.nodes?.length ?? 0}</strong></span>
          <span>edges <strong>{graphIR?.edges?.length ?? 0}</strong></span>
          <span>errors <strong>{errorCount}</strong></span>
        </div>
      </div>
      <div className={`af-design-grid${INSPECTOR_ENABLED ? "" : " af-design-grid--no-inspector"}`}>
        <aside className="af-design-sidebar" aria-label="선택 노드/엣지 정보">
          <div className="af-design-context-head">
            <span>선택 컨텍스트</span>
            <strong>
              {selectedNode ? selectedNode.label : selectedEdge ? `${nodeLabel(selectedEdge.from)} → ${nodeLabel(selectedEdge.to)}` : "노드/엣지 선택 없음"}
            </strong>
          </div>
          {graphEditState?.editModeActive && (graphEditState.selectedNode || graphEditState.selectedEdge) ? (
            <GraphElementEditor
              editState={graphEditState}
              moduleCandidates={analysis.moduleCandidates ?? []}
              a2aContracts={a2aContracts}
              onClose={() => onSelectionChange({ nodeId: null, edgeId: null })}
            />
          ) : (
            <GraphInspector
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              graphIR={graphEditState?.editModeActive ? graphEditState.draft : graphIR}
              nodeLabel={nodeLabel}
              candidate={selectedCandidate}
              a2aContracts={a2aContracts}
              onNavigateToA2AContracts={() => onSetActiveTab("a2a")}
              onClose={() => onSelectionChange({ nodeId: null, edgeId: null })}
            />
          )}
        </aside>

        <section className="af-design-canvas-pane" aria-label="Graph IR">
          <div className="af-design-canvas-toolbar">
            <div className="af-design-canvas-title">
              <span>Graph IR Canvas</span>
              <strong>{graphIR ? `${graphIR.nodes?.length ?? 0} nodes · ${graphIR.edges?.length ?? 0} edges` : "processFlow 없음"}</strong>
            </div>
            <Button type="button" variant="secondary" onClick={onOpenCatalogWorkflowPicker} disabled={saving || graphEditState?.editModeActive === true}>
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
                onSelectionChange={onSelectionChange}
                comments={comments}
                highlights={highlights}
                hideInspector
                editable
                saving={saving}
                onSaveGraph={onSaveGraphIR}
                onEditStateChange={onEditStateChange}
              />
            </Suspense>
          ) : (
            <EmptyState title="Graph IR 가 없습니다" description="processFlow 가 분석 결과에 포함되어 있지 않습니다." />
          )}
        </section>

        {INSPECTOR_ENABLED ? (
          <aside className="af-design-inspector" aria-label="선택 검토 패널">
            {activeTab === "runtime" ? (
              <RuntimeContractInspector contract={selectedContract} saving={saving} onSave={onSaveRuntimeContract} onCancel={() => onSetActionMessage(null)} />
            ) : activeTab === "a2a" ? (
              <A2AContractInspector
                candidate={selectedA2ARow?.candidate ?? null}
                contract={selectedA2ARow?.contract ?? null}
                saving={saving}
                onSave={onSaveA2AContract}
                onCancel={() => onSetActionMessage(null)}
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
                  isMutating={commentPending}
                  onAuthorNameChange={onAuthorNameChange}
                  onAuthorRoleChange={onAuthorRoleChange}
                  onCreate={onCreateComment}
                  onUpdate={onUpdateComment}
                  onDelete={onDeleteComment}
                />
              </>
            )}
          </aside>
        ) : null}
      </div>
    </>
  );
}
