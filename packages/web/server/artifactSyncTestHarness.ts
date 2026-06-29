import assert from "node:assert/strict";
import { once } from "node:events";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { createAfArtifactsMiddleware } from "./afArtifactsApi.ts";

export type ArtifactSyncResponse = {
  readonly ok: boolean;
  readonly requirement_id: string;
  readonly output_mode: string;
  readonly drift: {
    readonly before: readonly ArtifactSyncDriftEntry[];
    readonly after: readonly ArtifactSyncDriftEntry[];
  };
  readonly artifacts_written: readonly string[];
  readonly generation?: ArtifactSyncProcessResponse;
  readonly validation?: ArtifactSyncProcessResponse;
};

export type ArtifactSyncDriftEntry = {
  readonly path: string;
  readonly status: string;
};

export type ArtifactSyncProcessResponse = {
  readonly ok: boolean;
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
  readonly command_key?: string;
  readonly files?: readonly { readonly path: string; readonly bytes: number }[];
};

export type ArtifactTestRequest = ReturnType<typeof createRequester>;

type SseEntry = {
  readonly event: string;
  readonly data: Record<string, unknown>;
};

export async function writeFakeScripts(root: string): Promise<void> {
  const scriptsDir = join(root, "scripts");
  const binDir = join(root, "bin");
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(join(scriptsDir, "validate-artifacts.mjs"), "/* served by the test node shim */\n");
  await writeFile(join(scriptsDir, "generate-adk-source.mjs"), "/* served by the test node shim */\n");
  await writeFile(join(binDir, "python3"), "#!/bin/sh\necho 'unexpected fake python3 args: $@' >&2\nexit 2\n");
  await chmod(join(binDir, "python3"), 0o755);
  await writeFile(join(binDir, "node"), fakeNodeScript());
  await chmod(join(binDir, "node"), 0o755);
}

export function createRequester(root: string) {
  const middleware = createAfArtifactsMiddleware(root);
  return async (input: {
    readonly url: string;
    readonly method?: string;
    readonly headers?: IncomingHttpHeaders;
    readonly body?: unknown;
  }): Promise<FakeResponse> => {
    const req = new FakeRequest(input.url, input.method ?? "GET", input.headers ?? {}, input.body);
    const res = new FakeResponse();
    await middleware(req as IncomingMessage, res as ServerResponse, (error) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    });
    if (!res.writableEnded) await once(res, "finish");
    return res;
  };
}

export async function createRoot(request: ArtifactTestRequest, reqId: string): Promise<void> {
  const response = await request({
    url: "/",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { requirement_id: reqId }
  });
  assert.equal(response.status, 201);
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function fileExists(path: string): Promise<boolean> {
  return await readFile(path, "utf8").then(
    () => true,
    () => false
  );
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readCommandLog(root: string): Promise<readonly string[]> {
  const text = await readFile(join(root, "command-log.txt"), "utf8").catch(() => "");
  return text.trim() ? text.trim().split("\n") : [];
}

export async function readDerivedArtifactTexts(rootDir: string): Promise<Record<string, string>> {
  return {
    "normalized-requirement.json": await readFile(join(rootDir, "normalized-requirement.json"), "utf8"),
    "module-candidates.json": await readFile(join(rootDir, "module-candidates.json"), "utf8"),
    "process-flow.json": await readFile(join(rootDir, "process-flow.json"), "utf8"),
    "scaffold-plan.json": await readFile(join(rootDir, "scaffold-plan.json"), "utf8")
  };
}

export function assertScaffoldGraphNodes(value: unknown, expectedNodeIds: readonly string[]): void {
  assert.ok(isRecord(value), "scaffold-plan.json must contain an object");
  assert.ok(isRecord(value.graph), "scaffold-plan.json must contain graph");
  assert.ok(Array.isArray(value.graph.nodes), "scaffold-plan.json graph must contain nodes");
  const actualNodeIds = value.graph.nodes.map((node) => {
    assert.ok(isRecord(node), "scaffold-plan.json graph node must be an object");
    assert.equal(typeof node.id, "string");
    return node.id;
  });
  assert.deepEqual(actualNodeIds, expectedNodeIds);
}

export function assertDriftStatus(entries: readonly ArtifactSyncDriftEntry[], path: string, status: string): void {
  assert.ok(
    entries.some((entry) => entry.path === path && entry.status === status),
    `expected ${path} drift status ${status}`
  );
}

export function readRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(isRecord(value), `${label} must be an object`);
  return value;
}

export function parseSse(body: string): readonly SseEntry[] {
  return body
    .trim()
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLines = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice("data: ".length));
      assert.ok(eventLine, `missing event line in ${block}`);
      assert.ok(dataLines.length > 0, `missing data line in ${block}`);
      return { event: eventLine.slice("event: ".length), data: JSON.parse(dataLines.join("\n")) as Record<string, unknown> };
    });
}

export function responseJson<T>(response: FakeResponse): T {
  assert.equal(response.status, 200);
  return JSON.parse(response.text()) as T;
}

export function parseJsonBody<T>(response: FakeResponse): T {
  return JSON.parse(response.text()) as T;
}

function fakeNodeScript(): string {
  return [
    "#!/bin/sh",
    "script=\"$1\"",
    "shift",
    "printf '%s\\n' \"node $script $*\" >> \"$PWD/command-log.txt\"",
    "case \"$script\" in",
    "  scripts/validate-artifacts.mjs)",
    "    root_dir=\"$1\"",
    "    echo 'verify stdout line'",
    "    echo 'verify stderr line' >&2",
    "    if [ -f \"$root_dir/fail-validate\" ]; then exit 7; fi",
    "    exit 0",
    "    ;;",
    "  scripts/generate-adk-source.mjs)",
    "    root_dir=\"$1\"",
    "    stub_dir=\"$2\"",
    "    echo 'build stdout line'",
    "    echo 'build stderr line' >&2",
    "    if [ -f \"$root_dir/fail-generate\" ]; then exit 6; fi",
    "    mkdir -p \"$stub_dir\"",
    "    printf '# TODO runtime wiring\\n' > \"$stub_dir/agent.py\"",
    "    printf '# Root implementation handoff\\n' > \"$root_dir/implementation-handoff.md\"",
    "    mkdir -p \"$stub_dir/req_stream_adk/__pycache__\"",
    "    printf 'compiled cache\\n' > \"$stub_dir/req_stream_adk/__pycache__/agent.pyc\"",
    "    exit 0",
    "    ;;",
    `  *) exec "${process.execPath}" "$script" "$@" ;;`,
    "esac",
    ""
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class FakeRequest extends Readable {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
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
