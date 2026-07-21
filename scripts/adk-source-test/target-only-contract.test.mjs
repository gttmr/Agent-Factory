import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadArtifactContext } from "../adk-source/context.mjs";
import {
  generateBundle,
  targetAsset,
  targetEdge,
  targetEvidence,
  targetGraph,
  targetRequirement,
  targetRuntimeContract,
  writeJson
} from "./fixtures.mjs";

test("generator consumes strict Target-only v2 artifacts without compatibility projection", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-only-"));
  const outputRoot = join(artifactRoot, "runtime-handoff");
  try {
    writeTargetOnlyFixture(artifactRoot);
    const context = loadArtifactContext(artifactRoot);
    assert.equal(context.graph.graph_id, "graph.target-only");
    assert.equal(context.assets[0].asset_id, "agent.writer");
    assert.equal("processFlow" in context, false);
    assert.equal("moduleCandidates" in context, false);
    assert.equal("modules" in context, false);
    generateBundle(artifactRoot, outputRoot);

    const packageRoot = join(outputRoot, "target_only_adk");
    assert.equal(readFileSync(join(packageRoot, "nodes", "tools.py"), "utf8").includes("Adapter"), false);
    assert.equal(readFileSync(join(packageRoot, "nodes", "subworkflows.py"), "utf8").includes("workflow_call"), false);
    const manifest = JSON.parse(readFileSync(join(packageRoot, "workflow_manifest.json"), "utf8"));
    assert.deepEqual(manifest.runtime.connected_tools, []);
    assert.equal("connected_adapters" in manifest.runtime, false);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("generator rejects removed artifact filenames instead of ignoring them", () => {
  for (const [name, replacement, value] of [
    ["module-candidates.json", "asset-candidates.json", []],
    ["process-flow.json", "graph-ir.json", {}],
    ["commonization-notes.json", "analysis-result.json", {}]
  ]) {
    const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-removed-file-"));
    try {
      writeTargetOnlyFixture(artifactRoot);
      writeJson(join(artifactRoot, name), value);
      assert.throws(
        () => loadArtifactContext(artifactRoot),
        new RegExp(`${name.replace(".", "\\.")} is removed; use ${replacement.replace(".", "\\.")}`)
      );
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  }
});

test("generator requires a complete run manifest instead of backfilling approval state", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-manifest-"));
  try {
    writeTargetOnlyFixture(artifactRoot);
    writeJson(join(artifactRoot, "af-run-manifest.json"), {
      requirement_id: "req-target-only",
      approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
      stages: { design: { status: "complete" } }
    });
    assert.throws(() => loadArtifactContext(artifactRoot), /af-run-manifest\.json\.artifact_root|af-run-manifest\.json\.current_stage/);

    rmSync(join(artifactRoot, "af-run-manifest.json"));
    assert.throws(() => loadArtifactContext(artifactRoot), /Missing required artifact: .*af-run-manifest\.json/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("generator rejects a run manifest that skips the approval hierarchy", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-manifest-hierarchy-"));
  try {
    writeTargetOnlyFixture(artifactRoot);
    const manifestPath = join(artifactRoot, "af-run-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.approvals.boundaries_approved = false;
    manifest.approvals.runtime_contracts_approved = true;
    writeJson(manifestPath, manifest);
    assert.throws(() => loadArtifactContext(artifactRoot), /boundaries_approved.*true/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("generator rejects stdio MCP instead of emitting it as streamable HTTP", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-mock-binding-"));
  try {
    writeTargetOnlyFixture(artifactRoot);
    const analysisPath = join(artifactRoot, "analysis-result.json");
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const analysis = JSON.parse(readFileSync(analysisPath, "utf8"));
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    const binding = { kind: "mcp", server_ref: "mock.lookup", tool_name: "lookup" };
    const connection = { transport: "stdio" };
    const contract = targetRuntimeContract({
      contractId: "rtc-target-stdio",
      contractKind: "mcp_connection",
      assetId: "tool.lookup"
    });
    analysis.assetCandidates[1].binding = binding;
    analysis.assetCandidates[1].connection = connection;
    analysis.runtimeContracts = [contract];
    plan.assets[1].binding = structuredClone(binding);
    plan.assets[1].connection = structuredClone(connection);
    plan.runtime_contracts = [structuredClone(contract)];
    writeJson(analysisPath, analysis);
    writeJson(planPath, plan);

    assert.throws(
      () => loadArtifactContext(artifactRoot),
      /unsupported MCP transport stdio.*tool\.lookup.*will not emit stdio as HTTP/i
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

function writeTargetOnlyFixture(root) {
  const requirement = targetRequirement("req-target-only", { title: "Target only" });
  const assets = [
    targetAsset("agent.writer", "agent", { source_requirement_id: requirement.id }),
    targetAsset("tool.lookup", "tool", {
      source_requirement_id: requirement.id,
      binding: { kind: "function" },
      connection: { transport: "in_process" },
      inputs: [{ name: "key", type: "string", required: true }],
      outputs: [{ name: "value", type: "object" }]
    })
  ];
  const graph = targetGraph({
    requirementId: requirement.id,
    nodes: [
      { id: "input", node_kind: "input" },
      { id: "writer", node_kind: "agent", agent_ref: "agent.writer", available_tools: [] },
      { id: "lookup", node_kind: "tool", tool_ref: "tool.lookup", invocation_control: "workflow" },
      { id: "output", node_kind: "output" }
    ],
    edges: [targetEdge("input", "writer"), targetEdge("writer", "lookup"), targetEdge("lookup", "output")]
  });
  writeJson(join(root, "analysis-result.json"), {
    contract_version: "2.0",
    normalizedRequirement: requirement,
    evidence: targetEvidence(requirement),
    assetCandidates: assets,
    a2aContracts: [],
    runtimeContracts: [],
    graph
  });
  writeJson(join(root, "scaffold-plan.json"), {
    contract_version: "2.0",
    requirement_id: requirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    package_name: "target_only_adk",
    assets,
    graph,
    runtime_contracts: [],
    excluded_assets: [],
    manifest: { catalog_bound_assets: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
  writeJson(join(root, "af-run-manifest.json"), {
    requirement_id: requirement.id,
    artifact_root: `artifacts/af/${requirement.id}`,
    current_stage: "build",
    stages: {
      analyze: { status: "complete", outputs: ["analysis-result.json"] },
      design: { status: "complete", outputs: ["scaffold-plan.json"] },
      build: { status: "pending", outputs: [] },
      verify: { status: "pending", outputs: [] }
    },
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: false
    },
    validation: { commands: [], last_result: "not_run" }
  });
}
