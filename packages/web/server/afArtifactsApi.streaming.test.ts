import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import {
  type ArtifactTestRequest,
  createRequester,
  createRoot,
  parseJsonBody,
  parseSse,
  responseJson,
  writeFakeScripts
} from "./artifactSyncTestHarness.ts";

async function assertVerifyRunStreams(request: ArtifactTestRequest): Promise<void> {
  const response = await request({
    url: "/req-stream/verify/run",
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"] ?? ""), /^text\/event-stream/);

  const events = parseSse(response.text());
  assert.deepEqual(events.map((entry) => entry.event), ["start", "stdout", "stderr", "done"]);
  assert.equal(events[0]?.data.command_key, "validate_artifact_root");
  assert.equal(events[1]?.data.chunk, "verify stdout line\n");
  assert.equal(events[2]?.data.chunk, "verify stderr line\n");
  assert.equal(events[3]?.data.ok, true);
  assert.equal(events[3]?.data.exit_code, 0);
  assert.equal(events[3]?.data.stdout, "verify stdout line\n");
  assert.equal(events[3]?.data.stderr, "verify stderr line\n");
  const manifest = responseJson<{ readonly validation: { readonly last_result: string } }>(
    await request({ url: "/req-stream/manifest" })
  );
  assert.equal(manifest.validation.last_result, "passed");
}

async function assertRuntimeStubBuildStreams(request: ArtifactTestRequest): Promise<void> {
  const response = await request({
    url: "/req-stream/runtime-stub/build",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { streamProgress: true }
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"] ?? ""), /^text\/event-stream/);

  const events = parseSse(response.text());
  assert.deepEqual(events.map((entry) => entry.event), ["start", "stdout", "stderr", "done"]);
  assert.match(String(events[0]?.data.command), /^node scripts\/generate-adk-source\.mjs /);
  assert.equal(events[1]?.data.chunk, "build stdout line\n");
  assert.equal(events[2]?.data.chunk, "build stderr line\n");
  assert.equal(events[3]?.data.ok, true);
  assert.deepEqual(events[3]?.data.files, [{ path: "agent.py", bytes: 22 }]);

  const listing = responseJson<{ readonly exists: boolean; readonly files: readonly { readonly path: string; readonly bytes: number }[] }>(
    await request({ url: "/req-stream/runtime-stub" })
  );
  assert.equal(listing.exists, true);
  assert.deepEqual(listing.files, [{ path: "agent.py", bytes: 22 }]);
}

async function assertJsonPathsStillWork(request: ArtifactTestRequest): Promise<void> {
  const buildResponse = await request({ url: "/req-json/runtime-stub/build", method: "POST" });
  assert.equal(buildResponse.status, 200);
  assert.match(String(buildResponse.headers["content-type"] ?? ""), /^application\/json/);
  const build = responseJson<{
    readonly ok: boolean;
    readonly stdout: string;
    readonly stderr: string;
    readonly command: string;
    readonly files: readonly { readonly path: string; readonly bytes: number }[];
  }>(buildResponse);
  assert.deepEqual(Object.keys(build), ["ok", "files", "stdout", "stderr", "command"]);
  assert.equal(build.ok, true);
  assert.equal(build.stdout, "build stdout line\n");
  assert.equal(build.stderr, "build stderr line\n");
  assert.match(build.command, /^node scripts\/generate-adk-source\.mjs /);
  assert.deepEqual(build.files, [{ path: "agent.py", bytes: 22 }]);

  const handoffResponse = await request({ url: "/req-json/implementation-handoff.md" });
  assert.equal(handoffResponse.status, 200);
  assert.equal(handoffResponse.text(), "# Root implementation handoff\n");

  const verifyResponse = await request({
    url: "/req-json/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(verifyResponse.status, 200);
  assert.match(String(verifyResponse.headers["content-type"] ?? ""), /^application\/json/);
  const verify = responseJson<{ readonly ok: boolean; readonly stdout: string; readonly stderr: string; readonly command_key: string }>(
    verifyResponse
  );
  assert.equal(verify.ok, true);
  assert.equal(verify.command_key, "validate_artifact_root");
  assert.equal(verify.stdout, "verify stdout line\n");
  assert.equal(verify.stderr, "verify stderr line\n");
}

async function assertVerifyRunRejectsArbitraryCommand(request: ArtifactTestRequest): Promise<void> {
  const before = responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" }));
  const response = await request({
    url: "/req-json/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "rm" }
  });

  assert.equal(response.status, 400);
  assert.equal(parseJsonBody<{ readonly error: string }>(response).error, "허용되지 않은 명령입니다: rm");
  assert.deepEqual(responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" })), before);
}

async function assertRuntimeChatLifecycle(request: ArtifactTestRequest, root: string): Promise<void> {
  await writeFakeRuntimeStub(root, "req-runtime");
  const before = responseJson<{
    readonly installed: boolean;
    readonly port: number;
    readonly app_name: string;
    readonly server: { readonly status: string; readonly pid: number | null };
  }>(await request({ url: "/req-runtime/runtime-chat/status" }));
  assert.equal(before.installed, false);
  assert.equal(before.port, Number(process.env.AF_ADK_CHAT_PORT));
  assert.equal(before.app_name, "req_stream_adk");
  assert.equal(before.server.status, "stopped");

  const installResponse = await request({ url: "/req-runtime/runtime-chat/install", method: "POST" });
  assert.equal(installResponse.status, 405);
  const install = parseJsonBody<{ readonly error: string; readonly status: { readonly installed: boolean } }>(installResponse);
  assert.match(install.error, /설치는 지원하지 않습니다/);
  assert.equal(install.status.installed, false);

  await writeFakeSharedAdkRuntime(root);
  assert.equal(responseJson<{ readonly installed: boolean }>(await request({ url: "/req-runtime/runtime-chat/status" })).installed, true);
  const started = responseJson<{ readonly ok: boolean; readonly status: { readonly server: { readonly status: string; readonly pid: number | null } } }>(
    await request({ url: "/req-runtime/runtime-chat/start", method: "POST" })
  );
  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.ok(started.status.server.pid);
  assert.equal(responseJson<{ readonly ok: boolean }>(await request({ url: "/req-runtime/runtime-chat/stop", method: "POST" })).ok, true);

  const a2aStatus = responseJson<{
    readonly installed: boolean;
    readonly port: number;
    readonly app_name: string;
    readonly rpc_url: string;
    readonly agent_card_url: string;
    readonly server: { readonly status: string };
  }>(await request({ url: "/req-runtime/runtime-a2a/status" }));
  assert.equal(a2aStatus.installed, true);
  assert.equal(a2aStatus.port, Number(process.env.AF_ADK_A2A_PORT));
  assert.equal(a2aStatus.app_name, "req_stream_adk");
  assert.equal(a2aStatus.rpc_url, `http://127.0.0.1:${process.env.AF_ADK_A2A_PORT}/a2a/req_stream_adk`);
  assert.equal(
    a2aStatus.agent_card_url,
    `http://127.0.0.1:${process.env.AF_ADK_A2A_PORT}/a2a/req_stream_adk/.well-known/agent-card.json`
  );
  assert.equal(a2aStatus.server.status, "stopped");

  const card = responseJson<{
    readonly app_name: string;
    readonly rpc_url: string;
    readonly agent_card_url: string;
    readonly card: { readonly name: string; readonly url: string; readonly preferredTransport: string };
  }>(await request({ url: "/req-runtime/runtime-a2a/agent-card" }));
  assert.equal(card.app_name, "req_stream_adk");
  assert.equal(card.card.name, "req_stream_adk");
  assert.equal(card.card.url, card.rpc_url);
  assert.equal(card.card.preferredTransport, "JSONRPC");
}

async function writeFakeRuntimeStub(root: string, reqId: string): Promise<void> {
  const stubDir = join(root, `artifacts/af/${reqId}/runtime-stub`);
  await mkdir(join(stubDir, "req_stream_adk"), { recursive: true });
  await writeFile(join(stubDir, "req_stream_adk/workflow_manifest.json"), `${JSON.stringify({ package: "req_stream_adk" }, null, 2)}\n`);
}

async function writeFakeSharedAdkRuntime(root: string): Promise<void> {
  const binDir = join(root, ".agent-factory/runtime/.venv/bin");
  await mkdir(binDir, { recursive: true });
  await writeFile(join(binDir, "python"), "#!/bin/sh\nexit 0\n");
  await writeFile(join(binDir, "adk"), ["#!/bin/sh", "echo 'fake adk server started'", "sleep 30", ""].join("\n"));
  await chmod(join(binDir, "python"), 0o755);
  await chmod(join(binDir, "adk"), 0o755);
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

const repoRoot = await mkdtemp(join(tmpdir(), "af-artifacts-api-stream-"));
const originalPath = process.env.PATH ?? "";
const originalRuntimePort = process.env.AF_ADK_CHAT_PORT;
const originalA2aPort = process.env.AF_ADK_A2A_PORT;

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  process.env.AF_ADK_CHAT_PORT = String(await getAvailablePort());
  process.env.AF_ADK_A2A_PORT = String(await getAvailablePort());
  const request = createRequester(repoRoot);

  await createRoot(request, "req-stream");
  await assertVerifyRunStreams(request);
  await assertRuntimeStubBuildStreams(request);

  await createRoot(request, "req-json");
  await assertJsonPathsStillWork(request);
  await assertVerifyRunRejectsArbitraryCommand(request);

  await createRoot(request, "req-runtime");
  await assertRuntimeChatLifecycle(request, repoRoot);
} finally {
  process.env.PATH = originalPath;
  if (originalRuntimePort === undefined) delete process.env.AF_ADK_CHAT_PORT;
  else process.env.AF_ADK_CHAT_PORT = originalRuntimePort;
  if (originalA2aPort === undefined) delete process.env.AF_ADK_A2A_PORT;
  else process.env.AF_ADK_A2A_PORT = originalA2aPort;
  await rm(repoRoot, { recursive: true, force: true });
}
