import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactRootStore } from "./artifactRootStore.ts";
import {
  DEFAULT_ADK_CHAT_PORT,
  RuntimeChatManager,
  buildAdkServerCommand,
  extractFinalTextFromAdkEvents,
  resolveAdkRuntimeVenv
} from "./runtimeChat.ts";

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

  const finalText = extractFinalTextFromAdkEvents([
    { content: { parts: [{ functionCall: { name: "demo_tool" } }], role: "model" } },
    { content: { parts: [{ text: "Synthetic loan precheck response" }], role: "model" } }
  ]);
  assert.equal(finalText, "Synthetic loan precheck response");

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
      "const http = require('node:http');",
      "const args = process.argv.slice(2);",
      "const port = Number(args[args.indexOf('--port') + 1]);",
      "const host = args[args.indexOf('--host') + 1] || '127.0.0.1';",
      "const server = http.createServer((_req, res) => res.end('fake adk'));",
      "server.listen(port, host);",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
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

  const stopped = await restartedManager.stop("req-adopt");
  assert.equal(stopped.ok, true);
  assert.equal(stopped.status.server.status, "stopped");
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
