import { DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "../context.mjs";
import { pyNodeName } from "../naming.mjs";
import { toPyStr, toPythonLiteral, yamlScalar } from "../python-literals.mjs";
import { remoteA2aEnvVars } from "../remote-a2a.mjs";

export function buildAgentsConfig({ modules, agentNodeTargets = [], defaultAgentInstruction, adapterConnection }) {
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

  const agents = agentConfigEntries({ modules, agentNodeTargets });
  lines.push("agents:");
  if (!agents.length) lines.push("  []");
  for (const agent of agents) {
    lines.push(`  - id: ${agent.id}`);
    if (agent.moduleId) lines.push(`    module_id: ${agent.moduleId}`);
    lines.push(`    name: ${pyNodeName(agent.target)}`);
    lines.push(`    model: ${agent.module.model || DEFAULT_MODEL}`);
    lines.push("    instruction: |");
    const instruction = defaultAgentInstruction(agent.target);
    for (const line of String(instruction).split("\n")) lines.push(`      ${line}`);
  }

  const adapters = modules.filter((module) => module.module_category === "adapter");
  lines.push("adapters:");
  if (!adapters.length) lines.push("  []");
  for (const module of adapters) {
    const connected = adapterConnection(module) === "mcp_connected";
    lines.push(`  - id: ${module.id}`);
    lines.push(`    connection: ${connected ? "mcp_connected" : "unconnected"}`);
    lines.push(`    mcp_server: ${module.mcp_server ? module.mcp_server : "null"}`);
    lines.push(`    mcp_tool: ${module.mcp_tool_name ? module.mcp_tool_name : "null"}`);
    if (connected) {
      lines.push(`    runtime_mcp_label: ${RUNTIME_MCP_LABEL}`);
      lines.push(`    runtime_mcp_note: ${RUNTIME_MCP_NOTE}`);
    }
    lines.push("    mcp_url: null  # 기본값: $AF_MOCK_LAB_MCP_URL/<mcp_server>");
    if (connected) {
      lines.push("    input_map: {}  # 선택: {tool_input_name: state_or_upstream_output_key}");
    }
  }

  const workflows = modules.filter((module) => module.module_category === "workflow");
  if (workflows.length) {
    lines.push("workflows:");
    for (const module of workflows) {
      lines.push(`  - id: ${module.id}`);
      lines.push("    note: 검토된 결정적 조정자 자리표시자입니다. 후속 작업에서 하위 그래프로 확장하세요.");
    }
  }
  return `${lines.join("\n")}\n`;
}

function agentConfigEntries({ modules, agentNodeTargets }) {
  const entries = modules.filter(isAgentModule).map((module) => ({
    id: module.id,
    moduleId: null,
    module,
    target: module
  }));
  for (const target of agentNodeTargets) {
    if (!isAgentModule(target.module) || target.node.id === target.module.id) continue;
    entries.push({
      id: target.node.id,
      moduleId: target.module.id,
      module: target.module,
      target
    });
  }
  return entries;
}

export function buildWorkflowPy() {
  return `"""ADK Workflow entrypoint shim.

The executable root_agent lives in agent.py so ADK Web can import the package.
This file gives developers a stable place to inspect workflow-level handoff
metadata without adding production business logic.
"""

from .agent import root_agent

__all__ = ["root_agent"]
`;
}

export function buildSchemasPy({ modules, adapterConnection }) {
  return `"""Reviewed input/output schema names for the generated skeleton."""

MODULE_SCHEMAS = ${toPythonLiteral(
    Object.fromEntries(
      modules.map((module) => [
        module.id,
        {
          inputs: module.inputs ?? [],
          outputs: module.outputs ?? [],
          invoke_binding: module.invoke_binding ?? null,
          decision_owner: module.decision_owner ?? null,
          call_control: module.call_control ?? null,
          side_effect: module.side_effect ?? null,
          policy: module.policy ?? null,
          workflow_ref: module.workflow_ref ?? null,
          mock_binding: module.module_category === "adapter" ? mockBindingFromModule(module, { adapterConnection }) : null,
        },
      ])
    )
  )}
`;
}

export function buildNodeHelperPy(kind) {
  const note = {
    agents: "Agent node instructions are emitted in agent.py as LlmAgent declarations.",
    adapters: "Adapter stubs call Mock Lab only when mock_binding is linked; replace with real EAI/API clients manually.",
    gates: "User confirmation gates are modeled with RequestInput nodes and reviewed router route edges.",
    human_inputs: "Human input nodes are RequestInput placeholders for ADK Web smoke tests.",
    routers: "Reviewed router nodes lower route edges into ADK Workflow route functions.",
  }[kind];
  return `"""${note}"""

DEVELOPER_NOTE = ${toPyStr(note)}
`;
}

export function buildWorkflowCallsPy({ modules }) {
  const workflowCalls = modules.filter((module) => module.module_category === "workflow");
  const rows = workflowCalls.map((module) => ({
    module_id: module.id,
    module_name: module.name,
    workflow_ref: module.workflow_ref ?? {
      id: module.id,
      version: null,
      source: "placeholder",
      display_name: module.name,
    },
    input_mapping: module.input_mapping ?? {},
    output_mapping: module.output_mapping ?? {},
    developer_todos: module.developer_todos ?? [],
  }));
  return `"""workflow_call placeholders for existing/sub-workflow calls.

These functions intentionally do not implement target workflow business logic.
Developers should replace the placeholder return with an import/call to the
reviewed target Workflow skeleton after confirming the contract.
"""

WORKFLOW_CALLS = ${toPythonLiteral(rows)}


async def call_existing_workflow(ctx, input_data, workflow_ref):
    return {
        "status": "workflow_call_placeholder",
        "manual_completion_required": True,
        "target_workflow": workflow_ref,
        "input": input_data,
    }
`;
}

export function buildMockConfigYaml({ modules, adapterConnection }) {
  const adapters = modules.filter((module) => module.module_category === "adapter");
  const lines = ["provider: mock_lab", "package_path: packages/mock-lab", "adapters:"];
  if (!adapters.length) lines.push("  []");
  for (const module of adapters) {
    const binding = mockBindingFromModule(module, { adapterConnection });
    lines.push(`  - module_id: ${yamlScalar(module.id)}`);
    lines.push(`    module_name: ${yamlScalar(module.name)}`);
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

export function buildEnvExample({ analysisResult, modules }) {
  const remoteEnvLines = remoteA2aEnvVars({ analysisResult, modules }).map((envVar) => `# ${envVar}=...`);
  return `# Agent Factory 공유 runtime env template입니다.
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

export function mockBindingFromModule(module, { adapterConnection }) {
  const connection = adapterConnection(module);
  if (module.mock_binding && typeof module.mock_binding === "object") {
    return {
      ...module.mock_binding,
      status: connection === "mcp_connected" ? "linked" : "missing"
    };
  }
  return {
    provider: "mock_lab",
    package_path: "packages/mock-lab",
    mock_server_id: module.mcp_server ?? null,
    tool_name: module.mcp_tool_name ?? null,
    input_schema: module.mcp_schema_ref ?? null,
    output_schema: null,
    sample_response_ref: null,
    status: connection === "mcp_connected" ? "linked" : "missing",
  };
}

function isAgentModule(module) {
  return module.module_category === "agent";
}
