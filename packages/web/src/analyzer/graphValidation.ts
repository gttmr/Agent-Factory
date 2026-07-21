import {
  functionRoles,
  graphChannels,
  graphControlKinds,
  graphNodeKinds,
  graphRegionKinds,
  type GraphValidation,
  type GraphValidationIssue
} from "./types";

const NODE_KINDS = new Set<string>(graphNodeKinds);
const CONTROL_KINDS = new Set<string>(graphControlKinds);
const CHANNELS = new Set<string>(graphChannels);
const REGION_KINDS = new Set<string>(graphRegionKinds);
const FUNCTION_ROLES = new Set<string>(functionRoles);

export function validateGraphIR(input: unknown): GraphValidation {
  const errors: GraphValidationIssue[] = [];
  const warnings: GraphValidationIssue[] = [];
  if (!isRecord(input)) return result([issue("invalid_graph", "Graph must be an object.", "graph", null)], warnings);
  exactKeys(input, ["graph_id", "source_requirement_id", "workflow_ref", "nodes", "edges", "regions"], "graph", errors);
  requiredString(input.graph_id, "graph.graph_id", errors, "graph", null);
  requiredString(input.source_requirement_id, "graph.source_requirement_id", errors, "graph", null);
  nullableString(input.workflow_ref, "graph.workflow_ref", errors, "graph", null);

  const nodeIds = new Set<string>();
  if (!Array.isArray(input.nodes)) errors.push(issue("invalid_nodes", "graph.nodes must be an array.", "graph", null));
  else input.nodes.forEach((node, index) => validateNode(node, index, nodeIds, errors));

  const edgeIds = new Set<string>();
  if (!Array.isArray(input.edges)) errors.push(issue("invalid_edges", "graph.edges must be an array.", "graph", null));
  else input.edges.forEach((edge, index) => validateEdge(edge, index, nodeIds, edgeIds, errors));

  const regionIds = new Set<string>();
  if (!Array.isArray(input.regions)) errors.push(issue("invalid_regions", "graph.regions must be an array.", "graph", null));
  else {
    input.regions.forEach((region, index) => validateRegion(region, index, nodeIds, regionIds, errors));
    input.regions.forEach((region, index) => {
      if (isRecord(region) && typeof region.parent_region_id === "string" && !regionIds.has(region.parent_region_id)) {
        errors.push(issue("dangling_parent_region", `graph.regions[${index}].parent_region_id is dangling.`, "region", stringOrNull(region.id)));
      }
    });
    validateRegionHierarchy(input.regions, errors);
  }
  return result(errors, warnings);
}

function validateNode(value: unknown, index: number, ids: Set<string>, errors: GraphValidationIssue[]) {
  const path = `graph.nodes[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue("invalid_node", `${path} must be an object.`, "node", null));
    return;
  }
  const kind = value.node_kind;
  const common = ["id", "label", "node_kind"];
  const extra = kind === "agent" ? ["agent_ref", "available_tools"]
    : kind === "tool" ? ["tool_ref", "invocation_control"]
      : kind === "function" ? ["role"]
        : kind === "human_input" ? ["human_input_contract"]
          : kind === "subworkflow" ? ["workflow_ref"] : [];
  exactKeys(value, [...common, ...extra], path, errors, "node", stringOrNull(value.id));
  requiredString(value.id, `${path}.id`, errors, "node", stringOrNull(value.id));
  requiredString(value.label, `${path}.label`, errors, "node", stringOrNull(value.id));
  if (typeof kind !== "string" || !NODE_KINDS.has(kind)) errors.push(issue("invalid_node_kind", `${path}.node_kind is invalid.`, "node", stringOrNull(value.id)));
  if (typeof value.id === "string") {
    if (ids.has(value.id)) errors.push(issue("duplicate_node_id", `Duplicate node id ${value.id}.`, "node", value.id));
    ids.add(value.id);
  }
  if (kind === "agent") {
    requiredString(value.agent_ref, `${path}.agent_ref`, errors, "node", stringOrNull(value.id));
    if (!Array.isArray(value.available_tools)) errors.push(issue("invalid_available_tools", `${path}.available_tools must be an array.`, "node", stringOrNull(value.id)));
    else value.available_tools.forEach((entry, toolIndex) => {
      if (!isRecord(entry)) errors.push(issue("invalid_available_tool", `${path}.available_tools[${toolIndex}] must be an object.`, "node", stringOrNull(value.id)));
      else {
        exactKeys(entry, ["tool_ref", "invocation_control"], `${path}.available_tools[${toolIndex}]`, errors, "node", stringOrNull(value.id));
        requiredString(entry.tool_ref, `${path}.available_tools[${toolIndex}].tool_ref`, errors, "node", stringOrNull(value.id));
        if (entry.invocation_control !== "agent") errors.push(issue("invalid_invocation_control", `${path}.available_tools[${toolIndex}].invocation_control must be agent.`, "node", stringOrNull(value.id)));
      }
    });
  } else if (kind === "tool") {
    requiredString(value.tool_ref, `${path}.tool_ref`, errors, "node", stringOrNull(value.id));
    if (value.invocation_control !== "workflow") errors.push(issue("invalid_invocation_control", `${path}.invocation_control must be workflow.`, "node", stringOrNull(value.id)));
  } else if (kind === "function" && (typeof value.role !== "string" || !FUNCTION_ROLES.has(value.role))) {
    errors.push(issue("invalid_function_role", `${path}.role is invalid.`, "node", stringOrNull(value.id)));
  } else if (kind === "subworkflow") {
    requiredString(value.workflow_ref, `${path}.workflow_ref`, errors, "node", stringOrNull(value.id));
  } else if (kind === "human_input") {
    validateHumanInputContract(value.human_input_contract, `${path}.human_input_contract`, stringOrNull(value.id), errors);
  }
}

function validateHumanInputContract(
  value: unknown,
  path: string,
  nodeId: string | null,
  errors: GraphValidationIssue[]
) {
  if (!isRecord(value)) {
    errors.push(issue("invalid_human_input_contract", `${path} must be an object.`, "node", nodeId));
    return;
  }
  const keys = [
    "message",
    "payload_schema_ref",
    "response_schema_ref",
    "response_mapping",
    "choice_options",
    "accepted_aliases",
    "default_choice"
  ] as const;
  exactKeys(value, keys, path, errors, "node", nodeId, ["message", "payload_schema_ref", "response_schema_ref", "response_mapping"]);
  requiredString(value.message, `${path}.message`, errors, "node", nodeId);
  for (const key of ["payload_schema_ref", "response_schema_ref", "default_choice"] as const) {
    if (value[key] !== undefined && value[key] !== null && (typeof value[key] !== "string" || !value[key].trim())) {
      errors.push(issue("invalid_human_input_contract", `${path}.${key} must be a non-empty string or null.`, "node", nodeId));
    }
  }
  if (value.response_mapping !== null && !isStringRecord(value.response_mapping)) {
    errors.push(issue("invalid_human_input_contract", `${path}.response_mapping must be a string map or null.`, "node", nodeId));
  }
  if (value.choice_options !== undefined && value.choice_options !== null && !isNonEmptyStringArray(value.choice_options)) {
    errors.push(issue("invalid_human_input_contract", `${path}.choice_options must be a string array or null.`, "node", nodeId));
  }
  if (value.accepted_aliases !== undefined && value.accepted_aliases !== null) {
    if (!isRecord(value.accepted_aliases) || Object.values(value.accepted_aliases).some((aliases) => !isNonEmptyStringArray(aliases))) {
      errors.push(issue("invalid_human_input_contract", `${path}.accepted_aliases must map choices to string arrays or be null.`, "node", nodeId));
    }
  }
}

function validateEdge(value: unknown, index: number, nodeIds: ReadonlySet<string>, ids: Set<string>, errors: GraphValidationIssue[]) {
  const path = `graph.edges[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue("invalid_edge", `${path} must be an object.`, "edge", null));
    return;
  }
  exactKeys(value, ["id", "from", "to", "control", "channel"], path, errors, "edge", stringOrNull(value.id));
  for (const key of ["id", "from", "to"] as const) requiredString(value[key], `${path}.${key}`, errors, "edge", stringOrNull(value.id));
  if (typeof value.id === "string") {
    if (ids.has(value.id)) errors.push(issue("duplicate_edge_id", `Duplicate edge id ${value.id}.`, "edge", value.id));
    ids.add(value.id);
  }
  if (typeof value.from === "string" && !nodeIds.has(value.from)) errors.push(issue("dangling_edge_from", `${path}.from is dangling.`, "edge", stringOrNull(value.id)));
  if (typeof value.to === "string" && !nodeIds.has(value.to)) errors.push(issue("dangling_edge_to", `${path}.to is dangling.`, "edge", stringOrNull(value.id)));
  if (!isRecord(value.control)) errors.push(issue("invalid_control", `${path}.control must be an object.`, "edge", stringOrNull(value.id)));
  else {
    exactKeys(value.control, ["kind", "condition", "accepted_aliases", "default"], `${path}.control`, errors, "edge", stringOrNull(value.id));
    if (typeof value.control.kind !== "string" || !CONTROL_KINDS.has(value.control.kind)) errors.push(issue("invalid_control_kind", `${path}.control.kind is invalid.`, "edge", stringOrNull(value.id)));
    if (value.control.condition !== null && (typeof value.control.condition !== "string" || !value.control.condition.trim())) errors.push(issue("invalid_condition", `${path}.control.condition must be a non-empty string or null.`, "edge", stringOrNull(value.id)));
    if (!Array.isArray(value.control.accepted_aliases) || value.control.accepted_aliases.some((alias) => typeof alias !== "string" || !alias.trim())) errors.push(issue("invalid_accepted_aliases", `${path}.control.accepted_aliases must be a string array.`, "edge", stringOrNull(value.id)));
    if (typeof value.control.default !== "boolean") errors.push(issue("invalid_default", `${path}.control.default must be boolean.`, "edge", stringOrNull(value.id)));
  }
  if (value.channel !== null && (typeof value.channel !== "string" || !CHANNELS.has(value.channel))) errors.push(issue("invalid_channel", `${path}.channel is invalid.`, "edge", stringOrNull(value.id)));
}

function validateRegion(value: unknown, index: number, nodeIds: ReadonlySet<string>, ids: Set<string>, errors: GraphValidationIssue[]) {
  const path = `graph.regions[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue("invalid_region", `${path} must be an object.`, "region", null));
    return;
  }
  exactKeys(value, ["id", "kind", "node_ids", "entry_node_ids", "exit_node_ids", "parent_region_id"], path, errors, "region", stringOrNull(value.id));
  requiredString(value.id, `${path}.id`, errors, "region", stringOrNull(value.id));
  if (typeof value.kind !== "string" || !REGION_KINDS.has(value.kind)) errors.push(issue("invalid_region_kind", `${path}.kind is invalid.`, "region", stringOrNull(value.id)));
  for (const key of ["node_ids", "entry_node_ids", "exit_node_ids"] as const) {
    if (!Array.isArray(value[key]) || value[key].some((id) => typeof id !== "string" || !nodeIds.has(id))) errors.push(issue("invalid_region_nodes", `${path}.${key} contains an invalid Node reference.`, "region", stringOrNull(value.id)));
  }
  if (Array.isArray(value.node_ids)) {
    const members = new Set(value.node_ids.filter((id): id is string => typeof id === "string"));
    for (const key of ["entry_node_ids", "exit_node_ids"] as const) {
      if (Array.isArray(value[key]) && value[key].some((id) => typeof id === "string" && !members.has(id))) {
        errors.push(issue("invalid_region_membership", `${path}.${key} must contain only Region member Nodes.`, "region", stringOrNull(value.id)));
      }
    }
  }
  if (value.parent_region_id !== null && (typeof value.parent_region_id !== "string" || !value.parent_region_id.trim())) errors.push(issue("invalid_parent_region", `${path}.parent_region_id must be a string or null.`, "region", stringOrNull(value.id)));
  if (typeof value.id === "string") {
    if (ids.has(value.id)) errors.push(issue("duplicate_region_id", `Duplicate region id ${value.id}.`, "region", value.id));
    ids.add(value.id);
  }
}

function validateRegionHierarchy(values: unknown[], errors: GraphValidationIssue[]) {
  const parentById = new Map<string, string | null>();
  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== "string") continue;
    parentById.set(value.id, typeof value.parent_region_id === "string" ? value.parent_region_id : null);
  }
  for (const [regionId, initialParent] of parentById) {
    const visited = new Set([regionId]);
    let parent = initialParent;
    while (parent !== null && parentById.has(parent)) {
      if (visited.has(parent)) {
        errors.push(issue("cyclic_parent_region", `Region ${regionId} has a cyclic parent_region_id chain.`, "region", regionId));
        break;
      }
      visited.add(parent);
      parent = parentById.get(parent) ?? null;
    }
  }
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: GraphValidationIssue[],
  targetKind: GraphValidationIssue["target_kind"] = "graph",
  targetId: string | null = null,
  required: readonly string[] = allowed
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) errors.push(issue("unknown_field", `${path}.${key} is not allowed.`, targetKind, targetId));
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(issue("missing_field", `${path}.${key} is required.`, targetKind, targetId));
}

function requiredString(value: unknown, path: string, errors: GraphValidationIssue[], targetKind: GraphValidationIssue["target_kind"], targetId: string | null) {
  if (typeof value !== "string" || !value.trim()) errors.push(issue("invalid_string", `${path} must be a non-empty string.`, targetKind, targetId));
}

function nullableString(value: unknown, path: string, errors: GraphValidationIssue[], targetKind: GraphValidationIssue["target_kind"], targetId: string | null) {
  if (value !== null && (typeof value !== "string" || !value.trim())) {
    errors.push(issue("invalid_string", `${path} must be a non-empty string or null.`, targetKind, targetId));
  }
}

function issue(code: string, message: string, target_kind: GraphValidationIssue["target_kind"], target_id: string | null): GraphValidationIssue {
  return { code, message, target_kind, target_id };
}

function result(errors: GraphValidationIssue[], warnings: GraphValidationIssue[]): GraphValidation {
  return { ok: errors.length === 0, errors, warnings };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
