import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvedRegistryA2AContract } from "./cdp-a2a-contracts.mjs";
import { baseModules, discoverGeneratedPackage, generateBundle, remoteModule, writeJson } from "./fixtures.mjs";

function registryProjectionContract() {
  return {
    scaffold_level: "mock_testable_skeleton",
    target_runtime: "adk_python_2_x",
    generation_mode: "deterministic_template",
    implementation_template: "remote_a2a_registry_projection_stub",
    manual_completion_required: true,
    developer_todos: ["review Remote A2A provider projection"]
  };
}

function registryDiscoveryModule(includeSelector, moduleOverrides) {
  const [, adapter] = baseModules(true);
  return {
    ...adapter,
    id: "mod-registry-discovery",
    name: "Agent Registry Discovery Adapter",
    outputs: [{ name: "agent_registry_snapshot", type: "object", required: true }],
    runtime_binding: "local_function",
    invoke_binding: "local_function",
    adk_skeleton_contract: includeSelector ? registryProjectionContract() : undefined,
    ...moduleOverrides
  };
}

function registryModules(registry, includeProvider, includeScaffoldModule) {
  return [
    ...(includeScaffoldModule ? [registry] : []),
    ...(!includeProvider
      ? []
      : [
          remoteModule({
            id: "mod-reviewed-remote-agent",
            name: "reviewed_remote_agent",
            a2a_contract_id: "a2a-registry-001"
          })
        ])
  ];
}

function registryProcessFlow(registry, includeProvider, includeSelector, includeGraphNode, graphNodeOverrides) {
  const graphContract = includeSelector
    ? {
        ...registryProjectionContract(),
        ...(graphNodeOverrides.adk_skeleton_contract ?? {})
      }
    : undefined;
  return {
    nodes: [
      { id: "in", node_kind: "input" },
      ...(includeGraphNode
        ? [
            {
              id: "registry",
              node_kind: "adapter_call",
              module_id: registry.id,
              runtime_binding: "local_function",
              invoke_binding: "local_function",
              call_control: "fixed_by_workflow",
              ...graphNodeOverrides,
              adk_skeleton_contract: graphContract
            }
          ]
        : []),
      ...(includeProvider ? [{ id: "remote-provider", node_kind: "remote_a2a", module_id: "mod-reviewed-remote-agent", owner_scope: "remote" }] : []),
      { id: "out", node_kind: "output" }
    ],
    edges: [
      ...(includeGraphNode
        ? [
            { from: "in", to: "registry", edge_kind: "event_output", execution_semantics: "normal_transition" },
            { from: "registry", to: "out", edge_kind: "session_state", execution_semantics: "normal_transition", state_key: "agent_registry_snapshot" }
          ]
        : [{ from: "in", to: "out", edge_kind: "event_output", execution_semantics: "normal_transition" }])
    ],
    validation: { errors: [] }
  };
}

function writeRegistrySnapshotFixture(artifactRoot, {
  includeProvider,
  includeGraphSelector,
  includeScaffoldSelector,
  includeGraphNode,
  includeScaffoldModule,
  moduleOverrides,
  graphNodeOverrides
}) {
  const registry = registryDiscoveryModule(includeScaffoldSelector, moduleOverrides);
  const modules = registryModules(registry, includeProvider, includeScaffoldModule);
  writeJson(join(artifactRoot, "normalized-requirement.json"), { id: "req-registry", title: "Registry", status: "approved" });
  writeJson(
    join(artifactRoot, "process-flow.json"),
    registryProcessFlow(registry, includeProvider, includeGraphSelector, includeGraphNode, graphNodeOverrides)
  );
  writeJson(join(artifactRoot, "module-candidates.json"), modules.map((module) => ({ id: module.id, status: "approved", missing_information: [] })));
  writeJson(join(artifactRoot, "analysis-result.json"), {
    a2aContracts: includeProvider ? [approvedRegistryA2AContract()] : []
  });
  writeJson(join(artifactRoot, "af-run-manifest.json"), {
    requirement_id: "req-registry",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(artifactRoot, "scaffold-plan.json"), {
    requirement_id: "req-registry",
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

export function generateRegistryBundle({
  includeProvider,
  includeSelector = true,
  includeGraphSelector = includeSelector,
  includeScaffoldSelector = includeSelector,
  includeGraphNode = true,
  includeScaffoldModule = true,
  moduleOverrides = {},
  graphNodeOverrides = {}
}) {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-registry-snapshot-"));
  try {
    writeRegistrySnapshotFixture(artifactRoot, {
      includeProvider,
      includeGraphSelector,
      includeScaffoldSelector,
      includeGraphNode,
      includeScaffoldModule,
      moduleOverrides,
      graphNodeOverrides
    });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const packageName = discoverGeneratedPackage(outputRoot);
    return {
      sourcePath: join(outputRoot, packageName, "agent.py"),
      cleanup: () => rmSync(artifactRoot, { recursive: true, force: true })
    };
  } catch (error) {
    rmSync(artifactRoot, { recursive: true, force: true });
    throw error;
  }
}
