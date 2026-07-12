export const REGISTRY_PROJECTION_TEMPLATE = "remote_a2a_registry_projection_stub";

export function registryProjectionCompatibilityIssues(module, { outputMode = null } = {}) {
  const contract = module?.adk_skeleton_contract;
  if (contract?.implementation_template !== REGISTRY_PROJECTION_TEMPLATE) return [];

  const issues = [];
  if (outputMode !== null && outputMode !== "runnable") {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} requires runnable output_mode`);
  }
  if (module.module_category !== "adapter") {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} module category must be adapter`);
  }
  if (module.runtime_binding !== "local_function") {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} runtime_binding must be local_function`);
  }
  if (module.invoke_binding !== "local_function" && module.invoke_binding !== "local_python") {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} invoke_binding must be local_function or local_python`);
  }
  if (lowersThroughConnectedMcpAdapter(module)) {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} must lower through the stub-function path, not an MCP-connected adapter`);
  }
  if (contract.generation_mode !== undefined && contract.generation_mode !== "deterministic_template") {
    issues.push(`${REGISTRY_PROJECTION_TEMPLATE} generation_mode must be deterministic_template when present`);
  }
  return issues;
}

function lowersThroughConnectedMcpAdapter(module) {
  if (module?.module_category !== "adapter") return false;
  const hasServer = typeof module.mcp_server === "string" && module.mcp_server.trim().length > 0;
  const hasTool = typeof module.mcp_tool_name === "string" && module.mcp_tool_name.trim().length > 0;
  if (!hasServer || !hasTool) return false;
  const hasGraphInvocationSemantics = module.invoke_binding != null || module.call_control != null;
  if (hasGraphInvocationSemantics) {
    return (
      module.node_kind === "adapter_call" &&
      module.invoke_binding === "mcp_tool" &&
      module.call_control === "fixed_by_workflow"
    );
  }
  return (
    module.access_protocol === "mcp" ||
    module.runtime_binding === "mcp" ||
    module.runtime_binding === "mcp_tool" ||
    module.mock_binding?.status === "linked"
  );
}
