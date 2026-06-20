// Pure, dependency-free helpers for migrating legacy stage-flow process flows
// into ADK 2.0 Graph IR, plus a soft structural validator that mirrors the
// validate-artifacts.mjs structural checks without throwing.
//
// Both Vite (browser) and Node consume this module. Do NOT add `node:` imports.

import {
  AGENT_EXECUTION_MODES,
  GRAPH_EDGE_KINDS,
  GRAPH_LANE_IDS,
  GRAPH_NODE_KINDS
} from "./types";
import type {
  AgentExecutionMode,
  EdgeKind,
  ExecutionSemantics,
  GraphContainer,
  GraphEdge,
  GraphIR,
  GraphLane,
  GraphNode,
  GraphValidation,
  GraphValidationIssue,
  LaneId,
  NodeKind,
  OwnerScope
} from "./types";

const NODE_KIND_SET = new Set<string>(GRAPH_NODE_KINDS);
const EDGE_KIND_SET = new Set<string>(GRAPH_EDGE_KINDS);
const LANE_ID_SET = new Set<string>(GRAPH_LANE_IDS);
const AGENT_EXECUTION_MODE_SET = new Set<string>(AGENT_EXECUTION_MODES);
const MODULE_BOUND_NODE_KIND_SET = new Set<string>([
  "agent",
  "workflow",
  "workflow_call",
  "adapter",
  "adapter_call",
  "remote_a2a",
  "remote_agent_call"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGraphIRShaped(value: Record<string, unknown>): boolean {
  // Graph IR has containers + lanes arrays AND its nodes use `node_kind`
  // rather than the legacy `type` field.
  const hasContainers = Array.isArray(value.containers);
  const hasLanes = Array.isArray(value.lanes);
  if (!hasContainers || !hasLanes) return false;
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  if (nodes.length === 0) return true;
  return nodes.every((node) => isRecord(node) && typeof node.node_kind === "string");
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asAgentExecutionMode(value: unknown, nodeKind: NodeKind): AgentExecutionMode | null {
  if (nodeKind !== "agent") return null;
  return typeof value === "string" && AGENT_EXECUTION_MODE_SET.has(value) ? (value as AgentExecutionMode) : null;
}

function normalizeNodePosition(value: unknown): GraphNode["position"] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const x = value.x;
  const y = value.y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x, y }
    : undefined;
}

function laneForLegacyType(legacyType: string | undefined, nodeKind: NodeKind): LaneId {
  if (legacyType === "input" || nodeKind === "input") return "input";
  if (legacyType === "output" || nodeKind === "output") return "output";
  if (legacyType === "remote_a2a" || nodeKind === "remote_a2a") return "remote_boundary";
  if (legacyType === "adapter" || nodeKind === "adapter" || nodeKind === "adapter_call") return "adapter";
  if (nodeKind === "human_input") return "human_input";
  return "local_graph";
}

function legacyChannelToEdgeKind(channel: unknown, edgeType: unknown): EdgeKind {
  if (typeof channel === "string" && EDGE_KIND_SET.has(channel)) {
    return channel as EdgeKind;
  }
  if (edgeType === "remote_a2a") return "remote_a2a";
  return "event_output";
}

function executionSemanticsForEdge(kind: EdgeKind): ExecutionSemantics {
  return kind === "remote_a2a" ? "boundary_crossing" : "normal_transition";
}

function padEdgeId(index: number): string {
  return `edge-${String(index + 1).padStart(3, "0")}`;
}

function nextUnusedEdgeId(used: Set<string>): string {
  let index = 1;
  while (used.has(padEdgeId(index - 1))) {
    index += 1;
  }
  return padEdgeId(index - 1);
}

function canonicalEdgeId(value: unknown, index: number, used: Set<string>): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const base = (() => {
    const canonical = raw.match(/^edge-([0-9]+)$/);
    if (canonical) return `edge-${canonical[1]}`;
    const shorthand = raw.match(/^e-([0-9]+)$/);
    if (shorthand) return `edge-${shorthand[1]}`;
    return padEdgeId(index);
  })();
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const next = nextUnusedEdgeId(used);
  used.add(next);
  return next;
}

function slugForContainerId(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/^container-/, "")
    .replace(/^c-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function canonicalContainerIdValue(value: unknown, fallback = "root"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^container-[a-z0-9-]+$/.test(raw)) return raw;
  return `container-${slugForContainerId(raw, fallback)}`;
}

function uniqueContainerId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const next = `${base}-${suffix}`;
  used.add(next);
  return next;
}

function resolveContainerReference(value: unknown, idMap: Map<string, string>): string | null {
  const raw = typeof value === "string" && value.trim() ? value.trim() : null;
  if (!raw) return null;
  return idMap.get(raw) ?? canonicalContainerIdValue(raw);
}

const SOFT_VALIDATION_CODES = new Set([
  "graph_not_object",
  "duplicate_node_id",
  "node_missing_module_id",
  "module_node_missing_incoming",
  "module_node_missing_outgoing",
  "invalid_lane_id",
  "invalid_node_position",
  "duplicate_edge_id",
  "invalid_edge_id",
  "dangling_edge_endpoint",
  "route_missing_condition",
  "artifact_missing_key",
  "state_missing_key",
  "remote_missing_contract",
  "remote_boundary_flag_missing",
  "remote_link_incoherent",
  "invalid_container_id",
  "parallel_region_needs_two_entries",
  "parallel_region_missing_join",
  "loop_region_missing_back",
  "loop_region_missing_exit"
]);

function keepNonSoftIssue(issue: GraphValidationIssue): boolean {
  return !SOFT_VALIDATION_CODES.has(issue.code);
}

export function mergeGraphIRValidation(
  existing: GraphValidation | undefined,
  soft: { errors: GraphValidationIssue[]; warnings: GraphValidationIssue[] }
): GraphValidation {
  const baseErrors = Array.isArray(existing?.errors) ? existing.errors.filter(keepNonSoftIssue) : [];
  const baseWarnings = Array.isArray(existing?.warnings) ? existing.warnings.filter(keepNonSoftIssue) : [];
  const errors = [...baseErrors, ...soft.errors];
  const warnings = [...baseWarnings, ...soft.warnings];
  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function canonicalizeGraphIRIds(graphIR: GraphIR): GraphIR {
  const usedContainerIds = new Set<string>();
  const containerIdMap = new Map<string, string>();
  const containers = (graphIR.containers ?? []).map((container, index) => {
    const rawId = typeof container.id === "string" && container.id.trim() ? container.id.trim() : `container-${index + 1}`;
    const canonical = uniqueContainerId(canonicalContainerIdValue(rawId, index === 0 ? "root" : `region-${index + 1}`), usedContainerIds);
    if (!containerIdMap.has(rawId)) {
      containerIdMap.set(rawId, canonical);
    }
    return {
      ...container,
      id: canonical
    };
  });

  const nodes = (graphIR.nodes ?? []).map((node) => ({
    ...node,
    container_id: resolveContainerReference(node.container_id, containerIdMap)
  }));

  const edgesUsed = new Set<string>();
  const edges = (graphIR.edges ?? []).map((edge, index) => ({
    ...edge,
    id: canonicalEdgeId(edge.id, index, edgesUsed)
  }));

  return {
    ...graphIR,
    nodes,
    edges,
    containers: containers.map((container) => ({
      ...container,
      parent_container_id: resolveContainerReference(container.parent_container_id, containerIdMap)
    }))
  };
}

/**
 * Detect a legacy stage-flow shape and convert it to Graph IR. If the input
 * is already Graph-IR-shaped (or not a record), it is returned unchanged.
 *
 * Conversion is conservative: synthetic node ids/lanes/containers are
 * derived from the old fields; everything not directly mappable becomes
 * `null` rather than fabricated values. A `migrated_from_legacy_stage_shape`
 * warning is appended to `validation.warnings` so the UI can banner it.
 */
export function legacyStageToGraphIR(input: unknown, requirementId: string): GraphIR {
  if (!isRecord(input)) {
    return {
      requirement_id: requirementId,
      graph_id: "graph-001",
      root_workflow_module_id: null,
      nodes: [],
      edges: [],
      containers: [],
      lanes: [],
      validation: {
        ok: true,
        errors: [],
        warnings: [
          {
            code: "migrated_from_legacy_stage_shape",
            message: "Legacy stage-flow shape was migrated to Graph IR.",
            target_kind: "graph",
            target_id: null
          }
        ]
      }
    };
  }

  if (isGraphIRShaped(input)) {
    return input as unknown as GraphIR;
  }

  const legacyNodes = Array.isArray(input.nodes) ? input.nodes : [];
  const legacyEdges = Array.isArray(input.edges) ? input.edges : [];

  const nodes: GraphNode[] = [];
  const usedLanes = new Set<LaneId>();
  let firstModuleBoundId: string | null = null;
  let hasRemote = false;

  for (const raw of legacyNodes) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;

    const legacyType = typeof raw.type === "string" ? raw.type : undefined;
    const candidateKind: NodeKind = (() => {
      if (typeof raw.node_kind === "string" && NODE_KIND_SET.has(raw.node_kind)) {
        return raw.node_kind as NodeKind;
      }
      if (legacyType && NODE_KIND_SET.has(legacyType)) {
        return legacyType as NodeKind;
      }
      // Old type values: input/output/agent/workflow/adapter/remote_a2a all
      // overlap NODE_KIND_SET. Anything else falls back to "agent".
      return "agent";
    })();

    const moduleBound =
      candidateKind === "agent" ||
      candidateKind === "workflow" ||
      candidateKind === "adapter" ||
      candidateKind === "remote_a2a";
    const moduleId = (() => {
      if (typeof raw.module_id === "string") return raw.module_id;
      if (moduleBound && /^mod-/.test(id)) return id;
      return null;
    })();

    if (moduleBound && firstModuleBoundId === null && moduleId) {
      firstModuleBoundId = moduleId;
    }
    if (candidateKind === "remote_a2a") hasRemote = true;

    const lane = laneForLegacyType(legacyType, candidateKind);
    usedLanes.add(lane);

    const ownerScope: OwnerScope = candidateKind === "remote_a2a" ? "remote" : "local";
    const containerId = candidateKind === "remote_a2a" ? "container-remote" : "container-root";

    const adkRole: GraphNode["adk_node_role"] =
      candidateKind === "remote_a2a"
        ? "boundary"
        : candidateKind === "input" || candidateKind === "output"
        ? "synthetic"
        : moduleBound
        ? "workflow_node"
        : "synthetic";

    const reviewStatus: GraphNode["review_status"] =
      typeof raw.review_status === "string" ? (raw.review_status as GraphNode["review_status"]) : "needs_info";

    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label : id;
    const subtype = typeof raw.subtype === "string" ? raw.subtype : undefined;

    nodes.push({
      id,
      label,
      module_id: moduleBound ? moduleId : null,
      node_kind: candidateKind,
      execution_kind: null,
      agent_execution_mode: asAgentExecutionMode(raw.agent_execution_mode, candidateKind),
      adk_node_role: adkRole,
      owner_scope: ownerScope,
      container_id: containerId,
      lane_id: lane,
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: reviewStatus
    });
  }

  const edges: GraphEdge[] = [];
  for (let i = 0; i < legacyEdges.length; i += 1) {
    const raw = legacyEdges[i];
    if (!isRecord(raw)) continue;
    const from = typeof raw.from === "string" ? raw.from : "";
    const to = typeof raw.to === "string" ? raw.to : "";
    if (!from || !to) continue;

    const channel = (raw as Record<string, unknown>).data_channel;
    const edgeType = (raw as Record<string, unknown>).edge_type;
    const edgeKind = legacyChannelToEdgeKind(channel, edgeType);
    const isRemote = edgeKind === "remote_a2a" || edgeType === "remote_a2a";
    const dataLabel = typeof raw.data === "string" ? raw.data : "";

    edges.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : padEdgeId(i),
      from,
      to,
      from_port: null,
      to_port: null,
      edge_kind: edgeKind,
      execution_semantics: executionSemanticsForEdge(edgeKind),
      data_label: dataLabel,
      schema_ref: typeof raw.schema_ref === "string" ? (raw.schema_ref as string) : null,
      route_condition: typeof raw.route_condition === "string" ? (raw.route_condition as string) : null,
      state_key: typeof raw.state_key === "string" ? (raw.state_key as string) : null,
      artifact_key: typeof raw.artifact_key === "string" ? (raw.artifact_key as string) : null,
      a2a_contract_id:
        typeof (raw as Record<string, unknown>).a2a_contract_id === "string"
          ? ((raw as Record<string, unknown>).a2a_contract_id as string)
          : null,
      is_remote_boundary_crossing: isRemote
    });
  }

  const containers: GraphContainer[] = [];
  const localNodeIds = nodes.filter((n) => n.owner_scope !== "remote").map((n) => n.id);
  const remoteNodeIds = nodes.filter((n) => n.owner_scope === "remote").map((n) => n.id);
  containers.push({
    id: "container-root",
    module_id: null,
    label: "Root graph workflow",
    container_kind: "graph_workflow",
    adk_mapping: null,
    contains_node_ids: localNodeIds,
    entry_node_ids: nodes.filter((n) => n.node_kind === "input").map((n) => n.id),
    exit_node_ids: nodes.filter((n) => n.node_kind === "output").map((n) => n.id),
    layout_policy: "dag_with_routes",
    parent_container_id: null
  });
  if (hasRemote) {
    containers.push({
      id: "container-remote",
      module_id: null,
      label: "Remote A2A boundary",
      container_kind: "remote_boundary",
      adk_mapping: null,
      contains_node_ids: remoteNodeIds,
      entry_node_ids: remoteNodeIds,
      exit_node_ids: remoteNodeIds,
      layout_policy: "free",
      parent_container_id: null
    });
  }

  // Always include input/output local_graph at minimum, plus any actually used.
  const laneOrder: LaneId[] = ["input", "local_graph", "adapter", "human_input", "output", "remote_boundary"];
  const lanes: GraphLane[] = laneOrder
    .filter((id) => usedLanes.has(id) || id === "input" || id === "local_graph" || id === "output")
    .map((id) => ({ id, label: id }));

  const validation: GraphValidation = {
    ok: true,
    errors: [],
    warnings: [
      {
        code: "migrated_from_legacy_stage_shape",
        message: "Legacy stage-flow shape was migrated to Graph IR.",
        target_kind: "graph",
        target_id: null
      }
    ]
  };

  return {
    requirement_id: requirementId,
    graph_id: "graph-001",
    root_workflow_module_id: firstModuleBoundId,
    nodes,
    edges,
    containers,
    lanes,
    validation
  };
}

/**
 * Return a native Graph IR object with legacy mirror fields removed. This is
 * intentionally tolerant because it runs on saved browser records and older
 * analyzer output before the strict validator gets a chance to reject them.
 */
export function normalizeGraphIRForRuntime(input: unknown, requirementId: string): GraphIR {
  const graphIR = legacyStageToGraphIR(input, requirementId);
  const containers = graphIR.containers ?? [];
  const lanes = graphIR.lanes ?? [];
  const validation = graphIR.validation ?? { ok: true, errors: [], warnings: [] };

  return canonicalizeGraphIRIds({
    requirement_id: asString(graphIR.requirement_id, requirementId),
    graph_id: asString(graphIR.graph_id, "graph-001"),
    root_workflow_module_id: graphIR.root_workflow_module_id ?? null,
    nodes: (graphIR.nodes ?? []).map((node) => {
      const nodeRecord = node as GraphNode & Record<string, unknown>;
      const legacyType = typeof nodeRecord.type === "string" ? nodeRecord.type : undefined;
      const nodeKind =
        node.node_kind && NODE_KIND_SET.has(node.node_kind)
          ? node.node_kind
          : legacyType && NODE_KIND_SET.has(legacyType)
            ? (legacyType as NodeKind)
            : "function";
      const position = normalizeNodePosition(nodeRecord.position);
      return {
        id: asString(node.id, "node-unknown"),
        label: asString(node.label, asString(node.id, "node")),
        module_id: asNullableString(node.module_id),
        node_kind: nodeKind,
        execution_kind: asNullableString(node.execution_kind),
        agent_execution_mode: asAgentExecutionMode(nodeRecord.agent_execution_mode, nodeKind),
        adk_node_role: node.adk_node_role ?? null,
        owner_scope: node.owner_scope ?? (nodeKind === "remote_a2a" ? "remote" : "local"),
        container_id: asNullableString(node.container_id),
        lane_id: LANE_ID_SET.has(String(node.lane_id)) ? (node.lane_id as LaneId) : laneForLegacyType(legacyType, nodeKind),
        input_ports: Array.isArray(node.input_ports) ? node.input_ports : [],
        output_ports: Array.isArray(node.output_ports) ? node.output_ports : [],
        schema_refs: Array.isArray(node.schema_refs) ? node.schema_refs : [],
        review_status: node.review_status ?? "needs_info",
        workflow_ref: isRecord(nodeRecord.workflow_ref) ? structuredClone(nodeRecord.workflow_ref) : null,
        input_schema: asNullableString(nodeRecord.input_schema),
        output_schema: asNullableString(nodeRecord.output_schema),
        input_mapping: isRecord(nodeRecord.input_mapping) ? structuredClone(nodeRecord.input_mapping) : null,
        output_mapping: isRecord(nodeRecord.output_mapping) ? structuredClone(nodeRecord.output_mapping) : null,
        runtime_binding: asNullableString(nodeRecord.runtime_binding) as GraphNode["runtime_binding"],
        mock_binding: isRecord(nodeRecord.mock_binding) ? structuredClone(nodeRecord.mock_binding) : null,
        adk_skeleton_contract: isRecord(nodeRecord.adk_skeleton_contract)
          ? structuredClone(nodeRecord.adk_skeleton_contract)
          : null,
        ...(position !== undefined ? { position } : {})
      };
    }),
    edges: (graphIR.edges ?? []).map((edge, index) => {
      const edgeRecord = edge as GraphEdge & Record<string, unknown>;
      const legacyChannel = edgeRecord.data_channel;
      const legacyEdgeType = edgeRecord.edge_type;
      const edgeKind =
        edge.edge_kind && EDGE_KIND_SET.has(edge.edge_kind)
          ? edge.edge_kind
          : legacyChannelToEdgeKind(legacyChannel, legacyEdgeType);
      return {
        id: asString(edge.id, padEdgeId(index)),
        from: asString(edge.from, ""),
        to: asString(edge.to, ""),
        from_port: asNullableString(edge.from_port),
        to_port: asNullableString(edge.to_port),
        edge_kind: edgeKind,
        execution_semantics: edge.execution_semantics ?? executionSemanticsForEdge(edgeKind),
        data_label: typeof edge.data_label === "string" ? edge.data_label : typeof edgeRecord.data === "string" ? edgeRecord.data : "",
        schema_ref: asNullableString(edge.schema_ref),
        route_condition: asNullableString(edge.route_condition),
        state_key: asNullableString(edge.state_key),
        artifact_key: asNullableString(edge.artifact_key),
        a2a_contract_id: asNullableString(edge.a2a_contract_id),
        is_remote_boundary_crossing: edge.is_remote_boundary_crossing === true || edgeKind === "remote_a2a"
      };
    }),
    containers,
    lanes,
    validation
  });
}

/**
 * Soft structural validation. Mirrors validate-artifacts.mjs `validateGraphIR`
 * checks (id uniqueness, dangling refs, lane validity, route/artifact/state/
 * remote field requirements, parallel/loop region structure) but never throws.
 * Callers should merge the returned issues into `graphIR.validation`.
 */
export function validateGraphIRSoft(
  graphIR: unknown
): { errors: GraphValidationIssue[]; warnings: GraphValidationIssue[] } {
  const errors: GraphValidationIssue[] = [];
  const warnings: GraphValidationIssue[] = [];

  if (!isRecord(graphIR)) {
    errors.push({
      code: "graph_not_object",
      message: "GraphIR must be an object.",
      target_kind: "graph",
      target_id: null
    });
    return { errors, warnings };
  }

  const nodes = Array.isArray(graphIR.nodes) ? (graphIR.nodes as GraphNode[]) : [];
  const edges = Array.isArray(graphIR.edges) ? (graphIR.edges as GraphEdge[]) : [];
  const containers = Array.isArray(graphIR.containers) ? (graphIR.containers as GraphContainer[]) : [];

  const nodeIds = new Set<string>();
  const nodeById = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!node || typeof node.id !== "string") continue;
    if (nodeIds.has(node.id)) {
      errors.push({
        code: "duplicate_node_id",
        message: `Duplicate node id: ${node.id}`,
        target_kind: "node",
        target_id: node.id
      });
    }
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
    if (typeof node.lane_id !== "string" || !LANE_ID_SET.has(node.lane_id)) {
      errors.push({
        code: "invalid_lane_id",
        message: `Node ${node.id} has invalid lane_id ${String(node.lane_id)}.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (
      "position" in node &&
      node.position !== null &&
      (typeof node.position !== "object" ||
        typeof node.position.x !== "number" ||
        !Number.isFinite(node.position.x) ||
        typeof node.position.y !== "number" ||
        !Number.isFinite(node.position.y))
    ) {
      errors.push({
        code: "invalid_node_position",
        message: `Node ${node.id} has invalid position.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (node.agent_execution_mode !== undefined && node.agent_execution_mode !== null) {
      if (!AGENT_EXECUTION_MODE_SET.has(node.agent_execution_mode)) {
        errors.push({
          code: "invalid_agent_execution_mode",
          message: `Node ${node.id} has invalid agent_execution_mode ${String(node.agent_execution_mode)}.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      if (node.node_kind !== "agent") {
        errors.push({
          code: "agent_execution_mode_on_non_agent",
          message: `Node ${node.id} has agent_execution_mode but is ${node.node_kind}; only agent nodes may set it.`,
          target_kind: "node",
          target_id: node.id
        });
      }
    }
    if (MODULE_BOUND_NODE_KIND_SET.has(node.node_kind) && (typeof node.module_id !== "string" || !node.module_id.trim())) {
      errors.push({
        code: "node_missing_module_id",
        message: `Node ${node.id} (${node.node_kind}) requires a module_id.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (node.node_kind === "workflow_call" && !node.workflow_ref) {
      warnings.push({
        code: "workflow_call_missing_ref",
        message: `Node ${node.id} is a workflow_call without workflow_ref; skeleton generation will require manual target resolution.`,
        target_kind: "node",
        target_id: node.id
      });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge) continue;
    if (typeof edge.id === "string") {
      if (edgeIds.has(edge.id)) {
        errors.push({
          code: "duplicate_edge_id",
          message: `Duplicate edge id: ${edge.id}`,
          target_kind: "edge",
          target_id: edge.id
        });
      }
      edgeIds.add(edge.id);
      if (!/^edge-[0-9]+$/.test(edge.id)) {
        errors.push({
          code: "invalid_edge_id",
          message: `Edge id ${edge.id} must match ^edge-[0-9]+$.`,
          target_kind: "edge",
          target_id: edge.id
        });
      }
    }
    if (typeof edge.from !== "string" || !nodeIds.has(edge.from)) {
      errors.push({
        code: "dangling_edge_endpoint",
        message: `Edge ${edge.id ?? "(no id)"} has unknown from=${String(edge.from)}.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }
    if (typeof edge.to !== "string" || !nodeIds.has(edge.to)) {
      errors.push({
        code: "dangling_edge_endpoint",
        message: `Edge ${edge.id ?? "(no id)"} has unknown to=${String(edge.to)}.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }

    if (edge.edge_kind === "route" && !edge.route_condition) {
      errors.push({
        code: "route_missing_condition",
        message: `Route edge ${edge.id ?? ""} requires route_condition.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }
    if (edge.edge_kind === "artifact" && !edge.artifact_key) {
      errors.push({
        code: "artifact_missing_key",
        message: `Artifact edge ${edge.id ?? ""} requires artifact_key.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }
    if (
      (edge.edge_kind === "session_state" ||
        edge.edge_kind === "temp_state" ||
        edge.edge_kind === "user_state" ||
        edge.edge_kind === "app_state") &&
      !edge.state_key
    ) {
      errors.push({
        code: "state_missing_key",
        message: `State edge ${edge.id ?? ""} requires state_key.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }
    if (edge.edge_kind === "remote_a2a") {
      if (!edge.a2a_contract_id) {
        errors.push({
          code: "remote_missing_contract",
          message: `Remote edge ${edge.id ?? ""} requires a2a_contract_id.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      }
      const fromNode = typeof edge.from === "string" ? nodeById.get(edge.from) : undefined;
      const toNode = typeof edge.to === "string" ? nodeById.get(edge.to) : undefined;
      const remoteNode =
        fromNode?.node_kind === "remote_a2a" ? fromNode : toNode?.node_kind === "remote_a2a" ? toNode : null;
      if (!remoteNode || typeof remoteNode.module_id !== "string" || !remoteNode.module_id.trim()) {
        warnings.push({
          code: "remote_link_incoherent",
          message: `Remote edge ${edge.id ?? ""} should connect to a remote_a2a node with module_id.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      }
      if (edge.is_remote_boundary_crossing !== true) {
        errors.push({
          code: "remote_boundary_flag_missing",
          message: `Remote edge ${edge.id ?? ""} must set is_remote_boundary_crossing=true.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      }
    }
  }

  for (const node of nodes) {
    if (!node || typeof node.id !== "string" || !node.module_id) continue;
    const hasIncoming = edges.some((edge) => edge && edge.to === node.id);
    const hasOutgoing = edges.some((edge) => edge && edge.from === node.id);
    if (!hasIncoming) {
      errors.push({
        code: "module_node_missing_incoming",
        message: `Module node ${node.id} has no incoming edge.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (!hasOutgoing) {
      errors.push({
        code: "module_node_missing_outgoing",
        message: `Module node ${node.id} has no outgoing edge.`,
        target_kind: "node",
        target_id: node.id
      });
    }
  }

  for (const container of containers) {
    if (!container) continue;
    if (typeof container.id !== "string" || !/^container-[a-z0-9-]+$/.test(container.id)) {
      errors.push({
        code: "invalid_container_id",
        message: `Container id ${String(container?.id)} must match ^container-[a-z0-9-]+$.`,
        target_kind: "container",
        target_id: typeof container.id === "string" ? container.id : null
      });
    }
    if (container.container_kind === "parallel_region") {
      const entries = Array.isArray(container.entry_node_ids) ? container.entry_node_ids : [];
      if (entries.length < 2) {
        errors.push({
          code: "parallel_region_needs_two_entries",
          message: `parallel_region ${container.id} must have ≥2 entry nodes.`,
          target_kind: "container",
          target_id: container.id
        });
      }
      const exits = Array.isArray(container.exit_node_ids) ? container.exit_node_ids : [];
      const hasJoin = exits.some((id) => nodes.find((n) => n.id === id && n.node_kind === "join"));
      if (!hasJoin) {
        warnings.push({
          code: "parallel_region_missing_join",
          message: `parallel_region ${container.id} should exit through a join node.`,
          target_kind: "container",
          target_id: container.id
        });
      }
    }
    if (container.container_kind === "loop_region") {
      const containedIds = new Set(container.contains_node_ids ?? []);
      const innerEdges = edges.filter((e) => containedIds.has(e.from) || containedIds.has(e.to));
      const hasBack = innerEdges.some((e) => e.execution_semantics === "loop_back");
      const hasExit = innerEdges.some((e) => e.execution_semantics === "loop_exit");
      if (!hasBack) {
        errors.push({
          code: "loop_region_missing_back",
          message: `loop_region ${container.id} requires one loop_back edge.`,
          target_kind: "container",
          target_id: container.id
        });
      }
      if (!hasExit) {
        errors.push({
          code: "loop_region_missing_exit",
          message: `loop_region ${container.id} requires one loop_exit edge.`,
          target_kind: "container",
          target_id: container.id
        });
      }
    }
  }

  return { errors, warnings };
}
