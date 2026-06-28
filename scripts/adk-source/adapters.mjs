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
