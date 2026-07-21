import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ArtifactRootStore } from "./artifactRootStore.ts";
import {
  DEFAULT_ADK_CHAT_PORT,
  RuntimeChatManager,
  buildAdkServerCommand,
  resolveAdkRuntimeVenv
} from "./runtimeChat.ts";
import {
  DEFAULT_ADK_A2A_PORT,
  RuntimeA2aManager,
  buildAdkA2aServerCommand
} from "./runtimeA2a.ts";
import { writeFakeA2aRuntime } from "./runtimeA2aTestHelpers.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-chat-"));
const store = new ArtifactRootStore({ repoRoot });

try {
  await store.createRoot("req-chat");
  const stubDir = join(repoRoot, "artifacts/af/req-chat/runtime-stub");
  await mkdir(join(stubDir, "req_chat_adk"), { recursive: true });
  await writeFile(
    join(stubDir, "req_chat_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_chat_adk" }, null, 2)}\n`,
    "utf8"
  );
  await writeRequiredMockScaffoldPlan(stubDir, "wf-chat-mock");
  await writeMockLabServerState("wf-chat-mock", "stopped");
  const statusPort = await getAvailablePort();
  const manager = new RuntimeChatManager({ repoRoot, store, port: statusPort });
  const status = await manager.status("req-chat");

  assert.equal(DEFAULT_ADK_CHAT_PORT, 8765);
  assert.equal(status.port, statusPort);
  assert.equal(status.host, "127.0.0.1");
  assert.equal(status.app_name, "req_chat_adk");
  assert.equal(status.installed, false);
  assert.equal(status.install_supported, false);
  assert.match(status.setup_hint, /requirements\/adk-runtime\.txt/);
  assert.equal(status.server.status, "stopped");
  assert.equal(status.api_base_url, `http://127.0.0.1:${statusPort}`);
  assert.equal(status.web_url, `http://127.0.0.1:${statusPort}`);
  assert.equal(status.paths.venv, join(repoRoot, ".agent-factory/runtime/.venv"));
  assert.equal(status.paths.python, join(repoRoot, ".agent-factory/runtime/.venv/bin/python"));
  assert.equal(status.paths.adk, join(repoRoot, ".agent-factory/runtime/.venv/bin/adk"));
  assert.deepEqual(
    status.mock_lab_prerequisites.map((prerequisite) => ({
      mock_server_id: prerequisite.mock_server_id,
      status: prerequisite.status,
      running: prerequisite.running,
      start_url: prerequisite.start_action.url
    })),
    [
      {
        mock_server_id: "wf-chat-mock",
        status: "stopped",
        running: false,
        start_url: "/api/mock-lab/wf-chat-mock/server/start"
      }
    ]
  );

  const venv = resolveAdkRuntimeVenv({ repoRoot, platform: "linux", env: {} });
  assert.equal(venv.venvDir, join(repoRoot, ".agent-factory/runtime/.venv"));
  assert.equal(venv.pythonPath, join(repoRoot, ".agent-factory/runtime/.venv/bin/python"));
  assert.equal(venv.adkPath, join(repoRoot, ".agent-factory/runtime/.venv/bin/adk"));
  const winVenv = resolveAdkRuntimeVenv({
    repoRoot,
    platform: "win32",
    env: { AF_ADK_VENV_DIR: "C:\\agent-factory\\adk-venv" }
  });
  assert.equal(winVenv.pythonPath, "C:\\agent-factory\\adk-venv\\Scripts\\python.exe");
  assert.equal(winVenv.adkPath, "C:\\agent-factory\\adk-venv\\Scripts\\adk.exe");

  const command = buildAdkServerCommand({ adkPath: venv.adkPath, host: "127.0.0.1", port: 8765 });
  assert.equal(command.command, join(repoRoot, ".agent-factory/runtime/.venv/bin/adk"));
  assert.deepEqual(command.args, [
    "api_server",
    "--host",
    "127.0.0.1",
    "--port",
    "8765",
    "--session_service_uri",
    "memory://",
    "--artifact_service_uri",
    "memory://",
    "--no-reload",
    "--with_ui",
    "."
  ]);

  await store.createRoot("req-a2a");
  const a2aPort = await getAvailablePort();
  const a2aStubDir = join(repoRoot, "artifacts/af/req-a2a/runtime-stub");
  await mkdir(join(a2aStubDir, "req_a2a_adk"), { recursive: true });
  await writeFile(
    join(a2aStubDir, "req_a2a_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_a2a_adk", requirement: { title: "A2A test provider" } }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(a2aStubDir, "req_a2a_adk/agent.py"), "root_agent = object()\n", "utf8");
  await writeFile(join(a2aStubDir, "af_adk_a2a_server.py"), "# fake launcher\n", "utf8");
  const a2aManager = new RuntimeA2aManager({ repoRoot, store, port: a2aPort });
  const a2aStatus = await a2aManager.status("req-a2a");
  assert.equal(DEFAULT_ADK_A2A_PORT, 8001);
  assert.equal(a2aStatus.port, a2aPort);
  assert.equal(a2aStatus.rpc_url, `http://127.0.0.1:${a2aPort}/a2a/req_a2a_adk`);
  assert.equal(
    a2aStatus.agent_card_url,
    `http://127.0.0.1:${a2aPort}/a2a/req_a2a_adk/.well-known/agent-card.json`
  );
  assert.equal(a2aStatus.server.status, "stopped");
  const a2aCommand = buildAdkA2aServerCommand({ pythonPath: venv.pythonPath, stubDir: a2aStubDir, host: "127.0.0.1", port: a2aPort });
  assert.deepEqual(a2aCommand.args, [
    join(a2aStubDir, "af_adk_a2a_server.py"),
    "--host",
    "127.0.0.1",
    "--port",
    String(a2aPort),
    "--session_service_uri",
    "memory://",
    "--artifact_service_uri",
    "memory://",
    "--no-reload",
    "--with_ui",
    "."
  ]);

  await store.createRoot("req-adopt");
  const adoptPort = await getAvailablePort();
  const adoptStubDir = join(repoRoot, "artifacts/af/req-adopt/runtime-stub");
  const sharedVenvDir = join(repoRoot, ".agent-factory/runtime/.venv");
  await mkdir(join(adoptStubDir, "req_adopt_adk"), { recursive: true });
  await mkdir(join(sharedVenvDir, "bin"), { recursive: true });
  await writeFile(
    join(adoptStubDir, "req_adopt_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_adopt_adk" }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(adoptStubDir, "req_adopt_adk/agent.py"), "root_agent = object()\n", "utf8");
  await writeFile(join(sharedVenvDir, "bin/python"), "#!/bin/sh\nexit 0\n", "utf8");
  await writeFile(
    join(sharedVenvDir, "bin/adk"),
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const http = require('node:http');",
      "const path = require('node:path');",
      "const args = process.argv.slice(2);",
      "const port = Number(args[args.indexOf('--port') + 1]);",
      "const host = args[args.indexOf('--host') + 1] || '127.0.0.1';",
      "function appName() {",
      "  const entry = fs.readdirSync(process.cwd(), { withFileTypes: true }).find((item) => item.isDirectory() && !item.name.startsWith('.'));",
      "  if (!entry) return 'unknown_adk';",
      "  const manifestPath = path.join(process.cwd(), entry.name, 'workflow_manifest.json');",
      "  if (!fs.existsSync(manifestPath)) return entry.name;",
      "  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).package || entry.name;",
      "}",
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/list-apps') {",
      "    res.setHeader('content-type', 'application/json');",
      "    res.end(JSON.stringify([appName()]));",
      "    return;",
      "  }",
      "  const match = req.url && req.url.match(/^\\/a2a\\/([^/]+)\\/\\.well-known\\/agent-card\\.json$/);",
      "  if (match) {",
      "    res.setHeader('content-type', 'application/json');",
      "    res.end(JSON.stringify({ name: match[1], skills: [{ id: `${match[1]}_workflow` }] }));",
      "    return;",
      "  }",
      "  res.end('fake adk');",
      "});",
      "server.listen(port, host);",
      "process.on('SIGTERM', () => { server.close(); process.exit(0); });",
      "setInterval(() => undefined, 1000);",
      ""
    ].join("\n"),
    "utf8"
  );
  await chmod(join(sharedVenvDir, "bin/python"), 0o755);
  await chmod(join(sharedVenvDir, "bin/adk"), 0o755);

  const firstManager = new RuntimeChatManager({ repoRoot, store, port: adoptPort });
  const started = await firstManager.start("req-adopt");
  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.equal(started.status.server.stale, false);
  assert.ok(started.status.server.pid);

  const restartedManager = new RuntimeChatManager({ repoRoot, store, port: adoptPort });
  const adopted = await restartedManager.status("req-adopt");
  assert.equal(adopted.server.status, "running");
  assert.equal(adopted.server.managed, true);
  assert.equal(adopted.server.can_stop, true);
  assert.equal(adopted.server.pid, started.status.server.pid);
  assert.equal(adopted.server.stale, false);

  await writeFile(join(adoptStubDir, "req_adopt_adk/agent.py"), "root_agent = 'changed'\n", "utf8");
  const staleStatus = await restartedManager.status("req-adopt");
  assert.equal(staleStatus.server.status, "running");
  assert.equal(staleStatus.server.stale, true);
  assert.notEqual(staleStatus.server.started_stub_fingerprint, staleStatus.server.current_stub_fingerprint);

  await store.createRoot("req-switch");
  const switchStubDir = join(repoRoot, "artifacts/af/req-switch/runtime-stub");
  await mkdir(join(switchStubDir, "req_switch_adk"), { recursive: true });
  await writeFile(
    join(switchStubDir, "req_switch_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_switch_adk" }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(switchStubDir, "req_switch_adk/agent.py"), "root_agent = object()\n", "utf8");
  const switchManager = new RuntimeChatManager({ repoRoot, store, port: adoptPort });
  const switchBlockedStatus = await switchManager.status("req-switch");
  assert.equal(switchBlockedStatus.server.status, "failed");
  assert.ok(switchBlockedStatus.server.port_owner_pid);
  assert.match(switchBlockedStatus.server.message ?? "", /replace it/);
  const switched = await switchManager.start("req-switch");
  assert.equal(switched.ok, true);
  assert.equal(switched.status.server.status, "running");
  assert.equal(switched.status.app_name, "req_switch_adk");
  const switchedPid = switched.status.server.pid;
  assert.ok(switchedPid);
  assert.deepEqual(await waitForListApps(adoptPort, ["req_switch_adk"]), ["req_switch_adk"]);

  const stopped = await switchManager.stop("req-switch");
  assert.equal(stopped.ok, true);
  assert.equal(stopped.status.server.status, "stopped");

  await writeFakeA2aRuntime(repoRoot, { serveAgentCard: true });
  const a2aStarted = await a2aManager.start("req-a2a");
  assert.equal(a2aStarted.ok, true);
  assert.equal(a2aStarted.status.server.status, "running");
  const generatedAgentCard = JSON.parse(readFileSync(join(a2aStubDir, "req_a2a_adk/agent.json"), "utf8")) as {
    readonly url: string;
    readonly name: string;
  };
  assert.equal(generatedAgentCard.name, "req_a2a_adk");
  assert.equal(generatedAgentCard.url, `http://127.0.0.1:${a2aPort}/a2a/req_a2a_adk`);
  const a2aStopped = await a2aManager.stop("req-a2a");
  assert.equal(a2aStopped.ok, true);

  await store.createRoot("req-a2a-missing-card");
  const missingCardPort = await getAvailablePort();
  const missingCardStubDir = join(repoRoot, "artifacts/af/req-a2a-missing-card/runtime-stub");
  await mkdir(join(missingCardStubDir, "req_a2a_missing_card_adk"), { recursive: true });
  await writeFile(
    join(missingCardStubDir, "req_a2a_missing_card_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_a2a_missing_card_adk", requirement: { title: "A2A missing card" } }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(missingCardStubDir, "req_a2a_missing_card_adk/agent.py"), "root_agent = object()\n", "utf8");
  await writeFile(join(missingCardStubDir, "af_adk_a2a_server.py"), "# fake launcher\n", "utf8");
  await writeFakeA2aRuntime(repoRoot, { serveAgentCard: false });
  const missingCardManager = new RuntimeA2aManager({
    repoRoot,
    store,
    port: missingCardPort,
    startupProbeTimeoutMs: 250,
    statusProbeTimeoutMs: 100
  });
  const missingCardStart = await missingCardManager.start("req-a2a-missing-card");
  assert.equal(missingCardStart.ok, false);
  assert.equal(missingCardStart.status.server.status, "failed");
  assert.equal(missingCardStart.status.server.agent_card_ready, false);
  assert.equal(missingCardStart.status.server.agent_card_status_code, 404);
  assert.match(missingCardStart.status.server.message ?? "", /Agent Card/);
  assert.equal((await missingCardManager.stop("req-a2a-missing-card")).ok, true);
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not allocate a local test port."));
      });
    });
  });
}

async function waitForListApps(port: number, expected: readonly string[]): Promise<unknown> {
  const deadline = Date.now() + 3_000;
  let lastValue: unknown = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/list-apps`);
      lastValue = await response.json();
      if (Array.isArray(lastValue) && lastValue.length === expected.length && lastValue.every((value, index) => value === expected[index])) {
        return lastValue;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
    await delay(50);
  }
  return lastValue;
}

async function writeRequiredMockScaffoldPlan(stubDir: string, mockServerId: string): Promise<void> {
  await writeFile(
    join(stubDir, "scaffold-plan.json"),
    `${JSON.stringify(
      {
        contract_version: "2.0",
        requirement_id: "req-runtime-chat-mock",
        source: "approved_workbench_artifact",
        raw_requirement_to_code: false,
        output_mode: "runnable",
        assets: [
          {
            asset_id: "tool.required-mock",
            source_requirement_id: "req-runtime-chat-mock",
            catalog_entry_id: null,
            name: "Required synthetic mock Tool",
            asset_type: "tool",
            domain_scope: "domain_neutral",
            business_domains: [],
            owner: "platform",
            reuse_status: "project_only",
            capability_tags: ["synthetic-mock"],
            binding: { kind: "mcp", server_ref: mockServerId, tool_name: "get_scenario_taxonomy" },
            connection: { transport: "stdio" },
            workflow_profile: null,
            exposure: null,
            confidence: 1,
            rationale: "Local synthetic runtime prerequisite.",
            inputs: [],
            outputs: [],
            risk_level: "low",
            risk_signals: [],
            status: "approved",
            missing_information: []
          }
        ],
        runtime_contracts: [],
        excluded_assets: [],
        graph: {
          graph_id: "graph-runtime-chat-mock",
          source_requirement_id: "req-runtime-chat-mock",
          workflow_ref: null,
          nodes: [],
          edges: [],
          regions: []
        },
        manifest: { catalog_bound_assets: [], new_code_required: [] },
        validation: { can_generate_source: true, blockers: [], warnings: [] }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeMockLabServerState(mockServerId: string, status: "running" | "stopped"): Promise<void> {
  const mockDir = join(repoRoot, "artifacts/mock-lab", mockServerId);
  await mkdir(mockDir, { recursive: true });
  await writeFile(join(mockDir, "mock-spec.json"), `${JSON.stringify({ mock_id: mockServerId, tools: [] }, null, 2)}\n`, "utf8");
  await writeFile(
    join(mockDir, "server-state.json"),
    `${JSON.stringify(
      {
        mock_id: mockServerId,
        status,
        pid: status === "running" ? process.pid : null
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
