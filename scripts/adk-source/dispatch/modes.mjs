import { nodeFunctionName } from "../naming.mjs";

export const GENERATION_MODES = Object.freeze(["smoke", "static", "dynamic"]);

export function nodeCapabilityForMode(handler, context) {
  const capability = handler.modes?.[context.mode];
  if (typeof capability !== "function") {
    return Object.freeze({ supported: false, reason: `${context.mode} mode has no registered node capability`, code: "missing_mode" });
  }
  const result = capability(context);
  if (result?.supported === true) return result;
  return Object.freeze({
    supported: false,
    reason: result?.reason || `${context.mode} mode does not support this node kind`,
    code: result?.code || "unsupported_mode"
  });
}

export function resolveNodeEndpointForMode(handler, context) {
  return handler.resolveEndpoint?.(context) ?? null;
}

export function runtimeNodeNameForMode(handler, context) {
  const name = handler.runtimeName?.(context);
  return typeof name === "string" && name ? name : null;
}

export function edgeCapabilityForMode(handler, context) {
  const modeHandler = handler.modes?.[context.mode];
  if (!modeHandler || typeof modeHandler.capability !== "function") {
    return Object.freeze({ supported: false, reason: `${context.mode} mode has no registered edge capability` });
  }
  const result = modeHandler.capability(context);
  return result?.supported === true
    ? result
    : Object.freeze({ supported: false, reason: result?.reason || `${context.mode} mode does not support this edge kind` });
}

export function lowerEdgeForMode(handler, context) {
  const modeHandler = handler.modes?.[context.mode];
  const capability = edgeCapabilityForMode(handler, context);
  if (!capability.supported) return { capability, record: null };
  if (typeof modeHandler.lower !== "function") {
    return {
      capability: Object.freeze({ supported: false, reason: `${context.mode} mode has no lowering callback for accepted edge kind` }),
      record: null
    };
  }
  return { capability, record: modeHandler.lower(context) };
}

export function assembleSmokeGraphWorkflowEdges(context, collection, lowerEdge) {
  const rows = [];
  const seen = new Set();
  const push = (from, to) => {
    if (!from || !to || from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push([from, to]);
  };

  const edges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];
  for (const [index, edge] of edges.entries()) {
    const record = lowerEdge(edge, index);
    push(record.from, record.to);
  }

  const incoming = new Set(rows.map(([, to]) => to));
  const outgoing = new Set(rows.map(([from]) => from));
  for (const spec of collection.moduleSpecsInDeclarationOrder) {
    const fn = nodeFunctionName(spec);
    if (!incoming.has(fn)) push("START", fn);
    if (!outgoing.has(fn)) push(fn, "emit_workflow_result");
  }

  if (rows.length === 0) {
    throw new Error("processFlow does not provide any usable Graph IR edges for runtime stub generation.");
  }
  return rows;
}
