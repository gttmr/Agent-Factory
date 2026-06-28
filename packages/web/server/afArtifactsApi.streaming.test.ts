import assert from "node:assert/strict";
import { once } from "node:events";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { createAfArtifactsMiddleware } from "./afArtifactsApi.ts";

interface SseEntry {
  event: string;
  data: Record<string, unknown>;
}

async function writeFakeScripts(root: string): Promise<void> {
  const scriptsDir = join(root, "scripts");
  const binDir = join(root, "bin");
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(scriptsDir, "validate-artifacts.mjs"),
    "/* served by the test node shim */\n"
  );
  await writeFile(
    join(scriptsDir, "generate-adk-source.mjs"),
    "/* served by the test node shim */\n"
  );
  await writeFile(
    join(binDir, "python3"),
    "#!/bin/sh\necho 'unexpected fake python3 args: $@' >&2\nexit 2\n"
  );
  await chmod(join(binDir, "python3"), 0o755);
  await writeFile(
    join(binDir, "node"),
    [
      "#!/bin/sh",
      "script=\"$1\"",
      "shift",
      "case \"$script\" in",
      "  scripts/validate-artifacts.mjs)",
      "    echo 'verify stdout line'",
      "    echo 'verify stderr line' >&2",
      "    exit 0",
      "    ;;",
      "  scripts/generate-adk-source.mjs)",
      "    root_dir=\"$1\"",
      "    stub_dir=\"$2\"",
      "    echo 'build stdout line'",
      "    echo 'build stderr line' >&2",
      "    mkdir -p \"$stub_dir\"",
      "    printf '# TODO runtime wiring\\n' > \"$stub_dir/agent.py\"",
      "    mkdir -p \"$stub_dir/req_stream_adk/__pycache__\"",
      "    printf 'compiled cache\\n' > \"$stub_dir/req_stream_adk/__pycache__/agent.pyc\"",
      "    exit 0",
      "    ;;",
      `  *) exec "${process.execPath}" "$script" "$@" ;;`,
      "esac",
      ""
    ].join("\n")
  );
  await chmod(join(binDir, "node"), 0o755);
}

function createRequester(root: string) {
  const middleware = createAfArtifactsMiddleware(root);
  return async (input: {
    url: string;
    method?: string;
    headers?: IncomingHttpHeaders;
    body?: unknown;
  }): Promise<FakeResponse> => {
    const req = new FakeRequest(input.url, input.method ?? "GET", input.headers ?? {}, input.body);
    const res = new FakeResponse();
    await middleware(req as IncomingMessage, res as unknown as ServerResponse, (error) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    });
    if (!res.writableEnded) await once(res, "finish");
    return res;
  };
}

async function createRoot(request: ReturnType<typeof createRequester>, reqId: string): Promise<void> {
  const response = await request({
    url: "/",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { requirement_id: reqId }
  });
  assert.equal(response.status, 201);
}

async function assertVerifyRunStreams(request: ReturnType<typeof createRequester>): Promise<void> {
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
  assert.equal(events[0].data.command_key, "validate_artifact_root");
  assert.equal(events[1].data.chunk, "verify stdout line\n");
  assert.equal(events[2].data.chunk, "verify stderr line\n");
  assert.equal(events[3].data.ok, true);
  assert.equal(events[3].data.exit_code, 0);
  assert.equal(events[3].data.stdout, "verify stdout line\n");
  assert.equal(events[3].data.stderr, "verify stderr line\n");

  const manifest = responseJson<{ validation: { last_result: string } }>(
    await request({ url: "/req-stream/manifest" })
  );
  assert.equal(manifest.validation.last_result, "passed");
}

async function assertRuntimeStubBuildStreams(request: ReturnType<typeof createRequester>): Promise<void> {
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
  assert.match(String(events[0].data.command), /^node scripts\/generate-adk-source\.mjs /);
  assert.equal(events[1].data.chunk, "build stdout line\n");
  assert.equal(events[2].data.chunk, "build stderr line\n");
  assert.equal(events[3].data.ok, true);
  assert.deepEqual(events[3].data.files, [{ path: "agent.py", bytes: 22 }]);

  const listing = responseJson<{ exists: boolean; files: Array<{ path: string; bytes: number }> }>(
    await request({ url: "/req-stream/runtime-stub" })
  );
  assert.equal(listing.exists, true);
  assert.deepEqual(listing.files, [{ path: "agent.py", bytes: 22 }]);
}

async function assertJsonPathsStillWork(request: ReturnType<typeof createRequester>): Promise<void> {
  const buildResponse = await request({ url: "/req-json/runtime-stub/build", method: "POST" });
  assert.equal(buildResponse.status, 200);
  assert.match(String(buildResponse.headers["content-type"] ?? ""), /^application\/json/);
  const build = responseJson<{
    ok: boolean;
    stdout: string;
    stderr: string;
    files: Array<{ path: string; bytes: number }>;
  }>(buildResponse);
  assert.equal(build.ok, true);
  assert.equal(build.stdout, "build stdout line\n");
  assert.equal(build.stderr, "build stderr line\n");
  assert.deepEqual(build.files, [{ path: "agent.py", bytes: 22 }]);

  const verifyResponse = await request({
    url: "/req-json/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(verifyResponse.status, 200);
  assert.match(String(verifyResponse.headers["content-type"] ?? ""), /^application\/json/);
  const verify = responseJson<{
    ok: boolean;
    stdout: string;
    stderr: string;
    command_key: string;
  }>(verifyResponse);
  assert.equal(verify.ok, true);
  assert.equal(verify.command_key, "validate_artifact_root");
  assert.equal(verify.stdout, "verify stdout line\n");
  assert.equal(verify.stderr, "verify stderr line\n");
}

async function writeFakeRuntimeStub(root: string, reqId: string): Promise<void> {
  const stubDir = join(root, `artifacts/af/${reqId}/runtime-stub`);
  await mkdir(join(stubDir, "req_stream_adk"), { recursive: true });
  await writeFile(
    join(stubDir, "req_stream_adk/workflow_manifest.json"),
    `${JSON.stringify({ package: "req_stream_adk" }, null, 2)}\n`
  );
}

async function writeFakeSharedAdkRuntime(root: string): Promise<void> {
  const binDir = join(root, ".agent-factory/runtime/.venv/bin");
  await mkdir(binDir, { recursive: true });
  await writeFile(join(binDir, "python"), "#!/bin/sh\nexit 0\n");
  await writeFile(
    join(binDir, "adk"),
    ["#!/bin/sh", "echo 'fake adk server started'", "sleep 30", ""].join("\n")
  );
  await chmod(join(binDir, "python"), 0o755);
  await chmod(join(binDir, "adk"), 0o755);
}

async function assertRuntimeChatLifecycle(request: ReturnType<typeof createRequester>, root: string): Promise<void> {
  await writeFakeRuntimeStub(root, "req-runtime");
  const before = responseJson<{
    installed: boolean;
    port: number;
    app_name: string;
    server: { status: string; pid: number | null };
  }>(await request({ url: "/req-runtime/runtime-chat/status" }));
  assert.equal(before.installed, false);
  assert.equal(before.port, Number(process.env.AF_ADK_CHAT_PORT));
  assert.equal(before.app_name, "req_stream_adk");
  assert.equal(before.server.status, "stopped");

  const installResponse = await request({ url: "/req-runtime/runtime-chat/install", method: "POST" });
  assert.equal(installResponse.status, 405);
  const install = JSON.parse(installResponse.text()) as { error: string; status: { installed: boolean } };
  assert.match(install.error, /설치는 지원하지 않습니다/);
  assert.equal(install.status.installed, false);

  await writeFakeSharedAdkRuntime(root);
  const ready = responseJson<{ installed: boolean }>(await request({ url: "/req-runtime/runtime-chat/status" }));
  assert.equal(ready.installed, true);

  const started = responseJson<{ ok: boolean; status: { server: { status: string; pid: number | null } } }>(
    await request({ url: "/req-runtime/runtime-chat/start", method: "POST" })
  );
  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.ok(started.status.server.pid);

  const stopped = responseJson<{ ok: boolean }>(
    await request({ url: "/req-runtime/runtime-chat/stop", method: "POST" })
  );
  assert.equal(stopped.ok, true);
}

function parseSse(body: string): SseEntry[] {
  return body
    .trim()
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLines = lines
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length));
      assert.ok(eventLine, `missing event line in ${block}`);
      assert.ok(dataLines.length > 0, `missing data line in ${block}`);
      return {
        event: eventLine.slice("event: ".length),
        data: JSON.parse(dataLines.join("\n")) as Record<string, unknown>
      };
    });
}

function responseJson<T>(response: FakeResponse): T {
  assert.equal(response.status, 200);
  return JSON.parse(response.text()) as T;
}

class FakeRequest extends Readable {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  private readonly rawBody: string;
  private sent = false;

  constructor(url: string, method: string, headers: IncomingHttpHeaders, body: unknown) {
    super();
    this.url = url;
    this.method = method;
    this.headers = headers;
    this.rawBody = body === undefined ? "" : JSON.stringify(body);
  }

  _read() {
    if (this.sent) return;
    this.sent = true;
    if (this.rawBody) this.push(Buffer.from(this.rawBody));
    this.push(null);
  }
}

class FakeResponse extends Writable {
  statusCode = 200;
  headers: Record<string, string | number | string[]> = {};
  private chunks: Buffer[] = [];

  get status() {
    return this.statusCode;
  }

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers[name.toLowerCase()] = Array.isArray(value) ? [...value] : value;
    return this;
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }

  write(
    chunk: unknown,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    cb?: (error?: Error | null) => void
  ): boolean {
    const callback = typeof encoding === "function" ? encoding : cb;
    this.chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8")
    );
    callback?.();
    return true;
  }

  end(chunk?: unknown, encoding?: BufferEncoding | (() => void), cb?: () => void): this {
    if (chunk !== undefined && chunk !== null) this.write(chunk, typeof encoding === "string" ? encoding : undefined);
    super.end();
    const callback = typeof encoding === "function" ? encoding : cb;
    callback?.();
    this.emit("close");
    return this;
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(chunk);
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

const repoRoot = await mkdtemp(join(tmpdir(), "af-artifacts-api-stream-"));
const originalPath = process.env.PATH ?? "";
const originalRuntimePort = process.env.AF_ADK_CHAT_PORT;

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  process.env.AF_ADK_CHAT_PORT = String(await getAvailablePort());
  const request = createRequester(repoRoot);

  await createRoot(request, "req-stream");
  await assertVerifyRunStreams(request);
  await assertRuntimeStubBuildStreams(request);

  await createRoot(request, "req-json");
  await assertJsonPathsStillWork(request);

  await createRoot(request, "req-runtime");
  await assertRuntimeChatLifecycle(request, repoRoot);
} finally {
  process.env.PATH = originalPath;
  if (originalRuntimePort === undefined) delete process.env.AF_ADK_CHAT_PORT;
  else process.env.AF_ADK_CHAT_PORT = originalRuntimePort;
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
