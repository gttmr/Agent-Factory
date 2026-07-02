import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable lowers reviewed loop control through an ADK dynamic workflow node", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-draft", name: "Draft Agent" },
    { ...unconnectedAdapter, id: "mod-review", name: "Review Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-loop-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "draft", node_kind: "agent", module_id: "mod-draft" },
        { id: "review", node_kind: "adapter", module_id: "mod-review" },
        { id: "loop-control", node_kind: "loop_control", module_id: null },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "draft" },
        { from: "draft", to: "review" },
        { from: "review", to: "loop-control" },
        {
          from: "loop-control",
          to: "draft",
          edge_kind: "control",
          execution_semantics: "loop_back",
          route_condition: "decision == retry",
          route_aliases: ["revise"]
        },
        {
          from: "loop-control",
          to: "out1",
          edge_kind: "control",
          execution_semantics: "loop_exit",
          route_condition: "decision == done",
          route_aliases: ["approved"],
          is_default_route: true
        }
      ],
      containers: [
        {
          id: "container-loop",
          container_kind: "loop_region",
          contains_node_ids: ["draft", "review", "loop-control"],
          entry_node_ids: ["draft"],
          exit_node_ids: ["loop-control"]
        }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    execFileSync("python3", ["-c", "import ast, sys; ast.parse(sys.stdin.read())"], { input: source, stdio: "pipe" });
    assert.match(source, /from google\.adk\.workflow import FunctionNode, START, Workflow, node/);
    assert.match(source, /@node\(name="dynamic_workflow", rerun_on_resume=True\)/);
    assert.match(source, /while True:/);
    assert.match(source, /await ctx\.run_node\(agent_mod_draft, payload\)/);
    assert.match(source, /await ctx\.run_node\(node_mod_review, payload\)/);
    assert.match(source, /ctx\.state\["af_dynamic_loop:loop-control"\]/);
    assert.match(
      source,
      /_dynamic_should_continue\(_loop_decision, \["retry", "revise"\], \["done", "approved"\], "loop_exit"\)/
    );
    assert.match(source, /root_agent = Workflow\(\s*name="req_ch_adk",\s*description=.*,\s*edges=\[\(START, dynamic_workflow\)\],\s*\)/s);
    assert.doesNotMatch(source, /loop Graph IR yet|wait for loop lowering/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
