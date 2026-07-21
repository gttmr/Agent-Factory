import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  bundleSha256Manifest,
  executeGeneratedAsyncResumeRuntime,
  compileGeneratedPython,
  executeGeneratedFunction,
  executeGeneratedWorkflowRuntime,
  generatedPythonExecutable
} from "./generated-python-runtime.mjs";
import {
  collectGeneratorSourceFiles,
  discoverGeneratedPackage,
  generateBundle,
  targetA2aContract,
  targetAsset,
  targetEdge,
  targetEvidence,
  targetGraph,
  targetRequirement,
  targetRuntimeContract,
  writeTargetArtifacts
} from "./fixtures.mjs";

const runtimeContractFixture = JSON.parse(
  readFileSync(
    new URL("../../templates/skill-scenarios/S07-a2a-consuming/context/analysis-result.json", import.meta.url),
    "utf8"
  )
).runtimeContracts[0];

test("declared ADK dependency is restricted to the tested 2.3 compatibility line", () => {
  const requirements = readFileSync(new URL("../../requirements/adk-runtime.txt", import.meta.url), "utf8");
  assert.match(requirements, /^google-adk\[a2a,mcp\]>=2\.3\.0,<2\.4\.0$/m);
  const version = execFileSync(
    generatedPythonExecutable(),
    ["-c", 'from importlib.metadata import version; print(version("google-adk"))'],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
  assert.equal(version, "2.3.0");
});

test("generator source stays neutral to regression-scenario vocabulary", () => {
  const source = collectGeneratorSourceFiles().map((path) => readFileSync(path, "utf8")).join("\n");
  for (const fixtureLiteral of [
    "graph.scenario-j",
    "req-page-recommendation",
    "agent.page-recommender",
    "Page Recommender",
    "tool.reused"
  ]) {
    assert.equal(source.includes(fixtureLiteral), false, `generator source embeds regression fixture literal ${fixtureLiteral}`);
  }
});

test("Target generator is deterministic and generated Python compiles", () => {
  withFixture(basicFixture(), ({ artifactRoot }) => {
    const first = join(artifactRoot, "out-a");
    const second = join(artifactRoot, "out-b");
    generateBundle(artifactRoot, first);
    generateBundle(artifactRoot, second);
    assert.deepEqual(bundleSha256Manifest(first), bundleSha256Manifest(second));
    const packageName = discoverGeneratedPackage(first);
    compileGeneratedPython(join(first, packageName, "agent.py"));
    execFileSync(
      generatedPythonExecutable(),
      ["-c", `import ${packageName}; assert ${packageName}.root_agent is not None`],
      { cwd: first, env: { ...process.env, AF_LLM_PROVIDER: "gemini" }, stdio: "pipe" }
    );
  });
});

test("Target lowering separates Workflow-owned MCP calls from Agent-owned available Tools", () => {
  withFixture(mcpFixture("workflow"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "workflow-owned");
    generateBundle(artifactRoot, output);
    const { source, manifest } = generated(output);
    assert.match(source, /session\.call_tool\("lookup"/);
    assert.equal(manifest.runtime.connected_tools.length, 1);
    assert.doesNotMatch(source, /McpToolset\(/);
  });
  withFixture(mcpFixture("agent"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "agent-owned");
    generateBundle(artifactRoot, output);
    const { source, manifest } = generated(output);
    assert.match(source, /McpToolset\(/);
    assert.match(source, /tool_filter=\["lookup"\]/);
    assert.match(source, /tools=\[/);
    assert.equal(manifest.runtime.connected_tools.length, 1);
    assert.doesNotMatch(source, /session\.call_tool\("lookup"/);
    const packageName = discoverGeneratedPackage(output);
    const filters = JSON.parse(execFileSync(
      generatedPythonExecutable(),
      ["-c", [
        "import importlib, json",
        "from google.adk.agents import LlmAgent",
        "from google.adk.tools import McpToolset",
        `module = importlib.import_module(${JSON.stringify(`${packageName}.agent`)})`,
        "filters = [tool.tool_filter for value in vars(module).values() if isinstance(value, LlmAgent) for tool in value.tools if isinstance(tool, McpToolset)]",
        "print(json.dumps(filters))"
      ].join("\n")],
      { cwd: output, encoding: "utf8", env: { ...process.env, AF_LLM_PROVIDER: "gemini" }, stdio: ["ignore", "pipe", "pipe"] }
    ));
    assert.deepEqual(filters, [["lookup"]]);
  });
});

test("MCP transport rejects stdio for both invocation owners and rejects unknown transport", () => {
  for (const owner of ["workflow", "agent"]) {
    withFixture(mcpFixture(owner, "stdio"), ({ artifactRoot }) => {
      assert.throws(
        () => generateBundle(artifactRoot, join(artifactRoot, `${owner}-stdio`)),
        /unsupported MCP transport stdio.*tool\.lookup.*will not emit stdio as HTTP/i
      );
    });
  }
  withFixture(mcpFixture("workflow", "unknown"), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "unknown-mcp")),
      /unsupported Tool transport unknown.*tool\.lookup/i
    );
  });
  withFixture(unknownTransportFixture(), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "unknown-function")),
      /unsupported Tool transport unknown.*tool\.unknown/i
    );
  });
});

test("generator independently requires approved runtime contracts for MCP, write, human approval, and external-message boundaries", () => {
  const cases = [
    { data: mcpFixture("workflow"), expected: /missing required runtime contract.*mcp_connection.*tool\.lookup/i },
    { data: writeBoundaryFixture(), expected: /missing required runtime contract.*write.*tool\.writer/i },
    { data: graphFeatureFixture(), expected: /missing required runtime contract.*human approval.*human/i },
    { data: externalMessageFixture(), expected: /missing required runtime contract.*external message.*agent\.notifier/i }
  ];
  for (const { data, expected } of cases) {
    data.runtimeContracts = [];
    withFixture(data, ({ artifactRoot }) => {
      assert.throws(() => generateBundle(artifactRoot, join(artifactRoot, "missing-contract")), expected);
    });
  }
});

test("Target Graph lowers route, fan-out, join, state, artifact, human input, and subworkflow refs", () => {
  withFixture(graphFeatureFixture(), ({ artifactRoot }) => {
    const output = join(artifactRoot, "features");
    generateBundle(artifactRoot, output);
    const { source, packageRoot, manifest } = generated(output);
    assert.match(source, /def _route_route/);
    assert.match(source, /JoinNode\(/);
    assert.match(source, /RequestInput\(/);
    assert.match(source, /ctx\.state\["edge\.state-tool\.join"\] = payload/);
    assert.match(source, /save_artifact\("edge\.artifact-tool\.join"/);
    assert.match(readFileSync(join(packageRoot, "nodes", "subworkflows.py"), "utf8"), /SUBWORKFLOWS/);
    assert.deepEqual(manifest.graph_ir.regions, [region("parallel.review", "parallel", ["state-tool", "artifact-tool", "join"], ["state-tool", "artifact-tool"], ["join"])]);
  });
});

test("reviewed async-resume policy lowers to stable correlation, expiry, and an at-most-once synthetic Tool", () => {
  const output = mkdtempSync(join(tmpdir(), "af-s11-lowering-"));
  try {
    const artifactRoot = new URL(
      "../../templates/skill-scenarios/S11-human-input-resume/context/",
      import.meta.url
    ).pathname;
    generateBundle(artifactRoot, output);
    const { source } = generated(output);
    assert.match(source, /_interrupt_id = "synthetic-approval-001"/);
    assert.match(source, /RequestInput\([^)]*interrupt_id=_interrupt_id/s);
    assert.match(source, /af_resume_record:/);
    assert.match(source, /expires_at/);
    assert.match(source, /af_resume_ledger:/);
    assert.match(source, /"delivery_semantics": "at_most_once"/);
    assert.doesNotMatch(source, /TODO_IMPLEMENT_HERE: Apply Synthetic Change Tool/);
    compileGeneratedPython(join(output, discoverGeneratedPackage(output), "agent.py"));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("generated S11 runtime pauses, resumes after runner restart, and fails closed without repeating the synthetic side effect", () => {
  const output = mkdtempSync(join(tmpdir(), "af-s11-runtime-"));
  try {
    const artifactRoot = new URL(
      "../../templates/skill-scenarios/S11-human-input-resume/context/",
      import.meta.url
    ).pathname;
    generateBundle(artifactRoot, output);
    const packageName = discoverGeneratedPackage(output);
    const runtime = executeGeneratedAsyncResumeRuntime({
      outputRoot: output,
      packageName,
      interruptId: "synthetic-approval-001",
      contractId: "rtc-s11-async-resume",
      changeId: "synthetic-change-001"
    });
    const outputs = (result) => result.events.map((event) => event.output).filter(Boolean);
    const ledgerResult = (result) => result.state[runtime.ledger_key]?.["synthetic-change-001"]?.result;

    assert.equal(runtime.google_adk_version, "2.3.0");
    assert.equal(runtime.approve_start.call.id, runtime.expected_interrupt_id);
    assert.equal(runtime.approve_start.error, null);
    assert.equal(runtime.ledger_key in runtime.approve_start.state, false, "an abandoned pending request has no side effect");

    assert.equal(runtime.approve_resume.error, null);
    assert.ok(outputs(runtime.approve_resume).some((output) => output.status === "synthetic_side_effect_applied"));
    assert.ok(outputs(runtime.approve_resume).some((output) => output.terminal_output_node_id === "node-s11-applied-output"));
    assert.equal(ledgerResult(runtime.approve_resume).apply_count, 1);

    assert.equal(runtime.approve_duplicate.error, null);
    assert.equal(ledgerResult(runtime.approve_duplicate).apply_count, 1, "duplicate resume must replay the recorded result");
    assert.equal(runtime.second_start.call.id, runtime.expected_interrupt_id, "the stable ID is scoped by invocation state");
    assert.equal(runtime.second_resume.error, null);
    assert.equal(ledgerResult(runtime.second_resume).apply_count, 1, "a second invocation with the same key must not apply twice");

    assert.match(runtime.conflict_resume.error?.message ?? "", /conflicting response rejected/);
    assert.ok(outputs(runtime.reject_resume).some((output) => output.decision === "cancel"));
    assert.ok(outputs(runtime.reject_resume).some((output) => output.terminal_output_node_id === "node-s11-canceled-output"));
    assert.equal(runtime.ledger_key in runtime.reject_resume.state, false);
    assert.ok(outputs(runtime.expiry_resume).some((output) => output.status === "expired" && output.decision === "cancel"));
    assert.equal(runtime.ledger_key in runtime.expiry_resume.state, false);
    assert.match(runtime.wrong_resume.error?.message ?? "", /Unexpected resume interrupt IDs/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("owning Workflow representation selects static graph versus dynamic Workflow generation", () => {
  withFixture(representationFixture("graph"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "graph-representation");
    generateBundle(artifactRoot, output);
    assert.doesNotMatch(generated(output).source, /async def dynamic_workflow/);
  });
  withFixture(representationFixture("dynamic"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "dynamic-representation");
    generateBundle(artifactRoot, output);
    assert.match(generated(output).source, /async def dynamic_workflow/);
  });
});

test("generated non-loop dynamic Workflow executes on google-adk 2.3.0", () => {
  withFixture(representationFixture("dynamic"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "dynamic-runtime");
    generateBundle(artifactRoot, output);
    const runtime = executeGeneratedWorkflowRuntime({
      outputRoot: output,
      packageName: discoverGeneratedPackage(output)
    });
    assert.equal(runtime.google_adk_version, "2.3.0");
    assert.ok(runtime.events.some((event) => event.output?.terminal_output_node_id === "output"), JSON.stringify(runtime));
  });
});

test("parallel and loop Regions do not independently select dynamic runtime mode", () => {
  withFixture(structuralRegionFixture("parallel"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "parallel-region");
    generateBundle(artifactRoot, output);
    assert.doesNotMatch(generated(output).source, /async def dynamic_workflow/);
  });
  withFixture(structuralRegionFixture("loop"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "loop-region");
    generateBundle(artifactRoot, output);
    assert.doesNotMatch(generated(output).source, /async def dynamic_workflow/);
  });
});

test("unresolved owning Workflow representation blocks runnable generation", () => {
  withFixture(representationFixture("unresolved"), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "unresolved")),
      /owning Workflow .* representation is unresolved/i
    );
  });
});

test("graph representation fails closed for a loop shape instead of switching to dynamic mode", () => {
  withFixture(loopFixture("graph"), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "graph-loop")),
      /representation graph.*loop_back.*dynamic/i
    );
  });
});

test("non-owning dynamic Workflow does not override the owning graph representation", () => {
  withFixture(nestedRepresentationMismatchFixture(), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "nested-mismatch")),
      /workflow\.owner.*representation graph.*node child requires dynamic lowering/i
    );
  });
});

test("dynamic representation rejects loops because Target Graph IR has no approved bound or exhaustion contract", () => {
  withFixture(loopFixture("dynamic"), ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "loop")),
      /dynamic runnable mode.*loop.*no approved loop bound.*exhaustion/i
    );
  });
});

test("retry, fallback, error, callback, resume, cancel, and timeout edges reject both static and dynamic runnable generation", () => {
  for (const kind of ["retry", "fallback", "error", "callback", "resume", "cancel", "timeout"]) {
    for (const representation of ["graph", "dynamic"]) {
      withFixture(exceptionalEdgeFixture(kind, representation), ({ artifactRoot }) => {
        assert.throws(
          () => generateBundle(artifactRoot, join(artifactRoot, `${representation}-${kind}`)),
          new RegExp(`${kind}.*no ${kind} lowerer`, "i")
        );
      });
    }
  }
});

test("condition routes without an explicit default or unmatched contract reject runnable generation", () => {
  const data = runtimeRouteFixture();
  for (const edge of data.graph.edges) {
    if (edge.control.kind === "condition") edge.control.default = false;
  }
  withFixture(data, ({ artifactRoot }) => {
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "route-without-default")),
      /route.*no explicit default.*unmatched.*route/i
    );
  });
});

test("generated static Workflow executes route, state-channel, and terminal behavior on google-adk 2.3.0", () => {
  withFixture(runtimeRouteFixture(), ({ artifactRoot }) => {
    const output = join(artifactRoot, "runtime-route");
    generateBundle(artifactRoot, output);
    const packageName = discoverGeneratedPackage(output);
    const selectedDecision = executeGeneratedFunction({
      outputRoot: output,
      packageName,
      functionName: "_route_route",
      nodeInput: { value: "todo_implementation_required" }
    });
    assert.equal(selectedDecision.route, "todo_implementation_required");
    const runtime = executeGeneratedWorkflowRuntime({
      outputRoot: output,
      packageName
    });
    assert.equal(runtime.google_adk_version, "2.3.0");
    assert.ok(runtime.events.some((event) => event.output?.asset_id === "tool.fallback"), JSON.stringify(runtime));
    assert.equal(runtime.events.some((event) => event.output?.asset_id === "tool.selected"), false);
    const terminal = runtime.events.find((event) => event.output?.terminal_output_node_id === "output");
    assert.ok(terminal, JSON.stringify(runtime));
    assert.ok(terminal.output.final_state_keys.includes("edge.fallback.output"), JSON.stringify(runtime));
    assert.ok(runtime.events.some((event) => event.texts.some((text) => text.includes("edge.fallback.output"))));
  });
});

test("generator context rejects duplicate node IDs and invalid Region references or hierarchy", () => {
  const mutations = [
    {
      mutate(graph) { graph.nodes[2].id = graph.nodes[1].id; },
      expected: /duplicates node id/i
    },
    {
      mutate(graph) {
        graph.regions = [region("region.invalid-node", "parallel", ["missing"], ["missing"], ["missing"])];
      },
      expected: /regions\[0\]\.node_ids.*missing.*Node/i
    },
    {
      mutate(graph) {
        graph.regions = [{ ...region("region.child", "parallel", ["step"], ["step"], ["step"]), parent_region_id: "region.missing" }];
      },
      expected: /parent_region_id.*region\.missing.*Region/i
    },
    {
      mutate(graph) {
        graph.regions = [region("region.membership", "parallel", ["step"], ["input"], ["output"])];
      },
      expected: /entry_node_ids.*input.*node_ids/i
    },
    {
      mutate(graph) {
        graph.regions = [
          { ...region("region.parent", "parallel", ["step"], ["step"], ["step"]), parent_region_id: "region.child" },
          { ...region("region.child", "parallel", ["step"], ["step"], ["step"]), parent_region_id: "region.parent" }
        ];
      },
      expected: /parent_region_id.*cycle.*region\.parent.*region\.child/i
    }
  ];
  for (const { mutate, expected } of mutations) {
    withFixture(representationFixture("graph"), ({ artifactRoot, analysis, plan }) => {
      mutate(analysis.graph);
      plan.graph = structuredClone(analysis.graph);
      writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
      assert.throws(() => generateBundle(artifactRoot, join(artifactRoot, "invalid")), expected);
    });
  }
});

test("generator context rejects candidate and edge integrity failures at both input boundaries", () => {
  const cases = [
    {
      boundary: "analysis-result.json",
      mutate(analysis) { analysis.assetCandidates.push(structuredClone(analysis.assetCandidates[0])); },
      expected: /analysis-result\.json\.assetCandidates\[1\]\.asset_id duplicates workflow\.owner/i
    },
    {
      boundary: "scaffold-plan.json",
      mutate(_analysis, plan) { plan.assets.push(structuredClone(plan.assets[0])); },
      expected: /scaffold-plan\.json\.assets\[1\]\.asset_id duplicates workflow\.owner/i
    },
    {
      boundary: "analysis-result.json",
      mutate(analysis) { analysis.assetCandidates[0].source_requirement_id = "req-drift"; },
      expected: /analysis-result\.json\.assetCandidates\[0\]\.source_requirement_id must equal normalizedRequirement\.id/i
    },
    {
      boundary: "scaffold-plan.json",
      mutate(_analysis, plan) { plan.assets[0].source_requirement_id = "req-drift"; },
      expected: /scaffold-plan\.json\.assets\[0\]\.source_requirement_id must equal requirement_id/i
    },
    {
      boundary: "analysis-result.json",
      mutate(analysis) { analysis.graph.edges.push(structuredClone(analysis.graph.edges[0])); },
      expected: /analysis-result\.json\.graph\.edges\[2\]\.id duplicates edge\.input\.step/i
    },
    {
      boundary: "scaffold-plan.json",
      mutate(_analysis, plan) { plan.graph.edges.push(structuredClone(plan.graph.edges[0])); },
      expected: /scaffold-plan\.json\.graph\.edges\[2\]\.id duplicates edge\.input\.step/i
    },
    {
      boundary: "analysis-result.json",
      mutate(analysis) { analysis.graph.edges[0].from = "missing"; },
      expected: /analysis-result\.json\.graph\.edges\[0\]\.from references missing Node missing/i
    },
    {
      boundary: "scaffold-plan.json",
      mutate(_analysis, plan) { plan.graph.edges[0].from = "missing"; },
      expected: /scaffold-plan\.json\.graph\.edges\[0\]\.from references missing Node missing/i
    }
  ];
  for (const { boundary, mutate, expected } of cases) {
    withFixture(representationFixture("graph"), ({ artifactRoot, analysis, plan }) => {
      analysis.graph = structuredClone(analysis.graph);
      plan.graph = structuredClone(plan.graph);
      mutate(analysis, plan);
      writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
      assert.throws(
        () => generateBundle(artifactRoot, join(artifactRoot, "invalid-boundary")),
        expected,
        boundary
      );
    });
  }
});

test("generator context rejects ambiguous or dangling runtime and A2A contract identities", () => {
  const runtimeCases = [
    {
      expected: /analysis-result\.json\.runtimeContracts\[1\]\.contract_id duplicates rtc-s07-a2a-connection/i,
      mutate(analysis, plan, contract) {
        analysis.runtimeContracts = [contract, structuredClone(contract)];
        plan.runtime_contracts = structuredClone(analysis.runtimeContracts);
      }
    },
    {
      expected: /scaffold-plan\.json\.runtime_contracts\[1\]\.contract_id duplicates rtc-s07-a2a-connection/i,
      mutate(analysis, plan, contract) {
        analysis.runtimeContracts = [contract];
        plan.runtime_contracts = [structuredClone(contract), structuredClone(contract)];
      }
    },
    {
      expected: /analysis-result\.json\.runtimeContracts\[0\]\.asset_id asset\.missing references a missing asset/i,
      mutate(analysis, plan, contract) {
        const dangling = { ...contract, asset_id: "asset.missing" };
        analysis.runtimeContracts = [dangling];
        plan.runtime_contracts = [structuredClone(dangling)];
      }
    },
    {
      expected: /scaffold-plan\.json\.runtime_contracts\[0\]\.asset_id asset\.missing references a missing asset/i,
      mutate(analysis, plan, contract) {
        analysis.runtimeContracts = [contract];
        plan.runtime_contracts = [{ ...contract, asset_id: "asset.missing" }];
      }
    }
  ];
  for (const { mutate, expected } of runtimeCases) {
    withFixture(representationFixture("graph"), ({ artifactRoot, analysis, plan }) => {
      const contract = { ...structuredClone(runtimeContractFixture), asset_id: "workflow.owner" };
      mutate(analysis, plan, contract);
      writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
      assert.throws(() => generateBundle(artifactRoot, join(artifactRoot, "invalid-contract")), expected);
    });
  }

  withFixture(a2aFixture(), ({ artifactRoot, analysis, plan }) => {
    analysis.a2aContracts.push(structuredClone(analysis.a2aContracts[0]));
    writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
    assert.throws(
      () => generateBundle(artifactRoot, join(artifactRoot, "duplicate-a2a")),
      /analysis-result\.json\.a2aContracts\[1\]\.contract_id duplicates a2a-001/i
    );
  });
});

test("generator never emits deprecated ADK orchestration agents", () => {
  const deprecated = /\b(?:SequentialAgent|ParallelAgent|LoopAgent)\b/;
  const generatorSource = collectGeneratorSourceFiles().map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(generatorSource, deprecated);
  assert.doesNotMatch(
    generatorSource,
    /\b(?:loopControl[A-Za-z]*|loop_control|loop_region|parallel_region)\b/,
    "retired Graph node/container implementation vocabulary must not survive in generator source"
  );
  for (const representation of ["graph", "dynamic"]) {
    withFixture(representationFixture(representation), ({ artifactRoot }) => {
      const output = join(artifactRoot, `no-deprecated-${representation}`);
      generateBundle(artifactRoot, output);
      assert.doesNotMatch(generated(output).source, deprecated);
    });
  }
});

test("Target A2A Agent binding emits the actual ADK RemoteA2aAgent runtime", () => {
  const data = a2aFixture();
  data.a2aContracts[0].adk_runtime_policy.fallback_handoff = {
    mode: "manual_review",
    message: "Escalate this synthetic failure for review."
  };
  withFixture(data, ({ artifactRoot }) => {
    const output = join(artifactRoot, "a2a");
    generateBundle(artifactRoot, output);
    const { source, manifest } = generated(output);
    assert.match(source, /from google\.adk\.agents\.remote_a2a_agent import RemoteA2aAgent/);
    assert.match(source, /class _RemoteA2aFailure_[A-Za-z0-9_]+\(RuntimeError\):/);
    assert.match(source, /class _FailClosed_[A-Za-z0-9_]+\(RemoteA2aAgent\):/);
    assert.match(source, /getattr\(event, "error_message".*getattr\(event, "error_code"/);
    assert.match(source, /raise _RemoteA2aFailure_[A-Za-z0-9_]+\(/);
    assert.equal("remote_a2a" in manifest.runtime, false);
    assert.equal(manifest.runtime.a2a_agents[0].agent_ref, "agent.remote");

    const packageName = discoverGeneratedPackage(output);
    const runtime = JSON.parse(execFileSync(
      generatedPythonExecutable(),
      ["-c", `
import asyncio
import importlib
import json

from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.events import Event
from google.genai import types

module = importlib.import_module(${JSON.stringify(`${packageName}.agent`)})
guard = next(value for value in vars(module).values() if type(value).__name__.startswith("_FailClosed_"))
original = RemoteA2aAgent._run_async_impl

async def run_case(kind):
    async def fake_remote(self, ctx):
        if kind == "success":
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part.from_text(text="ok")]))
        elif kind == "error":
            yield Event(author=self.name, error_message="synthetic remote error")
        elif kind == "failed_state":
            yield Event(author=self.name, custom_metadata={"a2a:response": {"status": {"state": "TASK_STATE_FAILED"}}})
        elif kind == "input_required":
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part.from_text(text="more input required")]), custom_metadata={"a2a:response": {"status": {"state": "TASK_STATE_INPUT_REQUIRED"}}})
        elif kind == "auth_required":
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part.from_text(text="auth required")]), custom_metadata={"a2a:response": {"status": {"state": "TASK_STATE_AUTH_REQUIRED"}}})
        elif kind == "long_running_without_state":
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part.from_text(text="pending function")]), long_running_tool_ids={"synthetic-call"})
        elif kind == "working_only":
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part.from_text(text="still working")]), custom_metadata={"a2a:response": {"status": {"state": "TASK_STATE_WORKING"}}})
        elif kind == "empty":
            return

    RemoteA2aAgent._run_async_impl = fake_remote
    events = []
    failure = None
    try:
        async for event in guard._run_async_impl(None):
            events.append(event)
    except Exception as exc:
        failure = {"type": type(exc).__name__, "message": str(exc)}
    finally:
        RemoteA2aAgent._run_async_impl = original
    return {"event_count": len(events), "failure": failure}

async def main():
    return {kind: await run_case(kind) for kind in ("success", "error", "failed_state", "input_required", "auth_required", "long_running_without_state", "working_only", "empty")}

print(json.dumps(asyncio.run(main())))
`],
      { cwd: output, encoding: "utf8", env: { ...process.env, AF_LLM_PROVIDER: "gemini" }, stdio: ["ignore", "pipe", "pipe"] }
    ));
    assert.deepEqual(runtime.success, { event_count: 1, failure: null });
    for (const kind of ["error", "failed_state", "empty"]) {
      assert.equal(runtime[kind].event_count, 0);
      assert.match(runtime[kind].failure.type, /^_RemoteA2aFailure_/);
      assert.match(runtime[kind].failure.message, /fallback_handoff=manual_review/);
      assert.match(runtime[kind].failure.message, /Escalate this synthetic failure for review\./);
    }
    for (const kind of ["input_required", "auth_required"]) {
      assert.equal(runtime[kind].event_count, 1, "interactive handoff must remain observable before fail-closed termination");
      assert.match(runtime[kind].failure.type, /^_RemoteA2aFailure_/);
      assert.match(runtime[kind].failure.message, /interactive handoff required/);
      assert.match(runtime[kind].failure.message, /fallback_handoff=manual_review/);
    }
    assert.match(runtime.input_required.failure.message, /input_required_followup=/);
    assert.match(runtime.auth_required.failure.message, /auth_required_followup=/);
    assert.equal(runtime.long_running_without_state.event_count, 1);
    assert.match(runtime.long_running_without_state.failure.type, /^_RemoteA2aFailure_/);
    assert.match(runtime.long_running_without_state.failure.message, /without a usable result/);
    assert.equal(runtime.working_only.event_count, 1);
    assert.match(runtime.working_only.failure.type, /^_RemoteA2aFailure_/);
    assert.match(runtime.working_only.failure.message, /without a usable result/);
  });
});

test("no-A2A bundle omits provider files, docs, and tests while importing on google-adk 2.3.0", () => {
  withFixture(representationFixture("graph"), ({ artifactRoot }) => {
    const output = join(artifactRoot, "no-a2a");
    generateBundle(artifactRoot, output);
    const { packageRoot, contractTest } = generated(output);
    assert.equal(existsSync(join(packageRoot, "agent.json")), false);
    assert.equal(existsSync(join(output, "af_adk_a2a_server.py")), false);
    assert.doesNotMatch(readFileSync(join(output, "README.md"), "utf8"), /ADK A2A provider/);
    assert.doesNotMatch(contractTest, /a2a_launcher/);
    assertGeneratedPackageImportsOnAdk23(output);
  });
});

test("A2A consuming-only bundle emits RemoteA2aAgent but no provider surface", () => {
  withFixture(a2aFixture(), ({ artifactRoot }) => {
    const output = join(artifactRoot, "a2a-consuming-only");
    generateBundle(artifactRoot, output);
    const { source, packageRoot, contractTest } = generated(output);
    assert.match(source, /class _FailClosed_[A-Za-z0-9_]+\(RemoteA2aAgent\):/);
    assert.equal(existsSync(join(packageRoot, "agent.json")), false);
    assert.equal(existsSync(join(output, "af_adk_a2a_server.py")), false);
    assert.doesNotMatch(readFileSync(join(output, "README.md"), "utf8"), /ADK A2A provider/);
    assert.doesNotMatch(contractTest, /a2a_launcher/);
  });
});

test("approved A2A exposure emits provider files, docs, and tests that import on google-adk 2.3.0", () => {
  withFixture(a2aExposureFixture(), ({ artifactRoot }) => {
    const output = join(artifactRoot, "a2a-exposure");
    generateBundle(artifactRoot, output);
    const { packageRoot, contractTest } = generated(output);
    assert.equal(existsSync(join(packageRoot, "agent.json")), true);
    assert.equal(existsSync(join(output, "af_adk_a2a_server.py")), true);
    assert.match(readFileSync(join(output, "README.md"), "utf8"), /ADK A2A provider/);
    assert.match(contractTest, /a2a_launcher/);
    assertGeneratedPackageImportsOnAdk23(output, { provider: true });
  });
});

test("Target generator blocks unapproved assets and approved-contract drift", () => {
  for (const mutate of [
    (analysis) => { analysis.assetCandidates[0].status = "needs_info"; },
    (_analysis, plan) => { plan.assets[0].rationale = "Drifted after approval"; }
  ]) {
    withFixture(basicFixture(), ({ artifactRoot, analysis, plan }) => {
      mutate(analysis, plan);
      writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
      assert.throws(() => generateBundle(artifactRoot, join(artifactRoot, "blocked")), /unapproved or drifted assets/);
    });
  }
});

function basicFixture() {
  const agent = targetAsset("agent.writer", "agent", { name: "Writer" });
  return fixture("req-basic", [agent], [
    { id: "input", node_kind: "input" },
    { id: "writer", node_kind: "agent", agent_ref: agent.asset_id, available_tools: [] },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "writer"), targetEdge("writer", "output")]);
}

function mcpFixture(owner, transport = "http") {
  const agent = targetAsset("agent.writer", "agent", { name: "Writer" });
  const tool = targetAsset("tool.lookup", "tool", {
    name: "Lookup Tool",
    binding: { kind: "mcp", server_ref: "lookup-server", tool_name: "lookup" },
    connection: { transport },
    inputs: [{ name: "key", type: "string", required: true }],
  });
  const nodes = [
    { id: "input", node_kind: "input" },
    {
      id: "writer",
      node_kind: "agent",
      agent_ref: agent.asset_id,
      available_tools: owner === "agent" ? [{ tool_ref: tool.asset_id, invocation_control: "agent" }] : []
    },
    ...(owner === "workflow" ? [{ id: "lookup", node_kind: "tool", tool_ref: tool.asset_id, invocation_control: "workflow" }] : []),
    { id: "output", node_kind: "output" }
  ];
  const edges = owner === "workflow"
    ? [targetEdge("input", "writer"), targetEdge("writer", "lookup"), targetEdge("lookup", "output")]
    : [targetEdge("input", "writer"), targetEdge("writer", "output")];
  const data = fixture(`req-mcp-${owner}`, [agent, tool], nodes, edges);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: `rtc-mcp-${owner}`,
    contractKind: "mcp_connection",
    assetId: tool.asset_id
  })];
  return data;
}

function unknownTransportFixture() {
  const tool = targetAsset("tool.unknown", "tool", {
    name: "Unknown Transport Tool",
    binding: { kind: "function" },
    connection: { transport: "unknown" }
  });
  return fixture("req-unknown-transport", [tool], [
    { id: "input", node_kind: "input" },
    { id: "unknown", node_kind: "tool", tool_ref: tool.asset_id, invocation_control: "workflow" },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "unknown"), targetEdge("unknown", "output")]);
}

function graphFeatureFixture() {
  const routeAgent = targetAsset("agent.route", "agent", { name: "Route Agent" });
  const stateTool = targetAsset("tool.state", "tool", { name: "State Tool", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const artifactTool = targetAsset("tool.artifact", "tool", { name: "Artifact Tool", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const workflow = targetAsset("workflow.child", "workflow", { name: "Child Workflow" });
  const nodes = [
    { id: "input", node_kind: "input" },
    { id: "route-agent", node_kind: "agent", agent_ref: routeAgent.asset_id, available_tools: [] },
    { id: "route", node_kind: "function", role: "route" },
    { id: "state-tool", node_kind: "tool", tool_ref: stateTool.asset_id, invocation_control: "workflow" },
    { id: "artifact-tool", node_kind: "tool", tool_ref: artifactTool.asset_id, invocation_control: "workflow" },
    { id: "join", node_kind: "join" },
    { id: "human", node_kind: "human_input", human_input_contract: { message: "Continue?", payload_schema_ref: null, response_schema_ref: "str", response_mapping: null, choice_options: ["continue"], accepted_aliases: null, default_choice: "continue" } },
    { id: "child", node_kind: "subworkflow", workflow_ref: workflow.asset_id },
    { id: "output", node_kind: "output" }
  ];
  const edges = [
    targetEdge("input", "route-agent", "fan_out"),
    targetEdge("route-agent", "route"),
    targetEdge("route", "state-tool", "condition", { control: { condition: "state" } }),
    targetEdge("route", "artifact-tool", "condition", { control: { condition: "artifact", default: true } }),
    targetEdge("state-tool", "join", "fan_in", { channel: "state" }),
    targetEdge("artifact-tool", "join", "fan_in", { channel: "artifact" }),
    targetEdge("join", "human"),
    targetEdge("human", "child"),
    targetEdge("child", "output")
  ];
  const data = fixture("req-features", [routeAgent, stateTool, artifactTool, workflow], nodes, edges, [
    region("parallel.review", "parallel", ["state-tool", "artifact-tool", "join"], ["state-tool", "artifact-tool"], ["join"])
  ]);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: "rtc-features-human",
    contractKind: "async_resume",
    assetId: workflow.asset_id,
    operationType: "approval",
    sideEffectLevel: "none",
    humanApprovalRequired: true,
    asyncResumeRequired: true,
    graphIrAnnotations: { human_input_node_id: "human" }
  })];
  return data;
}

function writeBoundaryFixture() {
  const writer = targetAsset("tool.writer", "tool", {
    name: "Writer",
    binding: { kind: "function" },
    connection: { transport: "in_process" },
    side_effect: "write",
    risk_signals: ["transaction_write"]
  });
  const data = fixture("req-write-boundary", [writer], [
    { id: "input", node_kind: "input" },
    { id: "write", node_kind: "tool", tool_ref: writer.asset_id, invocation_control: "workflow" },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "write"), targetEdge("write", "output")]);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: "rtc-write-boundary",
    contractKind: "external_connection",
    assetId: writer.asset_id,
    operationType: "write",
    sideEffectLevel: "write"
  })];
  return data;
}

function externalMessageFixture() {
  const notifier = targetAsset("agent.notifier", "agent", {
    name: "Notifier",
    risk_signals: ["external_message"]
  });
  const data = fixture("req-external-message", [notifier], [
    { id: "input", node_kind: "input" },
    { id: "notify", node_kind: "agent", agent_ref: notifier.asset_id, available_tools: [] },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "notify"), targetEdge("notify", "output")]);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: "rtc-external-message",
    contractKind: "external_connection",
    assetId: notifier.asset_id,
    operationType: "notification",
    sideEffectLevel: "customer_notification"
  })];
  return data;
}

function representationFixture(representation) {
  const workflow = targetAsset("workflow.owner", "workflow", {
    name: "Owning Workflow",
    workflow_profile: { representation, coordination: "explicit", template_ref: null }
  });
  return fixture("req-representation", [workflow], [
    { id: "input", node_kind: "input" },
    { id: "step", node_kind: "function", role: "transform" },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "step"), targetEdge("step", "output")], [], [], workflow.asset_id);
}

function structuralRegionFixture(kind) {
  const data = representationFixture("graph");
  data.graph.regions = [region(`region.${kind}`, kind, ["step"], ["step"], ["step"])];
  return data;
}

function nestedRepresentationMismatchFixture() {
  const owner = targetAsset("workflow.owner", "workflow", { name: "Owning Graph Workflow" });
  const child = targetAsset("workflow.child", "workflow", {
    name: "Dynamic Child Workflow",
    workflow_profile: { representation: "dynamic", coordination: "explicit", template_ref: null }
  });
  return fixture("req-nested-mismatch", [owner, child], [
    { id: "input", node_kind: "input" },
    { id: "child", node_kind: "subworkflow", workflow_ref: child.asset_id },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "child"), targetEdge("child", "output")], [], [], owner.asset_id);
}

function loopFixture(representation) {
  const workflow = targetAsset("workflow.loop", "workflow", {
    name: "Loop Workflow",
    workflow_profile: { representation, coordination: "explicit", template_ref: null }
  });
  const worker = targetAsset("tool.worker", "tool", { name: "Worker", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const nodes = [
    { id: "input", node_kind: "input" },
    { id: "work", node_kind: "tool", tool_ref: worker.asset_id, invocation_control: "workflow" },
    { id: "decision", node_kind: "function", role: "validate" },
    { id: "output", node_kind: "output" }
  ];
  const edges = [
    targetEdge("input", "work"),
    targetEdge("work", "decision"),
    targetEdge("decision", "work", "loop_back", { control: { condition: "todo_implementation_required", accepted_aliases: ["again"] } }),
    targetEdge("decision", "output", "loop_exit", { control: { condition: "done", accepted_aliases: ["complete"], default: true } })
  ];
  return fixture("req-loop", [workflow, worker], nodes, edges, [
    region("loop.review", "loop", ["work", "decision"], ["work"], ["decision"])
  ], [], workflow.asset_id);
}

function exceptionalEdgeFixture(kind, representation) {
  const data = representationFixture(representation);
  data.graph.edges[1] = targetEdge("step", "output", kind);
  return data;
}

function runtimeRouteFixture() {
  const workflow = targetAsset("workflow.route", "workflow", { name: "Route Workflow" });
  const producer = targetAsset("tool.producer", "tool", { name: "Producer", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const selected = targetAsset("tool.selected", "tool", { name: "Selected", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const fallback = targetAsset("tool.fallback", "tool", { name: "Fallback", binding: { kind: "function" }, connection: { transport: "in_process" } });
  const nodes = [
    { id: "input", node_kind: "input" },
    { id: "producer", node_kind: "tool", tool_ref: producer.asset_id, invocation_control: "workflow" },
    { id: "route", node_kind: "function", role: "route" },
    { id: "selected", node_kind: "tool", tool_ref: selected.asset_id, invocation_control: "workflow" },
    { id: "fallback", node_kind: "tool", tool_ref: fallback.asset_id, invocation_control: "workflow" },
    { id: "output", node_kind: "output" }
  ];
  const edges = [
    targetEdge("input", "producer"),
    targetEdge("producer", "route"),
    targetEdge("route", "selected", "condition", { control: { condition: "todo_implementation_required" } }),
    targetEdge("route", "fallback", "condition", { control: { condition: "fallback", default: true } }),
    targetEdge("selected", "output"),
    { ...targetEdge("fallback", "output"), id: "edge.fallback.output", channel: "state" }
  ];
  return fixture("req-runtime-route", [workflow, producer, selected, fallback], nodes, edges, [], [], workflow.asset_id);
}

function a2aFixture() {
  const local = targetAsset("agent.local", "agent", { name: "Local" });
  const remote = targetAsset("agent.remote", "agent", {
    name: "Remote",
    binding: { kind: "a2a", contract_ref: "a2a-001" },
    connection: { transport: "http" }
  });
  const data = fixture("req-a2a", [local, remote], [
    { id: "input", node_kind: "input" },
    { id: "local", node_kind: "agent", agent_ref: local.asset_id, available_tools: [] },
    { id: "remote", node_kind: "agent", agent_ref: remote.asset_id, available_tools: [] },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "local"), targetEdge("local", "remote"), targetEdge("remote", "output")], [], [
    targetA2aContract({ agentRef: remote.asset_id, url: "http://127.0.0.1:8011/a2a/remote/.well-known/agent-card.json" })
  ]);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: "rtc-a2a-consumer",
    contractKind: "external_connection",
    assetId: remote.asset_id
  })];
  return data;
}

function a2aExposureFixture() {
  const contractId = "a2a-201";
  const exposed = targetAsset("agent.exposed", "agent", {
    name: "Exposed Agent",
    exposure: { protocol: "a2a", contract_ref: contractId }
  });
  const data = fixture("req-a2a-exposure", [exposed], [
    { id: "input", node_kind: "input" },
    { id: "exposed", node_kind: "agent", agent_ref: exposed.asset_id, available_tools: [] },
    { id: "output", node_kind: "output" }
  ], [targetEdge("input", "exposed"), targetEdge("exposed", "output")], [], [
    targetA2aContract({
      contractId,
      agentRef: exposed.asset_id,
      name: exposed.name,
      url: "http://127.0.0.1:8001/a2a/exposed/.well-known/agent-card.json"
    })
  ]);
  data.runtimeContracts = [targetRuntimeContract({
    contractId: "rtc-a2a-exposure",
    contractKind: "external_connection",
    assetId: exposed.asset_id
  })];
  return data;
}

function fixture(requirementId, assets, nodes, edges, regions = [], a2aContracts = [], workflowRef = null) {
  const requirement = targetRequirement(requirementId);
  const strictAssets = assets.map((asset) => ({ ...asset, source_requirement_id: requirementId }));
  return { requirement, assets: strictAssets, graph: targetGraph({ requirementId, nodes, edges, regions, workflowRef }), a2aContracts };
}

function region(id, kind, nodeIds, entryNodeIds, exitNodeIds) {
  return {
    id,
    kind,
    node_ids: nodeIds,
    entry_node_ids: entryNodeIds,
    exit_node_ids: exitNodeIds,
    parent_region_id: null
  };
}

function withFixture(data, callback) {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-matrix-"));
  const analysis = {
    contract_version: "2.0",
    normalizedRequirement: data.requirement,
    evidence: targetEvidence(data.requirement),
    assetCandidates: structuredClone(data.assets),
    a2aContracts: data.a2aContracts ?? [],
    runtimeContracts: data.runtimeContracts ?? [],
    graph: data.graph
  };
  const plan = {
    contract_version: "2.0",
    requirement_id: data.requirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    assets: structuredClone(data.assets),
    graph: data.graph,
    runtime_contracts: structuredClone(data.runtimeContracts ?? []),
    excluded_assets: [],
    manifest: { catalog_bound_assets: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  };
  writeTargetArtifactsFromObjects(artifactRoot, analysis, plan);
  try {
    callback({ artifactRoot, analysis, plan });
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
}

function writeTargetArtifactsFromObjects(root, analysis, plan) {
  writeTargetArtifacts(root, {
    requirement: analysis.normalizedRequirement,
    assets: plan.assets,
    graph: plan.graph,
    runnable: true,
    a2aContracts: analysis.a2aContracts,
    runtimeContracts: analysis.runtimeContracts
  });
  writeFileSync(join(root, "analysis-result.json"), `${JSON.stringify(analysis, null, 2)}\n`);
  writeFileSync(join(root, "scaffold-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
}

function generated(outputRoot) {
  const packageName = discoverGeneratedPackage(outputRoot);
  const packageRoot = join(outputRoot, packageName);
  return {
    packageRoot,
    source: readFileSync(join(packageRoot, "agent.py"), "utf8"),
    manifest: JSON.parse(readFileSync(join(packageRoot, "workflow_manifest.json"), "utf8")),
    contractTest: readFileSync(join(packageRoot, "tests", "test_workflow_contract.py"), "utf8")
  };
}

function assertGeneratedPackageImportsOnAdk23(outputRoot, { provider = false } = {}) {
  const packageName = discoverGeneratedPackage(outputRoot);
  const providerImport = provider ? "; import af_adk_a2a_server" : "";
  const stdout = execFileSync(
    generatedPythonExecutable(),
    ["-c", `from importlib.metadata import version; import ${packageName}${providerImport}; print(version("google-adk"))`],
    { cwd: outputRoot, encoding: "utf8", env: { ...process.env, AF_LLM_PROVIDER: "gemini" }, stdio: ["ignore", "pipe", "pipe"] }
  );
  assert.equal(stdout.trim(), "2.3.0");
}
