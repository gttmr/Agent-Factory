import { lazy, Suspense } from "react";
import type { GraphEditState, Selection } from "../../components/GraphCanvas";
import { GraphElementEditor } from "../../components/GraphElementEditor";
import { GraphInspector } from "../../components/GraphInspector";
import type { AnalysisResult, GraphEdge, GraphIR, GraphNode, ModuleCandidate } from "../../analyzer/types";
import type { CommentRecord, HighlightRecord } from "../../state/useCollaboration";
import { Button, EmptyState } from "../../ui/primitives";
import type { SidebarTab } from "./designStageModel";

const GraphCanvas = lazy(async () => {
  const module = await import("../../components/GraphCanvas");
  return { default: module.GraphCanvas };
});

interface DesignGraphPanelProps {
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  normalizationError?: string;
  errorCount: number;
  selection: Selection;
  graphEditState: GraphEditState | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  selectedCandidate: ModuleCandidate | null;
  a2aContracts: AnalysisResult["a2aContracts"];
  catalogContracts: Record<string, unknown>;
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  saving: boolean;
  nodeLabel: (id: string) => string;
  onSelectionChange: (selection: Selection) => void;
  onEditStateChange: (state: GraphEditState | null) => void;
  onSaveGraphIR: (graphIR: GraphIR) => void;
  onOpenCatalogWorkflowPicker: () => void;
  onSetActiveTab: (tab: SidebarTab) => void;
}

export function DesignGraphPanel({
  analysis,
  graphIR,
  normalizationError,
  errorCount,
  selection,
  graphEditState,
  selectedNode,
  selectedEdge,
  selectedCandidate,
  a2aContracts,
  catalogContracts,
  comments,
  highlights,
  saving,
  nodeLabel,
  onSelectionChange,
  onEditStateChange,
  onSaveGraphIR,
  onOpenCatalogWorkflowPicker,
  onSetActiveTab
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
      <div className="af-design-grid">
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
              catalogContracts={catalogContracts}
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
              catalogContracts={catalogContracts}
              onNavigateToA2AContracts={() => onSetActiveTab("a2a")}
              onClose={() => onSelectionChange({ nodeId: null, edgeId: null })}
            />
          )}
        </aside>

        <section className="af-design-canvas-pane" aria-label="Graph IR">
          <div className="af-design-canvas-toolbar">
            <div className="af-design-canvas-title">
              <span>Graph IR Canvas</span>
              <strong>
                {normalizationError
                  ? "processFlow 형식 오류"
                  : graphIR
                    ? `${graphIR.nodes?.length ?? 0} nodes · ${graphIR.edges?.length ?? 0} edges`
                    : "processFlow 없음"}
              </strong>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenCatalogWorkflowPicker}
              disabled={saving || graphEditState?.editModeActive === true || Boolean(normalizationError)}
            >
              카탈로그 워크플로우 삽입
            </Button>
          </div>
          {normalizationError ? (
            <EmptyState title="Graph IR 형식 오류" description={normalizationError} />
          ) : graphIR ? (
            <Suspense fallback={<div className="af-design-canvas-loading">Graph IR 불러오는 중...</div>}>
              <GraphCanvas
                graphIR={graphIR}
                moduleCandidates={analysis.moduleCandidates}
                a2aContracts={analysis.a2aContracts ?? []}
                catalogContracts={catalogContracts}
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

      </div>
    </>
  );
}
