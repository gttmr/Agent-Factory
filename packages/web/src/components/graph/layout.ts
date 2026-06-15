// Layout helper for GraphIR — positions nodes once for the whole workflow,
// then derives container overlays from already-positioned node bounds.
import dagre from "dagre";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "reactflow";
import type {
  GraphContainer,
  GraphEdge,
  GraphIR,
  GraphNode,
  LaneId
} from "../../analyzer/types";

export interface GraphNodeData {
  graphNode: GraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
  commentCount?: number;
  commentTooltip?: string;
  highlightCount?: number;
}

export interface GraphEdgeData {
  graphEdge: GraphEdge;
  selected: boolean;
  onSelect: (id: string) => void;
  commentCount?: number;
  commentTooltip?: string;
  highlightCount?: number;
  highlightColor?: string;
}

export interface ContainerRect {
  container: GraphContainer;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: ReactFlowNode<GraphNodeData>[];
  edges: ReactFlowEdge<GraphEdgeData>[];
  containerRects: ContainerRect[];
}

const NODE_WIDTH = 232;
const NODE_HEIGHT = 116;
const ROUTER_SIZE = 96;
const JOIN_SIZE = 56; // loop_control box
// join box hugs its 22px dot so the left/right edge handles anchor at the
// circle's perimeter (vertical center = dot center). The join label is rendered
// as an absolute caption below the box, so it does not inflate the box.
const JOIN_DOT_BOX = 26;
const PILL_WIDTH = 148; // input/output — fits the variable name with no eyebrow
const PILL_HEIGHT = 64;
const WORKFLOW_PADDING_X = 42;
const WORKFLOW_PADDING_Y = 54;
const REGION_PADDING_X = 18;
const REGION_PADDING_Y = 30;
const GRAPH_ORIGIN_X = 72;
const GRAPH_ORIGIN_Y = 96;

const LANE_ORDER: LaneId[] = [
  "input",
  "local_graph",
  "adapter",
  "human_input",
  "output",
  "remote_boundary"
];

function nodeSize(node: GraphNode): { width: number; height: number } {
  if (node.node_kind === "router") return { width: ROUTER_SIZE, height: ROUTER_SIZE };
  if (node.node_kind === "join") return { width: JOIN_DOT_BOX, height: JOIN_DOT_BOX };
  if (node.node_kind === "loop_control") return { width: JOIN_SIZE, height: JOIN_SIZE };
  if (node.node_kind === "input" || node.node_kind === "output") {
    return { width: PILL_WIDTH, height: PILL_HEIGHT };
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

interface NodeXY {
  x: number;
  y: number;
  width: number;
  height: number;
}

function laneIndex(laneId: string | undefined): number {
  const idx = LANE_ORDER.indexOf((laneId ?? "local_graph") as LaneId);
  return idx === -1 ? 1 : idx;
}

function hasFinitePosition(node: GraphNode): node is GraphNode & { position: { x: number; y: number } } {
  return (
    node.position !== null &&
    typeof node.position === "object" &&
    typeof node.position.x === "number" &&
    Number.isFinite(node.position.x) &&
    typeof node.position.y === "number" &&
    Number.isFinite(node.position.y)
  );
}

function isWorkflowContainer(kind: GraphContainer["container_kind"]): boolean {
  return kind === "graph_workflow" || kind === "dynamic_workflow";
}

function rectPadding(kind: GraphContainer["container_kind"]): { x: number; y: number } {
  return isWorkflowContainer(kind)
    ? { x: WORKFLOW_PADDING_X, y: WORKFLOW_PADDING_Y }
    : { x: REGION_PADDING_X, y: REGION_PADDING_Y };
}

function rectFromNodeIds(
  container: GraphContainer,
  ids: string[],
  positions: Map<string, NodeXY>
): ContainerRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const p = positions.get(id);
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  if (!Number.isFinite(minX)) return null;
  const padding = rectPadding(container.container_kind);
  return {
    container,
    x: minX - padding.x,
    y: minY - padding.y,
    width: maxX - minX + padding.x * 2,
    height: maxY - minY + padding.y * 2
  };
}

function rectPriority(kind: GraphContainer["container_kind"]): number {
  return isWorkflowContainer(kind) ? 0 : 1;
}

// Pin every node to its current laid-out position so the whole graph has finite
// `node.position`. Used when entering edit mode: once all nodes are positioned,
// `layoutGraphIR` becomes a pass-through (no dagre, no origin re-translation), so
// dragging one node never re-lays or shifts the others — the container overlay
// then recomputes purely from each node's actual position.
export function freezeGraphLayout(graphIR: GraphIR): GraphIR {
  const layout = layoutGraphIR(graphIR, { nodeId: null, edgeId: null }, () => undefined);
  const positionById = new Map(layout.nodes.map((node) => [node.id, node.position]));
  return {
    ...graphIR,
    nodes: (graphIR.nodes ?? []).map((node) => {
      const position = positionById.get(node.id);
      return position ? { ...node, position: { x: position.x, y: position.y } } : node;
    })
  };
}

export function layoutGraphIR(
  graphIR: GraphIR,
  selection: { nodeId: string | null; edgeId: string | null },
  onSelect: (kind: "node" | "edge", id: string) => void
): LayoutResult {
  const containers = graphIR.containers ?? [];
  const allNodes = graphIR.nodes ?? [];
  const allEdges = graphIR.edges ?? [];

  const positions = new Map<string, NodeXY>();
  const containerRects: ContainerRect[] = [];

  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const autoNodes = allNodes.filter((n) => !hasFinitePosition(n));
  const autoNodeIds = new Set(autoNodes.map((n) => n.id));

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 56, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of autoNodes) {
    const { width, height } = nodeSize(n);
    g.setNode(n.id, { width, height });
  }
  for (const e of allEdges) {
    if (autoNodeIds.has(e.from) && autoNodeIds.has(e.to)) {
      g.setEdge(e.from, e.to, {}, e.id ?? `${e.from}->${e.to}`);
    }
  }
  try {
    dagre.layout(g);
  } catch {
    // ignore — orphan fallback below will keep the graph renderable
  }

  let minGraphX = Infinity;
  let minGraphY = Infinity;
  let fallbackY = 0;
  for (const n of allNodes) {
    const { width, height } = nodeSize(n);
    if (hasFinitePosition(n)) {
      positions.set(n.id, { x: n.position.x, y: n.position.y, width, height });
      continue;
    }
    const dn = g.node(n.id);
    let x: number;
    let y: number;
    if (dn && Number.isFinite(dn.x) && Number.isFinite(dn.y)) {
      x = dn.x - width / 2;
      y = dn.y - height / 2;
    } else {
      const idx = laneIndex(n.lane_id as string | undefined);
      x = idx * 220;
      y = fallbackY;
      fallbackY += height + 22;
    }
    minGraphX = Math.min(minGraphX, x);
    minGraphY = Math.min(minGraphY, y);
    positions.set(n.id, { x, y, width, height });
  }

  const translateX = Number.isFinite(minGraphX) ? GRAPH_ORIGIN_X - minGraphX : GRAPH_ORIGIN_X;
  const translateY = Number.isFinite(minGraphY) ? GRAPH_ORIGIN_Y - minGraphY : GRAPH_ORIGIN_Y;
  for (const [id, p] of positions) {
    const node = nodeById.get(id);
    if (node && hasFinitePosition(node)) continue;
    positions.set(id, { ...p, x: p.x + translateX, y: p.y + translateY });
  }

  // Lane fallback for any nodes not accepted by dagre.
  const orphanY = new Map<number, number>();
  for (const n of allNodes) {
    if (positions.has(n.id)) continue;
    const idx = laneIndex(n.lane_id as string | undefined);
    const baseX = GRAPH_ORIGIN_X + idx * 220;
    const colY = orphanY.get(idx) ?? GRAPH_ORIGIN_Y;
    const { width, height } = nodeSize(n);
    positions.set(n.id, { x: baseX, y: colY, width, height });
    orphanY.set(idx, colY + height + 22);
  }

  for (const container of containers) {
    const ids = (container.contains_node_ids ?? []).filter((id) => nodeById.has(id));
    const rect = rectFromNodeIds(container, ids, positions);
    if (rect) containerRects.push(rect);
  }
  containerRects.sort((a, b) => rectPriority(a.container.container_kind) - rectPriority(b.container.container_kind));

  const rfNodes: ReactFlowNode<GraphNodeData>[] = allNodes.map((n) => {
    const p = positions.get(n.id) ?? { x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT };
    return {
      id: n.id,
      type: n.node_kind ?? "agent",
      position: { x: p.x, y: p.y },
      data: {
        graphNode: n,
        selected: selection.nodeId === n.id,
        onSelect: (id: string) => onSelect("node", id)
      },
      draggable: false,
      selectable: true,
      style: { width: p.width, height: p.height }
    };
  });

  const rfEdges: ReactFlowEdge<GraphEdgeData>[] = allEdges.map((e, i) => {
    const id = e.id ?? `edge-${i}`;
    return {
      id,
      source: e.from,
      target: e.to,
      type: e.edge_kind ?? "event_output",
      zIndex: selection.edgeId === id ? 20 : 1,
      data: {
        graphEdge: e,
        selected: selection.edgeId === id,
        onSelect: (eid: string) => onSelect("edge", eid)
      }
    };
  });

  return { nodes: rfNodes, edges: rfEdges, containerRects };
}
