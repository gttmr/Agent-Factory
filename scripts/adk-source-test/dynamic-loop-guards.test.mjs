import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, readBundle, writeChannelFixture } from "./fixtures.mjs";

test("runnable rejects loop control edges without reviewed loop decisions", () => {
  const { agentBase } = channelModules();
  const modules = [{ ...agentBase, id: "mod-draft", name: "Draft Agent" }];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-loop-reject-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "draft", node_kind: "agent", module_id: "mod-draft" },
        { id: "loop-control", node_kind: "loop_control", module_id: null },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "draft" },
        { from: "draft", to: "loop-control" },
        { from: "loop-control", to: "draft", edge_kind: "control", execution_semantics: "loop_back" },
        { from: "loop-control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit" }
      ],
      containers: [
        {
          id: "container-loop",
          container_kind: "loop_region",
          contains_node_ids: ["draft", "loop-control"],
          entry_node_ids: ["draft"],
          exit_node_ids: ["loop-control"]
        }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /loop_control loop-control requires reviewed route_condition/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable dynamic workflow modules use the internal dynamic builder without a new output mode", () => {
  const { unconnectedAdapter } = channelModules();
  const dynamicWorkflow = {
    ...unconnectedAdapter,
    id: "mod-dynamic",
    name: "Dynamic Workflow",
    module_category: "workflow",
    workflow_kind: "dynamic",
    adapter_kind: null,
    node_kind: "workflow"
  };
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-module-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules: [dynamicWorkflow],
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "dynamic", node_kind: "workflow", module_id: "mod-dynamic" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "dynamic" },
        { from: "dynamic", to: "out1" }
      ],
      containers: [
        {
          id: "container-dynamic",
          container_kind: "dynamic_workflow",
          contains_node_ids: ["dynamic"],
          entry_node_ids: ["dynamic"],
          exit_node_ids: ["dynamic"]
        }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const { manifest, agentSource } = readBundle(outputRoot);
    assert.equal(manifest.output_mode, "runnable");
    assert.match(agentSource, /@node\(name="dynamic_workflow", rerun_on_resume=True\)/);
    assert.match(agentSource, /await ctx\.run_node\(node_mod_dynamic, payload\)/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
