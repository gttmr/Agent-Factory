import { stateKey } from "./naming.mjs";
import { toPyStr } from "./python-literals.mjs";
import { toolConnection } from "./tools.mjs";
import { graphIndexes, nodeAssetRef } from "./graph/indexes.mjs";

function edgeDataChannel(edge) {
  if (!edge) return null;
  if (edge.channel === "state" || edge.channel === "artifact") {
    const key = typeof edge.id === "string" ? edge.id.trim() : "";
    return key ? { kind: edge.channel, key } : null;
  }
  return null;
}

function assetDataChannels(context) {
  const graph = graphIndexes(context);
  const assetIdOf = (nodeId) => {
    const node = graph.nodesById.get(nodeId);
    const ref = nodeAssetRef(node);
    return ref && graph.assetById.has(ref) ? ref : null;
  };
  const outgoing = new Map();
  const incoming = new Map();
  const pushUnique = (map, id, channel) => {
    if (!map.has(id)) map.set(id, []);
    const list = map.get(id);
    if (!list.some((existing) => existing.kind === channel.kind && existing.key === channel.key)) {
      list.push(channel);
    }
  };
  for (const edge of Array.isArray(context.graph.edges) ? context.graph.edges : []) {
    const channel = edgeDataChannel(edge);
    if (!channel) continue;
    const fromId = assetIdOf(edge.from);
    const toId = assetIdOf(edge.to);
    if (fromId) pushUnique(outgoing, fromId, channel);
    if (toId) pushUnique(incoming, toId, channel);
  }
  return { outgoing, incoming };
}

export function outgoingStateChannelKeys(context, assetId) {
  return [
    ...new Set(
      (assetDataChannels(context).outgoing.get(assetId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

export function incomingStateChannelKeys(context, assetId) {
  return [
    ...new Set(
      (assetDataChannels(context).incoming.get(assetId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

export function agentOutputStateKey(context, asset) {
  const keys = outgoingStateChannelKeys(context, asset.asset_id);
  return keys.length === 1 ? keys[0] : stateKey(asset);
}

export function emitOutgoingStateChannelWrites(context, assetId, indent = "    ") {
  return outgoingStateChannelKeys(context, assetId)
    .filter((key) => key !== stateKey({ asset_id: assetId }))
    .map((key) => `${indent}ctx.state[${toPyStr(key)}] = payload\n`)
    .join("");
}

function outgoingArtifactChannelKeys(context, assetId) {
  return [
    ...new Set(
      (assetDataChannels(context).outgoing.get(assetId) ?? [])
        .filter((channel) => channel.kind === "artifact")
        .map((channel) => channel.key)
    )
  ];
}

export function incomingArtifactChannelKeys(context, assetId) {
  return [
    ...new Set(
      (assetDataChannels(context).incoming.get(assetId) ?? [])
        .filter((channel) => channel.kind === "artifact")
        .map((channel) => channel.key)
    )
  ];
}

export function usesArtifactChannels(context) {
  return context.assets.some(
    (asset) =>
      outgoingArtifactChannelKeys(context, asset.asset_id).length || incomingArtifactChannelKeys(context, asset.asset_id).length
  );
}

export function emitOutgoingArtifactChannelWrites(context, assetId, indent = "    ") {
  return outgoingArtifactChannelKeys(context, assetId)
    .map(
      (key) =>
        `${indent}await ctx.save_artifact(${toPyStr(key)}, types.Part(text=json.dumps(payload, ensure_ascii=False)))\n`
    )
    .join("");
}

export function emitIncomingArtifactLoad(context, assetId, indent = "    ") {
  const keys = incomingArtifactChannelKeys(context, assetId);
  if (!keys.length) return "";
  return `${indent}_artifact_payloads = []
${indent}for _artifact_key in ${JSON.stringify(keys)}:
${indent}    _loaded = await ctx.load_artifact(_artifact_key)
${indent}    _text = getattr(_loaded, "text", None) if _loaded is not None else None
${indent}    if _text:
${indent}        try:
${indent}            _value = json.loads(_text)
${indent}        except Exception:
${indent}            _value = None
${indent}        if isinstance(_value, dict):
${indent}            _artifact_payloads.append(_value)
`;
}

export function assertDataChannelsSupported(context) {
  const conflicts = [];
  const agentArtifacts = [];
  const unsupportedStateConsumers = [];
  const unsupportedArtifactConsumers = [];
  for (const asset of context.assets) {
    if (asset.asset_type === "agent") {
      const keys = outgoingStateChannelKeys(context, asset.asset_id);
      if (keys.length > 1) conflicts.push(`${asset.asset_id} (${keys.join(", ")})`);
      const artifactKeys = outgoingArtifactChannelKeys(context, asset.asset_id);
      if (artifactKeys.length) agentArtifacts.push(`${asset.asset_id} (${artifactKeys.join(", ")})`);
    }
    const incomingStateKeys = incomingStateChannelKeys(context, asset.asset_id);
    const incomingArtifactKeys = incomingArtifactChannelKeys(context, asset.asset_id);
    const connectedTool = toolConnection(asset) === "mcp_connected";
    if (incomingStateKeys.length && asset.asset_type !== "agent" && !connectedTool) {
      unsupportedStateConsumers.push(`${asset.asset_id} (${incomingStateKeys.join(", ")})`);
    }
    if (incomingArtifactKeys.length && !connectedTool) {
      unsupportedArtifactConsumers.push(`${asset.asset_id} (${incomingArtifactKeys.join(", ")})`);
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `runnable mode cannot lower an agent node with multiple distinct outgoing state channels (LlmAgent has a single output_key): ${conflicts.join("; ")}. Use one state channel per agent output, route extra fan-out through a function node, or use smoke mode.`
    );
  }
  if (agentArtifacts.length > 0) {
    throw new Error(
      `runnable mode cannot lower an artifact channel produced by an agent node (LlmAgent emits text, not artifacts): ${agentArtifacts.join("; ")}. Produce the artifact from a Function or Tool node, or use a state channel.`
    );
  }
  if (unsupportedStateConsumers.length > 0) {
    throw new Error(
      `runnable mode cannot lower a state channel consumed by non-connected node: ${unsupportedStateConsumers.join("; ")}. Send state into an Agent instruction or a connected MCP Tool, or add an explicit reviewed binding.`
    );
  }
  if (unsupportedArtifactConsumers.length > 0) {
    throw new Error(
      `runnable mode cannot lower an artifact channel consumed by non-connected node: ${unsupportedArtifactConsumers.join("; ")}. Artifact payload loading is only implemented for connected MCP Tools.`
    );
  }
  const producersByStateKey = new Map();
  for (const asset of context.assets) {
    for (const key of outgoingStateChannelKeys(context, asset.asset_id)) {
      if (!producersByStateKey.has(key)) producersByStateKey.set(key, new Set());
      producersByStateKey.get(key).add(asset.asset_id);
    }
  }
  const collisions = [...producersByStateKey.entries()]
    .filter(([, producers]) => producers.size > 1)
    .map(([key, producers]) => `${key} <- ${[...producers].join(", ")}`);
  if (collisions.length > 0) {
    throw new Error(
      `runnable mode cannot lower a state channel written by multiple producers (writes collapse into one ctx.state slot): ${collisions.join("; ")}. Give each producer a distinct channel edge, or merge upstream before the channel.`
    );
  }
}
