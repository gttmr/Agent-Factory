// Layout helper for GraphIR — positions nodes via dagre per local container,
// then unions container bounding rectangles. Lanes only set a fallback X
// position when a node has no container.
import dagre from "dagre";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "reactflow";
import type {
  GraphContainer,
  GraphEdge,
  GraphIR,
  GraphNode,
  LaneId
} from "../analyzer/types";

export interface GraphNodeData {
  graphNode: GraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
}

export interface GraphEdgeData {
  graphEdge: GraphEdge;
  selected: boolean;
  onSelect: (id: string) => void;
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
const JOIN_SIZE = 56;
const CONTAINER_PADDING_X = 28;
const CONTAINER_PADDING_Y = 44;
const REMOTE_GAP = 220;

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
  if (node.node_kind === "join" || node.node_kind === "loop_control") {
    return { width: JOIN_SIZE, height: JOIN_SIZE };
  }
  if (node.node_kind === "input" || node.node_kind === "output") {
    return { width: 140, height: 56 };
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

function isLocalContainer(kind: GraphContainer["container_kind"]): boolean {
  return kind !== "remote_boundary";
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
  const containerOf = new Map<string, GraphContainer>();
  for (const c of containers) {
    for (const id of c.contains_node_ids ?? []) {
      containerOf.set(id, c);
    }
  }

  // Track horizontal cursor for stacking containers along X.
  let containerCursorX = 40;
  const localContainers = containers.filter((c) => isLocalContainer(c.container_kind));
  const remoteContainers = containers.filter((c) => !isLocalContainer(c.container_kind));

  // Layout each local container with dagre LR.
  for (const container of localContainers) {
    const ids = container.contains_node_ids ?? [];
    if (ids.length === 0) continue;

    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 80, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const id of ids) {
      const n = nodeById.get(id);
      if (!n) continue;
      const { width, height } = nodeSize(n);
      g.setNode(id, { width, height });
    }
    const idSet = new Set(ids);
    for (const e of allEdges) {
      if (idSet.has(e.from) && idSet.has(e.to)) {
        g.setEdge(e.from, e.to, {}, e.id ?? `${e.from}->${e.to}`);
      }
    }
    try {
      dagre.layout(g);
    } catch {
      // ignore — fall through to manual placement
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let fallbackY = 0;
    for (const id of ids) {
      const n = nodeById.get(id);
      if (!n) continue;
      const { width, height } = nodeSize(n);
      const dn = g.node(id);
      let cx: number;
      let cy: number;
      if (dn && Number.isFinite(dn.x) && Number.isFinite(dn.y)) {
        cx = dn.x;
        cy = dn.y;
      } else {
        cx = width / 2;
        cy = fallbackY + height / 2;
        fallbackY += height + 24;
      }
      const x = cx - width / 2;
      const y = cy - height / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
      positions.set(id, { x, y, width, height });
    }

    if (!Number.isFinite(minX)) continue;

    // Translate container into a horizontal slot.
    const localOriginX = containerCursorX - minX + CONTAINER_PADDING_X;
    const localOriginY = 80 - minY + CONTAINER_PADDING_Y;
    const containerX = containerCursorX;
    const containerY = 80;
    const containerWidth = maxX - minX + CONTAINER_PADDING_X * 2;
    const containerHeight = maxY - minY + CONTAINER_PADDING_Y * 2;

    for (const id of ids) {
      const p = positions.get(id);
      if (!p) continue;
      positions.set(id, {
        ...p,
        x: p.x + localOriginX,
        y: p.y + localOriginY
      });
    }

    containerRects.push({
      container,
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight
    });

    containerCursorX += containerWidth + 60;
  }

  // Place remote containers to the right with a gap.
  let remoteX = containerCursorX + REMOTE_GAP - 60;
  for (const container of remoteContainers) {
    const ids = container.contains_node_ids ?? [];
    let cursorY = 80 + CONTAINER_PADDING_Y;
    let maxRowWidth = 0;
    for (const id of ids) {
      const n = nodeById.get(id);
      if (!n) continue;
      const { width, height } = nodeSize(n);
      positions.set(id, {
        x: remoteX + CONTAINER_PADDING_X,
        y: cursorY,
        width,
        height
      });
      cursorY += height + 24;
      maxRowWidth = Math.max(maxRowWidth, width);
    }
    const containerWidth = maxRowWidth + CONTAINER_PADDING_X * 2;
    const containerHeight = cursorY - 80 + CONTAINER_PADDING_Y;
    containerRects.push({
      container,
      x: remoteX,
      y: 80,
      width: containerWidth,
      height: containerHeight
    });
    remoteX += containerWidth + 60;
  }

  // Lane fallback for orphan nodes.
  const orphanY = new Map<number, number>();
  for (const n of allNodes) {
    if (positions.has(n.id)) continue;
    const idx = laneIndex(n.lane_id as string | undefined);
    const baseX = 60 + idx * 240;
    const colY = orphanY.get(idx) ?? 80;
    const { width, height } = nodeSize(n);
    positions.set(n.id, { x: baseX, y: colY, width, height });
    orphanY.set(idx, colY + height + 24);
  }

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
      data: {
        graphEdge: e,
        selected: selection.edgeId === id,
        onSelect: (eid: string) => onSelect("edge", eid)
      }
    };
  });

  return { nodes: rfNodes, edges: rfEdges, containerRects };
}
