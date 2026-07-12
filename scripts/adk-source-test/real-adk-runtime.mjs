#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { channelModules, discoverGeneratedPackage, generateBundle, writeChannelFixture } from "./fixtures.mjs";
import { generatedPythonExecutable } from "./generated-python-runtime.mjs";
import { dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";

const prepareOnly = process.argv[2] === "--prepare-only";
const preparedRoot = prepareOnly ? process.argv[3] : null;
if (prepareOnly && !preparedRoot) throw new Error("--prepare-only requires a target directory under /tmp");
if (preparedRoot) mkdirSync(preparedRoot, { recursive: true });
const artifactRoot = preparedRoot ?? mkdtempSync(join(tmpdir(), "af-real-adk-dynamic-resume-"));

try {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-pre", name: "Pre" },
    { ...agentBase, id: "mod-after", name: "After" }
  ];
  writeChannelFixture(artifactRoot, {
    modules,
    nodes: [
      { id: "in1", node_kind: "input" },
      { id: "pre", node_kind: "agent", module_id: "mod-pre" },
      {
        id: "human",
        node_kind: "human_input",
        human_input_contract: {
          message: "Approve the loop result.",
          response_schema_ref: "str",
          choice_options: ["done", "retry"],
          accepted_aliases: { done: ["approved"], retry: ["revise"] },
          default_choice: "done"
        }
      },
      { id: "after", node_kind: "agent", module_id: "mod-after" },
      { id: "loop-control", node_kind: "loop_control" },
      { id: "out1", node_kind: "output" }
    ],
    edges: [
      { id: "e1", from: "in1", to: "pre", execution_semantics: "normal_transition" },
      { id: "e2", from: "pre", to: "human", execution_semantics: "normal_transition" },
      { id: "e3", from: "human", to: "after", execution_semantics: "normal_transition" },
      { id: "e4", from: "after", to: "loop-control", execution_semantics: "normal_transition" },
      {
        id: "e5",
        from: "loop-control",
        to: "pre",
        edge_kind: "control",
        execution_semantics: "loop_back",
        route_condition: "decision == retry",
        route_aliases: ["retry", "revise"]
      },
      {
        id: "e6",
        from: "loop-control",
        to: "out1",
        edge_kind: "control",
        execution_semantics: "loop_exit",
        route_condition: "decision == done",
        route_aliases: ["done", "approved"],
        is_default_route: true
      }
    ],
    containers: [
      {
        id: "loop-region",
        container_kind: "loop_region",
        contains_node_ids: ["pre", "human", "after", "loop-control"],
        entry_node_ids: ["pre"],
        exit_node_ids: ["loop-control"]
      }
    ]
  });
  const outputRoot = join(artifactRoot, "out");
  generateBundle(artifactRoot, outputRoot);
  const sourcePath = join(outputRoot, discoverGeneratedPackage(outputRoot), "agent.py");
  if (prepareOnly) {
    const gatePath = join(artifactRoot, "real-adk-gate.py");
    writeFileSync(gatePath, realAdkGatePython(), "utf8");
    process.stdout.write(`${JSON.stringify({ sourcePath, gatePath })}\n`);
    process.exitCode = 0;
  } else {
    const output = execFileSync(generatedPythonExecutable(), ["-c", realAdkGatePython()], {
      encoding: "utf8",
      input: sourcePath,
      stdio: ["pipe", "pipe", "pipe"]
    });
    process.stdout.write(output);
  }
} finally {
  if (!prepareOnly) rmSync(artifactRoot, { recursive: true, force: true });
}

function realAdkGatePython() {
  const loopRegion = dynamicRunIdComponent("loop-region");
  const expectedSegments = [
    `Pre@run-loop-${loopRegion}-iteration-0-${dynamicRunIdComponent("pre")}`,
    `human@run-loop-${loopRegion}-iteration-0-${dynamicRunIdComponent("human")}`,
    `After@run-loop-${loopRegion}-iteration-0-${dynamicRunIdComponent("after")}`,
    `loop_control@run-loop-${loopRegion}-iteration-0-${dynamicRunIdComponent("loop-control")}`,
    `out1@run-node-${dynamicRunIdComponent("out1")}`
  ];
  return String.raw`
import ast
import asyncio
import json
import sys
from importlib.metadata import version

from google.adk import Context
from google.adk.events import RequestInput
from google.adk.runners import InMemoryRunner
from google.adk.workflow import FunctionNode, START, Workflow, node
from google.genai import types

source_path = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
with open(source_path, encoding="utf-8") as source_file:
    source = source_file.read()
module = ast.parse(source, filename=source_path)
wanted = {
    "_MAX_DYNAMIC_LOOP_ITERATIONS",
    "_dynamic_decision_text",
    "_dynamic_matches",
    "_dynamic_should_continue",
    "_hitl_human",
    "dynamic_workflow",
}
selected = []
for item in module.body:
    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name in wanted:
        selected.append(item)
    elif isinstance(item, ast.Assign) and any(isinstance(target, ast.Name) and target.id in wanted for target in item.targets):
        selected.append(item)

namespace = {
    "Any": object,
    "Context": Context,
    "RequestInput": RequestInput,
    "node": node,
}
namespace["_first_resume_input"] = lambda ctx: next(iter(ctx.resume_inputs.values()), None)
namespace["_json_safe_node_value"] = lambda value: value
exec(compile(ast.Module(body=selected, type_ignores=[]), source_path, "exec"), namespace)

counts = {"pre": 0, "after": 0, "terminal": 0}

def pre(node_input=None):
    counts["pre"] += 1
    return {"pre": counts["pre"]}

def after(node_input=None):
    counts["after"] += 1
    return node_input

def control(node_input=None):
    return node_input

def terminal(node_input=None):
    counts["terminal"] += 1
    return node_input

namespace["agent_mod_pre"] = FunctionNode(func=pre, name="Pre")
namespace["node_human"] = FunctionNode(func=namespace["_hitl_human"], name="human", rerun_on_resume=True)
namespace["agent_mod_after"] = FunctionNode(func=after, name="After")
namespace["node_loop_control"] = FunctionNode(func=control, name="loop_control")
namespace["node_out1"] = FunctionNode(func=terminal, name="out1")

root = Workflow(name="d8_generated_gate", edges=[(START, namespace["dynamic_workflow"])])

async def run_gate():
    runner = InMemoryRunner(node=root, app_name="d8_generated_gate")
    await runner.session_service.create_session(
        app_name="d8_generated_gate", user_id="user", session_id="session"
    )
    first = [
        event
        async for event in runner.run_async(
            user_id="user",
            session_id="session",
            new_message=types.Content(role="user", parts=[types.Part(text="start")]),
        )
    ]
    requests = [
        call
        for event in first
        for call in event.get_function_calls()
        if call.name == "adk_request_input"
    ]
    if len(requests) != 1:
        raise AssertionError(f"expected one RequestInput, got {len(requests)}")
    resume = types.Content(
        role="user",
        parts=[
            types.Part(
                function_response=types.FunctionResponse(
                    id=requests[0].id,
                    name="adk_request_input",
                    response={"result": "done"},
                )
            )
        ],
    )
    second = [
        event
        async for event in runner.run_async(
            user_id="user", session_id="session", new_message=resume
        )
    ]
    paths = [event.node_info.path for event in first + second if event.node_info.path]
    expected_segments = set(${JSON.stringify(expectedSegments)})
    missing = [segment for segment in expected_segments if not any(segment in path for path in paths)]
    if missing:
        raise AssertionError(f"generated explicit run IDs were not observed: {missing}; paths={paths}")
    if counts != {"pre": 1, "after": 1, "terminal": 1}:
        raise AssertionError(f"completed children did not replay from cache: {counts}")
    outputs = [event.output for event in second if event.output is not None]
    if not outputs or outputs[-1].get("response") != "done":
        raise AssertionError(f"resume did not reach terminal output: {outputs}")
    await runner.close()
    return {
        "status": "PASS",
        "google_adk": version("google-adk"),
        "counts": counts,
        "interrupt_id": requests[0].id,
        "paths": paths,
        "final_output": outputs[-1],
    }

print(json.dumps(asyncio.run(run_gate()), ensure_ascii=False))
`;
}
