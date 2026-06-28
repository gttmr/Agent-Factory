import { adapterConnection } from "./adapters.mjs";
import { RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "./context.mjs";

export function componentContracts(context) {
  const { outputMode, scaffoldPlan, mockBindingFromModule } = context;
  return Object.fromEntries(
    scaffoldPlan.modules.map((module) => {
      const base = {
        catalog_binding: module.catalog_binding ?? null,
        developer_todos: module.developer_todos,
        inputs: module.inputs,
        outputs: module.outputs,
        risk_signals: module.risk_signals,
        runtime_mock: module.runtime_mock ?? null,
        smoke_spec: module.smoke_spec ?? null
      };
      if (outputMode !== "runnable") return [module.id, base];
      return [
        module.id,
        {
          module_category: module.module_category,
          ...base,
          instruction: module.instruction ?? null,
          model: module.model ?? null,
          access_protocol: module.access_protocol ?? null,
          mcp_server: module.mcp_server ?? null,
          mcp_tool_name: module.mcp_tool_name ?? null,
          invoke_binding: module.invoke_binding ?? null,
          decision_owner: module.decision_owner ?? null,
          call_control: module.call_control ?? null,
          side_effect: module.side_effect ?? null,
          policy: module.policy ?? null,
          workflow_ref: module.workflow_ref ?? null,
          input_mapping: module.input_mapping ?? null,
          output_mapping: module.output_mapping ?? null,
          mock_binding: mockBindingFromModule(module),
          adk_skeleton_contract: module.adk_skeleton_contract ?? null,
          runtime_mcp_label: adapterConnection(module) === "mcp_connected" ? RUNTIME_MCP_LABEL : null,
          runtime_mcp_note: adapterConnection(module) === "mcp_connected" ? RUNTIME_MCP_NOTE : null,
          connection_status: adapterConnection(module)
        }
      ];
    })
  );
}
