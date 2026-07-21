import { routeValue } from "../graph/routes.mjs";

const LOOP_KINDS = new Set(["loop_back", "loop_exit"]);

export const EDGE_CONTROL_HANDLERS = Object.freeze({
  next: transitionHandler("next"),
  fan_out: transitionHandler("fan_out"),
  fan_in: transitionHandler("fan_in"),
  retry: unsupportedRunnableTransitionHandler("retry"),
  fallback: unsupportedRunnableTransitionHandler("fallback"),
  error: unsupportedRunnableTransitionHandler("error"),
  callback: unsupportedRunnableTransitionHandler("callback"),
  resume: unsupportedRunnableTransitionHandler("resume"),
  cancel: unsupportedRunnableTransitionHandler("cancel"),
  timeout: unsupportedRunnableTransitionHandler("timeout"),
  condition: Object.freeze({
    kind: "condition",
    featureFlags: Object.freeze(["routes"]),
    forcesDynamic: () => false,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode(staticConditionCapability, lowerCondition),
      dynamic: unsupportedEdgeMode("dynamic runnable mode has no conditional route lowerer")
    })
  }),
  loop_back: loopHandler("loop_back"),
  loop_exit: loopHandler("loop_exit")
});

function transitionHandler(kind, { forceDynamic = false } = {}) {
  return Object.freeze({
    kind,
    featureFlags: Object.freeze(["state_channels", "artifact_channels"]),
    forcesDynamic: () => forceDynamic,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: edgeMode(forceDynamic ? () => unsupported(`${kind} requires dynamic lowering`) : ordinaryCapability, lowerPair),
      dynamic: edgeMode(ordinaryCapability, lowerDynamicTransition)
    })
  });
}

function unsupportedRunnableTransitionHandler(kind) {
  const reason = `no ${kind} lowerer exists; runnable generation must not treat ${kind} as an ordinary transition`;
  return Object.freeze({
    kind,
    featureFlags: Object.freeze(["state_channels", "artifact_channels"]),
    forcesDynamic: () => false,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: unsupportedEdgeMode(reason),
      dynamic: unsupportedEdgeMode(reason)
    })
  });
}

function loopHandler(kind) {
  return Object.freeze({
    kind,
    featureFlags: Object.freeze(["loops"]),
    forcesDynamic: () => true,
    modes: Object.freeze({
      smoke: edgeMode(smokeCapability, lowerPair),
      static: unsupportedEdgeMode(`${kind} requires dynamic lowering`),
      dynamic: edgeMode(dynamicLoopCapability, lowerDynamicTransition)
    })
  });
}

function edgeMode(capability, lower) {
  return Object.freeze({ capability, lower });
}

function unsupportedEdgeMode(reason) {
  return edgeMode(() => unsupported(reason), null);
}

function smokeCapability({ edge }) {
  return channelCapability(edge);
}

function ordinaryCapability({ edge, fromNode, toNode }) {
  const channel = channelCapability(edge);
  if (!channel.supported) return channel;
  if (fromNode.node_kind === "output" || toNode.node_kind === "input") {
    return unsupported("edges cannot leave output nodes or target input nodes");
  }
  return supported();
}

function channelCapability() { return supported(); }

function staticConditionCapability({ edge, fromNode, toNode }) {
  if (fromNode.node_kind !== "function" || fromNode.role !== "route") {
    return unsupported("condition edges must originate from a Function node with role route");
  }
  if (!(typeof edge.control.condition === "string" && edge.control.condition.trim())) {
    return unsupported("condition edges require control.condition");
  }
  if (toNode.node_kind === "input" || fromNode.node_kind === "output") return unsupported("condition edge endpoints are invalid");
  return channelCapability(edge);
}

function dynamicLoopCapability({ edge, fromNode, toNode }) {
  if (!LOOP_KINDS.has(edge.control.kind)) return unsupported("loop control kind is invalid");
  if (fromNode.node_kind === "output" || toNode.node_kind === "input") return unsupported("loop edges have invalid endpoints");
  return channelCapability(edge);
}

function lowerPair({ edge, resolveEndpoint }) {
  return Object.freeze({
    kind: "pair",
    from: resolveEndpoint(edge.from, "from"),
    to: resolveEndpoint(edge.to, "to"),
    fanIn: edge.control.kind === "fan_in",
    consumedEdgeId: edge.key,
    edge
  });
}

function lowerCondition({ edge, resolveEndpoint }) {
  return Object.freeze({
    kind: "route",
    from: resolveEndpoint(edge.from, "from"),
    to: resolveEndpoint(edge.to, "to"),
    value: routeValue(edge),
    isDefault: edge.control.default === true,
    consumedEdgeId: edge.key,
    edge
  });
}

function lowerDynamicTransition({ edge }) {
  return Object.freeze({
    ...edge,
    dispatchRole: edge.control.kind,
    fanIn: edge.control.kind === "fan_in",
    consumedEdgeId: edge.key
  });
}

function supported() {
  return Object.freeze({ supported: true, reason: null });
}

function unsupported(reason) {
  return Object.freeze({ supported: false, reason });
}
