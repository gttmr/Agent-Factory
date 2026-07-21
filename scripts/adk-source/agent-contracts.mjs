import { toolConnection } from "./tools.mjs";
import { RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "./context.mjs";

export function componentContracts(context) {
  const { outputMode, scaffoldPlan, toolConfigForAsset } = context;
  return Object.fromEntries(
    scaffoldPlan.assets.map((asset) => {
      const base = {
        asset_type: asset.asset_type,
        binding: asset.binding,
        connection: asset.connection,
        developer_todos: asset.developer_todos ?? [],
        inputs: asset.inputs ?? [],
        outputs: asset.outputs ?? [],
        risk_signals: asset.risk_signals ?? [],
        smoke_spec: asset.smoke_spec ?? null
      };
      if (outputMode !== "runnable") return [asset.asset_id, base];
      return [
        asset.asset_id,
        {
          ...base,
          workflow_profile: asset.workflow_profile,
          exposure: asset.exposure,
          tool_config: asset.asset_type === "tool" ? toolConfigForAsset(asset) : null,
          runtime_mcp_label: toolConnection(asset) === "mcp_connected" ? RUNTIME_MCP_LABEL : null,
          runtime_mcp_note: toolConnection(asset) === "mcp_connected" ? RUNTIME_MCP_NOTE : null,
          connection_status: toolConnection(asset)
        }
      ];
    })
  );
}
