import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactRootStore } from "./artifactRootStore.ts";
import {
  DEFAULT_ADK_CHAT_PORT,
  RuntimeChatManager,
  buildAdkServerCommand,
  extractFinalTextFromAdkEvents
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
  await writeFile(join(stubDir, "requirements.txt"), "google-adk\npytest\n", "utf8");

  const manager = new RuntimeChatManager({ repoRoot, store });
  const status = await manager.status("req-chat");

  assert.equal(DEFAULT_ADK_CHAT_PORT, 8765);
  assert.equal(status.port, 8765);
  assert.equal(status.host, "127.0.0.1");
  assert.equal(status.app_name, "req_chat_adk");
  assert.equal(status.installed, false);
  assert.equal(status.server.status, "stopped");
  assert.equal(status.api_base_url, "http://127.0.0.1:8765");
  assert.equal(status.web_url, "http://127.0.0.1:8765");

  const command = buildAdkServerCommand({ stubDir, host: "127.0.0.1", port: 8765 });
  assert.equal(command.command, join(stubDir, ".venv/bin/adk"));
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
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}
