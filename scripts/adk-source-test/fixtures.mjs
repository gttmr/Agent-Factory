import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const scriptsRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = join(scriptsRoot, "..");
export const generator = join(scriptsRoot, "generate-adk-source.mjs");

export function baseModules(runnable, { connectedAdapter = false, agentExecutionMode = null } = {}) {
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
      model: runnable ? "hosted_vllm/local-model" : null,
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

export function writeFixture(dir, { runnable, connectedAdapter = false, agentExecutionMode = null }) {
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

export function generate({ runnable, connectedAdapter = false, agentExecutionMode = null }) {
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

export function discoverGeneratedPackage(root) {
  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(join(root, entry, "workflow_manifest.json")));
  if (packages.length !== 1) {
    throw new Error(`expected one generated ADK package, found ${packages.join(", ") || "none"}`);
  }
  return packages[0];
}

export function readBundle(outputRoot) {
  const packageName = discoverGeneratedPackage(outputRoot);
  return {
    packageName,
    manifest: JSON.parse(readFileSync(join(outputRoot, packageName, "workflow_manifest.json"), "utf8")),
    agentSource: readFileSync(join(outputRoot, packageName, "agent.py"), "utf8"),
    contractTest: readFileSync(join(outputRoot, packageName, "tests", "test_workflow_contract.py"), "utf8")
  };
}

export function collectFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export function collectGeneratorSourceFiles() {
  const files = [generator];
  const splitSourceRoot = join(scriptsRoot, "adk-source");
  if (existsSync(splitSourceRoot)) {
    files.push(...collectFiles(splitSourceRoot).filter((file) => file.endsWith(".mjs")));
  }
  return files.sort((a, b) => relative(repoRoot, a).localeCompare(relative(repoRoot, b)));
}

export function writeChannelFixture(dir, { modules, nodes, edges, containers = [] }) {
  writeJson(join(dir, "normalized-requirement.json"), { id: "req-ch", title: "Channel workflow", status: "approved" });
  writeJson(join(dir, "process-flow.json"), { nodes, edges, containers, validation: { errors: [] } });
  writeJson(join(dir, "module-candidates.json"), modules.map((m) => ({ id: m.id, status: "approved", missing_information: [] })));
  writeJson(join(dir, "af-run-manifest.json"), {
    requirement_id: "req-ch",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(dir, "scaffold-plan.json"), {
    requirement_id: "req-ch",
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    modules,
    runtime_contracts: [],
    excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

export function channelModules() {
  const [agentBase, unconnectedAdapter] = baseModules(true);
  const [, connectedAdapter] = baseModules(true, { connectedAdapter: true });
  return { agentBase, unconnectedAdapter, connectedAdapter };
}

export function remoteModule(overrides = {}) {
  return {
    id: "mod-r",
    name: "remote_partner_agent",
    module_category: "remote_a2a",
    agent_kind: null,
    workflow_kind: null,
    adapter_kind: null,
    remote_contract_kind: "a2a",
    scaffold_output: "runnable",
    no_runnable_business_logic: false,
    catalog_binding: null,
    developer_todos: ["review"],
    inputs: [],
    outputs: [{ name: "result", type: "object" }],
    risk_signals: [],
    required_review_fields: [],
    runtime_mock: null,
    instruction: null,
    model: null,
    access_protocol: "remote_a2a",
    mcp_server: null,
    mcp_tool_name: null,
    mcp_schema_ref: null,
    mcp_auth_mode: null,
    runtime_binding: "remote_a2a",
    a2a_contract_id: "a2a-001",
    smoke_spec: { sample_user_message: "go", synthetic_inputs: {}, expected_output_shape: {}, expected_event_markers: [], mock_sources: [], ready: true },
    ...overrides
  };
}

export function writeRemoteFixture(dir, { modules, nodes, edges, a2aContracts }) {
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
    requirement_id: "req-remote",
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    modules,
    runtime_contracts: [],
    excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

export const remoteGraph = {
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

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
