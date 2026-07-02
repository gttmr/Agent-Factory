import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, readBundle, writeChannelFixture, writeFixture, writeJson } from "./fixtures.mjs";

test("runnable keeps LLM-selected MCP toolsets as unconnected handoff stubs", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-llm-toolset-"));
  try {
    writeFixture(artifactRoot, { runnable: true, connectedAdapter: true });
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    const adapter = plan.modules.find((module) => module.id === "mod-gen-adapter");
    adapter.invoke_binding = "mcp_toolset";
    adapter.decision_owner = "llm";
    adapter.call_control = "selected_by_llm";
    adapter.adk_skeleton_contract = {
      ...adapter.adk_skeleton_contract,
      scaffold_level: "handoff",
      implementation_template: "adapter_placeholder_stub"
    };
    writeJson(planPath, plan);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const { manifest, agentSource } = readBundle(outputRoot);
    assert.equal(manifest.runtime.connected_adapters.length, 0);
    assert.ok(
      manifest.runtime.unconnected_adapters.some((adapterEntry) => adapterEntry.module_id === "mod-gen-adapter"),
      "LLM-selected MCP toolset must remain an unconnected handoff"
    );
    assert.match(agentSource, /async def _fn_mod_gen_adapter\(ctx: Context, node_input=None\) -> dict:/);
    assert.match(agentSource, /"connection_status": "unconnected"/);
    assert.doesNotMatch(agentSource, /from mcp import ClientSession/);
    assert.doesNotMatch(agentSource, /"connection_status": "mcp_connected"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable exposes agent-owned MCP toolsets on a chat LlmAgent", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const agentModule = {
    ...agentBase,
    id: "mod-param-agent",
    name: "파라미터_수집_Agent",
    agent_execution_mode: "chat",
    invoke_binding: "mcp_toolset",
    decision_owner: "llm",
    call_control: "selected_by_llm",
    instruction: [
      "대화에서 필요한 API 파라미터를 수집하세요.",
      "필수 파라미터가 충분할 때만 승인된 Mock Lab MCP toolset을 선택하세요."
    ].join("\n")
  };
  const toolsetAdapter = {
    ...connectedAdapter,
    id: "mod-param-lookup",
    name: "파라미터_조회_Tool",
    inputs: [{ name: "query", type: "string", required: true }],
    outputs: [{ name: "result", type: "object", required: true }],
    mcp_server: "parameter-mock",
    mcp_tool_name: "lookup_required_parameters",
    mcp_schema_ref: "catalog/contracts/mcp/parameter.lookup.v1.json",
    mock_binding: {
      provider: "mock_lab",
      package_path: "packages/mock-lab",
      mock_server_id: "parameter-mock",
      tool_name: "lookup_required_parameters",
      input_schema: "catalog/contracts/mcp/parameter.lookup.v1.json",
      output_schema: "catalog/contracts/mcp/parameter.lookup.output.v1.json",
      sample_response_ref: "mock_samples.parameter.lookup",
      status: "linked"
    }
  };
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-agent-toolset-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules: [agentModule, toolsetAdapter],
      nodes: [
        { id: "in1", node_kind: "input" },
        {
          id: "agent",
          node_kind: "agent",
          module_id: "mod-param-agent",
          agent_execution_mode: "chat",
          invoke_binding: "mcp_toolset",
          decision_owner: "llm",
          call_control: "selected_by_llm"
        },
        {
          id: "toolset",
          node_kind: "adapter",
          module_id: "mod-param-lookup",
          mock_binding: toolsetAdapter.mock_binding
        },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "agent" },
        { from: "agent", to: "toolset" },
        { from: "toolset", to: "out1" }
      ]
    });

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const { agentSource } = readBundle(outputRoot);
    assert.match(agentSource, /agent_mod_param_agent = LlmAgent\(/);
    const agentDeclaration = agentSource.match(/agent_mod_param_agent = LlmAgent\([\s\S]*?\n\)/)?.[0] ?? "";
    assert.match(agentDeclaration, /mode="chat"/);
    assert.match(agentDeclaration, /\btools=\[/, "agent-owned MCP toolset must be exposed on the chat LlmAgent");
    assert.match(agentDeclaration, /McpToolset\(connection_params=StreamableHTTPConnectionParams\(url=_mcp_url\(/);
    assert.match(agentSource, /from google\.adk\.tools import McpToolset/);
    assert.match(agentSource, /from google\.adk\.tools\.mcp_tool import StreamableHTTPConnectionParams/);
    assert.doesNotMatch(agentSource, /async def _fn_mod_param_lookup\(ctx: Context, node_input=None\)/);
    assert.doesNotMatch(agentSource, /node_mod_param_lookup = FunctionNode\(/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
