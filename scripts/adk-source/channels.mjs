import { stateKey } from "./naming.mjs";
import { toPyStr } from "./python-literals.mjs";
import { adapterConnection } from "./adapters.mjs";
import { graphIndexes } from "./graph/indexes.mjs";

function edgeDataChannel(edge) {
  if (!edge) return null;
  const STATE_EDGE_SCOPE = {
    session_state: "",
    temp_state: "temp:",
    user_state: "user:",
    app_state: "app:"
  };
  const scopePrefix = STATE_EDGE_SCOPE[edge.edge_kind];
  if (scopePrefix !== undefined) {
    let key = typeof edge.state_key === "string" ? edge.state_key.trim() : "";
    if (!key) return null;
    key = key.replace(/^(?:temp:|user:|app:)/, "");
    return key ? { kind: "state", key: `${scopePrefix}${key}` } : null;
  }
  if (edge.edge_kind === "artifact") {
    const key = typeof edge.artifact_key === "string" ? edge.artifact_key.trim() : "";
    return key ? { kind: "artifact", key } : null;
  }
  return null;
}

function moduleDataChannels(context) {
  const graph = graphIndexes(context);
  const moduleIdOf = (nodeId) => {
    const node = graph.nodesById.get(nodeId);
    return node && typeof node.module_id === "string" && graph.moduleById.has(node.module_id)
      ? node.module_id
      : null;
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
  for (const edge of Array.isArray(context.processFlow.edges) ? context.processFlow.edges : []) {
    const channel = edgeDataChannel(edge);
    if (!channel) continue;
    const fromId = moduleIdOf(edge.from);
    const toId = moduleIdOf(edge.to);
    if (fromId) pushUnique(outgoing, fromId, channel);
    if (toId) pushUnique(incoming, toId, channel);
  }
  return { outgoing, incoming };
}

export function outgoingStateChannelKeys(context, moduleId) {
  return [
    ...new Set(
      (moduleDataChannels(context).outgoing.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

export function incomingStateChannelKeys(context, moduleId) {
  return [
    ...new Set(
      (moduleDataChannels(context).incoming.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

export function agentOutputStateKey(context, module) {
  const keys = outgoingStateChannelKeys(context, module.id);
  return keys.length === 1 ? keys[0] : stateKey(module);
}

export function emitOutgoingStateChannelWrites(context, moduleId, indent = "    ") {
  return outgoingStateChannelKeys(context, moduleId)
    .filter((key) => key !== stateKey({ id: moduleId }))
    .map((key) => `${indent}ctx.state[${toPyStr(key)}] = payload\n`)
    .join("");
}

function outgoingArtifactChannelKeys(context, moduleId) {
  return [
    ...new Set(
      (moduleDataChannels(context).outgoing.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "artifact")
        .map((channel) => channel.key)
    )
  ];
}

export function incomingArtifactChannelKeys(context, moduleId) {
  return [
    ...new Set(
      (moduleDataChannels(context).incoming.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "artifact")
        .map((channel) => channel.key)
    )
  ];
}

export function usesArtifactChannels(context) {
  return context.modules.some(
    (module) =>
      outgoingArtifactChannelKeys(context, module.id).length || incomingArtifactChannelKeys(context, module.id).length
  );
}

export function emitOutgoingArtifactChannelWrites(context, moduleId, indent = "    ") {
  return outgoingArtifactChannelKeys(context, moduleId)
    .map(
      (key) =>
        `${indent}await ctx.save_artifact(${toPyStr(key)}, types.Part(text=json.dumps(payload, ensure_ascii=False)))\n`
    )
    .join("");
}

export function emitIncomingArtifactLoad(context, moduleId, indent = "    ") {
  const keys = incomingArtifactChannelKeys(context, moduleId);
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
  for (const module of context.modules) {
    if (module.module_category === "agent") {
      const keys = outgoingStateChannelKeys(context, module.id);
      if (keys.length > 1) conflicts.push(`${module.id} (${keys.join(", ")})`);
      const artifactKeys = outgoingArtifactChannelKeys(context, module.id);
      if (artifactKeys.length) agentArtifacts.push(`${module.id} (${artifactKeys.join(", ")})`);
    }
    const incomingStateKeys = incomingStateChannelKeys(context, module.id);
    const incomingArtifactKeys = incomingArtifactChannelKeys(context, module.id);
    const connectedAdapter = adapterConnection(module) === "mcp_connected";
    if (incomingStateKeys.length && module.module_category !== "agent" && !connectedAdapter) {
      unsupportedStateConsumers.push(`${module.id} (${incomingStateKeys.join(", ")})`);
    }
    if (incomingArtifactKeys.length && !connectedAdapter) {
      unsupportedArtifactConsumers.push(`${module.id} (${incomingArtifactKeys.join(", ")})`);
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `runnable mode cannot lower an agent node with multiple distinct outgoing state channels (LlmAgent has a single output_key): ${conflicts.join("; ")}. Use one state_key per agent output, route extra fan-out through a function node, or use smoke mode.`
    );
  }
  if (agentArtifacts.length > 0) {
    throw new Error(
      `runnable mode cannot lower an artifact channel produced by an agent node (LlmAgent emits text, not artifacts): ${agentArtifacts.join("; ")}. Produce the artifact from a function/adapter node, or use a state channel.`
    );
  }
  if (unsupportedStateConsumers.length > 0) {
    throw new Error(
      `runnable mode cannot lower a state channel consumed by non-connected node: ${unsupportedStateConsumers.join("; ")}. Send state into an agent instruction or a connected MCP adapter, or add explicit reviewed runtime binding.`
    );
  }
  if (unsupportedArtifactConsumers.length > 0) {
    throw new Error(
      `runnable mode cannot lower an artifact channel consumed by non-connected node: ${unsupportedArtifactConsumers.join("; ")}. Artifact payload loading is only implemented for connected MCP adapters.`
    );
  }
  const producersByStateKey = new Map();
  for (const module of context.modules) {
    for (const key of outgoingStateChannelKeys(context, module.id)) {
      if (!producersByStateKey.has(key)) producersByStateKey.set(key, new Set());
      producersByStateKey.get(key).add(module.id);
    }
  }
  const collisions = [...producersByStateKey.entries()]
    .filter(([, producers]) => producers.size > 1)
    .map(([key, producers]) => `${key} <- ${[...producers].join(", ")}`);
  if (collisions.length > 0) {
    throw new Error(
      `runnable mode cannot lower a state channel written by multiple producers (writes collapse into one ctx.state slot): ${collisions.join("; ")}. Give each producer a distinct state_key, or merge upstream before the channel.`
    );
  }
}
