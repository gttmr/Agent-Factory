import { DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "../context.mjs";
import { remoteA2aRuntimeRows } from "../remote-a2a.mjs";

export function buildManifest({
  outputMode,
  packageName,
  normalizedRequirement,
  analysisResult,
  connectedTools,
  unconnectedTools,
  scaffoldPlan,
  assets,
  graph,
  startNodeIds,
  terminalOutputIds,
  graphNodeSemantics,
  graphEdgeSemantics,
  toolConfigForAsset
}) {
  return {
    contract_version: "2.0",
    package: packageName,
    output_mode: outputMode,
    requirement: {
      id: normalizedRequirement.id,
      title: normalizedRequirement.title,
      status: normalizedRequirement.status
    },
    guardrails: {
      raw_requirement_to_code: false,
      generated_business_logic: false,
      private_data_or_endpoints: false,
      ...(outputMode === "runnable" ? { runnable_synthetic_wiring: true } : {})
    },
    runtime: outputMode === "runnable"
      ? {
          provider: "auto",
          default_model: DEFAULT_MODEL,
          llm_provider_env: "AF_LLM_PROVIDER",
          vllm: {
            api_base_env: "AF_VLLM_API_BASE",
            model_env: "AF_VLLM_MODEL",
            api_key_env: "AF_VLLM_API_KEY"
          },
          gemini: { api_key_env: "GOOGLE_API_KEY", fallback_model: GEMINI_FALLBACK_MODEL },
          a2a_agents: remoteA2aRuntimeRows({ analysisResult, assets }),
          connected_tools: connectedTools.map((asset) => ({
            asset_id: asset.asset_id,
            asset_name: asset.name,
            runtime_mcp_label: RUNTIME_MCP_LABEL,
            runtime_mcp_note: RUNTIME_MCP_NOTE,
            binding: asset.binding,
            connection: asset.connection,
            tool_config: toolConfigForAsset(asset)
          })),
          unconnected_tools: unconnectedTools.map((asset) => ({ asset_id: asset.asset_id, asset_name: asset.name }))
        }
      : null,
    scaffold_plan: {
      source: scaffoldPlan.source,
      raw_requirement_to_code: scaffoldPlan.raw_requirement_to_code,
      output_mode: outputMode,
      approved_asset_count: scaffoldPlan.assets.length,
      excluded_assets: scaffoldPlan.excluded_assets ?? []
    },
    catalog_bound_assets: scaffoldPlan.manifest?.catalog_bound_assets ?? [],
    new_code_required: scaffoldPlan.manifest?.new_code_required ?? [],
    runtime_contracts: scaffoldPlan.runtime_contracts ?? [],
    graph_ir: {
      graph_id: graph.graph_id,
      source_requirement_id: graph.source_requirement_id,
      workflow_ref: graph.workflow_ref,
      start_nodes: startNodeIds(),
      terminal_outputs: terminalOutputIds(),
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      nodes: graphNodeSemantics(),
      edges: graphEdgeSemantics(),
      regions: graph.regions
    },
    assets: scaffoldPlan.assets
  };
}
