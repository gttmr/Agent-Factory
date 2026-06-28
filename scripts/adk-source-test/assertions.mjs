import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  collectFiles,
  collectGeneratorSourceFiles,
  discoverGeneratedPackage,
  readBundle,
  repoRoot
} from "./fixtures.mjs";

const generatorAuthoredLeaks = [
  "wf-page-recommendation-mock",
  "WORKFLOW_INSTRUCTION",
  "Page Metadata RAG",
  "적금",
  "T2S",
  "UserFlow",
  "행동유형",
  "PAGE_B"
];
const legacyRouteAliasLiterals = ["run_analysis", "skip_analysis", "분석 실행", "분석 없이 진행"];

export function assertGeneratorSourcesStayDomainNeutral() {
  for (const file of collectGeneratorSourceFiles()) {
    const label = relative(repoRoot, file);
    const source = readFileSync(file, "utf8");
    for (const token of generatorAuthoredLeaks) {
      assert.ok(!source.includes(token), `${label} contains generator-authored scenario/product literal "${token}"`);
    }
    assertLegacyRouteAliasCompatOnly(source, label);
  }
}

export function assertSmokeBundle(outputRoot) {
  const { packageName, manifest, agentSource } = readBundle(outputRoot);
  assertCommonBundle(outputRoot, manifest);
  assert.equal(manifest.output_mode, "smoke");
  assert.equal(manifest.guardrails.generated_business_logic, false);
  assert.match(agentSource, /from google\.adk\.agents import BaseAgent/);
  assert.match(agentSource, /class SyntheticRuntimeSmokeAgent\(BaseAgent\)/);
  assert.match(agentSource, /runtime_mock_smoke/);
  assert.match(agentSource, /GRAPH_EDGES = \[/);
  assert.match(agentSource, /\("START", "node_/);
  assert.doesNotMatch(agentSource, /root_agent = Workflow\(/);
  assert.ok(!existsSync(join(outputRoot, "agents.config.yaml")), "smoke bundle must not emit agents.config.yaml");
  return packageName;
}

export function assertRunnableBundle(outputRoot) {
  const { packageName, manifest, agentSource } = readBundle(outputRoot);
  const envExample = readFileSync(join(outputRoot, ".env.example"), "utf8");
  const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
  const agentsConfig = readFileSync(join(outputRoot, "agents.config.yaml"), "utf8");
  assertCommonBundle(outputRoot, manifest);
  assert.equal(manifest.output_mode, "runnable");
  assert.equal(manifest.guardrails.runnable_synthetic_wiring, true);
  assert.ok(manifest.runtime, "runnable manifest must include a runtime block");
  assert.ok(Array.isArray(manifest.runtime.connected_adapters));
  assert.ok(Array.isArray(manifest.runtime.unconnected_adapters));
  assert.match(agentSource, /from google\.adk\.workflow import/);
  assert.match(agentSource, /from google\.adk\.agents import LlmAgent/);
  assert.match(agentSource, /AF_LLM_PROVIDER/);
  assert.match(agentSource, /AF_VLLM_API_BASE/);
  assert.match(agentSource, /AF_VLLM_MODEL/);
  assert.match(agentSource, /from google\.adk\.models\.lite_llm import LiteLlm/);
  assert.match(agentSource, /LiteLlm\(/);
  assert.match(agentSource, /_llm_cfg\(\)\.get\("provider"\)/);
  assert.match(agentSource, /root_agent = Workflow\(/);
  assert.match(agentSource, /mode="single_turn"/);
  assert.match(agentSource, /당신은/);
  assert.doesNotMatch(agentSource, /You are gen_agent/);
  assert.match(agentSource, /name="응답_생성_Agent"/);
  assert.match(agentSource, /name="데이터_조회_Adapter"/);
  assert.match(agentSource, /http:\/\/127\.0\.0\.1:5173\/api\/mock-lab\/mcp/);
  assert.match(agentSource, /AF_RUNTIME_ENV_FILE/);
  assert.match(agentSource, /\.agent-factory\/runtime\.env/);
  assert.match(agentSource, /if key not in os\.environ:/);
  assert.doesNotMatch(agentSource, /SyntheticRuntimeSmokeAgent/);
  assert.match(agentSource, /async def _fn_mod_gen_adapter\(ctx: Context\)/);
  assert.match(agentSource, /node_mod_gen_adapter = FunctionNode\(func=_fn_mod_gen_adapter/);
  assert.ok(
    manifest.runtime.unconnected_adapters.some((adapter) => adapter.module_id === "mod-gen-adapter"),
    "fixture adapter must be reported as unconnected"
  );
  assert.equal(manifest.runtime.connected_adapters.length, 0);
  assert.ok(existsSync(join(outputRoot, "agents.config.yaml")), "runnable bundle must emit agents.config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "workflow.py")), "bundle must include workflow.py for developer handoff");
  assert.ok(existsSync(join(outputRoot, packageName, "schemas.py")), "bundle must include schemas.py");
  assert.ok(existsSync(join(outputRoot, packageName, "mock_config.yaml")), "bundle must include mock_config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "sample_inputs.yaml")), "bundle must include sample_inputs.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "README.md")), "bundle must include package-local README.md");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "adapters.py")), "bundle must include nodes/adapters.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "gates.py")), "bundle must include nodes/gates.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "workflow_calls.py")), "bundle must include nodes/workflow_calls.py");
  assert.ok(existsSync(join(outputRoot, "README.md")), "bundle must include README.md");
  assert.match(
    readFileSync(join(outputRoot, "implementation-handoff.md"), "utf8"),
    /TODO/,
    "bundle must keep a TODO handoff"
  );
  assert.ok(existsSync(join(outputRoot, ".env.example")), "runnable bundle must emit .env.example");
  assert.ok(existsSync(join(outputRoot, ".gitignore")), "runnable bundle must emit .gitignore");
  assert.doesNotMatch(envExample, /^GOOGLE_API_KEY=/m, "per-bundle .env.example must not ask developers to repeat Gemini secrets");
  assert.match(envExample, /AF_LLM_PROVIDER=auto/);
  assert.match(envExample, /AF_VLLM_API_BASE=http:\/\/127\.0\.0\.1:8000\/v1/);
  assert.match(envExample, /AF_VLLM_MODEL=hosted_vllm\/local-model/);
  assert.match(envExample, /AF_RUNTIME_ENV_FILE/);
  assert.match(envExample, /\.agent-factory\/runtime\.env/);
  assert.match(agentsConfig, /provider: auto/);
  assert.match(agentsConfig, /default_model: hosted_vllm\/local-model/);
  assert.match(agentsConfig, /api_base_env: AF_VLLM_API_BASE/);
  assert.match(agentsConfig, /model_env: AF_VLLM_MODEL/);
  assert.match(agentsConfig, /한글 우선/);
  assert.match(agentsConfig, /name: 응답_생성_Agent/);
  assert.equal(manifest.runtime.provider, "auto");
  assert.equal(manifest.runtime.default_model, "hosted_vllm/local-model");
  assert.match(readme, /repository root의 `\.agent-factory\/runtime\.env`로 복사/);
  assert.match(readme, /AF_VLLM_API_BASE/);
  assert.match(readme, /AF_VLLM_MODEL/);
  assert.match(readme, /npm run dev --prefix packages\/mock-lab -- --host 0\.0\.0\.0 --port 5176 --strictPort/);
  assert.match(readme, /AF_MOCK_LAB_MCP_URL=http:\/\/127\.0\.0\.1:5176\/api\/mock-lab\/mcp/);
  assert.doesNotMatch(readme, /cp \.env\.example \.env\s+# then set GOOGLE_API_KEY/);
  return packageName;
}

export function assertPregeneratedRunnableBundle(outputRoot) {
  const { packageName, manifest, agentSource, contractTest } = readBundle(outputRoot);
  const envExample = readFileSync(join(outputRoot, ".env.example"), "utf8");
  const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
  const agentsConfig = readFileSync(join(outputRoot, "agents.config.yaml"), "utf8");
  assertCommonBundle(outputRoot, manifest);
  assert.equal(manifest.output_mode, "runnable");
  assert.equal(manifest.guardrails.runnable_synthetic_wiring, true);
  assert.ok(manifest.runtime, "runnable manifest must include a runtime block");
  assert.ok(Array.isArray(manifest.runtime.connected_adapters));
  assert.ok(Array.isArray(manifest.runtime.unconnected_adapters));
  assert.match(agentSource, /from google\.adk\.workflow import/);
  assert.match(agentSource, /root_agent = Workflow\(/);
  assert.doesNotMatch(agentSource, /SyntheticRuntimeSmokeAgent/);
  assert.ok(existsSync(join(outputRoot, "agents.config.yaml")), "runnable bundle must emit agents.config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "workflow.py")), "bundle must include workflow.py for developer handoff");
  assert.ok(existsSync(join(outputRoot, packageName, "schemas.py")), "bundle must include schemas.py");
  assert.ok(existsSync(join(outputRoot, packageName, "mock_config.yaml")), "bundle must include mock_config.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "sample_inputs.yaml")), "bundle must include sample_inputs.yaml");
  assert.ok(existsSync(join(outputRoot, packageName, "README.md")), "bundle must include package-local README.md");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "adapters.py")), "bundle must include nodes/adapters.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "gates.py")), "bundle must include nodes/gates.py");
  assert.ok(existsSync(join(outputRoot, packageName, "nodes", "workflow_calls.py")), "bundle must include nodes/workflow_calls.py");
  assert.ok(existsSync(join(outputRoot, "README.md")), "bundle must include README.md");
  assert.ok(existsSync(join(outputRoot, ".env.example")), "runnable bundle must emit .env.example");
  assert.ok(existsSync(join(outputRoot, ".gitignore")), "runnable bundle must emit .gitignore");
  assert.doesNotMatch(envExample, /^GOOGLE_API_KEY=/m, "per-bundle .env.example must not ask developers to repeat Gemini secrets");
  assert.match(envExample, /AF_LLM_PROVIDER=auto/);
  assert.match(envExample, /AF_VLLM_API_BASE=http:\/\/127\.0\.0\.1:8000\/v1/);
  assert.match(envExample, /AF_VLLM_MODEL=hosted_vllm\/local-model/);
  assert.match(agentsConfig, /provider: auto/);
  assert.match(agentsConfig, /default_model: hosted_vllm\/local-model/);
  assert.match(agentsConfig, /api_base_env: AF_VLLM_API_BASE/);
  assert.match(agentsConfig, /model_env: AF_VLLM_MODEL/);
  assert.match(agentsConfig, /한글 우선/);
  assert.equal(manifest.runtime.provider, "auto");
  assert.equal(manifest.runtime.default_model, "hosted_vllm/local-model");
  assert.match(readme, /repository root의 `\.agent-factory\/runtime\.env`로 복사/);
  assert.match(readme, /AF_VLLM_API_BASE/);
  assert.match(readme, /AF_VLLM_MODEL/);
  assert.match(readme, /npm run dev --prefix packages\/mock-lab -- --host 0\.0\.0\.0 --port 5176 --strictPort/);
  assert.match(readme, /AF_MOCK_LAB_MCP_URL=http:\/\/127\.0\.0\.1:5176\/api\/mock-lab\/mcp/);
  assert.match(contractTest, /test_runtime_chat_smoke_contract_is_present/);
  return packageName;
}

export function assertConnectedMcpRuntimeLabels(outputRoot) {
  const { manifest, agentSource } = readBundle(outputRoot);
  const mockConfig = readFileSync(join(outputRoot, discoverGeneratedPackage(outputRoot), "mock_config.yaml"), "utf8");
  assert.equal(manifest.runtime.connected_adapters.length, 1);
  assert.equal(manifest.runtime.connected_adapters[0].runtime_mcp_label, "런타임 MCP");
  assert.equal(manifest.runtime.connected_adapters[0].mock_binding.provider, "mock_lab");
  assert.match(manifest.runtime.connected_adapters[0].runtime_mcp_note, /실행 시점/);
  assert.match(agentSource, /"runtime_mcp_label": "런타임 MCP"/);
  assert.match(agentSource, /"runtime_mcp_note": "실행 시점에 Mock Lab MCP 서버를 통해 모델이 파악한 데이터입니다\."/);
  assert.match(agentSource, /"connection_status": "mcp_connected"/);
  assert.match(agentSource, /def _user_text_from_context\(ctx: Context\) -> str:/);
  assert.match(agentSource, /USER_TEXT_INPUT_NAMES = \{/);
  assert.match(agentSource, /"objective_text"/);
  assert.match(mockConfig, /provider: mock_lab/);
  assert.match(mockConfig, /package_path: packages\/mock-lab/);
  assert.match(mockConfig, /tool_name: "?lookup_test_data"?/);
}

export function assertManifestStageUpdated(artifactRoot) {
  const runManifest = JSON.parse(readFileSync(join(artifactRoot, "af-run-manifest.json"), "utf8"));
  assert.equal(runManifest.current_stage, "build");
  assert.equal(runManifest.stages.build.status, "complete");
  assert.equal(runManifest.approvals.stub_ready_for_followup, true);
  assert.ok(runManifest.stages.build.outputs.includes("runtime-stub/"));
  assert.ok(runManifest.validation.commands.some((command) => command.includes("python3 -m compileall")));
}

function assertCommonBundle(outputRoot, manifest) {
  const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
  assert.equal(manifest.guardrails.raw_requirement_to_code, false);
  assert.equal(manifest.guardrails.private_data_or_endpoints, false);
  assert.equal(manifest.scaffold_plan.source, "approved_workbench_artifact");
  assert.equal(manifest.scaffold_plan.raw_requirement_to_code, false);
  assert.ok(manifest.graph_ir, "manifest must include graph_ir");
  assert.ok(existsSync(join(outputRoot, "scaffold-plan.json")));
  assert.ok(existsSync(join(outputRoot, "implementation-handoff.md")));
  assert.ok(existsSync(join(outputRoot, "runtime-chat-smoke.json")));
  assert.ok(!existsSync(join(outputRoot, "requirements.txt")), "runtime-stub must not carry artifact-local Python requirements");
  assert.doesNotMatch(readme, /python3 -m venv \.venv/);
  assert.doesNotMatch(readme, /pip install -r requirements\.txt/);
  assert.match(readme, /requirements\/adk-runtime\.txt/);
  assertNoGeneratorAuthoredGeneratedLeaks(outputRoot);
}

function assertNoGeneratorAuthoredGeneratedLeaks(outputRoot) {
  for (const file of collectFiles(outputRoot)) {
    const label = relative(outputRoot, file);
    const text = readFileSync(file, "utf8");
    for (const token of generatorAuthoredLeaks) {
      assert.ok(!text.includes(token), `domain-neutral bundle leaked generator-authored literal "${token}" into ${label}`);
    }
  }
}

function assertLegacyRouteAliasCompatOnly(source, label) {
  const range = blockRange(source, "routeAliases");
  const hasMarkedCompatBlock = range && source.slice(range.start, range.end).includes("LEGACY_ROUTE_ALIAS_COMPAT");
  for (const token of legacyRouteAliasLiterals) {
    let index = source.indexOf(token);
    while (index !== -1) {
      const insideMarkedBlock = hasMarkedCompatBlock && index >= range.start && index < range.end;
      assert.ok(
        insideMarkedBlock,
        `${label} contains legacy route alias literal "${token}" outside LEGACY_ROUTE_ALIAS_COMPAT routeAliases() block`
      );
      index = source.indexOf(token, index + token.length);
    }
  }
}

function blockRange(source, functionName) {
  const functionIndex = source.indexOf(`function ${functionName}(`);
  if (functionIndex === -1) return null;
  const openBrace = source.indexOf("{", functionIndex);
  if (openBrace === -1) return null;
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return { start: functionIndex, end: index + 1 };
    }
  }
  return null;
}
