#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertConnectedMcpRuntimeLabels,
  assertGeneratorSourcesStayDomainNeutral,
  assertManifestStageUpdated,
  assertPregeneratedRunnableBundle,
  assertRunnableBundle,
  assertSmokeBundle
} from "./adk-source-test/assertions.mjs";
import {
  baseModules,
  channelModules,
  discoverGeneratedPackage,
  generate,
  generator,
  readBundle,
  remoteGraph,
  remoteModule,
  repoRoot,
  writeChannelFixture,
  writeFixture,
  writeJson,
  writeRemoteFixture
} from "./adk-source-test/fixtures.mjs";

// ---------------------------------------------------------------------------
// Hermetic both-mode tests (run via `node --test`).
// ---------------------------------------------------------------------------

test("smoke mode emits the synthetic runtime smoke agent", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: false });
  try {
    assertSmokeBundle(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable mode emits an ADK Workflow graph and the editable bundle config", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true });
  try {
    assertRunnableBundle(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable mode lowers chat agent execution mode", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true, agentExecutionMode: "chat" });
  try {
    const { agentSource } = readBundle(outputRoot);
    assert.match(agentSource, /mode="chat"/);
    assert.doesNotMatch(agentSource, /mode="single_turn"/);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters carry an explicit runtime MCP label", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true, connectedAdapter: true });
  try {
    assertConnectedMcpRuntimeLabels(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("generator source keeps hardcoded scenario literals out of generator modules", () => {
  assertGeneratorSourcesStayDomainNeutral();
});

test("runnable honors an explicit scaffold package_name", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-package-name-"));
  try {
    writeFixture(artifactRoot, { runnable: true });
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.package_name = "wf_page_recommendation_required";
    writeJson(planPath, plan);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    assert.ok(existsSync(join(outputRoot, "wf_page_recommendation_required", "agent.py")));
    assert.equal(discoverGeneratedPackage(outputRoot), "wf_page_recommendation_required");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable omitted package_name fallback preserves requirement id casing", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-package-fallback-"));
  try {
    writeFixture(artifactRoot, { runnable: true });
    const requirementPath = join(artifactRoot, "normalized-requirement.json");
    const requirement = JSON.parse(readFileSync(requirementPath, "utf8"));
    requirement.id = "Agent Factory";
    writeJson(requirementPath, requirement);

    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.requirement_id = "Agent Factory";
    delete plan.package_name;
    writeJson(planPath, plan);

    const manifestPath = join(artifactRoot, "af-run-manifest.json");
    const runManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    runManifest.requirement_id = "Agent Factory";
    writeJson(manifestPath, runManifest);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    assert.ok(existsSync(join(outputRoot, "Agent_Factory_adk", "agent.py")));
    assert.equal(discoverGeneratedPackage(outputRoot), "Agent_Factory_adk");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable README uses an env file path relative to the generated output root", () => {
  const artifactRoot = join(repoRoot, "artifacts", "af", `req-gen-env-${process.pid}`);
  try {
    const outputRoot = join(artifactRoot, "runtime-stub");
    mkdirSync(artifactRoot, { recursive: true });
    writeFixture(artifactRoot, { runnable: true, connectedAdapter: true });
    // Pin cwd to the repo root so runtimeEnvRelativePath() (which anchors on
    // process.cwd()) is deterministic whether this runs standalone or via the
    // packages/web `test:analyzer` runner.
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe", cwd: repoRoot });

    const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
    assert.match(readme, /AF_RUNTIME_ENV_FILE=\.\.\/\.\.\/\.\.\/\.\.\/\.agent-factory\/runtime\.env/);
    assert.doesNotMatch(readme, /AF_RUNTIME_ENV_FILE=\.\.\/\.\.\/\.agent-factory\/runtime\.env/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable lowers a user-confirmation route without joining branch convergence", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "초기_선택_Agent" },
    { ...unconnectedAdapter, id: "mod-analysis", name: "분석_실행_Adapter" },
    { ...unconnectedAdapter, id: "mod-final", name: "최종_선택_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-route-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "confirm", node_kind: "human_input", module_id: null, label: "추가 분석을 수행할까요?" },
        { id: "analysis-router", node_kind: "router", module_id: null, label: "분석 실행 여부 route" },
        { id: "analysis", node_kind: "adapter", module_id: "mod-analysis" },
        { id: "final", node_kind: "adapter", module_id: "mod-final" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "confirm" },
        { from: "confirm", to: "analysis-router" },
        {
          from: "analysis-router",
          to: "analysis",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == run_analysis"
        },
        {
          from: "analysis-router",
          to: "final",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == skip_analysis"
        },
        { from: "analysis", to: "final" },
        { from: "final", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    const sampleInputs = readFileSync(join(outputRoot, "req_ch_adk", "sample_inputs.yaml"), "utf8");
    assert.match(source, /from google\.adk\.events import Event, RequestInput/);
    assert.match(source, /def _hitl_confirm\(ctx: Context, node_input=None\):/);
    assert.match(source, /_hitl_response = _first_resume_input\(ctx\)/);
    assert.match(source, /yield RequestInput\(message="추가 분석을 수행할까요\?", payload=node_input\)/);
    assert.match(source, /"previous": node_input/);
    assert.match(source, /"response": _hitl_response/);
    assert.match(source, /node_confirm = FunctionNode\(func=_hitl_confirm, name="confirm", rerun_on_resume=True\)/);
    assert.match(source, /def _route_analysis_router\(node_input=None\):/);
    assert.match(source, /Event\(route="run_analysis", output=node_input\)/);
    assert.match(source, /\(node_analysis_router,\s*\{\s*"run_analysis": node_mod_analysis,\s*"skip_analysis": node_mod_final,\s*\}\s*\)/s);
    assert.doesNotMatch(source, /join_1 = JoinNode\(name="join_1"\)/);
    assert.match(sampleInputs, /workflow_chat_smoke:/);
    assert.match(sampleInputs, /conversation:/);
    assert.match(sampleInputs, /추가 분석을 수행할까요\?/);
    assert.match(sampleInputs, /"1"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

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
    assert.match(agentSource, /async def _fn_mod_gen_adapter\(ctx: Context\) -> dict:/);
    assert.match(agentSource, /"connection_status": "unconnected"/);
    assert.doesNotMatch(agentSource, /from mcp import ClientSession/);
    assert.doesNotMatch(agentSource, /"connection_status": "mcp_connected"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

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
    assert.match(adapters, /Adapter stubs call Mock Lab/);
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

test("runnable mode rejects Graph IR shapes it cannot lower (v1: DAG + fan-out/fan-in)", () => {
  const cases = [
    { name: "module-bound human_input node", mutate: (pf) => pf.nodes.push({ id: "h1", node_kind: "human_input", module_id: "mod-gen-agent" }) },
    { name: "module-bound input node", mutate: (pf) => { pf.nodes.find((n) => n.id === "in1").module_id = "mod-gen-agent"; } },
    { name: "module-bound output node", mutate: (pf) => { pf.nodes.find((n) => n.id === "out1").module_id = "mod-gen-adapter"; } },
    { name: "module_id-null function node", mutate: (pf) => pf.nodes.push({ id: "f1", node_kind: "function", module_id: null }) },
    { name: "conditional edge", mutate: (pf) => { pf.edges[0].execution_semantics = "conditional"; } },
    { name: "remote boundary edge", mutate: (pf) => { pf.edges[0].is_remote_boundary_crossing = true; } },
    { name: "input->output passthrough", mutate: (pf) => pf.edges.push({ from: "in1", to: "out1", edge_kind: "event_output", execution_semantics: "normal_transition" }) },
    { name: "dangling edge endpoint", mutate: (pf) => pf.edges.push({ from: "mod-gen-agent", to: "ghost", edge_kind: "event_output", execution_semantics: "normal_transition" }) },
    {
      name: "router route to output terminal",
      mutate: (pf) => {
        pf.nodes.push({ id: "done-router", node_kind: "router", module_id: null });
        pf.edges = [
          { from: "in1", to: "mod-gen-agent" },
          { from: "mod-gen-agent", to: "done-router" },
          {
            from: "done-router",
            to: "out1",
            edge_kind: "route",
            execution_semantics: "conditional",
            route_condition: "choice == done"
          }
        ];
      }
    },
    { name: "loop_region container", mutate: (pf) => { (pf.containers ||= []).push({ id: "container-loop", container_kind: "loop_region" }); } }
  ];
  for (const testCase of cases) {
    const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reject-"));
    try {
      writeFixture(artifactRoot, { runnable: true });
      const pfPath = join(artifactRoot, "process-flow.json");
      const pf = JSON.parse(readFileSync(pfPath, "utf8"));
      testCase.mutate(pf);
      writeFileSync(pfPath, JSON.stringify(pf));
      assert.throws(
        () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
        /does not support|cannot lower/,
        `expected runnable generation to reject: ${testCase.name}`
      );
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// Per-edge data-passing channels (state).
// ---------------------------------------------------------------------------

test("runnable lowers per-edge state channels (agent output_key, function mirror, consumer read)", () => {
  const { agentBase, unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "요약_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "전처리_Adapter" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-channel-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "b", edge_kind: "session_state", state_key: "agent_summary" },
        { from: "b", to: "c", edge_kind: "temp_state", state_key: "lookup_payload" },
        { from: "c", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /output_key="agent_summary"/, "agent's sole outgoing state channel becomes output_key");
    assert.match(source, /ctx\.state\["temp:lookup_payload"\] = payload/, "function producer mirrors payload to the scoped temp channel");
    assert.match(source, /"temp:lookup_payload"/, "connected consumer receives the incoming channel key");
    assert.doesNotMatch(source, /output_key="mod_a_output"/, "named channel replaces the canonical agent output key");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters resolve inputs from agent-authored JSON state channels", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    {
      ...agentBase,
      id: "mod-arg-agent",
      name: "Adapter_Arguments_Agent",
      outputs: [{ name: "adapter_arguments", type: "object", required: true }]
    },
    {
      ...connectedAdapter,
      id: "mod-lookup",
      name: "조회_Adapter",
      inputs: [
        { name: "objective_text", type: "string", required: true },
        { name: "product_hint", type: "string", required: false }
      ],
      smoke_spec: {
        sample_user_message: "fallback should lose",
        synthetic_inputs: { objective_text: "synthetic fallback objective" },
        expected_output_shape: { type: "object" },
        expected_event_markers: [],
        mock_sources: [],
        ready: true
      }
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-agent-json-channel-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "arg-agent", node_kind: "agent", module_id: "mod-arg-agent" },
        { id: "lookup", node_kind: "adapter", module_id: "mod-lookup" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "arg-agent" },
        { from: "arg-agent", to: "lookup", edge_kind: "session_state", state_key: "adapter_arguments" },
        { from: "lookup", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /output_key="adapter_arguments"/, "planner agent writes the named arguments channel");
    assert.match(source, /^import json$/m, "JSON state channel parsing needs json import");
    assert.match(source, /def _json_payload\(value: Any\) -> Any:/, "runtime can parse agent-authored JSON strings");
    assert.match(source, /_value = _json_payload\(payload\)/, "payload resolver tries JSON string payloads");
    assert.match(source, /"adapter_arguments"/, "connected adapter receives the named channel");
    assert.match(source, /async def _fn_mod_lookup\(ctx: Context, node_input=None\) -> dict:/);
    assert.match(source, /node_input=node_input/);
    assert.match(source, /"arguments": arguments/, "audit payload records actual MCP arguments");
    assert.doesNotMatch(source, /for key, value in structured_content\.items\(\):/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters prefer reviewed node input_mapping before fallback inputs", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    {
      ...agentBase,
      id: "mod-arg-agent",
      name: "Adapter_Arguments_Agent",
      outputs: [{ name: "adapter_arguments", type: "object", required: true }]
    },
    {
      ...connectedAdapter,
      id: "mod-lookup",
      name: "조회_Adapter",
      inputs: [
        { name: "objective_text", type: "string", required: true },
        { name: "product_hint", type: "string", required: false }
      ],
      input_mapping: {
        objective_text: "confirmed_objective_text",
        product_hint: "confirmed_product_hint"
      },
      smoke_spec: {
        sample_user_message: "fallback should lose",
        synthetic_inputs: { objective_text: "synthetic fallback objective" },
        expected_output_shape: { type: "object" },
        expected_event_markers: [],
        mock_sources: [],
        ready: true
      }
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reviewed-input-map-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "arg-agent", node_kind: "agent", module_id: "mod-arg-agent" },
        {
          id: "lookup",
          node_kind: "adapter",
          module_id: "mod-lookup",
          input_mapping: {
            objective_text: "confirmed_objective_text",
            product_hint: "confirmed_product_hint"
          }
        },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "arg-agent" },
        { from: "arg-agent", to: "lookup", edge_kind: "session_state", state_key: "adapter_arguments" },
        { from: "lookup", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /reviewed_mapping = contract\.get\("input_mapping"\)/);
    assert.match(source, /source_key = reviewed_mapping\.get\(name\) or overrides\.get\(name, name\)/);
    assert.match(source, /"confirmed_objective_text"/);
    assert.match(source, /"confirmed_product_hint"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects an agent with conflicting outgoing state channels", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "분기_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "B_Adapter" },
    { ...unconnectedAdapter, id: "mod-c", name: "C_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-channel-conflict-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "b", edge_kind: "session_state", state_key: "k1" },
        { from: "a", to: "c", edge_kind: "session_state", state_key: "k2" },
        { from: "b", to: "out1" },
        { from: "c", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /multiple distinct outgoing state channels/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable lowers an artifact channel (function save_artifact, consumer load_artifact)", () => {
  const { agentBase, unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "분류_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "증거_Adapter" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-artifact-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "c", edge_kind: "artifact", artifact_key: "evidence_blob.json" },
        { from: "c", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /^import json$/m, "artifact bundle imports json");
    assert.match(source, /from google\.genai import types/, "artifact bundle imports genai types");
    assert.match(
      source,
      /await ctx\.save_artifact\("evidence_blob\.json", types\.Part\(text=json\.dumps\(payload/,
      "function producer saves the artifact"
    );
    assert.match(source, /await ctx\.load_artifact\(_artifact_key\)/, "consumer loads incoming artifacts");
    assert.match(source, /extra_payloads=_artifact_payloads/, "consumer passes loaded artifacts to input resolution");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects an artifact channel produced by an agent node", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "초안_Agent" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-artifact-agent-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "c", edge_kind: "artifact", artifact_key: "blob.json" },
        { from: "c", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /artifact channel produced by an agent node/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a state channel written by multiple producers (same state_key)", () => {
  const { unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-b", name: "B_Adapter" },
    { ...unconnectedAdapter, id: "mod-c", name: "C_Adapter" },
    { ...connectedAdapter, id: "mod-d", name: "D_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-state-collide-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "d", node_kind: "adapter", module_id: "mod-d" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "b" },
        { from: "in1", to: "c" },
        { from: "b", to: "d", edge_kind: "session_state", state_key: "shared" },
        { from: "c", to: "d", edge_kind: "session_state", state_key: "shared" },
        { from: "d", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /state channel written by multiple producers/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// remote_a2a (A2A) lowering.
// ---------------------------------------------------------------------------

test("runnable lowers a remote_a2a node to RemoteA2aAgent from its A2A contract", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()];
  const a2aContracts = [{
    contract_id: "a2a-001", remote_module_id: "mod-r", target_agent_name: "Partner Prime Agent",
    contract_status: "approved",
    agent_card: { discovery_method: "well-known", agent_card_url: "http://localhost:8001/a2a/test_agent/.well-known/agent-card.json", version: "1.0.0", notes: "" }
  }];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes: remoteGraph.nodes, edges: remoteGraph.edges, a2aContracts });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_remote_adk", "agent.py"), "utf8");
    assert.match(source, /from google\.adk\.agents\.remote_a2a_agent import RemoteA2aAgent/, "imports RemoteA2aAgent");
    assert.match(source, /= RemoteA2aAgent\(/, "emits a RemoteA2aAgent node");
    assert.match(source, /agent_card="http:\/\/localhost:8001\/a2a\/test_agent\/\.well-known\/agent-card\.json"/, "agent_card from the contract");
    assert.match(source, /use_legacy=False/);
    const reqs = readFileSync(join(repoRoot, "requirements", "adk-runtime.txt"), "utf8");
    assert.match(reqs, /google-adk\[a2a,mcp\]/, "shared requirements include the ADK extras");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable lowers a remote_agent_call node to RemoteA2aAgent from its A2A contract", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()];
  const a2aContracts = [{
    contract_id: "a2a-001", remote_module_id: "mod-r", target_agent_name: "Partner Prime Agent",
    contract_status: "approved",
    agent_card: { discovery_method: "well-known", agent_card_url: "http://localhost:8001/a2a/test_agent/.well-known/agent-card.json", version: "1.0.0", notes: "" }
  }];
  const nodes = remoteGraph.nodes.map((node) => node.id === "r" ? { ...node, node_kind: "remote_agent_call" } : node);
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-agent-call-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes, edges: remoteGraph.edges, a2aContracts });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_remote_adk", "agent.py"), "utf8");
    assert.match(source, /= RemoteA2aAgent\(/, "emits a RemoteA2aAgent node");
    assert.match(source, /agent_card="http:\/\/localhost:8001\/a2a\/test_agent\/\.well-known\/agent-card\.json"/, "agent_card from the contract");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a remote_a2a node whose contract has no agent_card_url", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_agent" }, remoteModule()];
  const a2aContracts = [{
    contract_id: "a2a-001", remote_module_id: "mod-r", target_agent_name: "Partner",
    contract_status: "approved",
    agent_card: { discovery_method: "tbd", agent_card_url: "", version: "", notes: "" }
  }];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-nocard-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes: remoteGraph.nodes, edges: remoteGraph.edges, a2aContracts });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /agent_card\.agent_card_url/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a mislabeled remote_a2a edge between two local nodes", () => {
  // Two LOCAL nodes joined by a remote_a2a edge with boundary crossing — must be
  // rejected (it would otherwise bypass the boundary-crossing gate). There is no
  // remote_a2a module, so assertRemoteA2aSupported passes; the edge gate must catch it.
  const [agentBase, unconnectedAdapter] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "A_agent" }, { ...unconnectedAdapter, id: "mod-b", name: "B_adapter" }];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-mislabeled-"));
  try {
    writeRemoteFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a", edge_kind: "event_output", execution_semantics: "normal_transition" },
        { from: "a", to: "b", edge_kind: "remote_a2a", execution_semantics: "boundary_crossing", a2a_contract_id: "a2a-001", is_remote_boundary_crossing: true },
        { from: "b", to: "out1", edge_kind: "event_output", execution_semantics: "normal_transition" }
      ],
      a2aContracts: [{
        contract_id: "a2a-001", remote_module_id: "mod-x", target_agent_name: "X", contract_status: "approved",
        agent_card: { discovery_method: "wk", agent_card_url: "http://localhost:8001/.well-known/agent-card.json", version: "1.0.0", notes: "" }
      }]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /does not support these edges/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Optional: validate a pre-generated bundle passed on the CLI (mode-aware).
// ---------------------------------------------------------------------------

const cliOutputRoot = process.argv[2];
if (cliOutputRoot) {
  test(`pre-generated bundle at ${cliOutputRoot} is consistent`, () => {
    const { manifest } = readBundle(cliOutputRoot);
    if (manifest.output_mode === "runnable") assertPregeneratedRunnableBundle(cliOutputRoot);
    else assertSmokeBundle(cliOutputRoot);
  });
}
