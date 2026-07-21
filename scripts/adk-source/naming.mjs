export function toPythonIdentifier(value) {
  const identifier = String(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return /^[\p{L}_]/u.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

export function nodeSymbol(asset) {
  const resolvedAsset = targetAsset(asset);
  return `${resolvedAsset.asset_type === "agent" ? "agent_" : "node_"}${targetIdentifier(asset)}`;
}

export function funcName(asset) {
  return `_fn_${targetIdentifier(asset)}`;
}

export function pyNodeName(asset) {
  const resolvedAsset = targetAsset(asset);
  const name = toPythonIdentifier(resolvedAsset.name || resolvedAsset.asset_id);
  const node = targetNode(asset);
  return node && targetAssetNodeCount(asset) > 1 ? `${name}__${pyGraphNodeName(node)}` : name;
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

export function stateKey(asset) {
  return `${toPythonIdentifier(targetAsset(asset).asset_id)}_output`;
}

export function nodeFunctionName(asset) {
  return `node_${targetIdentifier(asset)}`;
}

export function todoFunctionName(asset) {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(targetAsset(asset).asset_id)}`;
}

function targetAsset(target) {
  return target?.asset ?? target;
}

function targetNode(target) {
  return target?.node ?? null;
}

function targetAssetNodeCount(target) {
  return Number.isInteger(target?.assetNodeCount) && target.assetNodeCount > 0 ? target.assetNodeCount : 1;
}

function targetIdentifier(target) {
  const asset = targetAsset(target);
  const base = toPythonIdentifier(asset.asset_id);
  const node = targetNode(target);
  if (!node || targetAssetNodeCount(target) <= 1) return base;
  return `${base}__${toPythonIdentifier(node.id)}`;
}
