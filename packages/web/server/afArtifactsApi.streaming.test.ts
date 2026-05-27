import assert from "node:assert/strict";
import { once } from "node:events";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
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

function parseSse(body: string): SseEntry[] {
  return body
    .trim()
    .split("\n\n")
    .map((block) => {
      const eventLine = block.split("\n").find((line) => line.startsWith("event: "));
      const dataLines = block
        .split("\n")
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

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  const request = createRequester(repoRoot);

  await createRoot(request, "req-stream");
  await assertVerifyRunStreams(request);
  await assertRuntimeStubBuildStreams(request);

  await createRoot(request, "req-json");
  await assertJsonPathsStillWork(request);
} finally {
  process.env.PATH = originalPath;
  await rm(repoRoot, { recursive: true, force: true });
}
