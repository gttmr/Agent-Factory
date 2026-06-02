#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const generator = join(here, "generate-adk-source.mjs");

// ---------------------------------------------------------------------------
// Minimal hermetic fixture: input -> agent -> adapter -> output.
// ---------------------------------------------------------------------------

function baseModules(runnable) {
  return [
    {
      id: "mod-gen-agent",
      name: "gen_agent",
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
      instruction: runnable ? "You are gen_agent. Use only synthetic inputs." : null,
      model: runnable ? "gemini-2.5-flash" : null,
      access_protocol: null,
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      mcp_auth_mode: null,
      runtime_binding: null
    },
    {
      id: "mod-gen-adapter",
      name: "gen_adapter",
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
      access_protocol: null,
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      mcp_auth_mode: null,
      runtime_binding: null
    }
  ];
}

function writeFixture(dir, { runnable }) {
  writeJson(join(dir, "normalized-requirement.json"), {
    id: "req-gen-test",
    title: "Generator test workflow",
    status: "approved"
  });
  writeJson(join(dir, "process-flow.json"), {
    nodes: [
      { id: "in1", node_kind: "input" },
      { id: "mod-gen-agent", node_kind: "agent", module_id: "mod-gen-agent" },
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
    modules: baseModules(runnable),
    runtime_contracts: [],
    excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

function generate({ runnable }) {
  const artifactRoot = mkdtempSync(join(tmpdir(), `af-gen-${runnable ? "runnable" : "smoke"}-`));
  try {
    writeFixture(artifactRoot, { runnable });
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
    contractTest: readFileSync(join(outputRoot, "tests", "test_workflow_contract.py"), "utf8")
  };
}

function assertCommonBundle(outputRoot, manifest) {
  assert.equal(manifest.guardrails.raw_requirement_to_code, false);
  assert.equal(manifest.guardrails.private_data_or_endpoints, false);
  assert.equal(manifest.scaffold_plan.source, "approved_workbench_artifact");
  assert.equal(manifest.scaffold_plan.raw_requirement_to_code, false);
  assert.ok(manifest.graph_ir, "manifest must include graph_ir");
  assert.ok(existsSync(join(outputRoot, "scaffold-plan.json")));
  assert.ok(existsSync(join(outputRoot, "implementation-handoff.md")));
  assert.ok(existsSync(join(outputRoot, "runtime-chat-smoke.json")));
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
  assert.ok(existsSync(join(outputRoot, ".env.example")), "runnable bundle must emit .env.example");
  assert.ok(existsSync(join(outputRoot, ".gitignore")), "runnable bundle must emit .gitignore");
  return packageName;
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

test("runnable mode rejects Graph IR shapes it cannot lower (v1: DAG + fan-out/fan-in)", () => {
  const cases = [
    { name: "module-bound human_input node", mutate: (pf) => pf.nodes.push({ id: "h1", node_kind: "human_input", module_id: "mod-gen-agent" }) },
    { name: "router node", mutate: (pf) => pf.nodes.push({ id: "r1", node_kind: "router", module_id: null }) },
    { name: "module_id-null function node", mutate: (pf) => pf.nodes.push({ id: "f1", node_kind: "function", module_id: null }) },
    { name: "route edge", mutate: (pf) => { pf.edges[0].edge_kind = "route"; } },
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
