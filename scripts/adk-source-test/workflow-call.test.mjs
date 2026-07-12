import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { baseModules, channelModules, discoverGeneratedPackage, generator, readBundle, writeChannelFixture } from "./fixtures.mjs";

test("runnable preserves workflow_call stubs and handoff files", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-workflow-call-"));
  try {
    const [agentBase] = baseModules(true);
    const workflowModule = {
      id: "mod-risk-workflow",
      name: "이탈위험_판단_Workflow",
      module_category: "workflow",
      agent_kind: null,
      workflow_kind: "graph",
      adapter_kind: null,
      remote_contract_kind: null,
      scaffold_output: "runnable",
      no_runnable_business_logic: false,
      catalog_binding: null,
      developer_todos: ["confirm_workflow_call_contract"],
      inputs: [{ name: "customer_id", type: "string", required: true }],
      outputs: [{ name: "risk_result", type: "object", required: true }],
      risk_signals: [],
      required_review_fields: [],
      runtime_mock: null,
      instruction: null,
      model: null,
      agent_execution_mode: null,
      access_protocol: null,
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      mcp_auth_mode: null,
      runtime_binding: "workflow_call",
      node_kind: "workflow_call",
      invoke_binding: "internal_workflow",
      decision_owner: "workflow_code",
      call_control: "fixed_by_workflow",
      workflow_ref: { id: "wf-risk-check", version: "v1", source: "catalog", display_name: "이탈위험 판단 Workflow" },
      input_mapping: { customer_id: "$state.customer.id" },
      output_mapping: { risk_result: "$result" },
      mock_binding: null,
      adk_skeleton_contract: {
        scaffold_level: "mock_testable_skeleton",
        target_runtime: "adk_python_2_x",
        implementation_template: "workflow_call_stub",
        manual_completion_required: true,
        developer_todos: ["confirm_workflow_call_contract"]
      }
    };
    writeChannelFixture(artifactRoot, {
      modules: [{ ...agentBase, id: "mod-a", name: "접수_Agent" }, workflowModule],
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "wf", node_kind: "workflow_call", module_id: "mod-risk-workflow" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "wf" },
        { from: "wf", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const packageName = discoverGeneratedPackage(outputRoot);
    const workflowCalls = readFileSync(join(outputRoot, packageName, "nodes", "workflow_calls.py"), "utf8");
    const adapters = readFileSync(join(outputRoot, packageName, "nodes", "adapters.py"), "utf8");
    const handoff = readFileSync(join(outputRoot, "implementation-handoff.md"), "utf8");
    assert.ok(existsSync(join(outputRoot, packageName, "workflow.py")));
    assert.ok(existsSync(join(outputRoot, packageName, "mock_config.yaml")));
    assert.ok(existsSync(join(outputRoot, packageName, "sample_inputs.yaml")));
    assert.ok(existsSync(join(outputRoot, "README.md")));
    assert.match(workflowCalls, /workflow_call_placeholder/);
    assert.match(workflowCalls, /wf-risk-check/);
    assert.match(adapters, /Adapter stubs call the synthetic MCP provider/);
    assert.match(handoff, /confirm_workflow_call_contract/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable contract test does not require LlmAgent mode when no LlmAgent node is emitted", () => {
  const { unconnectedAdapter } = channelModules();
  const workflowModule = {
    id: "mod-risk-workflow",
    name: "Risk Workflow",
    module_category: "workflow",
    agent_kind: null,
    workflow_kind: "graph",
    adapter_kind: null,
    remote_contract_kind: null,
    scaffold_output: "runnable",
    no_runnable_business_logic: false,
    catalog_binding: null,
    developer_todos: ["confirm_workflow_call_contract"],
    inputs: [{ name: "customer_id", type: "string", required: true }],
    outputs: [{ name: "risk_result", type: "object", required: true }],
    risk_signals: [],
    required_review_fields: [],
    runtime_mock: null,
    instruction: null,
    model: null,
    agent_execution_mode: null,
    access_protocol: null,
    mcp_server: null,
    mcp_tool_name: null,
    mcp_schema_ref: null,
    mcp_auth_mode: null,
    runtime_binding: "workflow_call",
    node_kind: "workflow_call",
    workflow_ref: { id: "wf-risk-check", version: "v1", source: "catalog", display_name: "Risk Workflow" },
    input_mapping: { customer_id: "$state.customer.id" },
    output_mapping: { risk_result: "$result" },
    mock_binding: null,
    adk_skeleton_contract: {
      scaffold_level: "mock_testable_skeleton",
      target_runtime: "adk_python_2_x",
      implementation_template: "workflow_call_stub",
      manual_completion_required: true,
      developer_todos: ["confirm_workflow_call_contract"]
    }
  };
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-no-agent-workflow-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules: [{ ...unconnectedAdapter, id: "mod-source-adapter", name: "Source Adapter" }, workflowModule],
      nodes: [
        { id: "adapter", node_kind: "adapter", module_id: "mod-source-adapter" },
        { id: "wf", node_kind: "workflow_call", module_id: "mod-risk-workflow" }
      ],
      edges: [{ from: "adapter", to: "wf" }]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const { agentSource, contractTest } = readBundle(outputRoot);
    assert.doesNotMatch(agentSource, / = LlmAgent\(/);
    assert.doesNotMatch(contractTest, /mode="single_turn"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
