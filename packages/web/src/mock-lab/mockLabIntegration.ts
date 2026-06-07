import type { ScaffoldPlan, ScaffoldPlanModule } from "../analyzer/types";

export interface MockLabRouteInput {
  adapterName?: string | null;
  reqId?: string | null;
}

export interface MockLabBindingSelection {
  mcpServer: string;
  mcpToolName: string;
  mcpSchemaRef?: string | null;
}

export function buildMockLabRoute(input: MockLabRouteInput = {}): string {
  const params = new URLSearchParams();
  if (input.adapterName) params.set("adapter", input.adapterName);
  if (input.reqId) params.set("req", input.reqId);
  const query = params.toString();
  return query ? `/mock-lab?${query}` : "/mock-lab";
}

export function isMcpBoundAdapter(module: Pick<ScaffoldPlanModule, "module_category" | "access_protocol" | "mcp_server" | "mcp_tool_name">): boolean {
  return module.module_category === "adapter" && module.access_protocol === "mcp" && Boolean(module.mcp_server) && Boolean(module.mcp_tool_name);
}

export function applyMockLabBinding(
  plan: ScaffoldPlan,
  moduleId: string,
  selection: MockLabBindingSelection
): ScaffoldPlan {
  return {
    ...plan,
    modules: plan.modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            access_protocol: "mcp",
            mcp_server: selection.mcpServer,
            mcp_tool_name: selection.mcpToolName,
            mcp_schema_ref: selection.mcpSchemaRef ?? module.mcp_schema_ref ?? null,
            runtime_binding: "mcp"
          }
        : module
    )
  };
}
