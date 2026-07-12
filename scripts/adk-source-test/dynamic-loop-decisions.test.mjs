import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";
import { channelModules, generateBundle, writeChannelFixture } from "./fixtures.mjs";
import {
  executeGeneratedDynamicTrace,
  generatedPythonExecutable
} from "./generated-python-runtime.mjs";

function assertDynamicDecisionHelpers(agentSource, cases) {
  const python = `
import ast
import json
import sys

source = sys.stdin.read()
module = ast.parse(source)
wanted = {"_dynamic_decision_text", "_dynamic_matches", "_dynamic_should_continue"}
helpers = [node for node in module.body if isinstance(node, ast.FunctionDef) and node.name in wanted]
namespace = {"Any": object}
exec(compile(ast.Module(body=helpers, type_ignores=[]), "<generated-dynamic-helpers>", "exec"), namespace)
generated_call = next(
    node for node in ast.walk(module)
    if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "_dynamic_should_continue"
)
generated_back_aliases = ast.literal_eval(generated_call.args[1])
generated_exit_aliases = ast.literal_eval(generated_call.args[2])
generated_default_action = ast.literal_eval(generated_call.args[3])
for case in json.loads(${JSON.stringify(JSON.stringify(cases))}):
    actual = namespace["_dynamic_should_continue"](
        case["value"],
        case.get("backAliases", generated_back_aliases),
        case.get("exitAliases", generated_exit_aliases),
        case.get("defaultAction", generated_default_action),
    )
    expected = case["shouldContinue"]
    if actual != expected:
        raise AssertionError(f"{case['name']}: expected {expected}, got {actual}")
`;
  execFileSync(generatedPythonExecutable(), ["-c", python], { input: agentSource, stdio: "pipe" });
}

test("dynamic loop decisions exact-match aliases and fall back to reviewed human continue default", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-param-check", name: "Parameter Check Agent" },
    { ...unconnectedAdapter, id: "mod-fixed-adapter", name: "Fixed Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-loop-hitl-default-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "param-check", node_kind: "agent", module_id: "mod-param-check" },
        {
          id: "operator-input",
          node_kind: "human_input",
          module_id: null,
          human_input_contract: {
            message: "Provide missing parameters or reply complete.",
            payload_schema_ref: "schema:param-status",
            response_schema_ref: "str",
            response_mapping: { response: "latest_human_response" },
            choice_options: ["provide_missing_parameters", "complete"],
            accepted_aliases: {
              provide_missing_parameters: ["missing", "continue", "not ready"],
              complete: ["complete", "done", "ready"]
            },
            default_choice: "provide_missing_parameters"
          }
        },
        { id: "loop-control", node_kind: "loop_control", module_id: null },
        { id: "fixed-adapter", node_kind: "adapter_call", module_id: "mod-fixed-adapter" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "param-check" },
        { from: "param-check", to: "operator-input" },
        { from: "operator-input", to: "loop-control" },
        {
          from: "loop-control",
          to: "param-check",
          edge_kind: "control",
          execution_semantics: "loop_back",
          route_condition: "decision == provide_missing_parameters",
          route_aliases: ["missing", "continue", "not ready"],
          is_default_route: false
        },
        {
          from: "loop-control",
          to: "fixed-adapter",
          edge_kind: "control",
          execution_semantics: "loop_exit",
          route_condition: "decision == complete",
          route_aliases: ["done", "ready"],
          is_default_route: true
        },
        { from: "fixed-adapter", to: "out1" }
      ],
      containers: [
        {
          id: "container-loop",
          container_kind: "loop_region",
          contains_node_ids: ["param-check", "operator-input", "loop-control"],
          entry_node_ids: ["param-check"],
          exit_node_ids: ["loop-control"]
        }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const sourcePath = join(outputRoot, "req_ch_adk", "agent.py");
    const source = readFileSync(sourcePath, "utf8");

    assertDynamicDecisionHelpers(source, [
      {
        name: "unknown text uses reviewed human continue default",
        value: "operator typed an unrelated note",
        shouldContinue: true
      },
      {
        name: "incomplete is not the complete exit alias",
        value: "incomplete",
        shouldContinue: true
      },
      {
        name: "exact complete exits to the fixed adapter",
        value: "complete",
        shouldContinue: false
      }
    ]);
    const trace = executeGeneratedDynamicTrace({
      sourcePath,
      initialInput: { request: "check" },
      nodeOutputs: {
        agent_mod_param_check: [{ check: 1 }, { check: 2 }],
        node_operator_input: [
          { response: "provide_missing_parameters" },
          { response: "complete" }
        ],
        node_loop_control: [
          { response: "provide_missing_parameters" },
          { response: "complete" }
        ],
        node_mod_fixed_adapter: { fixed: true },
        node_out1: { terminal: true }
      }
    });
    assert.deepEqual(trace.trace.map((row) => row.symbol), [
      "agent_mod_param_check",
      "node_operator_input",
      "node_loop_control",
      "agent_mod_param_check",
      "node_operator_input",
      "node_loop_control",
      "node_mod_fixed_adapter",
      "node_out1"
    ]);
    assert.deepEqual(trace.trace[4].input, { check: 2 }, "iteration two must not reuse iteration-one results");
    assert.deepEqual(trace.trace.slice(0, 6).map((row) => row.run_id), [
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("param-check")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("operator-input")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-0-${dynamicRunIdComponent("loop-control")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-1-${dynamicRunIdComponent("param-check")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-1-${dynamicRunIdComponent("operator-input")}`,
      `run-loop-${dynamicRunIdComponent("container-loop")}-iteration-1-${dynamicRunIdComponent("loop-control")}`
    ]);
    const bounded = executeGeneratedDynamicTrace({
      sourcePath,
      initialInput: { request: "bounded" },
      nodeOutputs: {
        agent_mod_param_check: [{ check: 1 }, { check: 2 }, { check: 3 }],
        node_operator_input: { response: "provide_missing_parameters" },
        node_loop_control: { response: "provide_missing_parameters" },
        node_mod_fixed_adapter: { fixed: true },
        node_out1: { terminal: true }
      }
    });
    assert.equal(bounded.trace.filter((row) => row.symbol === "node_loop_control").length, 3);
    assert.equal(bounded.state["af_dynamic_loop:loop-control:max_iterations_reached"], true);
    assert.deepEqual(bounded.trace.at(-1).input, { fixed: true });
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
