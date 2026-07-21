import dagre from "dagre";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode, XYPosition } from "reactflow";
import type { AssetCandidate, AssetType, GraphEdge, GraphIR, GraphNode, GraphRegion } from "../../analyzer/types";
import { graphEdgeId, graphNodeKindToAssetType } from "../../graph/graphDisplay";

export interface GraphRouteSummary {
  value: string;
  aliases: string[];
  isDefault: boolean;
  targetNodeId: string;
  targetLabel: string;
}

export interface GraphNodeData {
  graphNode: GraphNode;
  asset: AssetCandidate | null;
  assetType: AssetType | null;
  a2aBoundary: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  routeMap?: GraphRouteSummary[];
  upstreamHumanPrompt?: string | null;
  commentCount?: number;
  commentTooltip?: string;
  highlightCount?: number;
  assetSubtype?: string | null;
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

export interface RegionRect {
  region: GraphRegion;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: ReactFlowNode<GraphNodeData>[];
  edges: ReactFlowEdge<GraphEdgeData>[];
  regionRects: RegionRect[];
}

const NODE_WIDTH = 232;
const NODE_HEIGHT = 116;
const ROUTE_WIDTH = 260;
const ROUTE_HEIGHT = 168;
const JOIN_SIZE = 26;
const PILL_WIDTH = 148;
const PILL_HEIGHT = 64;
const ORIGIN_X = 72;
const ORIGIN_Y = 96;
const REGION_PADDING_X = 24;
const REGION_PADDING_Y = 38;

interface NodeRect extends XYPosition {
  width: number;
  height: number;
}

function nodeSize(node: GraphNode): { width: number; height: number } {
  if (node.node_kind === "function" && node.role === "route") return { width: ROUTE_WIDTH, height: ROUTE_HEIGHT };
  if (node.node_kind === "join") return { width: JOIN_SIZE, height: JOIN_SIZE };
  if (node.node_kind === "input" || node.node_kind === "output") return { width: PILL_WIDTH, height: PILL_HEIGHT };
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

export function layoutGraphIR(
  graphIR: GraphIR,
  selection: { nodeId: string | null; edgeId: string | null },
  onSelect: (kind: "node" | "edge", id: string) => void,
  presentationPositions: ReadonlyMap<string, XYPosition> = new Map()
): LayoutResult {
  const nodeById = new Map(graphIR.nodes.map((node) => [node.id, node]));
  const positions = derivePositions(graphIR, presentationPositions);
  const regionRects = graphIR.regions
    .map((region) => regionRect(region, positions))
    .filter((rect): rect is RegionRect => rect !== null)
    .sort((a, b) => regionDepth(a.region, graphIR.regions) - regionDepth(b.region, graphIR.regions));

  const nodes: ReactFlowNode<GraphNodeData>[] = graphIR.nodes.map((node) => {
    const rect = positions.get(node.id) ?? { x: ORIGIN_X, y: ORIGIN_Y, ...nodeSize(node) };
    const isRoute = node.node_kind === "function" && node.role === "route";
    return {
      id: node.id,
      type: node.node_kind,
      position: { x: rect.x, y: rect.y },
      data: {
        graphNode: node,
        asset: null,
        assetType: graphNodeKindToAssetType(node.node_kind),
        a2aBoundary: false,
        selected: selection.nodeId === node.id,
        onSelect: (id) => onSelect("node", id),
        routeMap: isRoute ? routeMapForNode(node.id, graphIR.edges, nodeById) : undefined,
        upstreamHumanPrompt: isRoute ? upstreamHumanPromptForRoute(node.id, graphIR.edges, nodeById) : null
      },
      draggable: false,
      selectable: true,
      style: { width: rect.width, height: rect.height }
    };
  });

  const edges: ReactFlowEdge<GraphEdgeData>[] = graphIR.edges.map((edge, index) => {
    const id = graphEdgeId(edge, index);
    return {
      id,
      source: edge.from,
      target: edge.to,
      type: edge.control.kind,
      zIndex: selection.edgeId === id ? 20 : 1,
      data: {
        graphEdge: edge,
        selected: selection.edgeId === id,
        onSelect: (edgeId) => onSelect("edge", edgeId)
      }
    };
  });

  return { nodes, edges, regionRects };
}

function derivePositions(graphIR: GraphIR, presentationPositions: ReadonlyMap<string, XYPosition>): Map<string, NodeRect> {
  const layout = new dagre.graphlib.Graph({ multigraph: true });
  layout.setGraph({ rankdir: "LR", nodesep: 34, ranksep: 64, marginx: 0, marginy: 0 });
  layout.setDefaultEdgeLabel(() => ({}));
  for (const node of graphIR.nodes) layout.setNode(node.id, nodeSize(node));
  for (const edge of graphIR.edges) layout.setEdge(edge.from, edge.to, {}, edge.id);
  try {
    dagre.layout(layout);
  } catch {
    // Orphan fallback below keeps malformed drafts operable while validation is visible.
  }

  const positions = new Map<string, NodeRect>();
  let fallbackY = ORIGIN_Y;
  let minX = Infinity;
  let minY = Infinity;
  for (const node of graphIR.nodes) {
    const size = nodeSize(node);
    const point = layout.node(node.id);
    const x = point && Number.isFinite(point.x) ? point.x - size.width / 2 : 0;
    const y = point && Number.isFinite(point.y) ? point.y - size.height / 2 : fallbackY;
    fallbackY += size.height + 24;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    positions.set(node.id, { x, y, ...size });
  }
  const translateX = Number.isFinite(minX) ? ORIGIN_X - minX : ORIGIN_X;
  const translateY = Number.isFinite(minY) ? ORIGIN_Y - minY : ORIGIN_Y;
  for (const [id, position] of positions) {
    const saved = presentationPositions.get(id);
    positions.set(id, saved ? { ...position, ...saved } : { ...position, x: position.x + translateX, y: position.y + translateY });
  }
  return positions;
}

function regionRect(region: GraphRegion, positions: ReadonlyMap<string, NodeRect>): RegionRect | null {
  const members = region.node_ids.map((id) => positions.get(id)).filter((value): value is NodeRect => Boolean(value));
  if (!members.length) return null;
  const minX = Math.min(...members.map((item) => item.x));
  const minY = Math.min(...members.map((item) => item.y));
  const maxX = Math.max(...members.map((item) => item.x + item.width));
  const maxY = Math.max(...members.map((item) => item.y + item.height));
  return {
    region,
    x: minX - REGION_PADDING_X,
    y: minY - REGION_PADDING_Y,
    width: maxX - minX + REGION_PADDING_X * 2,
    height: maxY - minY + REGION_PADDING_Y * 2
  };
}

function regionDepth(region: GraphRegion, regions: readonly GraphRegion[]): number {
  const byId = new Map(regions.map((item) => [item.id, item]));
  let depth = 0;
  let parent = region.parent_region_id ? byId.get(region.parent_region_id) : undefined;
  while (parent && depth < regions.length) {
    depth += 1;
    parent = parent.parent_region_id ? byId.get(parent.parent_region_id) : undefined;
  }
  return depth;
}

export function routeMapForNode(
  nodeId: string,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<string, GraphNode>
): GraphRouteSummary[] {
  return edges
    .filter((edge) => edge.from === nodeId && edge.control.kind === "condition")
    .map((edge) => ({
      value: routeValue(edge),
      aliases: edge.control.accepted_aliases,
      isDefault: edge.control.default,
      targetNodeId: edge.to,
      targetLabel: nodeById.get(edge.to)?.label ?? edge.to
    }));
}

export function upstreamHumanPromptForRoute(
  routeNodeId: string,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<string, GraphNode>
): string | null {
  for (const edge of edges) {
    if (edge.to !== routeNodeId) continue;
    const source = nodeById.get(edge.from);
    if (source?.node_kind === "human_input") return source.human_input_contract.message;
  }
  return null;
}

function routeValue(edge: GraphEdge): string {
  const condition = edge.control.condition?.trim() ?? "";
  const match = /(?:choice|route|decision)\s*==\s*["']?([A-Za-z0-9_-]+)["']?/i.exec(condition);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+$/.test(condition)) return condition;
  return edge.id;
}
