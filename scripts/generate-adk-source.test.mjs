#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const generator = join(here, "generate-adk-source.mjs");

// ---------------------------------------------------------------------------
// Minimal hermetic fixture: input -> agent -> adapter -> output.
// ---------------------------------------------------------------------------

function baseModules(runnable, { connectedAdapter = false, agentExecutionMode = null } = {}) {
  return [
    {
      id: "mod-gen-agent",
      name: "응답_생성_Agent",
      module_category: "agent",
      agent_kind: "specialist",
      workflow_kind: null,
      adapter_kind: null,
      remote_contract_kind: null,
      scaffold_output: runnable ? "runnable" : "agent_shell_only",
      no_runnable_business_logic: !runnable,
      catalog_binding: null,
      developer_todos: ["review"],
      inputs: [{ name: "question", type: "string", required: true }],
      outputs: [{ name: "answer", type: "string" }],
      risk_signals: [],
      required_review_fields: [],
      smoke_spec: { sample_user_message: "hello", synthetic_inputs: {}, expected_output_shape: {}, expected_event_markers: [], mock_sources: [], ready: true },
      runtime_mock: null,
      instruction: null,
      model: runnable ? "gemini-2.5-flash" : null,
      agent_execution_mode: agentExecutionMode,
      access_protocol: null,
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      mcp_auth_mode: null,
      runtime_binding: null
    },
    {
      id: "mod-gen-adapter",
      name: "데이터_조회_Adapter",
      module_category: "adapter",
      agent_kind: null,
      workflow_kind: null,
      adapter_kind: "data_query",
      remote_contract_kind: null,
      scaffold_output: runnable ? "runnable" : "contract_or_stub_only",
      no_runnable_business_logic: !runnable,
      catalog_binding: null,
      developer_todos: ["review"],
      inputs: [{ name: "key", type: "string", required: true }],
      outputs: [{ name: "value", type: "object" }],
      risk_signals: [],
      required_review_fields: [],
      runtime_mock: { value: { demo: true } },
      instruction: null,
      model: null,
      access_protocol: connectedAdapter ? "mcp" : null,
      mcp_server: connectedAdapter ? "test-mcp" : null,
      mcp_tool_name: connectedAdapter ? "lookup_test_data" : null,
      mcp_schema_ref: connectedAdapter ? "catalog/contracts/mcp/test.lookup.v1.json" : null,
      mcp_auth_mode: connectedAdapter ? "none" : null,
      runtime_binding: connectedAdapter ? "mcp_tool" : null,
      node_kind: "adapter_call",
      mock_binding: connectedAdapter
        ? {
            provider: "mock_lab",
            package_path: "packages/mock-lab",
            mock_server_id: "test-mcp",
            tool_name: "lookup_test_data",
            input_schema: "catalog/contracts/mcp/test.lookup.v1.json",
            output_schema: "catalog/contracts/mcp/test.lookup.output.v1.json",
            sample_response_ref: "mock_samples.test.lookup",
            status: "linked"
          }
        : {
            provider: "mock_lab",
            package_path: "packages/mock-lab",
            mock_server_id: null,
            tool_name: null,
            input_schema: null,
            output_schema: null,
            sample_response_ref: null,
            status: "missing"
          },
      adk_skeleton_contract: {
        scaffold_level: runnable && connectedAdapter ? "mock_testable_skeleton" : "handoff",
        target_runtime: "adk_python_2_x",
        implementation_template: connectedAdapter ? "mcp_mock_adapter_stub" : "adapter_placeholder_stub",
        manual_completion_required: true,
        developer_todos: ["replace_mock_with_real_eai_client"]
      }
    }
  ];
}

function writeFixture(dir, { runnable, connectedAdapter = false, agentExecutionMode = null }) {
  writeJson(join(dir, "normalized-requirement.json"), {
    id: "req-gen-test",
    title: "Generator test workflow",
    status: "approved"
  });
  writeJson(join(dir, "process-flow.json"), {
    nodes: [
      { id: "in1", node_kind: "input" },
      {
        id: "mod-gen-agent",
        node_kind: "agent",
        module_id: "mod-gen-agent",
        ...(agentExecutionMode ? { agent_execution_mode: agentExecutionMode } : {})
      },
      { id: "mod-gen-adapter", node_kind: "adapter", module_id: "mod-gen-adapter" },
      { id: "out1", node_kind: "output" }
    ],
    edges: [
      { from: "in1", to: "mod-gen-agent" },
      { from: "mod-gen-agent", to: "mod-gen-adapter" },
      { from: "mod-gen-adapter", to: "out1" }
    ],
    validation: { errors: [] }
  });
  writeJson(join(dir, "module-candidates.json"), [
    { id: "mod-gen-agent", status: "approved", missing_information: [] },
    { id: "mod-gen-adapter", status: "approved", missing_information: [] }
  ]);
  writeJson(join(dir, "af-run-manifest.json"), {
    requirement_id: "req-gen-test",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(dir, "scaffold-plan.json"), {
    requirement_id: "req-gen-test",
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: runnable ? "runnable" : "smoke",
    modules: baseModules(runnable, { connectedAdapter, agentExecutionMode }),
    runtime_contracts: [],
    excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

function generate({ runnable, connectedAdapter = false, agentExecutionMode = null }) {
  const artifactRoot = mkdtempSync(join(tmpdir(), `af-gen-${runnable ? "runnable" : "smoke"}-`));
  try {
    writeFixture(artifactRoot, { runnable, connectedAdapter, agentExecutionMode });
    const outputRoot = join(artifactRoot, "runtime-stub");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    return { artifactRoot, outputRoot };
  } catch (error) {
    rmSync(artifactRoot, { recursive: true, force: true });
    throw error;
  }
}

function discoverGeneratedPackage(root) {
  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(join(root, entry, "workflow_manifest.json")));
  assert.equal(packages.length, 1, `expected one generated ADK package, found ${packages.join(", ") || "none"}`);
  return packages[0];
}

function readBundle(outputRoot) {
  const packageName = discoverGeneratedPackage(outputRoot);
  return {
    packageName,
    manifest: JSON.parse(readFileSync(join(outputRoot, packageName, "workflow_manifest.json"), "utf8")),
    agentSource: readFileSync(join(outputRoot, packageName, "agent.py"), "utf8"),
    contractTest: readFileSync(join(outputRoot, packageName, "tests", "test_workflow_contract.py"), "utf8")
  };
}

function assertCommonBundle(outputRoot, manifest) {
  const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
  assert.equal(manifest.guardrails.raw_requirement_to_code, false);
  assert.equal(manifest.guardrails.private_data_or_endpoints, false);
  assert.equal(manifest.scaffold_plan.source, "approved_workbench_artifact");
  assert.equal(manifest.scaffold_plan.raw_requirement_to_code, false);
  assert.ok(manifest.graph_ir, "manifest must include graph_ir");
  assert.ok(existsSync(join(outputRoot, "scaffold-plan.json")));
  assert.ok(existsSync(join(outputRoot, "implementation-handoff.md")));
  assert.ok(existsSync(join(outputRoot, "runtime-chat-smoke.json")));
  assert.ok(!existsSync(join(outputRoot, "requirements.txt")), "runtime-stub must not carry artifact-local Python requirements");
  assert.doesNotMatch(readme, /python3 -m venv \.venv/);
  assert.doesNotMatch(readme, /pip install -r requirements\.txt/);
  assert.match(readme, /requirements\/adk-runtime\.txt/);
}

function assertSmokeBundle(outputRoot) {
  const { packageName, manifest, agentSource } = readBundle(outputRoot);
  assertCommonBundle(outputRoot, manifest);
  assert.equal(manifest.output_mode, "smoke");
  assert.equal(manifest.guardrails.generated_business_logic, false);
  assert.match(agentSource, /from google\.adk\.agents import BaseAgent/);
  assert.match(agentSource, /class SyntheticRuntimeSmokeAgent\(BaseAgent\)/);
  assert.match(agentSource, /runtime_mock_smoke/);
  assert.match(agentSource, /GRAPH_EDGES = \[/);
  assert.match(agentSource, /\("START", "node_/);
  assert.doesNotMatch(agentSource, /root_agent = Workflow\(/);
  assert.ok(!existsSync(join(outputRoot, "agents.config.yaml")), "smoke bundle must not emit agents.config.yaml");
  return packageName;
}

function assertRunnableBundle(outputRoot) {
  const { packageName, manifest, agentSource } = readBundle(outputRoot);
  const envExample = readFileSync(join(outputRoot, ".env.example"), "utf8");
  const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
  const agentsConfig = readFileSync(join(outputRoot, "agents.config.yaml"), "utf8");
  assertCommonBundle(outputRoot, manifest);
  assert.equal(manifest.output_mode, "runnable");
  assert.equal(manifest.guardrails.runnable_synthetic_wiring, true);
  assert.ok(manifest.runtime, "runnable manifest must include a runtime block");
  assert.ok(Array.isArray(manifest.runtime.connected_adapters));
  assert.ok(Array.isArray(manifest.runtime.unconnected_adapters));
  assert.match(agentSource, /from google\.adk\.workflow import/);
  assert.match(agentSource, /from google\.adk\.agents import LlmAgent/);
  assert.match(agentSource, /root_agent = Workflow\(/);
  assert.match(agentSource, /mode="single_turn"/);
  assert.match(agentSource, /당신은/);
  assert.doesNotMatch(agentSource, /You are gen_agent/);
  assert.match(agentSource, /name="응답_생성_Agent"/);
  assert.match(agentSource, /name="데이터_조회_Adapter"/);
  assert.match(agentSource, /http:\/\/127\.0\.0\.1:5173\/api\/mock-lab\/mcp/);
  assert.match(agentSource, /AF_RUNTIME_ENV_FILE/);
  assert.match(agentSource, /\.agent-factory\/runtime\.env/);
  assert.match(agentSource, /if key not in os\.environ:/);
  assert.doesNotMatch(agentSource, /SyntheticRuntimeSmokeAgent/);
  // The fixture adapter is unconnected → emitted as a FunctionNode stub and
  // classified as unconnected in the manifest.
  assert.match(agentSource, /async def _fn_mod_gen_adapter\(ctx: Context\)/);
  assert.match(agentSource, /node_mod_gen_adapter = FunctionNode\(func=_fn_mod_gen_adapter/);
  assert.ok(
    manifest.runtime.unconnected_adapters.some((adapter) => adapter.module_id === "mod-gen-adapter"),
    "fixture adapter must be reported as unconnected"
  );
  assert.equal(manifest.runtime.connected_adapters.length, 0);
  assert.ok(existsSync(join(outputRoot, "agents.config.yaml")), "runnable bundle must emit agents.config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "workflow.py")), "bundle must include workflow.py for developer handoff");
  assert.ok(existsSync(join(outputRoot, packageName, "schemas.py")), "bundle must include schemas.py");
  assert.ok(existsSync(join(outputRoot, packageName, "mock_config.yaml")), "bundle must include mock_config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "sample_inputs.yaml")), "bundle must include sample_inputs.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "README.md")), "bundle must include package-local README.md");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "adapters.py")), "bundle must include nodes/adapters.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "gates.py")), "bundle must include nodes/gates.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "workflow_calls.py")), "bundle must include nodes/workflow_calls.py");
  assert.ok(existsSync(join(outputRoot, "README.md")), "bundle must include README.md");
  assert.match(
    readFileSync(join(outputRoot, "implementation-handoff.md"), "utf8"),
    /TODO/,
    "bundle must keep a TODO handoff"
  );
  assert.ok(existsSync(join(outputRoot, ".env.example")), "runnable bundle must emit .env.example");
  assert.ok(existsSync(join(outputRoot, ".gitignore")), "runnable bundle must emit .gitignore");
  assert.doesNotMatch(envExample, /^GOOGLE_API_KEY=/m, "per-bundle .env.example must not ask developers to repeat Gemini secrets");
  assert.match(envExample, /AF_RUNTIME_ENV_FILE/);
  assert.match(envExample, /\.agent-factory\/runtime\.env/);
  assert.match(agentsConfig, /한글 우선/);
  assert.match(agentsConfig, /name: 응답_생성_Agent/);
  assert.match(readme, /repository root의 `\.agent-factory\/runtime\.env`로 복사/);
  assert.match(readme, /npm run dev --prefix packages\/mock-lab -- --host 0\.0\.0\.0 --port 5176 --strictPort/);
  assert.match(readme, /AF_MOCK_LAB_MCP_URL=http:\/\/127\.0\.0\.1:5176\/api\/mock-lab\/mcp/);
  assert.doesNotMatch(readme, /cp \.env\.example \.env\s+# then set GOOGLE_API_KEY/);
  // Regression guard: the generator must stay domain-neutral. A synthetic,
  // domain-free fixture must never surface requirement-specific literals that a
  // previous version hardcoded into sample output (banking / page-recommendation).
  // Data echoed FROM a scenario's own artifacts is legitimate; this fixture has
  // none of these tokens, so any occurrence is a generator-authored leak.
  const sampleInputs = readFileSync(join(outputRoot, packageName, "sample_inputs.yaml"), "utf8");
  const generatorAuthoredLeaks = [
    "wf-page-recommendation-mock",
    "WORKFLOW_INSTRUCTION",
    "Page Metadata RAG",
    "적금",
    "T2S",
    "UserFlow",
    "행동유형",
    "PAGE_B"
  ];
  for (const token of generatorAuthoredLeaks) {
    for (const [label, text] of [["README.md", readme], ["agent.py", agentSource], ["sample_inputs.yaml", sampleInputs]]) {
      assert.ok(!text.includes(token), `domain-neutral bundle leaked generator-authored literal "${token}" into ${label}`);
    }
  }
  return packageName;
}

function assertConnectedMcpRuntimeLabels(outputRoot) {
  const { manifest, agentSource } = readBundle(outputRoot);
  const mockConfig = readFileSync(join(outputRoot, discoverGeneratedPackage(outputRoot), "mock_config.yaml"), "utf8");
  assert.equal(manifest.runtime.connected_adapters.length, 1);
  assert.equal(manifest.runtime.connected_adapters[0].runtime_mcp_label, "런타임 MCP");
  assert.equal(manifest.runtime.connected_adapters[0].mock_binding.provider, "mock_lab");
  assert.match(manifest.runtime.connected_adapters[0].runtime_mcp_note, /실행 시점/);
  assert.match(agentSource, /"runtime_mcp_label": "런타임 MCP"/);
  assert.match(agentSource, /"runtime_mcp_note": "실행 시점에 Mock Lab MCP 서버를 통해 모델이 파악한 데이터입니다\."/);
  assert.match(agentSource, /"connection_status": "mcp_connected"/);
  assert.match(agentSource, /def _user_text_from_context\(ctx: Context\) -> str:/);
  assert.match(agentSource, /source_key in \{"query", "user_request"\}/);
  assert.match(mockConfig, /provider: mock_lab/);
  assert.match(mockConfig, /package_path: packages\/mock-lab/);
  assert.match(mockConfig, /tool_name: "?lookup_test_data"?/);
}

function assertManifestStageUpdated(artifactRoot) {
  const runManifest = JSON.parse(readFileSync(join(artifactRoot, "af-run-manifest.json"), "utf8"));
  assert.equal(runManifest.current_stage, "build");
  assert.equal(runManifest.stages.build.status, "complete");
  assert.ok(runManifest.stages.build.outputs.includes("runtime-stub/"));
  assert.ok(runManifest.validation.commands.some((command) => command.includes("python3 -m compileall")));
}

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

test("runnable README uses an env file path relative to the generated output root", () => {
  const artifactRoot = join(here, "..", "artifacts", "af", `req-gen-env-${process.pid}`);
  try {
    const outputRoot = join(artifactRoot, "runtime-stub");
    mkdirSync(artifactRoot, { recursive: true });
    writeFixture(artifactRoot, { runnable: true, connectedAdapter: true });
    // Pin cwd to the repo root so runtimeEnvRelativePath() (which anchors on
    // process.cwd()) is deterministic whether this runs standalone or via the
    // packages/web `test:analyzer` runner.
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe", cwd: join(here, "..") });

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
    assert.match(source, /def _route_analysis_router\(node_input=None\):/);
    assert.match(source, /Event\(route="run_analysis"\)/);
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

function writeChannelFixture(dir, { modules, nodes, edges }) {
  writeJson(join(dir, "normalized-requirement.json"), { id: "req-ch", title: "Channel workflow", status: "approved" });
  writeJson(join(dir, "process-flow.json"), { nodes, edges, validation: { errors: [] } });
  writeJson(join(dir, "module-candidates.json"), modules.map((m) => ({ id: m.id, status: "approved", missing_information: [] })));
  writeJson(join(dir, "af-run-manifest.json"), {
    requirement_id: "req-ch",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(dir, "scaffold-plan.json"), {
    requirement_id: "req-ch", source: "approved_workbench_artifact", raw_requirement_to_code: false,
    output_mode: "runnable", modules, runtime_contracts: [], excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

function channelModules() {
  const [agentBase] = baseModules(true);
  const unconnectedAdapter = baseModules(true)[1];
  const connectedAdapter = baseModules(true, { connectedAdapter: true })[1];
  return { agentBase, unconnectedAdapter, connectedAdapter };
}

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

function remoteModule(overrides = {}) {
  return {
    id: "mod-r", name: "remote_partner_agent", module_category: "remote_a2a",
    agent_kind: null, workflow_kind: null, adapter_kind: null, remote_contract_kind: "a2a",
    scaffold_output: "runnable", no_runnable_business_logic: false, catalog_binding: null,
    developer_todos: ["review"], inputs: [], outputs: [{ name: "result", type: "object" }],
    risk_signals: [], required_review_fields: [],
    runtime_mock: null, instruction: null, model: null,
    access_protocol: "remote_a2a", mcp_server: null, mcp_tool_name: null, mcp_schema_ref: null,
    mcp_auth_mode: null, runtime_binding: "remote_a2a", a2a_contract_id: "a2a-001",
    smoke_spec: { sample_user_message: "go", synthetic_inputs: {}, expected_output_shape: {}, expected_event_markers: [], mock_sources: [], ready: true },
    ...overrides
  };
}

function writeRemoteFixture(dir, { modules, nodes, edges, a2aContracts }) {
  writeJson(join(dir, "normalized-requirement.json"), { id: "req-remote", title: "Remote A2A", status: "approved" });
  writeJson(join(dir, "process-flow.json"), { nodes, edges, validation: { errors: [] } });
  writeJson(join(dir, "module-candidates.json"), modules.map((m) => ({ id: m.id, status: "approved", missing_information: [] })));
  writeJson(join(dir, "analysis-result.json"), { a2aContracts });
  writeJson(join(dir, "af-run-manifest.json"), {
    requirement_id: "req-remote",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(dir, "scaffold-plan.json"), {
    requirement_id: "req-remote", source: "approved_workbench_artifact", raw_requirement_to_code: false,
    output_mode: "runnable", modules, runtime_contracts: [], excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

const remoteGraph = {
  nodes: [
    { id: "in1", node_kind: "input" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "r", node_kind: "remote_a2a", module_id: "mod-r", owner_scope: "remote" },
    { id: "out1", node_kind: "output" }
  ],
  edges: [
    { from: "in1", to: "a", edge_kind: "event_output", execution_semantics: "normal_transition" },
    { from: "a", to: "r", edge_kind: "remote_a2a", execution_semantics: "boundary_crossing", a2a_contract_id: "a2a-001", is_remote_boundary_crossing: true },
    { from: "r", to: "out1", edge_kind: "remote_a2a", execution_semantics: "boundary_crossing", a2a_contract_id: "a2a-001", is_remote_boundary_crossing: true }
  ]
};

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
    const reqs = readFileSync(join(here, "..", "requirements", "adk-runtime.txt"), "utf8");
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
  const [agentBase] = baseModules(true);
  const unconnectedAdapter = baseModules(true)[1];
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
    if (manifest.output_mode === "runnable") assertRunnableBundle(cliOutputRoot);
    else assertSmokeBundle(cliOutputRoot);
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
