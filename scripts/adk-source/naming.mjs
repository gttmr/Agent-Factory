export function toPythonIdentifier(value) {
  const identifier = String(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return /^[\p{L}_]/u.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

export function nodeSymbol(module) {
  const resolvedModule = targetModule(module);
  return `${resolvedModule.module_category === "agent" ? "agent_" : "node_"}${targetIdentifier(module)}`;
}

export function funcName(module) {
  return `_fn_${targetIdentifier(module)}`;
}

export function pyNodeName(module) {
  const resolvedModule = targetModule(module);
  const name = toPythonIdentifier(resolvedModule.name || resolvedModule.id);
  const node = targetNode(module);
  return node && targetModuleNodeCount(module) > 1 ? `${name}__${pyGraphNodeName(node)}` : name;
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

export function terminalFuncName(node) {
  return `_terminal_${toPythonIdentifier(node.id)}`;
}

export function pyGraphNodeName(node) {
  return toPythonIdentifier(node.id);
}

export function stateKey(module) {
  return `${toPythonIdentifier(targetModule(module).id)}_output`;
}

export function nodeFunctionName(module) {
  return `node_${targetIdentifier(module)}`;
}

export function todoFunctionName(module) {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(targetModule(module).id)}`;
}

function targetModule(target) {
  return target?.module ?? target;
}

function targetNode(target) {
  return target?.node ?? null;
}

function targetModuleNodeCount(target) {
  return Number.isInteger(target?.moduleNodeCount) && target.moduleNodeCount > 0 ? target.moduleNodeCount : 1;
}

function targetIdentifier(target) {
  const module = targetModule(target);
  const base = toPythonIdentifier(module.id);
  const node = targetNode(target);
  if (!node || targetModuleNodeCount(target) <= 1) return base;
  return `${base}__${toPythonIdentifier(node.id)}`;
}
