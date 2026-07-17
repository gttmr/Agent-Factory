import { routeValue } from "../graph/routes.mjs";

const ORDINARY_EXECUTION_SEMANTICS = new Set(["normal_transition", "fan_out", "fan_in"]);
const LOOP_EXECUTION_SEMANTICS = new Set(["loop_back", "loop_exit"]);

export const EDGE_KIND_HANDLERS = Object.freeze({
  event_output: transitionHandler("event_output"),
  event_message: transitionHandler("event_message"),
  session_state: transitionHandler("session_state", {
    featureFlags: ["state_channels"],
    metadata: requiredText("state_key")
  }),
  temp_state: transitionHandler("temp_state", {
    featureFlags: ["state_channels"],
    metadata: requiredText("state_key")
  }),
  user_state: transitionHandler("user_state", {
    featureFlags: ["state_channels"],
    metadata: requiredText("state_key")
  }),
  app_state: transitionHandler("app_state", {
    featureFlags: ["state_channels"],
    metadata: requiredText("state_key")
  }),
  artifact: transitionHandler("artifact", {
    featureFlags: ["artifact_channels"],
    metadata: requiredText("artifact_key")
  }),
  route: Object.freeze({
    kind: "route",
    featureFlags: Object.freeze(["routes"]),
    forcesDynamic: dynamicShapeFromSemantics,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode(staticRouteCapability, lowerRoute),
      dynamic: unsupportedEdgeMode("dynamic runnable mode has no conditional route lowerer")
    })
  }),
  control: Object.freeze({
    kind: "control",
    featureFlags: Object.freeze(["loops"]),
    forcesDynamic: dynamicShapeFromSemantics,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode(staticOrdinaryCapability, lowerPair),
      dynamic: edgeMode(dynamicControlCapability, lowerDynamicControl)
    })
  }),
  remote_a2a: Object.freeze({
    kind: "remote_a2a",
    featureFlags: Object.freeze(["remote_a2a"]),
    forcesDynamic: dynamicShapeFromSemantics,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode(remoteCapability, lowerPair),
      dynamic: edgeMode(remoteCapability, lowerDynamicRemote)
    })
  })
});

function transitionHandler(kind, { featureFlags = [], metadata = () => null } = {}) {
  return Object.freeze({
    kind,
    featureFlags: Object.freeze(featureFlags),
    forcesDynamic: dynamicShapeFromSemantics,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode((context) => staticOrdinaryCapability(context, metadata), lowerPair),
      dynamic: edgeMode((context) => dynamicOrdinaryCapability(context, metadata), lowerDynamicTransition)
    })
  });
}

function edgeMode(capability, lower) {
  return Object.freeze({ capability, lower });
}

function unsupportedEdgeMode(reason) {
  return edgeMode(() => unsupported(reason), null);
}

function smokeCapability() {
  return supported();
}

function staticOrdinaryCapability(context, metadata = () => null) {
  const common = ordinaryCapability(context, metadata);
  if (!common.supported) return common;
  const { fromNode, toNode } = context;
  if (fromNode.node_kind === "output" || toNode.node_kind === "input") {
    return unsupported("static runnable edges cannot leave output nodes or target input nodes");
  }
  if (fromNode.node_kind === "input" && toNode.node_kind === "output") {
    return unsupported("static runnable mode does not lower a direct input-to-output edge");
  }
  return common;
}

function dynamicOrdinaryCapability(context, metadata = () => null) {
  const common = ordinaryCapability(context, metadata);
  if (!common.supported) return common;
  const { fromNode, toNode } = context;
  if (fromNode.node_kind === "output" || toNode.node_kind === "input") {
    return unsupported("dynamic runnable edges cannot leave output nodes or target input nodes");
  }
  return common;
}

function ordinaryCapability({ edge }, metadata) {
  if (!ORDINARY_EXECUTION_SEMANTICS.has(edge.execution_semantics)) {
    return unsupported(`execution semantics ${edge.execution_semantics} are not ordinary transition/fan-out/fan-in`);
  }
  if (edge.is_remote_boundary_crossing === true) {
    return unsupported("ordinary edges cannot claim a Remote A2A boundary crossing");
  }
  const metadataReason = metadata(edge);
  return metadataReason ? unsupported(metadataReason) : supported();
}

function staticRouteCapability({ edge, fromNode, toNode }) {
  if (fromNode.node_kind !== "router") return unsupported("route edges must originate from a router node");
  if (typeof edge.route_condition !== "string" || !edge.route_condition.trim()) {
    return unsupported("route edges require a non-empty route_condition");
  }
  if (edge.execution_semantics !== "conditional") {
    return unsupported("route edges require conditional execution semantics");
  }
  if (toNode.node_kind === "input" || toNode.node_kind === "output" || fromNode.node_kind === "output") {
    return unsupported("route edge endpoints are not lowerable by the static runnable graph");
  }
  return supported();
}

function dynamicControlCapability({ edge, fromNode, toNode }) {
  if (!LOOP_EXECUTION_SEMANTICS.has(edge.execution_semantics)) {
    return unsupported("dynamic control edges require loop_back or loop_exit execution semantics");
  }
  if (fromNode.node_kind !== "loop_control") {
    return unsupported("dynamic loop control edges must originate from loop_control");
  }
  if (toNode.node_kind === "input") {
    return unsupported(
      `${edge.execution_semantics} from loop_control ${fromNode.id} cannot target input seed ${toNode.id}; input seeds keep the original node_input and emit no runtime step, so target a reviewed executable body or exit step instead`
    );
  }
  if (edge.execution_semantics === "loop_back" && toNode.node_kind === "join") {
    return unsupported(
      `loop_back from loop_control ${fromNode.id} cannot target explicit join ${toNode.id}; the loop must re-enter a decision-consuming body step, or replace explicit join ${toNode.id} with a reviewed body step`
    );
  }
  return supported();
}

function remoteCapability({ edge, fromNode, toNode }) {
  if (!isRemoteAgentGraphNode(fromNode) && !isRemoteAgentGraphNode(toNode)) {
    return unsupported("remote_a2a edges must touch a remote agent node");
  }
  if (edge.execution_semantics !== "boundary_crossing" || edge.is_remote_boundary_crossing !== true) {
    return unsupported("remote_a2a edges require a reviewed boundary_crossing");
  }
  if (typeof edge.a2a_contract_id !== "string" || !edge.a2a_contract_id.trim()) {
    return unsupported("remote_a2a edges require a2a_contract_id");
  }
  if (fromNode.node_kind === "output" || toNode.node_kind === "input") {
    return unsupported("remote_a2a edges cannot leave output nodes or target input nodes");
  }
  if (fromNode.node_kind === "input" && toNode.node_kind === "output") {
    return unsupported("remote_a2a edges cannot directly connect input to output");
  }
  return supported();
}

function lowerPair({ edge, resolveEndpoint }) {
  return Object.freeze({
    kind: "pair",
    from: resolveEndpoint(edge.from, "from"),
    to: resolveEndpoint(edge.to, "to"),
    fanIn: edge.execution_semantics === "fan_in" || edge.flow_kind === "fan_in",
    consumedEdgeId: edge.key,
    edge
  });
}

function lowerRoute({ edge, resolveEndpoint }) {
  return Object.freeze({
    kind: "route",
    from: resolveEndpoint(edge.from, "from"),
    to: resolveEndpoint(edge.to, "to"),
    value: routeValue(edge),
    isDefault: edge.is_default_route === true,
    consumedEdgeId: edge.key,
    edge
  });
}

function lowerDynamicTransition({ edge }) {
  return dynamicRecord(edge, "transition");
}

function lowerDynamicRemote({ edge }) {
  return dynamicRecord(edge, "remote");
}

function lowerDynamicControl({ edge }) {
  return dynamicRecord(edge, edge.execution_semantics);
}

function dynamicRecord(edge, dispatchRole) {
  return Object.freeze({
    ...edge,
    dispatchRole,
    fanIn: edge.execution_semantics === "fan_in" || edge.flow_kind === "fan_in",
    consumedEdgeId: edge.key
  });
}

function requiredText(field) {
  return (edge) => {
    const value = edge[field];
    return typeof value === "string" && value.trim() ? null : `${edge.edge_kind} edges require non-empty ${field}`;
  };
}

function dynamicShapeFromSemantics(edge) {
  return LOOP_EXECUTION_SEMANTICS.has(edge?.execution_semantics);
}

function supported() {
  return Object.freeze({ supported: true, reason: null });
}

function unsupported(reason) {
  return Object.freeze({ supported: false, reason });
}

function isRemoteAgentGraphNode(node) {
  return node?.node_kind === "remote_a2a" || node?.node_kind === "remote_agent_call";
}
