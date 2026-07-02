import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertConnectedMcpRuntimeLabels,
  assertGeneratorSourcesStayDomainNeutral,
  assertManifestStageUpdated,
  assertRunnableBundle,
  assertSmokeBundle
} from "./assertions.mjs";
import {
  baseModules,
  discoverGeneratedPackage,
  generate,
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

test("runnable tool input resolver traverses runtime mock output bundles", () => {
  const { artifactRoot, outputRoot } = generate({ runnable: true, connectedAdapter: true });
  try {
    const { agentSource } = readBundle(outputRoot);
    assert.match(
      agentSource,
      /PAYLOAD_WRAPPER_KEYS = \([\s\S]*"runtime_mock"[\s\S]*"analysis_input_bundle"[\s\S]*\)/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("generator source keeps hardcoded scenario literals out of generator modules", () => {
  assertGeneratorSourcesStayDomainNeutral();
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
