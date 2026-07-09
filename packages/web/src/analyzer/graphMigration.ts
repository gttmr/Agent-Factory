// Pure, dependency-free helpers for migrating legacy stage-flow process flows
// into ADK Graph IR, plus a soft structural validator that mirrors the
// validate-artifacts.mjs structural checks without throwing.
//
// Both Vite (browser) and Node consume this module. Do NOT add `node:` imports.

import {
  AGENT_EXECUTION_MODES,
  GRAPH_CALL_CONTROLS,
  GRAPH_DECISION_OWNERS,
  GRAPH_EDGE_KINDS,
  GRAPH_FLOW_KINDS,
  GRAPH_INVOKE_BINDINGS,
  GRAPH_LANE_IDS,
  GRAPH_NODE_KINDS,
  GRAPH_POLICIES,
  GRAPH_SIDE_EFFECTS
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
  GraphCallControl,
  GraphDecisionOwner,
  GraphFlowKind,
  GraphInvokeBinding,
  HumanInputContract,
  GraphPolicy,
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
const GRAPH_INVOKE_BINDING_SET = new Set<string>(GRAPH_INVOKE_BINDINGS);
const GRAPH_DECISION_OWNER_SET = new Set<string>(GRAPH_DECISION_OWNERS);
const GRAPH_CALL_CONTROL_SET = new Set<string>(GRAPH_CALL_CONTROLS);
const GRAPH_FLOW_KIND_SET = new Set<string>(GRAPH_FLOW_KINDS);
const GRAPH_POLICY_SET = new Set<string>(GRAPH_POLICIES);
const SIDE_EFFECT_SET = new Set<string>(GRAPH_SIDE_EFFECTS);
const CALLBACK_INVOKE_BINDINGS = new Set<string>(["callback_wait"]);
const CALLBACK_CALL_CONTROLS = new Set<string>(["event_callback", "resume"]);
const CALLBACK_FLOW_KINDS = new Set<string>(["callback", "resume"]);
const MODULE_BOUND_NODE_KIND_SET = new Set<string>([
  "agent",
  "workflow",
  "workflow_call",
  "adapter",
  "adapter_call",
  "remote_a2a",
  "remote_agent_call"
]);
const MODULE_FORBIDDEN_NODE_KIND_SET = new Set<string>([
  "input",
  "output",
  "join",
  "router",
  "loop_control",
  "human_input",
  "callback_wait"
]);
const REMOTE_AGENT_NODE_KIND_SET = new Set<string>(["remote_a2a", "remote_agent_call"]);

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim());
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asAgentExecutionMode(value: unknown, nodeKind: NodeKind): AgentExecutionMode | null {
  if (nodeKind !== "agent") return null;
  return typeof value === "string" && AGENT_EXECUTION_MODE_SET.has(value) ? (value as AgentExecutionMode) : null;
}

function graphNodeControlMetadata(raw: Record<string, unknown>): Pick<
  GraphNode,
  "invoke_binding" | "decision_owner" | "call_control" | "side_effect" | "policy"
> {
  const metadata: Pick<GraphNode, "invoke_binding" | "decision_owner" | "call_control" | "side_effect" | "policy"> = {};
  const invokeBinding = optionalNullableString(raw.invoke_binding);
  const decisionOwner = optionalNullableString(raw.decision_owner);
  const callControl = optionalNullableString(raw.call_control);
  const sideEffect = optionalNullableString(raw.side_effect);
  const policy = optionalNullableString(raw.policy);
  if (invokeBinding !== undefined) metadata.invoke_binding = invokeBinding as GraphInvokeBinding | null;
  if (decisionOwner !== undefined) metadata.decision_owner = decisionOwner as GraphDecisionOwner | null;
  if (callControl !== undefined) metadata.call_control = callControl as GraphCallControl | null;
  if (sideEffect !== undefined) metadata.side_effect = sideEffect as GraphNode["side_effect"];
  if (policy !== undefined) metadata.policy = policy as GraphPolicy | null;
  return metadata;
}

function graphEdgeControlMetadata(raw: Record<string, unknown>): Pick<GraphEdge, "flow_kind" | "call_control"> {
  const metadata: Pick<GraphEdge, "flow_kind" | "call_control"> = {};
  const flowKind = optionalNullableString(raw.flow_kind);
  const callControl = optionalNullableString(raw.call_control);
  if (flowKind !== undefined) metadata.flow_kind = flowKind as GraphFlowKind | null;
  if (callControl !== undefined) metadata.call_control = callControl as GraphCallControl | null;
  return metadata;
}

function normalizeResponseSchemaRef(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeHumanInputContract(raw: Record<string, unknown>, label: string, nodeKind: NodeKind): HumanInputContract | null {
  if (nodeKind !== "human_input") return null;
  const reviewedContract = raw.human_input_contract;
  const hasReviewedContract = isRecord(reviewedContract);
  const contract: Record<string, unknown> = hasReviewedContract ? reviewedContract : {};
  const message = typeof contract.message === "string" && contract.message.trim() ? contract.message.trim() : label;
  const responseMapping = isRecord(contract.response_mapping)
    ? Object.fromEntries(
        Object.entries(contract.response_mapping).filter(
          (entry): entry is [string, string] => Boolean(entry[0].trim()) && typeof entry[1] === "string" && Boolean(entry[1].trim())
        )
      )
    : null;
  return {
    message,
    payload_schema_ref: asNullableString(contract.payload_schema_ref),
    response_schema_ref: normalizeResponseSchemaRef(contract.response_schema_ref, hasReviewedContract ? null : "str"),
    response_mapping: responseMapping && Object.keys(responseMapping).length ? responseMapping : null,
    choice_options: nullableStringArray(contract.choice_options),
    accepted_aliases: nullableStringArrayRecord(contract.accepted_aliases),
    default_choice: asNullableString(contract.default_choice)
  };
}

function hasInvalidResponseMappingShape(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (!isRecord(value)) return true;
  return Object.entries(value).some(([key, mapping]) => !key.trim() || typeof mapping !== "string" || !mapping.trim());
}

function hasInvalidStringArrayShape(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return !Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim());
}

function hasInvalidStringArrayRecordShape(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (!isRecord(value)) return true;
  return Object.entries(value).some(
    ([key, aliases]) =>
      !key.trim() ||
      !Array.isArray(aliases) ||
      aliases.some((alias) => typeof alias !== "string" || !alias.trim())
  );
}

function nullableStringArray(value: unknown): string[] | null {
  const values = asStringArray(value);
  return values.length ? values : null;
}

function nullableStringArrayRecord(value: unknown): Record<string, string[]> | null {
  if (Array.isArray(value)) {
    const entries: [string, string[]][] = [];
    for (const item of value) {
      if (!isRecord(item)) continue;
      const choice = asNullableString(item.choice);
      const aliases = asStringArray(item.aliases);
      if (choice && aliases.length) entries.push([choice, aliases]);
    }
    return entries.length ? Object.fromEntries(entries) : null;
  }
  if (!isRecord(value)) return null;
  const entries: [string, string[]][] = [];
  for (const [key, aliases] of Object.entries(value)) {
    if (!key.trim()) continue;
    const normalizedAliases = asStringArray(aliases);
    if (!normalizedAliases.length) continue;
    entries.push([key.trim(), normalizedAliases]);
  }
  return entries.length ? Object.fromEntries(entries) : null;
}

function isRemoteAgentNode(node: GraphNode | undefined): node is GraphNode {
  return typeof node?.node_kind === "string" && REMOTE_AGENT_NODE_KIND_SET.has(node.node_kind);
}

function validateOptionalEnum(
  value: unknown,
  allowed: Set<string>,
  code: string,
  message: string,
  targetKind: GraphValidationIssue["target_kind"],
  targetId: string | null,
  errors: GraphValidationIssue[]
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push({
      code,
      message,
      target_kind: targetKind,
      target_id: targetId
    });
  }
}

function hasCallbackWaitControlMetadata(node: GraphNode, edges: GraphEdge[]): boolean {
  if (typeof node.invoke_binding === "string" && CALLBACK_INVOKE_BINDINGS.has(node.invoke_binding)) return true;
  if (typeof node.call_control === "string" && CALLBACK_CALL_CONTROLS.has(node.call_control)) return true;
  if (node.policy === "callback_resume_required") return true;
  return edges.some((edge) => {
    if (!edge || (edge.from !== node.id && edge.to !== node.id)) return false;
    return (
      (typeof edge.call_control === "string" && CALLBACK_CALL_CONTROLS.has(edge.call_control)) ||
      (typeof edge.flow_kind === "string" && CALLBACK_FLOW_KINDS.has(edge.flow_kind))
    );
  });
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
  "invalid_invoke_binding",
  "invalid_decision_owner",
  "invalid_call_control",
  "invalid_side_effect",
  "invalid_policy",
  "invalid_flow_kind",
  "llm_toolset_requires_agent_node",
  "callback_wait_missing_control_metadata",
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
  "human_input_contract_on_non_human",
  "artifact_missing_key",
  "state_missing_key",
  "remote_missing_contract",
  "remote_boundary_flag_missing",
  "remote_link_incoherent",
  "invalid_container_id",
  "dynamic_workflow_design_only",
  "parallel_region_needs_two_entries",
  "parallel_region_missing_join",
  "loop_region_missing_back",
  "loop_region_missing_exit",
  "human_input_payload_schema_invalid",
  "human_input_response_mapping_invalid",
  "human_input_choice_options_invalid",
  "human_input_accepted_aliases_invalid",
  "human_input_default_choice_invalid",
  "human_input_contract_invalid"
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
function legacyStageToGraphIR(input: unknown, requirementId: string): GraphIR {
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
      review_status: reviewStatus,
      ...graphNodeControlMetadata(raw)
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
      ...graphEdgeControlMetadata(raw)
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
      const label = asString(node.label, asString(node.id, "node"));
      return {
        id: asString(node.id, "node-unknown"),
        label,
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
        human_input_contract: normalizeHumanInputContract(nodeRecord, label, nodeKind),
        runtime_binding: asNullableString(nodeRecord.runtime_binding) as GraphNode["runtime_binding"],
        ...graphNodeControlMetadata(nodeRecord),
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
        route_aliases: asStringArray(edgeRecord.route_aliases),
        is_default_route: edgeRecord.is_default_route === true,
        state_key: asNullableString(edge.state_key),
        artifact_key: asNullableString(edge.artifact_key),
        a2a_contract_id: asNullableString(edge.a2a_contract_id),
        is_remote_boundary_crossing: edge.is_remote_boundary_crossing === true || edgeKind === "remote_a2a",
        ...graphEdgeControlMetadata(edgeRecord)
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
    validateOptionalEnum(
      node.invoke_binding,
      GRAPH_INVOKE_BINDING_SET,
      "invalid_invoke_binding",
      `Node ${node.id} has invalid invoke_binding ${String(node.invoke_binding)}.`,
      "node",
      node.id,
      errors
    );
    validateOptionalEnum(
      node.decision_owner,
      GRAPH_DECISION_OWNER_SET,
      "invalid_decision_owner",
      `Node ${node.id} has invalid decision_owner ${String(node.decision_owner)}.`,
      "node",
      node.id,
      errors
    );
    validateOptionalEnum(
      node.call_control,
      GRAPH_CALL_CONTROL_SET,
      "invalid_call_control",
      `Node ${node.id} has invalid call_control ${String(node.call_control)}.`,
      "node",
      node.id,
      errors
    );
    validateOptionalEnum(
      node.side_effect,
      SIDE_EFFECT_SET,
      "invalid_side_effect",
      `Node ${node.id} has invalid side_effect ${String(node.side_effect)}.`,
      "node",
      node.id,
      errors
    );
    validateOptionalEnum(
      node.policy,
      GRAPH_POLICY_SET,
      "invalid_policy",
      `Node ${node.id} has invalid policy ${String(node.policy)}.`,
      "node",
      node.id,
      errors
    );
    if (
      (node.invoke_binding === "mcp_toolset" || node.call_control === "selected_by_llm") &&
      node.node_kind !== "agent"
    ) {
      errors.push({
        code: "llm_toolset_requires_agent_node",
        message: `Node ${node.id} (${node.node_kind}) carries LLM-selected MCP toolset semantics; mcp_toolset / selected_by_llm belong on an agent decision node, while adapter_call must use mcp_tool + fixed_by_workflow.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (
      MODULE_FORBIDDEN_NODE_KIND_SET.has(node.node_kind) &&
      typeof node.module_id === "string" &&
      node.module_id.trim()
    ) {
      errors.push({
        code: "node_kind_must_not_bind_module",
        message: `Node ${node.id} (${node.node_kind}) must not bind to module ${node.module_id}; it is workflow graph semantics.`,
        target_kind: "node",
        target_id: node.id
      });
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
    if (node.node_kind === "callback_wait" && !hasCallbackWaitControlMetadata(node, edges)) {
      errors.push({
        code: "callback_wait_missing_control_metadata",
        message: `Node ${node.id} is callback_wait but lacks callback/resume control metadata.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (node.node_kind !== "human_input" && node.human_input_contract !== undefined && node.human_input_contract !== null) {
      errors.push({
        code: "human_input_contract_on_non_human",
        message: `Node ${node.id} human_input_contract is allowed only on human_input nodes.`,
        target_kind: "node",
        target_id: node.id
      });
    }
    if (node.node_kind === "human_input" && node.human_input_contract) {
      if (typeof node.human_input_contract !== "object" || Array.isArray(node.human_input_contract)) {
        errors.push({
          code: "human_input_contract_invalid",
          message: `Node ${node.id} human_input_contract must be an object or null.`,
          target_kind: "node",
          target_id: node.id
        });
        continue;
      }
      if (typeof node.human_input_contract.message !== "string" || !node.human_input_contract.message.trim()) {
        errors.push({
          code: "human_input_message_missing",
          message: `Node ${node.id} human_input_contract.message must be a non-empty reviewed prompt.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      const payloadSchemaRef = node.human_input_contract.payload_schema_ref;
      if (payloadSchemaRef !== undefined && payloadSchemaRef !== null && (typeof payloadSchemaRef !== "string" || !payloadSchemaRef.trim())) {
        errors.push({
          code: "human_input_payload_schema_invalid",
          message: `Node ${node.id} human_input_contract.payload_schema_ref must be a non-empty string or null.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      const responseSchemaRef = node.human_input_contract.response_schema_ref;
      if (responseSchemaRef !== undefined && responseSchemaRef !== null && responseSchemaRef !== "str") {
        errors.push({
          code: "human_input_response_schema_unsupported",
          message: `Node ${node.id} response_schema_ref ${responseSchemaRef} is design-only; runnable currently supports only null or "str".`,
          target_kind: "node",
          target_id: node.id
        });
      }
      if (hasInvalidResponseMappingShape(node.human_input_contract.response_mapping)) {
        errors.push({
          code: "human_input_response_mapping_invalid",
          message: `Node ${node.id} human_input_contract.response_mapping must be an object with non-empty string values or null.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      if (hasInvalidStringArrayShape(node.human_input_contract.choice_options)) {
        errors.push({
          code: "human_input_choice_options_invalid",
          message: `Node ${node.id} human_input_contract.choice_options must be an array of non-empty strings or null.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      if (hasInvalidStringArrayRecordShape(node.human_input_contract.accepted_aliases)) {
        errors.push({
          code: "human_input_accepted_aliases_invalid",
          message: `Node ${node.id} human_input_contract.accepted_aliases must be an object of non-empty string arrays or null.`,
          target_kind: "node",
          target_id: node.id
        });
      }
      const defaultChoice = node.human_input_contract.default_choice;
      if (defaultChoice !== undefined && defaultChoice !== null && (typeof defaultChoice !== "string" || !defaultChoice.trim())) {
        errors.push({
          code: "human_input_default_choice_invalid",
          message: `Node ${node.id} human_input_contract.default_choice must be a non-empty string or null.`,
          target_kind: "node",
          target_id: node.id
        });
      }
    }
  }

  const edgeIds = new Set<string>();
  const defaultRouteEdgesByRouter = new Map<string, string[]>();
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
    const isRouteReviewEdge =
      edge.edge_kind === "route" ||
      ((edge.execution_semantics === "loop_back" || edge.execution_semantics === "loop_exit") && edge.edge_kind === "control");
    if (Array.isArray(edge.route_aliases) && edge.route_aliases.length > 0) {
      if (!isRouteReviewEdge) {
        errors.push({
          code: "route_aliases_on_non_route",
          message: `Edge ${edge.id ?? ""} route_aliases is allowed only on route or loop decision edges.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      }
      if (edge.route_aliases.some((alias) => typeof alias !== "string" || !alias.trim())) {
        errors.push({
          code: "route_alias_empty",
          message: `Route edge ${edge.id ?? ""} route_aliases entries must be non-empty strings.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      }
    }
    if (edge.is_default_route === true) {
      if (!isRouteReviewEdge) {
        errors.push({
          code: "default_route_on_non_route",
          message: `Edge ${edge.id ?? ""} is_default_route is allowed only on route or loop decision edges.`,
          target_kind: "edge",
          target_id: edge.id ?? null
        });
      } else if (edge.edge_kind === "route" && typeof edge.from === "string") {
        const current = defaultRouteEdgesByRouter.get(edge.from) ?? [];
        current.push(edge.id ?? `${edge.from}->${edge.to}`);
        defaultRouteEdgesByRouter.set(edge.from, current);
      }
    }
    if (edge.edge_kind === "artifact" && !edge.artifact_key) {
      errors.push({
        code: "artifact_missing_key",
        message: `Artifact edge ${edge.id ?? ""} requires artifact_key.`,
        target_kind: "edge",
        target_id: edge.id ?? null
      });
    }
    validateOptionalEnum(
      edge.flow_kind,
      GRAPH_FLOW_KIND_SET,
      "invalid_flow_kind",
      `Edge ${edge.id ?? ""} has invalid flow_kind ${String(edge.flow_kind)}.`,
      "edge",
      edge.id ?? null,
      errors
    );
    validateOptionalEnum(
      edge.call_control,
      GRAPH_CALL_CONTROL_SET,
      "invalid_call_control",
      `Edge ${edge.id ?? ""} has invalid call_control ${String(edge.call_control)}.`,
      "edge",
      edge.id ?? null,
      errors
    );
    if (edge.call_control === "selected_by_llm") {
      errors.push({
        code: "llm_toolset_requires_agent_node",
        message: `Edge ${edge.id ?? ""} has call_control selected_by_llm; LLM-selected toolset selection is agent node metadata (node_kind: agent), not edge metadata.`,
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
      const remoteNode = isRemoteAgentNode(fromNode) ? fromNode : isRemoteAgentNode(toNode) ? toNode : null;
      if (!remoteNode || typeof remoteNode.module_id !== "string" || !remoteNode.module_id.trim()) {
        warnings.push({
          code: "remote_link_incoherent",
          message: `Remote edge ${edge.id ?? ""} should connect to a remote agent node with module_id.`,
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

  for (const [routerId, defaults] of defaultRouteEdgesByRouter) {
    if (defaults.length > 1) {
      errors.push({
        code: "multiple_default_routes",
        message: `Router ${routerId} has multiple default route edges: ${defaults.join(", ")}.`,
        target_kind: "node",
        target_id: routerId
      });
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
    if (
      container.container_kind === "dynamic_workflow" &&
      typeof container.adk_mapping === "string" &&
      container.adk_mapping.trim()
    ) {
      errors.push({
        code: "dynamic_workflow_design_only",
        message: `dynamic_workflow ${container.id} is design-only and must not declare a runtime adk_mapping.`,
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
