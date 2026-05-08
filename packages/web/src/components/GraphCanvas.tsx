import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider
} from "reactflow";
import "reactflow/dist/style.css";
import type {
  A2AContract,
  GraphEdge,
  GraphIR,
  GraphNode,
  GraphValidationIssue,
  ModuleCandidate
} from "../analyzer/types";
import { ContainerOverlay } from "../graph/containerOverlay";
import { edgeTypes } from "../graph/edgeTypes";
import { layoutGraphIR } from "../graph/layout";
import { nodeTypes } from "../graph/nodeTypes";
import { ValidationBanner } from "../graph/validationBanner";
import { GraphInspector } from "./GraphInspector";

interface GraphCanvasProps {
  graphIR: GraphIR;
  moduleCandidates: ModuleCandidate[];
  a2aContracts: A2AContract[];
  onNavigateToA2AContracts?: () => void;
  onContinue: () => void;
}

interface Selection {
  nodeId: string | null;
  edgeId: string | null;
}

export function GraphCanvas({
  graphIR,
  moduleCandidates,
  a2aContracts,
  onNavigateToA2AContracts,
  onContinue
}: GraphCanvasProps) {
  const [selection, setSelection] = useState<Selection>({ nodeId: null, edgeId: null });

  const handleSelect = (kind: "node" | "edge", id: string) => {
    setSelection(kind === "node" ? { nodeId: id, edgeId: null } : { nodeId: null, edgeId: id });
  };

  const layout = useMemo(
    () => layoutGraphIR(graphIR, selection, handleSelect),
    [graphIR, selection.nodeId, selection.edgeId]
  );

  const nodeById = useMemo(() => new Map((graphIR.nodes ?? []).map((n) => [n.id, n])), [graphIR]);
  const edgeById = useMemo(
    () =>
      new Map<string, GraphEdge>(
        (graphIR.edges ?? []).map((e, i) => [e.id ?? `edge-${i}`, e])
      ),
    [graphIR]
  );
  const candidateByModuleId = useMemo(() => {
    const map = new Map<string, ModuleCandidate>();
    for (const c of moduleCandidates) map.set(c.id, c);
    return map;
  }, [moduleCandidates]);

  const selectedNode: GraphNode | null = selection.nodeId ? nodeById.get(selection.nodeId) ?? null : null;
  const selectedEdge: GraphEdge | null = selection.edgeId ? edgeById.get(selection.edgeId) ?? null : null;
  const selectedCandidate: ModuleCandidate | null =
    selectedNode && selectedNode.module_id ? candidateByModuleId.get(selectedNode.module_id) ?? null : null;

  const focusOn = (issue: GraphValidationIssue) => {
    if (!issue.target_id) return;
    if (issue.target_kind === "edge") {
      setSelection({ nodeId: null, edgeId: issue.target_id });
    } else if (issue.target_kind === "node") {
      setSelection({ nodeId: issue.target_id, edgeId: null });
    }
  };

  const nodeLabel = (id: string) => nodeById.get(id)?.label ?? id;

  return (
    <div className="graph-canvas-root">
      <section className="panel graph-canvas-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ADK 2.0 Graph Workflow</p>
            <h2>그래프 워크플로우 검토</h2>
          </div>
          <span className="graph-canvas-stats">
            노드 {graphIR.nodes?.length ?? 0} · 엣지 {graphIR.edges?.length ?? 0} · 컨테이너 {graphIR.containers?.length ?? 0}
          </span>
        </div>

        <div className="graph-canvas-stage">
          <ReactFlowProvider>
            <ReactFlow
              nodes={layout.nodes}
              edges={layout.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
              onPaneClick={() => setSelection({ nodeId: null, edgeId: null })}
              onNodeClick={(_, n) => setSelection({ nodeId: n.id, edgeId: null })}
              onEdgeClick={(_, e) => setSelection({ nodeId: null, edgeId: e.id })}
            >
              <Background gap={18} size={1} />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
              <ContainerOverlay rects={layout.containerRects} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <ValidationBanner validation={graphIR.validation} onFocus={focusOn} />

        <div className="actions align-end graph-canvas-actions">
          <button type="button" className="primary" onClick={onContinue}>
            다음 단계
          </button>
        </div>
      </section>

      <GraphInspector
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        nodeLabel={nodeLabel}
        candidate={selectedCandidate}
        a2aContracts={a2aContracts}
        onNavigateToA2AContracts={onNavigateToA2AContracts}
        onClose={() => setSelection({ nodeId: null, edgeId: null })}
      />
    </div>
  );
}
