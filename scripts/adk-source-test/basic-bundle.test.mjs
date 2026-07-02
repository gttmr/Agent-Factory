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
  discoverGeneratedPackage,
  generate,
  generator,
  readBundle,
  repoRoot,
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
