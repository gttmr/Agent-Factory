import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDynamicRunnablePlan, dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";
import { channelModules, generateBundle, readBundle, remoteModule, writeChannelFixture } from "./fixtures.mjs";

function linearContext({ nodeKind = "agent", module = null, edge = {} } = {}) {
  const { agentBase } = channelModules();
  const runtimeModule = module ?? { ...agentBase, id: "mod-run", name: "Run" };
  return {
    modules: [runtimeModule],
    processFlow: {
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "run", node_kind: nodeKind, module_id: runtimeModule.id },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { id: "e1", from: "in1", to: "run", ...edge },
        { id: "e2", from: "run", to: "out1", ...edge }
      ],
      containers: [{ id: "dynamic-root", container_kind: "dynamic_workflow" }]
    }
  };
}

function requiredMetadataForEdgeKind(edgeKind) {
  if (["session_state", "temp_state", "user_state", "app_state"].includes(edgeKind)) {
    return { state_key: "support_value" };
  }
  if (edgeKind === "artifact") return { artifact_key: "support.json" };
  return {};
}

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
      () => generateBundle(artifactRoot, join(artifactRoot, "out")),
      /loop_control loop-control requires reviewed route_condition/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("dynamic planning rejects loop_back that re-enters an explicit join", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-left", name: "Left" },
    { ...agentBase, id: "mod-right", name: "Right" },
    { ...agentBase, id: "mod-decision", name: "Decision" }
  ];
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules,
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "left", node_kind: "agent", module_id: "mod-left" },
          { id: "right", node_kind: "agent", module_id: "mod-right" },
          { id: "join1", node_kind: "join" },
          { id: "decision", node_kind: "agent", module_id: "mod-decision" },
          { id: "control", node_kind: "loop_control" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "left", execution_semantics: "fan_out" },
          { id: "e2", from: "in1", to: "right", execution_semantics: "fan_out" },
          { id: "e3", from: "left", to: "join1", execution_semantics: "fan_in" },
          { id: "e4", from: "right", to: "join1", execution_semantics: "fan_in" },
          { id: "e5", from: "join1", to: "decision" },
          { id: "e6", from: "decision", to: "control" },
          { id: "e7", from: "control", to: "join1", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
          { id: "e8", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
        ],
        containers: [
          { id: "loop", container_kind: "loop_region", contains_node_ids: ["join1", "decision", "control"], entry_node_ids: ["join1"], exit_node_ids: ["control"] }
        ]
      }
    }),
    /loop_back.*loop_control control.*explicit join join1.*re-enter a decision-consuming body step.*replace.*reviewed body step/i
  );
});

test("dynamic planning rejects a loop_back target that is an input seed", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-body", name: "Body" },
    { ...agentBase, id: "mod-after", name: "After" }
  ];
  const loopBackToInput = {
    modules,
    processFlow: {
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "body", node_kind: "agent", module_id: "mod-body" },
        { id: "control", node_kind: "loop_control" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { id: "e1", from: "in1", to: "body" },
        { id: "e2", from: "body", to: "control" },
        { id: "e3", from: "control", to: "in1", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
        { id: "e4", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
      ],
      containers: [
        { id: "loop", container_kind: "loop_region", contains_node_ids: ["in1", "body", "control"], entry_node_ids: ["in1"], exit_node_ids: ["control"] }
      ]
    }
  };
  assert.throws(
    () => buildDynamicRunnablePlan(loopBackToInput),
    /loop_back.*loop_control control.*input seed in1.*original node_input.*reviewed executable body or exit step/i
  );
});

test("dynamic planning rejects a loop_exit target that is an input seed", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-body", name: "Body" },
    { ...agentBase, id: "mod-after", name: "After" }
  ];
  const loopExitToInput = {
    modules,
    processFlow: {
      nodes: [
        { id: "start", node_kind: "input" },
        { id: "body", node_kind: "agent", module_id: "mod-body" },
        { id: "control", node_kind: "loop_control" },
        { id: "exit-input", node_kind: "input" },
        { id: "after", node_kind: "agent", module_id: "mod-after" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { id: "e1", from: "start", to: "body" },
        { id: "e2", from: "body", to: "control" },
        { id: "e3", from: "control", to: "body", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
        { id: "e4", from: "control", to: "exit-input", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true },
        { id: "e5", from: "exit-input", to: "after" },
        { id: "e6", from: "after", to: "out1" }
      ],
      containers: [
        { id: "loop", container_kind: "loop_region", contains_node_ids: ["body", "control"], entry_node_ids: ["body"], exit_node_ids: ["control"] }
      ]
    }
  };
  assert.throws(
    () => buildDynamicRunnablePlan(loopExitToInput),
    /loop_exit.*loop_control control.*input seed exit-input.*original node_input.*reviewed executable body or exit step/i
  );
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
    generateBundle(artifactRoot, outputRoot);
    const { manifest, agentSource } = readBundle(outputRoot);
    assert.equal(manifest.output_mode, "runnable");
    assert.match(agentSource, /@node\(name="dynamic_workflow", rerun_on_resume=True\)/);
    assert.ok(agentSource.includes(`run_id="run-node-${dynamicRunIdComponent("dynamic")}"`));
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("dynamic planning rejects unsanctioned cycles, self-loops, and unreachable active nodes", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "A" },
    { ...agentBase, id: "mod-b", name: "B" }
  ];
  const nodes = [
    { id: "in1", node_kind: "input" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "b", node_kind: "agent", module_id: "mod-b" },
    { id: "out1", node_kind: "output" }
  ];
  const context = (edges, extraNodes = []) => ({
    modules,
    processFlow: {
      nodes: [...nodes, ...extraNodes],
      edges,
      containers: [{ id: "dynamic-root", container_kind: "dynamic_workflow" }]
    }
  });
  assert.throws(
    () => buildDynamicRunnablePlan(context([
      { id: "e1", from: "in1", to: "a" },
      { id: "e2", from: "a", to: "b" },
      { id: "e3", from: "b", to: "a" },
      { id: "e4", from: "b", to: "out1" }
    ])),
    /rejects a cycle.*a, b/i
  );
  assert.throws(
    () => buildDynamicRunnablePlan(context([
      { id: "e1", from: "in1", to: "a" },
      { id: "e2", from: "a", to: "a" },
      { id: "e3", from: "a", to: "out1" }
    ])),
    /rejects a cycle.*a/i
  );
  assert.throws(
    () => buildDynamicRunnablePlan(context([
      { id: "e1", from: "in1", to: "a" },
      { id: "e2", from: "a", to: "out1" }
    ], [{ id: "out2", node_kind: "output" }])),
    /unreachable.*b, out2/i
  );
});

test("dynamic planning removes only reviewed loop_back edges and rejects a residual body cycle", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "A" },
    { ...agentBase, id: "mod-b", name: "B" }
  ];
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules,
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "a", node_kind: "agent", module_id: "mod-a" },
          { id: "b", node_kind: "agent", module_id: "mod-b" },
          { id: "control", node_kind: "loop_control" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "a" },
          { id: "e2", from: "a", to: "b" },
          { id: "e3", from: "b", to: "a" },
          { id: "e4", from: "b", to: "control" },
          { id: "e5", from: "control", to: "a", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
          { id: "e6", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
        ],
        containers: [
          { id: "loop", container_kind: "loop_region", contains_node_ids: ["a", "b", "control"], entry_node_ids: ["a"], exit_node_ids: ["control"] }
        ]
      }
    }),
    /rejects a cycle.*a, b/i
  );
});

test("dynamic planning rejects overlapping loop closures and illegal mid-body entry", () => {
  const { agentBase } = channelModules();
  const modules = [{ ...agentBase, id: "mod-shared", name: "Shared" }];
  const commonNodes = [
    { id: "in1", node_kind: "input" },
    { id: "shared", node_kind: "agent", module_id: "mod-shared" },
    { id: "control-a", node_kind: "loop_control" },
    { id: "control-b", node_kind: "loop_control" },
    { id: "out-a", node_kind: "output" },
    { id: "out-b", node_kind: "output" }
  ];
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules,
      processFlow: {
        nodes: commonNodes,
        edges: [
          { id: "e1", from: "in1", to: "shared" },
          { id: "e2", from: "shared", to: "control-a" },
          { id: "e3", from: "shared", to: "control-b" },
          { id: "e4", from: "control-a", to: "shared", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry-a"] },
          { id: "e5", from: "control-a", to: "out-a", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done-a"], is_default_route: true },
          { id: "e6", from: "control-b", to: "shared", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry-b"] },
          { id: "e7", from: "control-b", to: "out-b", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done-b"], is_default_route: true }
        ],
        containers: [
          { id: "loop-a", container_kind: "loop_region", contains_node_ids: ["shared", "control-a"], entry_node_ids: ["shared"], exit_node_ids: ["control-a"] },
          { id: "loop-b", container_kind: "loop_region", contains_node_ids: ["shared", "control-b"], entry_node_ids: ["shared"], exit_node_ids: ["control-b"] }
        ]
      }
    }),
    /overlapping loop closures/i
  );

  const midModules = [
    { ...agentBase, id: "mod-entry", name: "Entry" },
    { ...agentBase, id: "mod-mid", name: "Mid" }
  ];
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules: midModules,
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "entry", node_kind: "agent", module_id: "mod-entry" },
          { id: "mid", node_kind: "agent", module_id: "mod-mid" },
          { id: "control", node_kind: "loop_control" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "entry" },
          { id: "e2", from: "in1", to: "mid" },
          { id: "e3", from: "entry", to: "mid" },
          { id: "e4", from: "mid", to: "control" },
          { id: "e5", from: "control", to: "entry", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
          { id: "e6", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
        ],
        containers: [
          { id: "loop", container_kind: "loop_region", contains_node_ids: ["entry", "mid", "control"], entry_node_ids: ["entry"], exit_node_ids: ["control"] }
        ]
      }
    }),
    /illegal mid-body entry.*e2.*mid/i
  );
});

test("dynamic planning rejects a nested loop control inside an operational closure", () => {
  const { agentBase } = channelModules();
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules: [{ ...agentBase, id: "mod-entry", name: "Entry" }],
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "entry", node_kind: "agent", module_id: "mod-entry" },
          { id: "outer-control", node_kind: "loop_control" },
          { id: "inner-control", node_kind: "loop_control" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "entry" },
          { id: "e2", from: "entry", to: "inner-control" },
          { id: "e3", from: "inner-control", to: "outer-control" },
          { id: "e4", from: "outer-control", to: "entry", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
          { id: "e5", from: "outer-control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
        ],
        containers: [
          { id: "outer-loop", container_kind: "loop_region", contains_node_ids: ["entry", "outer-control", "inner-control"], entry_node_ids: ["entry"], exit_node_ids: ["outer-control"] }
        ]
      }
    }),
    /nested loop closures.*inner-control/i
  );
});

test("dynamic support matrix records every accepted module node kind and ordinary edge semantic", () => {
  for (const nodeKind of [
    "agent",
    "function",
    "tool",
    "adapter",
    "adapter_call",
    "workflow",
    "workflow_call",
    "remote_a2a",
    "remote_agent_call"
  ]) {
    const plan = buildDynamicRunnablePlan(linearContext({ nodeKind }));
    assert.equal(plan.coverage.get("run"), "run", nodeKind);
  }
  for (const edgeKind of [
    "event_output",
    "event_message",
    "session_state",
    "temp_state",
    "user_state",
    "app_state",
    "artifact"
  ]) {
    const plan = buildDynamicRunnablePlan(
      linearContext({ edge: { edge_kind: edgeKind, ...requiredMetadataForEdgeKind(edgeKind) } })
    );
    assert.deepEqual(new Set(plan.consumedEdgeIds), new Set(["e1", "e2"]), edgeKind);
  }
  for (const executionSemantics of ["normal_transition", "fan_out", "fan_in"]) {
    const plan = buildDynamicRunnablePlan(linearContext({ edge: { execution_semantics: executionSemantics } }));
    assert.deepEqual(new Set(plan.consumedEdgeIds), new Set(["e1", "e2"]), executionSemantics);
  }
  const remote = remoteModule();
  const remotePlan = buildDynamicRunnablePlan(
    linearContext({
      nodeKind: "remote_a2a",
      module: remote,
      edge: {
        edge_kind: "remote_a2a",
        execution_semantics: "boundary_crossing",
        is_remote_boundary_crossing: true,
        a2a_contract_id: "a2a-001"
      }
    })
  );
  assert.equal(remotePlan.coverage.get("run"), "run");
});

test("dynamic guards truthfully reject unsupported nodes, schemas, and malformed edge contracts", () => {
  assert.throws(() => buildDynamicRunnablePlan(linearContext({ nodeKind: "callback_wait" })), /cannot lower.*callback_wait/i);
  const structured = linearContext();
  structured.processFlow.nodes[1] = {
    id: "run",
    node_kind: "human_input",
    human_input_contract: { response_schema_ref: "schema:complex" }
  };
  assert.throws(() => buildDynamicRunnablePlan(structured), /structured human_input.*schema:complex/i);
  for (const edge of [
    { edge_kind: "unknown_kind" },
    { execution_semantics: "unknown_semantic" },
    { execution_semantics: "boundary_crossing" }
  ]) {
    assert.throws(() => buildDynamicRunnablePlan(linearContext({ edge })), /does not support these edges/i);
  }
  const invalid = linearContext();
  invalid.processFlow.edges[0] = null;
  assert.throws(() => buildDynamicRunnablePlan(invalid), /invalid edge record at index 0/i);
});

test("dynamic run IDs encode raw IDs injectively and join keys reject lossy runtime-name collisions", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "First" },
    { ...agentBase, id: "mod-b", name: "Second" }
  ];
  const plan = buildDynamicRunnablePlan({
      modules,
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "a-b", node_kind: "agent", module_id: "mod-a" },
          { id: "a_b", node_kind: "agent", module_id: "mod-b" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "a-b" },
          { id: "e2", from: "a-b", to: "a_b" },
          { id: "e3", from: "a_b", to: "out1" }
        ]
      }
    });
  assert.deepEqual(
    plan.steps.filter((step) => step.kind === "run").map((step) => step.runId),
    [`run-node-${dynamicRunIdComponent("a-b")}`, `run-node-${dynamicRunIdComponent("a_b")}`]
  );

  assert.throws(
    () => buildDynamicRunnablePlan({
      modules: [],
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "human-a", node_kind: "human_input" },
          { id: "human_a", node_kind: "human_input" },
          { id: "join1", node_kind: "join" },
          { id: "out1", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "human-a", execution_semantics: "fan_out" },
          { id: "e2", from: "in1", to: "human_a", execution_semantics: "fan_out" },
          { id: "e3", from: "human-a", to: "join1", execution_semantics: "fan_in" },
          { id: "e4", from: "human_a", to: "join1", execution_semantics: "fan_in" },
          { id: "e5", from: "join1", to: "out1" }
        ]
      }
    }),
    /ambiguous join keys.*human-a.*human_a/i
  );

  assert.throws(
    () => buildDynamicRunnablePlan({
      modules: [],
      processFlow: {
        nodes: [
          { id: "in1", node_kind: "input" },
          { id: "review-input", node_kind: "human_input" },
          { id: "review_input", node_kind: "output" }
        ],
        edges: [
          { id: "e1", from: "in1", to: "review-input" },
          { id: "e2", from: "review-input", to: "review_input" }
        ]
      }
    }),
    /ambiguous Python node symbol.*review-input.*review_input/i
  );
});
