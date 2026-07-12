import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertConnectedMcpRuntimeLabels,
  assertManifestStageUpdated,
  assertRunnableBundle,
  assertSmokeBundle
} from "./assertions.mjs";
import { compileGeneratedPython, executeGeneratedPythonSymbols } from "./generated-python-runtime.mjs";
import { reviewedPayloadWrapperKeys } from "../adk-source/emitters/runtime-tool-inputs.mjs";
import {
  baseModules,
  discoverGeneratedPackage,
  generate,
  generateBundle,
  generator,
  readBundle,
  repoRoot,
  writeChannelFixture,
  writeFixture,
  writeJson
} from "./fixtures.mjs";

test("smoke mode emits the synthetic runtime smoke agent", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: false });
  try {
    assertSmokeBundle(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable mode emits an ADK Workflow graph and the editable bundle config", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true });
  try {
    assertRunnableBundle(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable mode lowers chat agent execution mode", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true, agentExecutionMode: "chat" });
  try {
    const { agentSource } = readBundle(outputRoot);
    assert.match(agentSource, /mode="chat"/);
    assert.doesNotMatch(agentSource, /mode="single_turn"/);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters carry an explicit runtime MCP label", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true, connectedAdapter: true });
  try {
    assertConnectedMcpRuntimeLabels(outputRoot);
    assertManifestStageUpdated(artifactRoot);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable mode gives reused adapter module nodes unique Python symbols", () => {
  const [, adapter] = baseModules(true);
  const modules = [
    {
      ...adapter,
      id: "mod-applicant-notification-adapter",
      name: "Applicant Notification Adapter"
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reused-module-runnable-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "notify-initial", node_kind: "adapter_call", module_id: "mod-applicant-notification-adapter" },
        { id: "notify-final", node_kind: "adapter_call", module_id: "mod-applicant-notification-adapter" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "notify-initial" },
        { from: "in1", to: "notify-final" },
        { from: "notify-initial", to: "out1" },
        { from: "notify-final", to: "out1" }
      ]
    });

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(
      source,
      /node_mod_applicant_notification_adapter__notify_initial = FunctionNode\(func=_fn_mod_applicant_notification_adapter__notify_initial/
    );
    assert.match(
      source,
      /node_mod_applicant_notification_adapter__notify_final = FunctionNode\(func=_fn_mod_applicant_notification_adapter__notify_final/
    );
    assert.match(source, /\(START, node_mod_applicant_notification_adapter__notify_initial\)/);
    assert.match(source, /\(START, node_mod_applicant_notification_adapter__notify_final\)/);
    assert.match(source, /ctx\.state\["mod_applicant_notification_adapter_output"\] = payload/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("smoke mode graph edges keep reused adapter module nodes distinct", () => {
  const [, adapter] = baseModules(false);
  const modules = [
    {
      ...adapter,
      id: "mod-applicant-notification-adapter",
      name: "Applicant Notification Adapter"
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reused-module-smoke-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "notify-initial", node_kind: "adapter_call", module_id: "mod-applicant-notification-adapter" },
        { id: "notify-final", node_kind: "adapter_call", module_id: "mod-applicant-notification-adapter" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "notify-initial" },
        { from: "in1", to: "notify-final" },
        { from: "notify-initial", to: "out1" },
        { from: "notify-final", to: "out1" }
      ]
    });
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.output_mode = "smoke";
    plan.modules = plan.modules.map((module) => ({
      ...module,
      scaffold_output: "contract_or_stub_only",
      no_runnable_business_logic: true
    }));
    writeJson(planPath, plan);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /\("START", "node_mod_applicant_notification_adapter__notify_initial"\)/);
    assert.match(source, /\("START", "node_mod_applicant_notification_adapter__notify_final"\)/);
    assert.match(source, /def node_mod_applicant_notification_adapter__notify_initial\(node_input: Any = None\):/);
    assert.match(source, /def node_mod_applicant_notification_adapter__notify_final\(node_input: Any = None\):/);
    assert.match(source, /output\["todo_function"\] = "TODO_IMPLEMENT_HERE_mod_applicant_notification_adapter"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable tool input resolver traverses reviewed container outputs but not scalar outputs", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reviewed-wrapper-"));
  try {
    writeFixture(artifactRoot, { runnable: true, connectedAdapter: true });
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.modules[1].outputs = [
      { name: "reviewed_object_envelope", type: " object ", required: true },
      { name: "reviewed_array_envelope", type: "ARRAY", required: false },
      { name: "reviewed_scalar_envelope", type: "string", required: true },
      { name: "reviewed_\"quoted\"_envelope", type: "object", required: true },
      { name: "reviewed_object_envelope", type: "object", required: false }
    ];
    writeJson(planPath, plan);

    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const sourcePath = join(outputRoot, discoverGeneratedPackage(outputRoot), "agent.py");
    compileGeneratedPython(sourcePath);
    const result = executeGeneratedPythonSymbols({
      sourcePath,
      names: ["PAYLOAD_WRAPPER_KEYS", "_content_text", "_json_payload", "_payload_value"],
      prelude: "import json\nfrom typing import Any",
      body: `
result = {
    "object": _payload_value({"reviewed_object_envelope": {"needle": "object-ok"}}, "needle"),
    "array": _payload_value({"reviewed_array_envelope": [{"needle": "array-ok"}]}, "needle"),
    "quoted": _payload_value({'reviewed_"quoted"_envelope': {"needle": "quoted-ok"}}, "needle"),
    "scalar": _payload_value({"reviewed_scalar_envelope": {"needle": "must-not-resolve"}}, "needle"),
}
`
    });
    assert.deepEqual(result, { object: "object-ok", array: "array-ok", quoted: "quoted-ok", scalar: null });
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("reviewed payload wrapper keys are deduplicated and sorted by code unit after the generic base", () => {
  const keys = reviewedPayloadWrapperKeys([
    { outputs: [{ name: "z_wrapper", type: "object" }, { name: "A_wrapper", type: "array" }] },
    { outputs: [{ name: "z_wrapper", type: " ARRAY " }, { name: "scalar_leaf", type: "string" }] }
  ]);
  assert.deepEqual(keys.slice(-2), ["A_wrapper", "z_wrapper"]);
  assert.equal(keys.filter((key) => key === "z_wrapper").length, 1);
  assert.equal(keys.includes("scalar_leaf"), false);
});

test("runnable honors an explicit scaffold package_name", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-package-name-"));
  try {
    writeFixture(artifactRoot, { runnable: true });
    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.package_name = "wf_page_recommendation_required";
    writeJson(planPath, plan);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    assert.ok(existsSync(join(outputRoot, "wf_page_recommendation_required", "agent.py")));
    assert.equal(discoverGeneratedPackage(outputRoot), "wf_page_recommendation_required");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable omitted package_name fallback preserves requirement id casing", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-package-fallback-"));
  try {
    writeFixture(artifactRoot, { runnable: true });
    const requirementPath = join(artifactRoot, "normalized-requirement.json");
    const requirement = JSON.parse(readFileSync(requirementPath, "utf8"));
    requirement.id = "Agent Factory";
    writeJson(requirementPath, requirement);

    const planPath = join(artifactRoot, "scaffold-plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    plan.requirement_id = "Agent Factory";
    delete plan.package_name;
    writeJson(planPath, plan);

    const manifestPath = join(artifactRoot, "af-run-manifest.json");
    const runManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    runManifest.requirement_id = "Agent Factory";
    writeJson(manifestPath, runManifest);

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    assert.ok(existsSync(join(outputRoot, "Agent_Factory_adk", "agent.py")));
    assert.equal(discoverGeneratedPackage(outputRoot), "Agent_Factory_adk");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable README uses an env file path relative to the generated output root", () => {
  const artifactRoot = join(repoRoot, "artifacts", "af", `req-gen-env-${process.pid}`);
  try {
    const outputRoot = join(artifactRoot, "runtime-stub");
    mkdirSync(artifactRoot, { recursive: true });
    writeFixture(artifactRoot, { runnable: true, connectedAdapter: true });
    // Pin cwd to the repo root so runtimeEnvRelativePath() (which anchors on
    // process.cwd()) is deterministic whether this runs standalone or via the
    // packages/web `test:analyzer` runner.
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe", cwd: repoRoot });

    const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
    assert.match(readme, /AF_RUNTIME_ENV_FILE=\.\.\/\.\.\/\.\.\/\.\.\/\.agent-factory\/runtime\.env/);
    assert.doesNotMatch(readme, /AF_RUNTIME_ENV_FILE=\.\.\/\.\.\/\.agent-factory\/runtime\.env/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
