import { lazy, Suspense } from "react";
import type { GraphEditState, Selection } from "../../components/GraphCanvas";
import { GraphElementEditor } from "../../components/GraphElementEditor";
import { GraphInspector } from "../../components/GraphInspector";
import type { AnalysisResult, AssetCandidate, GraphEdge, GraphIR, GraphNode } from "../../analyzer/types";
import type { CommentRecord, HighlightRecord } from "../../state/useCollaboration";
import { Button, EmptyState } from "../../ui/primitives";

const GraphCanvas = lazy(async () => {
  const module = await import("../../components/GraphCanvas");
  return { default: module.GraphCanvas };
});

interface DesignGraphPanelProps {
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  validationError?: string;
  errorCount: number;
  selection: Selection;
  graphEditState: GraphEditState | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  selectedAsset: AssetCandidate | null;
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  saving: boolean;
  nodeLabel: (id: string) => string;
  onSelectionChange: (selection: Selection) => void;
  onEditStateChange: (state: GraphEditState | null) => void;
  onSaveGraphIR: (graphIR: GraphIR) => void;
  onOpenCatalogWorkflowPicker: () => void;
}

export function DesignGraphPanel({
  analysis,
  graphIR,
  validationError,
  errorCount,
  selection,
  graphEditState,
  selectedNode,
  selectedEdge,
  selectedAsset,
  comments,
  highlights,
  saving,
  nodeLabel,
  onSelectionChange,
  onEditStateChange,
  onSaveGraphIR,
  onOpenCatalogWorkflowPicker
}: DesignGraphPanelProps) {
  const inspectedGraph = graphEditState?.editModeActive ? graphEditState.draft : graphIR;
  return (
    <>
      <div className="af-design-review-head">
        <div>
          <p className="eyebrow">Graph IR Review</p>
          <h2>Graph IR 검토</h2>
          <p>Target Node·Edge, 병렬·반복 실행 범위와 typed asset ref를 한 화면에서 검토합니다.</p>
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
              assetCandidates={analysis.assetCandidates}
              onClose={() => onSelectionChange({ nodeId: null, edgeId: null })}
            />
          ) : inspectedGraph ? (
            <GraphInspector
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              graphIR={inspectedGraph}
              nodeLabel={nodeLabel}
              asset={selectedAsset}
              onClose={() => onSelectionChange({ nodeId: null, edgeId: null })}
            />
          ) : <EmptyState title="Graph IR 없음" description="Design 실행 후 Target Graph IR을 검토할 수 있습니다." />}
        </aside>

        <section className="af-design-canvas-pane" aria-label="Graph IR">
          <div className="af-design-canvas-toolbar">
            <div className="af-design-canvas-title">
              <span>Graph IR Canvas</span>
              <strong>
                {validationError
                  ? "graph 형식 오류"
                  : graphIR
                    ? `${graphIR.nodes?.length ?? 0} nodes · ${graphIR.edges?.length ?? 0} edges`
                    : "graph 없음"}
              </strong>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenCatalogWorkflowPicker}
              disabled={saving || graphEditState?.editModeActive === true || Boolean(validationError)}
            >
              카탈로그 워크플로우 삽입
            </Button>
          </div>
          {validationError ? (
            <EmptyState title="Graph IR 형식 오류" description={validationError} />
          ) : graphIR ? (
            <Suspense fallback={<div className="af-design-canvas-loading">Graph IR 불러오는 중...</div>}>
              <GraphCanvas
                graphIR={graphIR}
                assetCandidates={analysis.assetCandidates}
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
            <EmptyState title="Graph IR 가 없습니다" description="graph가 분석 결과에 포함되어 있지 않습니다." />
          )}
        </section>

      </div>
    </>
  );
}
