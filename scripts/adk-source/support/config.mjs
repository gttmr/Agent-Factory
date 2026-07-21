import { DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "../context.mjs";
import { pyNodeName } from "../naming.mjs";
import { toPyStr, toPythonLiteral, yamlScalar } from "../python-literals.mjs";
import { remoteA2aEnvVars } from "../remote-a2a.mjs";

export function buildAgentsConfig({ assets, agentNodeTargets = [], defaultAgentInstruction, toolConnection }) {
  const lines = [];
  lines.push("# agents.config.yaml — runnable ADK bundle의 노드별 override 파일입니다.");
  lines.push("# 한글 우선 instruction을 여기에서 검토/수정하세요. model / instruction / mcp_url 변경은");
  lines.push("# agent.py import 시점에 반영되므로 다음 실행부터 실제 동작이 바뀝니다.");
  lines.push("# 공유 secret은 이 bundle이 아니라 <repo>/.agent-factory/runtime.env에 둡니다.");
  lines.push(`default_model: ${DEFAULT_MODEL}`);
  lines.push("llm:");
  lines.push("  provider: auto  # auto: AF_VLLM_*가 있으면 vLLM, 없으면 Gemini fallback");
  lines.push(`  default_model: ${DEFAULT_MODEL}`);
  lines.push(`  gemini_model: ${GEMINI_FALLBACK_MODEL}`);
  lines.push("  api_base_env: AF_VLLM_API_BASE");
  lines.push("  model_env: AF_VLLM_MODEL");
  lines.push("  api_key_env: AF_VLLM_API_KEY");

  const agents = agentConfigEntries({ assets, agentNodeTargets });
  lines.push("agents:");
  if (!agents.length) lines.push("  []");
  for (const agent of agents) {
    lines.push(`  - id: ${agent.id}`);
    if (agent.assetRef) lines.push(`    asset_ref: ${agent.assetRef}`);
    lines.push(`    name: ${pyNodeName(agent.target)}`);
    lines.push(`    model: ${DEFAULT_MODEL}`);
    lines.push("    instruction: |");
    const instruction = defaultAgentInstruction(agent.target);
    for (const line of String(instruction).split("\n")) lines.push(`      ${line}`);
  }

  const tools = assets.filter((asset) => asset.asset_type === "tool");
  lines.push("tools:");
  if (!tools.length) lines.push("  []");
  for (const asset of tools) {
    const connected = toolConnection(asset) === "mcp_connected";
    lines.push(`  - asset_id: ${asset.asset_id}`);
    lines.push(`    connection: ${connected ? "mcp_connected" : "unconnected"}`);
    lines.push("    binding:");
    lines.push(`      kind: ${asset.binding?.kind ?? "unresolved"}`);
    lines.push(`      server_ref: ${asset.binding?.server_ref ?? "null"}`);
    lines.push(`      tool_name: ${asset.binding?.tool_name ?? "null"}`);
    if (connected) {
      lines.push(`    runtime_mcp_label: ${RUNTIME_MCP_LABEL}`);
      lines.push(`    runtime_mcp_note: ${RUNTIME_MCP_NOTE}`);
    }
    lines.push("    url: null  # 기본값: $AF_MOCK_LAB_MCP_URL/<server_ref>");
    if (connected) {
      lines.push("    input_map: {}  # 선택: {tool_input_name: state_or_upstream_output_key}");
    }
  }

  const workflows = assets.filter((asset) => asset.asset_type === "workflow");
  if (workflows.length) {
    lines.push("workflows:");
    for (const asset of workflows) {
      lines.push(`  - asset_id: ${asset.asset_id}`);
      lines.push("    note: 검토된 결정적 조정자 자리표시자입니다. 후속 작업에서 하위 그래프로 확장하세요.");
    }
  }
  return `${lines.join("\n")}\n`;
}

function agentConfigEntries({ assets, agentNodeTargets }) {
  const entries = assets.filter(isLocalAgent).map((asset) => ({
    id: asset.asset_id,
    assetRef: null,
    asset,
    target: asset
  }));
  for (const target of agentNodeTargets) {
    if (!isLocalAgent(target.asset) || target.node.id === target.asset.asset_id) continue;
    entries.push({
      id: target.node.id,
      assetRef: target.asset.asset_id,
      asset: target.asset,
      target
    });
  }
  return entries;
}

export function buildWorkflowPy() {
  return `"""ADK Workflow entrypoint shim.

The executable root_agent lives in agent.py so the ADK development UI can import the package.
This file gives developers a stable place to inspect workflow-level handoff
metadata without adding production business logic.
"""

from .agent import root_agent

__all__ = ["root_agent"]
`;
}

export function buildSchemasPy({ assets, toolConnection }) {
  return `"""Reviewed input/output schema names for the generated skeleton."""

ASSET_SCHEMAS = ${toPythonLiteral(
    Object.fromEntries(
      assets.map((asset) => [
        asset.asset_id,
        {
          inputs: asset.inputs ?? [],
          outputs: asset.outputs ?? [],
          binding: asset.binding ?? null,
          connection: asset.connection ?? null,
          tool_config: asset.asset_type === "tool" ? toolConfigFromAsset(asset, { toolConnection }) : null,
        },
      ])
    )
  )}
`;
}

export function buildNodeHelperPy(kind) {
  const note = {
    agents: "Agent node instructions are emitted in agent.py as LlmAgent declarations.",
    tools: "Tool stubs call the synthetic MCP provider only when the reviewed binding is connected; replace test doubles manually.",
    gates: "User confirmation gates are modeled with RequestInput nodes and reviewed condition edges.",
    human_inputs: "Human input nodes are RequestInput placeholders for ADK development UI smoke tests.",
    functions: "Reviewed Function nodes lower route and data-processing roles into ADK Workflow functions.",
  }[kind];
  return `"""${note}"""

DEVELOPER_NOTE = ${toPyStr(note)}
`;
}

export function buildSubworkflowsPy({ assets }) {
  const workflowAssets = assets.filter((asset) => asset.asset_type === "workflow");
  const rows = workflowAssets.map((asset) => ({
    asset_id: asset.asset_id,
    asset_name: asset.name,
    workflow_ref: asset.asset_id,
    developer_todos: asset.developer_todos ?? [],
  }));
  return `"""Subworkflow placeholders for reviewed Workflow asset calls.

These functions intentionally do not implement target workflow business logic.
Developers should replace the placeholder return with an import/call to the
reviewed target Workflow skeleton after confirming the contract.
"""

SUBWORKFLOWS = ${toPythonLiteral(rows)}


async def call_existing_workflow(ctx, input_data, workflow_ref):
    return {
        "status": "subworkflow_placeholder",
        "manual_completion_required": True,
        "target_workflow": workflow_ref,
        "input": input_data,
    }
`;
}

export function buildMockConfigYaml({ assets, toolConnection }) {
  const tools = assets.filter((asset) => asset.asset_type === "tool");
  const lines = ["provider: mock_lab", "package_path: packages/mock-lab", "tools:"];
  if (!tools.length) lines.push("  []");
  for (const asset of tools) {
    const binding = toolConfigFromAsset(asset, { toolConnection });
    lines.push(`  - asset_id: ${yamlScalar(asset.asset_id)}`);
    lines.push(`    asset_name: ${yamlScalar(asset.name)}`);
    lines.push(`    status: ${yamlScalar(binding.status)}`);
    lines.push(`    provider: ${yamlScalar(binding.provider)}`);
    lines.push(`    package_path: ${yamlScalar(binding.package_path)}`);
    lines.push(`    mock_server_id: ${yamlScalar(binding.mock_server_id)}`);
    lines.push(`    tool_name: ${yamlScalar(binding.tool_name)}`);
    lines.push(`    input_schema: ${yamlScalar(binding.input_schema)}`);
    lines.push(`    output_schema: ${yamlScalar(binding.output_schema)}`);
    lines.push(`    sample_response_ref: ${yamlScalar(binding.sample_response_ref)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildEnvExample({ analysisResult, assets }) {
  const remoteEnvLines = remoteA2aEnvVars({ analysisResult, assets }).map((envVar) => `# ${envVar}=...`);
  return `# Workbench 공유 runtime env template입니다.
# 이 파일을 <repo>/.agent-factory/runtime.env로 복사하거나 AF_RUNTIME_ENV_FILE을 지정하세요.
# AF_LLM_PROVIDER=auto 는 AF_VLLM_*가 있으면 vLLM, 없으면 Gemini fallback을 사용합니다.
#
AF_LLM_PROVIDER=auto
AF_VLLM_API_BASE=http://127.0.0.1:8000/v1
AF_VLLM_MODEL=hosted_vllm/local-model
# AF_VLLM_API_KEY=...
# GOOGLE_API_KEY=...
# PYTHONUTF8=1
# AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5173/api/mock-lab/mcp
${remoteEnvLines.length ? `\n# Remote A2A auth env vars\n${remoteEnvLines.join("\n")}\n` : ""}
`;
}

export function buildGitignore() {
  return `.env\n.venv/\n.adk/\n__pycache__/\n*.pyc\n`;
}

export function toolConfigFromAsset(asset, { toolConnection }) {
  const connection = toolConnection(asset);
  return {
    provider: "mock_lab",
    package_path: "packages/mock-lab",
    mock_server_id: asset.binding?.server_ref ?? null,
    tool_name: asset.binding?.tool_name ?? null,
    input_schema: null,
    output_schema: null,
    sample_response_ref: null,
    status: connection === "mcp_connected" ? "linked" : "missing",
  };
}

function isLocalAgent(asset) {
  return asset.asset_type === "agent" && asset.binding?.kind !== "a2a";
}
