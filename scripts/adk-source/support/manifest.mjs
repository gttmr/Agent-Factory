import { DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "../context.mjs";
import { remoteA2aRuntimeRows } from "../remote-a2a.mjs";

export function buildManifest({
  outputMode,
  packageName,
  normalizedRequirement,
  analysisResult,
  connectedAdapters,
  unconnectedAdapters,
  scaffoldPlan,
  modules,
  processFlow,
  startNodeIds,
  terminalOutputIds,
  graphNodeSemantics,
  graphEdgeSemantics,
  mockBindingFromModule
}) {
  const guardrails =
    outputMode === "runnable"
      ? {
          raw_requirement_to_code: false,
          generated_business_logic: false,
          private_data_or_endpoints: false,
          runnable_synthetic_wiring: true
        }
      : {
          raw_requirement_to_code: false,
          generated_business_logic: false,
          private_data_or_endpoints: false
        };
  return {
    package: packageName,
    output_mode: outputMode,
    requirement: {
      id: normalizedRequirement.id,
      title: normalizedRequirement.title,
      status: normalizedRequirement.status
    },
    guardrails,
    runtime:
      outputMode === "runnable"
        ? {
            provider: "auto",
            default_model: DEFAULT_MODEL,
            llm_provider_env: "AF_LLM_PROVIDER",
            vllm: {
              api_base_env: "AF_VLLM_API_BASE",
              model_env: "AF_VLLM_MODEL",
              api_key_env: "AF_VLLM_API_KEY"
            },
            gemini: {
              api_key_env: "GOOGLE_API_KEY",
              fallback_model: GEMINI_FALLBACK_MODEL
            },
            remote_a2a: remoteA2aRuntimeRows({ analysisResult, modules }),
            connected_adapters: connectedAdapters.map((module) => ({
              module_id: module.id,
              module_name: module.name,
              runtime_mcp_label: RUNTIME_MCP_LABEL,
              runtime_mcp_note: RUNTIME_MCP_NOTE,
              mcp_server: module.mcp_server ?? null,
              mcp_tool_name: module.mcp_tool_name ?? null,
              invoke_binding: module.invoke_binding ?? null,
              decision_owner: module.decision_owner ?? null,
              call_control: module.call_control ?? null,
              mock_binding: mockBindingFromModule(module)
            })),
            unconnected_adapters: unconnectedAdapters.map((module) => ({
              module_id: module.id,
              module_name: module.name
            }))
          }
        : null,
    scaffold_plan: {
      source: scaffoldPlan.source,
      raw_requirement_to_code: scaffoldPlan.raw_requirement_to_code,
      output_mode: outputMode,
      approved_module_count: scaffoldPlan.modules.length,
      excluded_modules: scaffoldPlan.excluded_modules ?? []
    },
    catalog_bound_modules: scaffoldPlan.manifest?.catalog_bound_modules ?? [],
    new_code_required: scaffoldPlan.manifest?.new_code_required ?? [],
    runtime_contracts: scaffoldPlan.runtime_contracts ?? [],
    graph_ir: {
      start_nodes: startNodeIds(),
      terminal_outputs: terminalOutputIds(),
      node_count: Array.isArray(processFlow.nodes) ? processFlow.nodes.length : 0,
      edge_count: Array.isArray(processFlow.edges) ? processFlow.edges.length : 0,
      validation: processFlow.validation ?? null,
      nodes: graphNodeSemantics(),
      edges: graphEdgeSemantics()
    },
    edges: Array.isArray(processFlow.edges) ? processFlow.edges : [],
    excluded_modules: scaffoldPlan.excluded_modules ?? [],
    modules: scaffoldPlan.modules
  };
}
