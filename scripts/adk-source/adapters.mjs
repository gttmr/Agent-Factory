import { graphIndexes } from "./graph/indexes.mjs";

export function adapterConnection(module) {
  if (module.module_category !== "adapter") return "n/a";
  if (!module.mcp_server || !module.mcp_tool_name) return "unconnected";
  const hasGraphInvocationSemantics = module.invoke_binding != null || module.call_control != null;
  if (hasGraphInvocationSemantics) {
    if (
      module.node_kind === "adapter_call" &&
      module.invoke_binding === "mcp_tool" &&
      module.call_control === "fixed_by_workflow"
    ) {
      return "mcp_connected";
    }
    return "unconnected";
  }
  const legacyBinding = module.runtime_binding === "mcp" || module.runtime_binding === "mcp_tool";
  const legacyMockLinked = module.mock_binding?.status === "linked";
  if (module.access_protocol === "mcp" || legacyBinding || legacyMockLinked) return "mcp_connected";
  return "unconnected";
}

export function agentOwnedToolsetAdapterIds(context) {
  return new Set(agentOwnedToolsetPairs(context).map(({ adapter }) => adapter.id));
}

export function agentOwnedToolsetAdapters(context, agentModule) {
  return agentOwnedToolsetPairs(context)
    .filter(({ agent }) => agent.id === agentModule.id)
    .map(({ adapter }) => adapter);
}

export function hasAgentOwnedToolsets(context) {
  return agentOwnedToolsetPairs(context).length > 0;
}

function agentOwnedToolsetPairs(context) {
  const graph = graphIndexes(context);
  const pairs = [];
  const seen = new Set();
  const edges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];

  for (const edge of edges) {
    const sourceNode = graph.nodesById.get(edge.from);
    const targetNode = graph.nodesById.get(edge.to);
    const agent = sourceNode?.module_id ? graph.moduleById.get(sourceNode.module_id) : null;
    const adapter = targetNode?.module_id ? graph.moduleById.get(targetNode.module_id) : null;
    if (!isLlmSelectedToolsetAgent(sourceNode, agent) || !isMockLabMcpAdapter(adapter)) continue;
    const key = `${agent.id}->${adapter.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ agent, adapter });
  }

  return pairs;
}

function isLlmSelectedToolsetAgent(node, module) {
  if (node?.node_kind !== "agent" || module?.module_category !== "agent") return false;
  return (
    (node.invoke_binding ?? module.invoke_binding) === "mcp_toolset" &&
    (node.decision_owner ?? module.decision_owner) === "llm" &&
    (node.call_control ?? module.call_control) === "selected_by_llm"
  );
}

function isMockLabMcpAdapter(module) {
  if (module?.module_category !== "adapter") return false;
  if (!module.mcp_server || !module.mcp_tool_name) return false;
  return module.mock_binding?.provider === "mock_lab" && module.mock_binding?.status === "linked";
}
