import type { FlowEdge, FlowNode, ModuleCandidate, NormalizedRequirement, ProcessFlow } from "./types";

export const ADK_FINAL_OUTPUT_ID = "__workflow_result__";
export const ADK_FINAL_OUTPUT_FUNCTION = "emit_workflow_result";

export type AdkRuntimeMode = "stub" | "llm" | "adapter";
export type AdkRuntimeRole =
  | "stub_function"
  | "llm_agent"
  | "adapter_stub"
  | "mcp_adapter"
  | "workflow_route"
  | "human_input"
  | "remote_contract"
  | "output";
export type AdkGraphIssueSeverity = "error" | "warning";
export type AdkGraphEdgeKind = "start" | "direct" | "route" | "loop" | "join";

export interface AdkGraphIssue {
  severity: AdkGraphIssueSeverity;
  code: string;
  message: string;
  node_id?: string;
  edge?: Pick<FlowEdge, "from" | "to" | "data" | "route_condition">;
}

export interface AdkGraphNode {
  id: string;
  label: string;
  type: FlowNode["type"];
  subtype: string | null;
  functionName: string;
  candidate: ModuleCandidate | null;
  runtimeRole: AdkRuntimeRole;
  activeInGraph: boolean;
  defaultRouteValue: string | null;
}

export interface AdkGraphEdge {
  from: string;
  to: string;
  kind: AdkGraphEdgeKind;
  routeValue: string | null;
  sourceEdge?: FlowEdge;
}

export interface AdkGraphJoinGroup {
  nodeId: string;
  joinName: string;
  incomingFrom: string[];
  reason: "fan_in_merge";
}

export interface AdkGraphFanOutGroup {
  nodeId: string;
  targets: string[];
  kind: "parallel" | "route";
}

export interface AdkGraphIr {
  packageName: string;
  runtimeMode: AdkRuntimeMode;
  nodes: AdkGraphNode[];
  edges: AdkGraphEdge[];
  joinGroups: AdkGraphJoinGroup[];
  fanOutGroups: AdkGraphFanOutGroup[];
  loopEdges: AdkGraphEdge[];
  terminalOutputs: string[];
  issues: AdkGraphIssue[];
}

export interface BuildAdkGraphInput {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  runtimeMode?: AdkRuntimeMode;
}

export function buildAdkGraphIr({
  normalizedRequirement,
  moduleCandidates,
  processFlow,
  runtimeMode = "stub"
}: BuildAdkGraphInput): AdkGraphIr {
  const packageName = `${toPythonIdentifier(normalizedRequirement.id || "agent_factory_workflow")}_adk`;
  const nodesById = new Map(processFlow.nodes.map((node) => [node.id, node]));
  const candidatesById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const issues: AdkGraphIssue[] = [];
  const outputNodeIds = new Set(processFlow.nodes.filter((node) => node.type === "output").map((node) => node.id));
  const rawActiveEdges = processFlow.edges.filter((edge) => isActiveEdge(edge, nodesById, new Set(processFlow.nodes.map((node) => node.id))));
  const runtimeFlowEdges = selectRuntimeEdges(rawActiveEdges, outputNodeIds);
  const routeValuesBySource = collectRouteValues(runtimeFlowEdges);
  const graphNodes = processFlow.nodes
    .filter((node) => node.type !== "input")
    .map((node) => {
      const candidate = candidatesById.get(node.id) ?? null;
      const activeInGraph =
        node.type === "output" || (node.type !== "remote_a2a" && candidate?.status === "approved");
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        subtype: node.subtype ?? null,
        functionName: node.type === "output" ? `emit_${toPythonIdentifier(node.id)}` : `node_${toPythonIdentifier(node.id)}`,
        candidate,
        runtimeRole: runtimeRoleFor(node, candidate, runtimeMode, routeValuesBySource.has(node.id)),
        activeInGraph,
        defaultRouteValue: routeValuesBySource.get(node.id)?.[0] ?? null
      };
    });

  const activeNodes = new Set(graphNodes.filter((node) => node.activeInGraph).map((node) => node.id));
  const activeEdges = runtimeFlowEdges.filter((edge) => isActiveEdge(edge, nodesById, activeNodes));
  const loopEdgeKeys = new Set(
    activeEdges
      .filter((edge) => !outputNodeIds.has(edge.to))
      .filter((edge) => isLoopEdge(edge, activeEdges.filter((candidateEdge) => !outputNodeIds.has(candidateEdge.to))))
      .map((edge) => edgeKey(edge.from, edge.to, edge.data))
  );
  const joinGroups = buildJoinGroups(
    activeEdges.filter((edge) => !outputNodeIds.has(edge.to)),
    activeNodes,
    loopEdgeKeys
  );
  const joinTargets = new Set(joinGroups.map((join) => join.nodeId));
  const edges: AdkGraphEdge[] = [];

  const startTargets = unique(
    processFlow.edges
      .filter((edge) => nodesById.get(edge.from)?.type === "input" && activeNodes.has(edge.to) && !joinTargets.has(edge.to))
      .map((edge) => edge.to)
  );
  const fallbackStart = graphNodes.find((node) => node.activeInGraph && node.type !== "output")?.id;
  (startTargets.length ? startTargets : fallbackStart ? [fallbackStart] : []).forEach((target) => {
    edges.push({ from: "START", to: target, kind: "start", routeValue: null });
  });

  joinGroups.forEach((join) => {
    edges.push({ from: join.joinName, to: join.nodeId, kind: "join", routeValue: null });
  });

  activeEdges.forEach((edge) => {
    if (nodesById.get(edge.from)?.type === "input") return;
    const routeValue = isRouteEdge(edge) ? normalizeRouteValue(edge) : null;
    const kind: AdkGraphEdgeKind = routeValue ? "route" : loopEdgeKeys.has(edgeKey(edge.from, edge.to, edge.data)) ? "loop" : "direct";
    const target = outputNodeIds.has(edge.to) ? ADK_FINAL_OUTPUT_ID : edge.to;
    edges.push({
      from: edge.from,
      to: joinTargets.has(target) && kind !== "loop" ? joinName(target) : target,
      kind,
      routeValue,
      sourceEdge: edge
    });
  });

  graphNodes
    .filter((node) => node.activeInGraph && node.type !== "output")
    .filter((node) => !edges.some((edge) => edge.from === node.id))
    .forEach((node) => {
      edges.push({ from: node.id, to: ADK_FINAL_OUTPUT_ID, kind: "direct", routeValue: null });
    });

  issues.push(...validateRouteDeterminism(activeEdges));
  issues.push(...validateReachability(graphNodes, edges));

  const fanOutGroups = buildFanOutGroups(edges);
  const loopEdges = edges.filter((edge) => edge.kind === "loop");
  const terminalOutputs = graphNodes
    .filter((node) => node.activeInGraph && node.type === "output")
    .map((node) => node.id);

  return {
    packageName,
    runtimeMode,
    nodes: graphNodes,
    edges,
    joinGroups,
    fanOutGroups,
    loopEdges,
    terminalOutputs,
    issues
  };
}

export function hasGraphErrors(ir: AdkGraphIr): boolean {
  return ir.issues.some((issue) => issue.severity === "error");
}

export function toPythonIdentifier(value: string): string {
  const identifier = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

export function normalizeRouteValue(edge: FlowEdge): string {
  return edge.route_condition ? toRouteLiteral(edge.route_condition) : `ROUTE_${toPythonIdentifier(edge.to).toUpperCase()}`;
}

export function joinName(nodeId: string): string {
  return `join_${toPythonIdentifier(nodeId)}`;
}

function runtimeRoleFor(
  node: FlowNode,
  candidate: ModuleCandidate | null,
  runtimeMode: AdkRuntimeMode,
  hasRouteOutput: boolean
): AdkRuntimeRole {
  if (node.type === "output") return "output";
  if (node.type === "remote_a2a") return "remote_contract";
  if (candidate?.workflow_kind === "human_review" || node.subtype === "human_review") return "human_input";
  if (hasRouteOutput) return "workflow_route";
  if (node.type === "agent") return runtimeMode === "llm" ? "llm_agent" : "stub_function";
  if (node.type === "adapter") return runtimeMode === "adapter" && candidate?.access_protocol === "mcp" ? "mcp_adapter" : "adapter_stub";
  return "stub_function";
}

function collectRouteValues(edges: FlowEdge[]): Map<string, string[]> {
  const values = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!isRouteEdge(edge)) return;
    values.set(edge.from, [...(values.get(edge.from) ?? []), normalizeRouteValue(edge)]);
  });
  return values;
}

function isActiveEdge(edge: FlowEdge, nodesById: Map<string, FlowNode>, activeNodes: Set<string>): boolean {
  const fromType = nodesById.get(edge.from)?.type;
  return (fromType === "input" || activeNodes.has(edge.from)) && activeNodes.has(edge.to);
}

function selectRuntimeEdges(edges: FlowEdge[], outputNodeIds: Set<string>): FlowEdge[] {
  return edges.filter((edge) => {
    if (!outputNodeIds.has(edge.to)) return true;
    const hasNonOutputContinuation = edges.some((candidate) => candidate.from === edge.from && !outputNodeIds.has(candidate.to));
    if (!hasNonOutputContinuation) return true;
    return isRouteEdge(edge) && isSingleRouteCondition(edge.route_condition);
  });
}

function isSingleRouteCondition(value: string | null | undefined): boolean {
  if (!value) return false;
  return !/[|,/]/.test(value);
}

function buildJoinGroups(edges: FlowEdge[], activeNodes: Set<string>, loopEdgeKeys: Set<string>): AdkGraphJoinGroup[] {
  const incoming = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (!activeNodes.has(edge.from) || !activeNodes.has(edge.to)) return;
    if (loopEdgeKeys.has(edgeKey(edge.from, edge.to, edge.data))) return;
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  });
  return [...incoming.entries()]
    .filter(([, group]) => unique(group.map((edge) => edge.from)).length > 1)
    .map(([nodeId, group]) => ({
      nodeId,
      joinName: joinName(nodeId),
      incomingFrom: unique(group.map((edge) => edge.from)),
      reason: "fan_in_merge" as const
    }));
}

function validateRouteDeterminism(edges: FlowEdge[]): AdkGraphIssue[] {
  const bySourceAndRoute = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (!isRouteEdge(edge)) return;
    const key = `${edge.from}::${normalizeRouteValue(edge)}`;
    bySourceAndRoute.set(key, [...(bySourceAndRoute.get(key) ?? []), edge]);
  });
  return [...bySourceAndRoute.entries()].flatMap(([key, group]) => {
    const targets = unique(group.map((edge) => edge.to));
    if (targets.length <= 1) return [];
    const [source, route] = key.split("::");
    return [
      {
        severity: "error" as const,
        code: "duplicate_route_value",
        node_id: source,
        edge: group[0],
        message: `${source}에서 route '${route}'가 여러 목적지(${targets.join(", ")})로 연결됩니다. route key를 분리하거나 순차 edge로 바꿔야 합니다.`
      }
    ];
  });
}

function validateReachability(nodes: AdkGraphNode[], edges: AdkGraphEdge[]): AdkGraphIssue[] {
  const activeNodes = nodes.filter((node) => node.activeInGraph);
  const reachable = new Set<string>();
  const visit = (nodeId: string) => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    edges.filter((edge) => edge.from === nodeId).forEach((edge) => visit(edge.to));
  };
  edges.filter((edge) => edge.from === "START").forEach((edge) => visit(edge.to));
  return activeNodes
    .filter((node) => node.type !== "output" && !reachable.has(node.id))
    .map((node) => ({
      severity: "warning" as const,
      code: "unreachable_node",
      node_id: node.id,
      message: `${node.id}는 START에서 도달할 수 없습니다. process flow input edge 또는 route 조건을 확인해야 합니다.`
    }));
}

function buildFanOutGroups(edges: AdkGraphEdge[]): AdkGraphFanOutGroup[] {
  const outgoing = new Map<string, AdkGraphEdge[]>();
  edges
    .filter((edge) => edge.from !== "START" && edge.kind !== "join")
    .forEach((edge) => outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]));
  return [...outgoing.entries()]
    .filter(([, group]) => unique(group.map((edge) => edge.to)).length > 1)
    .map(([nodeId, group]) => ({
      nodeId,
      targets: unique(group.map((edge) => edge.to)),
      kind: group.some((edge) => edge.kind === "route") ? "route" : "parallel"
    }));
}

function isRouteEdge(edge: FlowEdge): boolean {
  return edge.data_channel === "route" || Boolean(edge.route_condition);
}

function isLoopEdge(edge: FlowEdge, edges: FlowEdge[]): boolean {
  if (edge.data.toLowerCase().includes("loop")) return true;
  if ((edge.route_condition ?? "").toLowerCase().includes("retry")) return true;
  return hasPath(edge.to, edge.from, edges);
}

function hasPath(from: string, to: string, edges: FlowEdge[], visited = new Set<string>()): boolean {
  if (from === to) return true;
  if (visited.has(from)) return false;
  visited.add(from);
  return edges.filter((edge) => edge.from === from).some((edge) => hasPath(edge.to, to, edges, visited));
}

function edgeKey(from: string, to: string, data: string): string {
  return `${from}->${to}::${data}`;
}

function toRouteLiteral(value: string): string {
  const route = value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return route || "DEFAULT_ROUTE";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
