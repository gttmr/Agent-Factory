import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDynamicRunnablePlan, dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";
import { channelModules, discoverGeneratedPackage, generateBundle, repoRoot, writeChannelFixture } from "./fixtures.mjs";
import {
  compileGeneratedPython,
  executeGeneratedDynamicTrace,
  executeGeneratedPythonSymbols
} from "./generated-python-runtime.mjs";

test("runnable lowers reviewed loop control through an ADK dynamic workflow node", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-draft", name: "Draft Agent" },
    {
      ...unconnectedAdapter,
      id: "mod-review",
      name: "Review Adapter",
      outputs: [{ name: "dynamic_review_envelope", type: "object", required: true }]
    }
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
    generateBundle(artifactRoot, outputRoot);
    const sourcePath = join(outputRoot, "req_ch_adk", "agent.py");
    const source = readFileSync(sourcePath, "utf8");
    assert.match(source, /from google\.adk\.workflow import FunctionNode, START, Workflow, node/);
    assert.match(source, /from google\.genai import types/);
    assert.match(source, /from google\.adk\.events import Event, RequestInput/);
    assert.match(source, /@node\(name="dynamic_workflow", rerun_on_resume=True\)/);
    assert.match(source, /while True:/);
    assert.match(source, /ctx\.state\["af_dynamic_loop:loop-control"\]/);
    assert.match(
      source,
      /_dynamic_should_continue\(_loop_decision, \["retry", "revise"\], \["done", "approved"\], "loop_exit"\)/
    );
    assert.match(source, /def _terminal_out1\(ctx: Context, node_input=None\):/);
    assert.match(source, /yield Event\(\s*author="agent_factory_terminal",\s*content=types\.Content\(/s);
    assert.match(source, /node_out1 = FunctionNode\(func=_terminal_out1, name="out1"\)/);
    assert.match(source, /root_agent = Workflow\(\s*name="req_ch_adk",\s*description=.*,\s*edges=\[\(START, dynamic_workflow\)\],\s*\)/s);
    assert.doesNotMatch(source, /loop Graph IR yet|wait for loop lowering/);
    assert.doesNotMatch(source, /create_task|gather\(/);
    compileGeneratedPython(sourcePath);
    const trace = executeGeneratedDynamicTrace({
      sourcePath,
      initialInput: { request: "draft" },
      nodeOutputs: {
        agent_mod_draft: { draft: 1 },
        node_mod_review: { decision: "approved" },
        node_loop_control: { decision: "approved" },
        node_out1: { terminal: true }
      }
    });
    assert.deepEqual(trace.trace.map((row) => row.symbol), [
      "agent_mod_draft",
      "node_mod_review",
      "node_loop_control",
      "node_out1"
    ]);
    assert.deepEqual(trace.trace[0].input, { request: "draft" });
    assert.deepEqual(trace.trace[1].input, { draft: 1 });
    assert.deepEqual(trace.trace[2].input, { decision: "approved" });
    assert.deepEqual(trace.trace[3].input, { decision: "approved" }, "terminal must receive the loop exit result");
    assert.deepEqual(trace.trace.map((row) => row.run_id), [
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("draft")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("review")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("loop-control")}`,
      `run-node-${dynamicRunIdComponent("out1")}`
    ]);
    assert.equal(
      executeGeneratedPythonSymbols({
        sourcePath,
        names: ["PAYLOAD_WRAPPER_KEYS", "_content_text", "_json_payload", "_payload_value"],
        prelude: "import json\nfrom typing import Any",
        body: "result = _payload_value({'dynamic_review_envelope': {'needle': 'dynamic-ok'}}, 'needle')"
      }),
      "dynamic-ok"
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("scenario-d derives the complete human-review loop path from edges", () => {
  const analysis = JSON.parse(
    readFileSync(join(repoRoot, "templates", "regression-scenarios", "scenario-d-graph-workflow", "analysis-result.json"), "utf8")
  );
  const graphModuleIds = new Set(analysis.processFlow.nodes.map((node) => node.module_id).filter(Boolean));
  const modules = analysis.moduleCandidates.filter((module) => graphModuleIds.has(module.id));
  const plan = buildDynamicRunnablePlan({ modules, processFlow: analysis.processFlow });
  assert.deepEqual(plan.steps.slice(0, 3).map((step) => [step.kind, step.nodeId]), [
    ["run", "mod-002"],
    ["run", "mod-003"],
    ["join", "join-001"]
  ]);
  const loop = plan.steps.find((step) => step.kind === "loop");
  assert.ok(loop);
  assert.deepEqual(loop.bodySteps.map((step) => step.nodeId), [
    "mod-004",
    "mod-005",
    "human_input_001",
    "mod-006"
  ]);
  assert.equal(loop.controlNodeId, "loop_control_001");
  assert.deepEqual([plan.steps.at(-1)?.kind, plan.steps.at(-1)?.nodeId], ["terminal", "drafted_response"]);
  assert.deepEqual(new Set(plan.consumedEdgeIds), new Set(analysis.processFlow.edges.map((edge) => edge.id)));

  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-scenario-d-dynamic-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: analysis.processFlow.nodes,
      edges: analysis.processFlow.edges,
      containers: analysis.processFlow.containers
    });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const trace = executeGeneratedDynamicTrace({
      sourcePath: join(outputRoot, discoverGeneratedPackage(outputRoot), "agent.py"),
      initialInput: { request: "scenario-d" },
      nodeOutputs: {
        node_mod_002: { evidence: "a" },
        node_mod_003: { evidence: "b" },
        agent_mod_004: { draft: 1 },
        node_mod_005: { review: "needed" },
        node_human_input_001: { response: "approved" },
        agent_mod_006: { revision: "approved" },
        node_loop_control_001: { decision: "approved" },
        node_drafted_response: { terminal: true }
      }
    });
    assert.deepEqual(trace.trace.map((row) => row.symbol), [
      "node_mod_002",
      "node_mod_003",
      "agent_mod_004",
      "node_mod_005",
      "node_human_input_001",
      "agent_mod_006",
      "node_loop_control_001",
      "node_drafted_response"
    ]);
    assert.deepEqual(trace.trace[2].input, {
      evidence_lookup_a: { evidence: "a" },
      evidence_lookup_b: { evidence: "b" }
    });
    assert.deepEqual(trace.trace.at(-1).input, { decision: "approved" });
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
