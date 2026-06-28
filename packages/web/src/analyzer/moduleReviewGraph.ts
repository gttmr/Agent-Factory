import type {
  EdgeKind,
  ExecutionSemantics,
  FieldSpec,
  GraphEdge,
  GraphIR,
  GraphNode,
  LaneId,
  ModuleCandidate,
  NodeKind,
  OwnerScope
} from "./types";
import { normalizeGraphIRForRuntime, validateGraphIRSoft } from "./graphMigration";

export const REVIEW_INPUT_NODE_ID = "node-review-input";
export const REVIEW_OUTPUT_NODE_ID = "node-review-output";
export const REVIEW_INPUT_ENDPOINT = "__requirement_input__";
export const REVIEW_OUTPUT_ENDPOINT = "__workflow_output__";

export interface ModuleConnectionDraft {
  id: string;
  fromModuleId: string;
  toModuleId: string;
  edge_kind: EdgeKind;
  data_label: string;
  schema_ref: string | null;
  route_condition: string | null;
  route_aliases?: string[] | null;
  is_default_route?: boolean | null;
  state_key: string | null;
  artifact_key: string | null;
  a2a_contract_id: string | null;
}

interface BuildModuleReviewGraphInput {
  requirementId: string;
  graphId?: string;
  moduleCandidates: ModuleCandidate[];
  previousGraphIR?: GraphIR | null;
  connections: ModuleConnectionDraft[];
}

export function buildConnectionDraftsFromGraphIR(
  graphIR: GraphIR | null,
  moduleCandidates: ModuleCandidate[]
): ModuleConnectionDraft[] {
  const activeModuleIds = new Set(moduleCandidates.filter((candidate) => candidate.status !== "rejected").map((candidate) => candidate.id));
  if (!graphIR) {
    return buildLinearConnectionDrafts(moduleCandidates);
  }

  const nodeToModuleId = new Map<string, string>();
  nodeToModuleId.set(REVIEW_INPUT_NODE_ID, REVIEW_INPUT_ENDPOINT);
  nodeToModuleId.set("requirement_input", REVIEW_INPUT_ENDPOINT);
  nodeToModuleId.set(REVIEW_OUTPUT_NODE_ID, REVIEW_OUTPUT_ENDPOINT);
  nodeToModuleId.set("workflow_output", REVIEW_OUTPUT_ENDPOINT);
  for (const node of graphIR.nodes ?? []) {
    if (node.node_kind === "input") {
      nodeToModuleId.set(node.id, REVIEW_INPUT_ENDPOINT);
      continue;
    }
    if (node.node_kind === "output") {
      nodeToModuleId.set(node.id, REVIEW_OUTPUT_ENDPOINT);
      continue;
    }
    if (node.module_id && activeModuleIds.has(node.module_id)) {
      nodeToModuleId.set(node.id, node.module_id);
      nodeToModuleId.set(node.module_id, node.module_id);
    }
  }

  const drafts = (graphIR.edges ?? [])
    .map((edge, index): ModuleConnectionDraft | null => {
      const fromModuleId = nodeToModuleId.get(edge.from);
      const toModuleId = nodeToModuleId.get(edge.to);
      if (!fromModuleId || !toModuleId) return null;
      return {
        id: edge.id || padEdgeId(index + 1),
        fromModuleId,
        toModuleId,
        edge_kind: edge.edge_kind,
        data_label: edge.data_label || defaultEdgeLabel(fromModuleId, toModuleId, moduleCandidates),
        schema_ref: edge.schema_ref ?? null,
        route_condition: edge.route_condition ?? null,
        route_aliases: edge.route_aliases ?? [],
        is_default_route: edge.is_default_route === true,
        state_key: edge.state_key ?? null,
        artifact_key: edge.artifact_key ?? null,
        a2a_contract_id: edge.a2a_contract_id ?? null
      };
    })
    .filter((draft): draft is ModuleConnectionDraft => draft !== null);

  return drafts.length
    ? normalizeConnectionDraftIds(ensureConnectionCoverage(drafts, moduleCandidates))
    : buildLinearConnectionDrafts(moduleCandidates);
}

export function repairGraphIRModuleCoverage(
  graphIR: GraphIR,
  moduleCandidates: ModuleCandidate[]
): GraphIR {
  return buildGraphIRFromModuleReview({
    requirementId: graphIR.requirement_id,
    graphId: graphIR.graph_id,
    moduleCandidates,
    previousGraphIR: graphIR,
    connections: buildConnectionDraftsFromGraphIR(graphIR, moduleCandidates)
  });
}

export function hasModuleCoverageErrors(graphIR: GraphIR): boolean {
  return (graphIR.validation?.errors ?? []).some(
    (issue) =>
      issue.code === "module_node_missing_incoming" ||
      issue.code === "module_node_missing_outgoing"
  );
}

export function buildLinearConnectionDrafts(moduleCandidates: ModuleCandidate[]): ModuleConnectionDraft[] {
  const activeCandidates = moduleCandidates.filter((candidate) => candidate.status !== "rejected");
  const endpoints = [REVIEW_INPUT_ENDPOINT, ...activeCandidates.map((candidate) => candidate.id), REVIEW_OUTPUT_ENDPOINT];
  return endpoints.slice(0, -1).map((fromModuleId, index) => {
    const toModuleId = endpoints[index + 1];
    return {
      id: padEdgeId(index + 1),
      fromModuleId,
      toModuleId,
      edge_kind: "event_output",
      data_label: defaultEdgeLabel(fromModuleId, toModuleId, moduleCandidates),
      schema_ref: firstSchemaRef(fromModuleId, toModuleId, moduleCandidates),
      route_condition: null,
      route_aliases: [],
      is_default_route: false,
      state_key: null,
      artifact_key: null,
      a2a_contract_id: null
    };
  });
}

export function buildGraphIRFromModuleReview({
  requirementId,
  graphId = "graph-001",
  moduleCandidates,
  previousGraphIR,
  connections
}: BuildModuleReviewGraphInput): GraphIR {
  const activeCandidates = moduleCandidates.filter((candidate) => candidate.status !== "rejected");
  const nodeByModuleId = new Map<string, string>();
  const nodes: GraphNode[] = [
    {
      id: REVIEW_INPUT_NODE_ID,
      label: "Requirement input",
      module_id: null,
      node_kind: "input",
      execution_kind: null,
      agent_execution_mode: null,
      adk_node_role: "synthetic",
      owner_scope: "local",
      container_id: "container-root",
      lane_id: "input",
      input_ports: [],
      output_ports: collectInputPorts(activeCandidates),
      schema_refs: [],
      review_status: "n/a"
    }
  ];

  for (const candidate of activeCandidates) {
    const nodeId = nodeIdForCandidate(candidate);
    nodeByModuleId.set(candidate.id, nodeId);
    nodes.push({
      id: nodeId,
      label: candidate.name,
      module_id: candidate.id,
      node_kind: nodeKindForCandidate(candidate),
      execution_kind: candidate.module_category,
      agent_execution_mode: candidate.module_category === "agent" ? "single_turn" : null,
      adk_node_role: "workflow_node",
      owner_scope: ownerScopeForCandidate(candidate),
      container_id: "container-root",
      lane_id: laneForCandidate(candidate),
      input_ports: fieldsToPorts(candidate.inputs, "in"),
      output_ports: fieldsToPorts(candidate.outputs, "out"),
      schema_refs: schemaRefsForCandidate(candidate),
      review_status: candidate.status
    });
  }

  nodes.push({
    id: REVIEW_OUTPUT_NODE_ID,
    label: "Workflow output",
    module_id: null,
    node_kind: "output",
    execution_kind: null,
    agent_execution_mode: null,
    adk_node_role: "synthetic",
    owner_scope: "local",
    container_id: "container-root",
    lane_id: "output",
    input_ports: collectOutputPorts(activeCandidates),
    output_ports: [],
    schema_refs: [],
    review_status: "n/a"
  });

  const sanitizedConnections = normalizeConnectionDraftIds(connections.length ? connections : buildLinearConnectionDrafts(activeCandidates));
  const edges = sanitizedConnections.flatMap((draft, index): GraphEdge[] => {
    const from = endpointToNodeId(draft.fromModuleId, nodeByModuleId);
    const to = endpointToNodeId(draft.toModuleId, nodeByModuleId);
    if (!from || !to || from === to) return [];
    const edgeKind = normalizeEdgeKind(draft);
    return [
      {
        id: padEdgeId(index + 1),
        from,
        to,
        from_port: null,
        to_port: null,
        edge_kind: edgeKind,
        execution_semantics: executionSemanticsForDraft(edgeKind, draft),
        data_label: draft.data_label.trim() || defaultEdgeLabel(draft.fromModuleId, draft.toModuleId, activeCandidates),
        schema_ref: emptyToNull(draft.schema_ref),
        route_condition: edgeKind === "route" ? emptyToNull(draft.route_condition) : emptyToNull(draft.route_condition),
        route_aliases: draft.route_aliases ?? [],
        is_default_route: draft.is_default_route === true,
        state_key: isStateEdge(edgeKind) ? emptyToNull(draft.state_key) : emptyToNull(draft.state_key),
        artifact_key: edgeKind === "artifact" ? emptyToNull(draft.artifact_key) : emptyToNull(draft.artifact_key),
        a2a_contract_id: edgeKind === "remote_a2a" ? emptyToNull(draft.a2a_contract_id) : emptyToNull(draft.a2a_contract_id),
        is_remote_boundary_crossing: edgeKind === "remote_a2a"
      }
    ];
  });

  const generated = normalizeGraphIRForRuntime(
    {
      requirement_id: requirementId,
      graph_id: previousGraphIR?.graph_id ?? graphId,
      root_workflow_module_id: activeCandidates.find((candidate) => candidate.module_category === "workflow")?.id ?? null,
      nodes,
      edges,
      containers: [
        {
          id: "container-root",
          label: "Reviewed workflow",
          container_kind: "graph_workflow",
          contains_node_ids: nodes.map((node) => node.id),
          entry_node_ids: [REVIEW_INPUT_NODE_ID],
          exit_node_ids: [REVIEW_OUTPUT_NODE_ID],
          layout_policy: "dag_with_routes",
          parent_container_id: null
        }
      ],
      lanes: [
        { id: "input", label: "Input" },
        { id: "local_graph", label: "Workflow" },
        { id: "adapter", label: "Adapter" },
        { id: "human_input", label: "Human input" },
        { id: "remote_boundary", label: "Remote boundary" },
        { id: "output", label: "Output" }
      ],
      validation: { ok: true, errors: [], warnings: [] }
    },
    requirementId
  );
  const validation = validateGraphIRSoft(generated);
  return {
    ...generated,
    validation: {
      ok: validation.errors.length === 0,
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
}

function normalizeConnectionDraftIds(connections: ModuleConnectionDraft[]): ModuleConnectionDraft[] {
  return connections.map((connection, index) => ({ ...connection, id: padEdgeId(index + 1) }));
}

function ensureConnectionCoverage(
  connections: ModuleConnectionDraft[],
  moduleCandidates: ModuleCandidate[]
): ModuleConnectionDraft[] {
  const activeCandidates = moduleCandidates.filter((candidate) => candidate.status !== "rejected");
  if (!activeCandidates.length) return [];

  const next = [...connections];
  const connectionKeys = new Set(next.map(connectionKey));
  const incoming = new Set(next.map((connection) => connection.toModuleId));
  const outgoing = new Set(next.map((connection) => connection.fromModuleId));
  const orderedEndpoints = [
    REVIEW_INPUT_ENDPOINT,
    ...activeCandidates.map((candidate) => candidate.id),
    REVIEW_OUTPUT_ENDPOINT
  ];

  const addCoverageConnection = (fromModuleId: string, toModuleId: string) => {
    if (fromModuleId === toModuleId) return;
    const key = `${fromModuleId}->${toModuleId}`;
    if (connectionKeys.has(key)) return;
    const connection: ModuleConnectionDraft = {
      id: padEdgeId(next.length + 1),
      fromModuleId,
      toModuleId,
      edge_kind: "event_output",
      data_label: defaultEdgeLabel(fromModuleId, toModuleId, activeCandidates),
      schema_ref: firstSchemaRef(fromModuleId, toModuleId, activeCandidates),
      route_condition: null,
      route_aliases: [],
      is_default_route: false,
      state_key: null,
      artifact_key: null,
      a2a_contract_id: null
    };
    next.push(connection);
    connectionKeys.add(key);
    outgoing.add(fromModuleId);
    incoming.add(toModuleId);
  };

  for (const candidate of activeCandidates) {
    const index = orderedEndpoints.indexOf(candidate.id);
    const previousEndpoint = orderedEndpoints[index - 1] ?? REVIEW_INPUT_ENDPOINT;
    const nextEndpoint = orderedEndpoints[index + 1] ?? REVIEW_OUTPUT_ENDPOINT;
    if (!incoming.has(candidate.id)) {
      addCoverageConnection(previousEndpoint, candidate.id);
    }
    if (!outgoing.has(candidate.id)) {
      addCoverageConnection(candidate.id, nextEndpoint);
    }
  }

  if (!outgoing.has(REVIEW_INPUT_ENDPOINT)) {
    addCoverageConnection(REVIEW_INPUT_ENDPOINT, activeCandidates[0].id);
  }
  if (!incoming.has(REVIEW_OUTPUT_ENDPOINT)) {
    addCoverageConnection(activeCandidates[activeCandidates.length - 1].id, REVIEW_OUTPUT_ENDPOINT);
  }

  return next;
}

function connectionKey(connection: ModuleConnectionDraft): string {
  return `${connection.fromModuleId}->${connection.toModuleId}`;
}

function endpointToNodeId(endpoint: string, nodeByModuleId: Map<string, string>): string | null {
  if (endpoint === REVIEW_INPUT_ENDPOINT) return REVIEW_INPUT_NODE_ID;
  if (endpoint === REVIEW_OUTPUT_ENDPOINT) return REVIEW_OUTPUT_NODE_ID;
  return nodeByModuleId.get(endpoint) ?? null;
}

function nodeIdForCandidate(candidate: ModuleCandidate): string {
  return `node-${slug(candidate.id.replace(/^mod-/, ""))}`;
}

function nodeKindForCandidate(candidate: ModuleCandidate): NodeKind {
  if (candidate.module_category === "adapter") return "adapter";
  if (candidate.module_category === "workflow") return "workflow";
  if (candidate.module_category === "remote_a2a") return "remote_a2a";
  return "agent";
}

function laneForCandidate(candidate: ModuleCandidate): LaneId {
  if (candidate.module_category === "adapter") return "adapter";
  if (candidate.module_category === "remote_a2a") return "remote_boundary";
  return "local_graph";
}

function ownerScopeForCandidate(candidate: ModuleCandidate): OwnerScope {
  if (candidate.module_category === "remote_a2a") return "remote";
  if (candidate.module_category === "adapter" && candidate.access_protocol && candidate.access_protocol !== "local") return "external";
  return "local";
}

function fieldsToPorts(fields: FieldSpec[], prefix: string) {
  return fields.map((field, index) => ({
    id: `${prefix}-${slug(field.name || String(index + 1))}`,
    label: field.name || `${prefix}-${index + 1}`,
    schema_ref: field.type || null
  }));
}

function collectInputPorts(candidates: ModuleCandidate[]) {
  return candidates.flatMap((candidate) => fieldsToPorts(candidate.inputs, `out-${slug(candidate.id)}`));
}

function collectOutputPorts(candidates: ModuleCandidate[]) {
  return candidates.flatMap((candidate) => fieldsToPorts(candidate.outputs, `in-${slug(candidate.id)}`));
}

function schemaRefsForCandidate(candidate: ModuleCandidate): string[] {
  return Array.from(
    new Set([
      ...candidate.inputs.map((field) => field.type).filter(Boolean),
      ...candidate.outputs.map((field) => field.type).filter(Boolean)
    ])
  );
}

function firstSchemaRef(fromModuleId: string, toModuleId: string, candidates: ModuleCandidate[]): string | null {
  const fromCandidate = candidates.find((candidate) => candidate.id === fromModuleId);
  const toCandidate = candidates.find((candidate) => candidate.id === toModuleId);
  return fromCandidate?.outputs[0]?.type || toCandidate?.inputs[0]?.type || null;
}

function defaultEdgeLabel(fromModuleId: string, toModuleId: string, candidates: ModuleCandidate[]): string {
  const fromCandidate = candidates.find((candidate) => candidate.id === fromModuleId);
  const toCandidate = candidates.find((candidate) => candidate.id === toModuleId);
  if (fromModuleId === REVIEW_INPUT_ENDPOINT) return toCandidate?.inputs[0]?.name || "requirement_input";
  if (toModuleId === REVIEW_OUTPUT_ENDPOINT) return fromCandidate?.outputs[0]?.name || "workflow_output";
  return fromCandidate?.outputs[0]?.name || toCandidate?.inputs[0]?.name || "event_output";
}

function normalizeEdgeKind(draft: ModuleConnectionDraft): EdgeKind {
  if (draft.edge_kind === "remote_a2a") return "remote_a2a";
  if (draft.edge_kind === "artifact") return "artifact";
  if (isStateEdge(draft.edge_kind)) return draft.edge_kind;
  if (draft.edge_kind === "route") return "route";
  return "event_output";
}

function executionSemanticsForDraft(edgeKind: EdgeKind, draft: ModuleConnectionDraft): ExecutionSemantics {
  if (edgeKind === "remote_a2a") return "boundary_crossing";
  if (edgeKind === "route" || draft.route_condition) return "conditional";
  return "normal_transition";
}

function isStateEdge(edgeKind: EdgeKind): boolean {
  return edgeKind === "session_state" || edgeKind === "temp_state" || edgeKind === "user_state" || edgeKind === "app_state";
}

function emptyToNull(value: string | null): string | null {
  return value && value.trim() ? value.trim() : null;
}

function padEdgeId(index: number): string {
  return `edge-${String(index).padStart(3, "0")}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
