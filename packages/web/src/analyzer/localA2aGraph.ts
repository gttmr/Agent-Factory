import type { GraphContainer, GraphEdge, GraphIR, GraphLane, GraphNode } from "./types";

export function buildRemoteA2ANode(label: string, candidateId: string, nodeId: string): GraphNode {
  return {
    id: nodeId,
    label,
    module_id: candidateId,
    node_kind: "remote_agent_call",
    execution_kind: "remote_a2a_call",
    adk_node_role: "boundary",
    owner_scope: "remote",
    container_id: "container-remote",
    lane_id: "remote_boundary",
    input_ports: [{ id: `${nodeId}:in`, label: "message", schema_ref: null }],
    output_ports: [{ id: `${nodeId}:out`, label: "response", schema_ref: null }],
    schema_refs: [],
    review_status: "needs_info",
    position: null,
    runtime_binding: "remote_a2a",
    invoke_binding: "remote_a2a",
    decision_owner: "remote_agent",
    call_control: "fixed_by_workflow",
    side_effect: "read",
    policy: "timeout_retry_required"
  };
}

export function withLocalA2AGraph(graph: GraphIR, node: GraphNode, contractId: string): GraphIR {
  const edges = insertSimpleRemoteEdges(graph.edges, graph.nodes, node, contractId);
  return {
    ...graph,
    nodes: [...graph.nodes, node],
    edges,
    lanes: ensureRemoteLane(graph.lanes),
    containers: ensureRemoteContainer(graph.containers, node.id)
  };
}

function insertSimpleRemoteEdges(edges: GraphEdge[], nodes: GraphNode[], node: GraphNode, contractId: string): GraphEdge[] {
  const direct = findDirectInputOutputEdge(edges, nodes);
  if (!direct) return edges;
  const [sourceEdgeId, outputEdgeId] = replacementEdgeIds(edges, direct.id);
  const sourceToRemote = remoteEdge({
    ...direct,
    id: sourceEdgeId,
    to: node.id,
    to_port: node.input_ports[0]?.id ?? null,
    data_label: direct.data_label || "request message"
  }, contractId);
  const remoteToOutput = remoteEdge({
    ...direct,
    id: outputEdgeId,
    from: node.id,
    from_port: node.output_ports[0]?.id ?? null,
    data_label: "A2A provider response"
  }, contractId);
  return edges.flatMap((edge) => (edge.id === direct.id ? [sourceToRemote, remoteToOutput] : [edge]));
}

function findDirectInputOutputEdge(edges: GraphEdge[], nodes: GraphNode[]): GraphEdge | null {
  const inputIds = new Set(nodes.filter((node) => node.node_kind === "input").map((node) => node.id));
  const outputIds = new Set(nodes.filter((node) => node.node_kind === "output").map((node) => node.id));
  const candidates = edges.filter((edge) => inputIds.has(edge.from) && outputIds.has(edge.to));
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

function remoteEdge(edge: GraphEdge, contractId: string): GraphEdge {
  return {
    ...edge,
    edge_kind: "remote_a2a",
    execution_semantics: "boundary_crossing",
    a2a_contract_id: contractId,
    is_remote_boundary_crossing: true,
    flow_kind: "sequence",
    call_control: "fixed_by_workflow",
    state_key: null,
    artifact_key: null
  };
}

function replacementEdgeIds(edges: GraphEdge[], replacedId: string): [string, string] {
  const used = new Set(edges.map((edge) => edge.id).filter((id) => id !== replacedId && validEdgeId(id)));
  const first = validEdgeId(replacedId) ? replacedId : nextEdgeId(used);
  used.add(first);
  return [first, nextEdgeId(used)];
}

function nextEdgeId(used: Set<string>): string {
  let index = 1;
  while (used.has(`edge-${String(index).padStart(3, "0")}`)) index += 1;
  return `edge-${String(index).padStart(3, "0")}`;
}

function validEdgeId(id: string): boolean {
  return /^edge-\d+$/.test(id);
}

function ensureRemoteLane(lanes: GraphLane[]): GraphLane[] {
  return lanes.some((lane) => lane.id === "remote_boundary")
    ? lanes
    : [...lanes, { id: "remote_boundary", label: "Remote boundary" }];
}

function ensureRemoteContainer(containers: GraphContainer[], nodeId: string): GraphContainer[] {
  const existing = containers.find((container) => container.id === "container-remote");
  if (!existing) return [...containers, newRemoteContainer(nodeId)];
  return containers.map((container) =>
    container.id === "container-remote"
      ? {
          ...container,
          contains_node_ids: uniqueList([...container.contains_node_ids, nodeId]),
          entry_node_ids: uniqueList([...container.entry_node_ids, nodeId]),
          exit_node_ids: uniqueList([...container.exit_node_ids, nodeId])
        }
      : container
  );
}

function newRemoteContainer(nodeId: string): GraphContainer {
  return {
    id: "container-remote",
    module_id: null,
    label: "Remote A2A boundary",
    container_kind: "remote_boundary",
    adk_mapping: "A2A remote boundary",
    contains_node_ids: [nodeId],
    entry_node_ids: [nodeId],
    exit_node_ids: [nodeId],
    layout_policy: "free",
    parent_container_id: null
  };
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values)];
}
