export function toPythonIdentifier(value) {
  const identifier = String(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return /^[\p{L}_]/u.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

export function nodeSymbol(module) {
  return `${module.module_category === "agent" ? "agent_" : "node_"}${toPythonIdentifier(module.id)}`;
}

export function funcName(module) {
  return `_fn_${toPythonIdentifier(module.id)}`;
}

export function pyNodeName(module) {
  return toPythonIdentifier(module.name || module.id);
}

export function syntheticNodeSymbol(node) {
  const prefix = node.node_kind === "join" ? "join" : "node";
  return `${prefix}_${toPythonIdentifier(node.id)}`;
}

export function hitlFuncName(node) {
  return `_hitl_${toPythonIdentifier(node.id)}`;
}

export function routeFuncName(node) {
  return `_route_${toPythonIdentifier(node.id)}`;
}

export function pyGraphNodeName(node) {
  return toPythonIdentifier(node.id);
}

export function stateKey(module) {
  return `${toPythonIdentifier(module.id)}_output`;
}

export function nodeFunctionName(module) {
  return `node_${toPythonIdentifier(module.id)}`;
}

export function todoFunctionName(module) {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(module.id)}`;
}
