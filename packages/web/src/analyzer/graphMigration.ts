// Pure, dependency-free helpers for migrating legacy stage-flow process flows
// into ADK 2.0 Graph IR, plus a soft structural validator that mirrors the
// validate-artifacts.mjs structural checks without throwing.
//
// Both Vite (browser) and Node consume this module. Do NOT add `node:` imports.

import {
  GRAPH_EDGE_KINDS,
  GRAPH_LANE_IDS,
  GRAPH_NODE_KINDS
} from "./types";
import type {
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

function laneForLegacyType(legacyType: string | undefined, nodeKind: NodeKind): LaneId {
  if (legacyType === "input" || nodeKind === "input") return "input";
  if (legacyType === "output" || nodeKind === "output") return "output";
  if (legacyType === "remote_a2a" || nodeKind === "remote_a2a") return "remote_boundary";
  if (legacyType === "adapter" || nodeKind === "adapter") return "adapter";
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
      adk_node_role: adkRole,
      owner_scope: ownerScope,
      container_id: containerId,
      lane_id: lane,
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: reviewStatus,
      // Legacy mirror fields preserved for transitional readers.
      type: (legacyType ?? candidateKind) as GraphNode["type"],
      subtype
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
      is_remote_boundary_crossing: isRemote,
      // Legacy mirror fields preserved.
      edge_type: (edgeType === "remote_a2a" ? "remote_a2a" : "local") as GraphEdge["edge_type"],
      data: dataLabel,
      data_channel:
        typeof channel === "string" ? (channel as GraphEdge["data_channel"]) : ("event_output" as GraphEdge["data_channel"])
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
    if (typeof node.lane_id !== "string" || !LANE_ID_SET.has(node.lane_id)) {
      errors.push({
        code: "invalid_lane_id",
        message: `Node ${node.id} has invalid lane_id ${String(node.lane_id)}.`,
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
