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
import type { CommentRecord, HighlightRecord } from "../state/useCollaboration";

interface GraphCanvasProps {
  graphIR: GraphIR;
  moduleCandidates: ModuleCandidate[];
  a2aContracts: A2AContract[];
  onNavigateToA2AContracts?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  hideInspector?: boolean;
  comments?: CommentRecord[];
  highlights?: HighlightRecord[];
}

export interface Selection {
  nodeId: string | null;
  edgeId: string | null;
}

export function GraphCanvas({
  graphIR,
  moduleCandidates,
  a2aContracts,
  onNavigateToA2AContracts,
  onContinue,
  continueLabel,
  selection: selectionProp,
  onSelectionChange,
  hideInspector = false,
  comments = [],
  highlights = []
}: GraphCanvasProps) {
  const [internalSelection, setInternalSelection] = useState<Selection>({ nodeId: null, edgeId: null });
  const isControlled = selectionProp !== undefined;
  const selection = isControlled ? selectionProp! : internalSelection;
  const setSelection = (next: Selection) => {
    if (!isControlled) setInternalSelection(next);
    onSelectionChange?.(next);
  };

  const handleSelect = (kind: "node" | "edge", id: string) => {
    setSelection(kind === "node" ? { nodeId: id, edgeId: null } : { nodeId: null, edgeId: id });
  };

  const layout = useMemo(
    () => layoutGraphIR(graphIR, selection, handleSelect),
    [graphIR, selection.nodeId, selection.edgeId]
  );
  const collaborationMarks = useMemo(
    () => buildCollaborationMarks(graphIR, comments, highlights),
    [graphIR, comments, highlights]
  );

  const markedNodes = useMemo(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          commentCount: collaborationMarks.nodeCommentCounts.get(node.id) ?? 0,
          commentTooltip: collaborationMarks.nodeCommentTooltips.get(node.id),
          highlightCount: collaborationMarks.nodeHighlightCounts.get(node.id) ?? 0
        }
      })),
    [layout.nodes, collaborationMarks]
  );
  const markedEdges = useMemo(
    () =>
      layout.edges.map((edge) => ({
        ...edge,
        zIndex:
          (collaborationMarks.edgeHighlightCounts.get(edge.id) ?? 0) > 0
            ? Math.max(edge.zIndex ?? 1, 18)
            : edge.zIndex,
        data: {
          ...edge.data,
          commentCount: collaborationMarks.edgeCommentCounts.get(edge.id) ?? 0,
          commentTooltip: collaborationMarks.edgeCommentTooltips.get(edge.id),
          highlightCount: collaborationMarks.edgeHighlightCounts.get(edge.id) ?? 0,
          highlightColor: collaborationMarks.edgeHighlightColors.get(edge.id)
        }
      })),
    [layout.edges, collaborationMarks]
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
              nodes={markedNodes}
              edges={markedEdges}
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
              <ContainerOverlay rects={layout.containerRects} highlightedIds={collaborationMarks.containerHighlightIds} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <ValidationBanner validation={graphIR.validation} onFocus={focusOn} />

        {onContinue ? (
          <div className="actions align-end graph-canvas-actions">
            <button type="button" className="primary" onClick={onContinue}>
              {continueLabel ?? "다음 단계"}
            </button>
          </div>
        ) : null}
      </section>

      {hideInspector ? null : (
        <GraphInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          nodeLabel={nodeLabel}
          candidate={selectedCandidate}
          a2aContracts={a2aContracts}
          onNavigateToA2AContracts={onNavigateToA2AContracts}
          onClose={() => setSelection({ nodeId: null, edgeId: null })}
        />
      )}
    </div>
  );
}

interface CollaborationMarks {
  nodeCommentCounts: Map<string, number>;
  edgeCommentCounts: Map<string, number>;
  nodeCommentTooltips: Map<string, string>;
  edgeCommentTooltips: Map<string, string>;
  nodeHighlightCounts: Map<string, number>;
  edgeHighlightCounts: Map<string, number>;
  edgeHighlightColors: Map<string, string>;
  containerHighlightIds: Set<string>;
}

const HIGHLIGHT_COLORS: Record<HighlightRecord["color_token"], string> = {
  agent: "var(--cat-agent-line, #2c6ec0)",
  workflow: "var(--cat-workflow-line, #2f8a68)",
  adapter: "var(--cat-adapter-line, #8a6a2f)",
  remote: "var(--cat-remote-line, #c0432c)",
  neutral: "var(--line-strong, #64736b)"
};

function buildCollaborationMarks(
  graphIR: GraphIR,
  comments: CommentRecord[],
  highlights: HighlightRecord[]
): CollaborationMarks {
  const marks: CollaborationMarks = {
    nodeCommentCounts: new Map(),
    edgeCommentCounts: new Map(),
    nodeCommentTooltips: new Map(),
    edgeCommentTooltips: new Map(),
    nodeHighlightCounts: new Map(),
    edgeHighlightCounts: new Map(),
    edgeHighlightColors: new Map(),
    containerHighlightIds: new Set()
  };
  const edgeIdByPair = new Map((graphIR.edges ?? []).map((edge) => [`${edge.from}->${edge.to}`, edge.id]));

  const inc = (map: Map<string, number>, id: string | undefined) => {
    if (!id) return;
    map.set(id, (map.get(id) ?? 0) + 1);
  };
  const addComment = (countMap: Map<string, number>, tooltipMap: Map<string, string>, id: string | undefined, comment: CommentRecord) => {
    if (!id) return;
    inc(countMap, id);
    const summary = summarizeComment(comment);
    tooltipMap.set(id, tooltipMap.has(id) ? `${tooltipMap.get(id)}\n${summary}` : summary);
  };
  const pathEdgeIds = (nodePath: string[] | undefined) => {
    const result: string[] = [];
    if (!nodePath) return result;
    for (let index = 0; index < nodePath.length - 1; index += 1) {
      const edgeId = edgeIdByPair.get(`${nodePath[index]}->${nodePath[index + 1]}`);
      if (edgeId) result.push(edgeId);
    }
    return result;
  };

  for (const comment of comments) {
    const anchor = comment.anchor;
    if (anchor.kind === "node") addComment(marks.nodeCommentCounts, marks.nodeCommentTooltips, anchor.node_id, comment);
    if (anchor.kind === "edge") addComment(marks.edgeCommentCounts, marks.edgeCommentTooltips, anchor.edge_id, comment);
    if (anchor.kind === "path") {
      for (const nodeId of anchor.node_path ?? []) {
        addComment(marks.nodeCommentCounts, marks.nodeCommentTooltips, nodeId, comment);
      }
      for (const edgeId of pathEdgeIds(anchor.node_path)) {
        addComment(marks.edgeCommentCounts, marks.edgeCommentTooltips, edgeId, comment);
      }
    }
  }

  for (const highlight of highlights) {
    const color = HIGHLIGHT_COLORS[highlight.color_token] ?? HIGHLIGHT_COLORS.neutral;
    const markEdge = (edgeId: string | undefined) => {
      if (!edgeId) return;
      inc(marks.edgeHighlightCounts, edgeId);
      marks.edgeHighlightColors.set(edgeId, color);
    };
    if (highlight.kind === "path") {
      for (const nodeId of highlight.target.node_path ?? []) inc(marks.nodeHighlightCounts, nodeId);
      for (const edgeId of pathEdgeIds(highlight.target.node_path)) markEdge(edgeId);
    }
    if (highlight.kind === "node_group") {
      for (const nodeId of highlight.target.node_ids ?? []) inc(marks.nodeHighlightCounts, nodeId);
    }
    if (highlight.kind === "edge_group") {
      for (const edgeId of highlight.target.edge_ids ?? []) markEdge(edgeId);
    }
    if (highlight.kind === "container_focus" && highlight.target.container_id) {
      marks.containerHighlightIds.add(highlight.target.container_id);
    }
  }

  return marks;
}

function summarizeComment(comment: CommentRecord): string {
  const body = comment.body_md.replace(/\s+/g, " ").trim();
  const snippet = body.length > 96 ? `${body.slice(0, 96)}...` : body;
  return `${comment.author} · ${new Date(comment.created_at).toLocaleString()}: ${snippet}`;
}
