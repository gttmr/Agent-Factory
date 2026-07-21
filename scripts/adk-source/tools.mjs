import { graphIndexes, nodeAssetRef } from "./graph/indexes.mjs";

export function toolConnection(asset) {
  if (asset.asset_type !== "tool") return "n/a";
  if (asset.binding?.kind !== "mcp") return "unconnected";
  if (!asset.binding.server_ref || !asset.binding.tool_name) return "unconnected";
  return "mcp_connected";
}

export function agentOwnedToolIds(context) {
  return new Set(agentOwnedToolPairs(context).map(({ tool }) => tool.asset_id));
}

export function agentOwnedTools(context, agentAsset) {
  return agentOwnedToolPairs(context)
    .filter(({ agent }) => agent.asset_id === agentAsset.asset_id)
    .map(({ tool }) => tool);
}

export function hasAgentOwnedTools(context) {
  return agentOwnedToolPairs(context).length > 0;
}

function agentOwnedToolPairs(context) {
  const graph = graphIndexes(context);
  const pairs = [];
  const seen = new Set();
  for (const node of graph.nodes) {
    if (node.node_kind !== "agent") continue;
    const agent = graph.assetById.get(nodeAssetRef(node));
    if (agent?.asset_type !== "agent") continue;
    for (const available of node.available_tools ?? []) {
      if (available?.invocation_control !== "agent") continue;
      const tool = graph.assetById.get(available.tool_ref);
      if (!isMcpTool(tool)) continue;
      const key = `${agent.asset_id}->${tool.asset_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ agent, tool });
    }
  }
  return pairs;
}

function isMcpTool(asset) {
  return (
    asset?.asset_type === "tool" &&
    asset.binding?.kind === "mcp" &&
    asset.binding.server_ref &&
    asset.binding.tool_name
  );
}
