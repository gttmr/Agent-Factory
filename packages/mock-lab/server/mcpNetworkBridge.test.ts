import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMockLabMiddleware } from "./mockLabApi";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const MOCK_ID = "mocklab-smoke-ocr";

function startHarness(): Promise<{ base: string; server: HttpServer }> {
  const middleware = createMockLabMiddleware(repoRoot);
  const server = createServer((req, res) => {
    // Strip the /api/mock-lab mount prefix exactly like the vite plugin does.
    req.url = (req.url ?? "").replace(/^\/api\/mock-lab/, "") || "/";
    void middleware(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
  });
  return new Promise((resolveHarness) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolveHarness({ base: `http://127.0.0.1:${port}/api/mock-lab`, server });
    });
  });
}

function sampleArgs(schema: unknown): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!schema || typeof schema !== "object") return args;
  const props = (schema as { properties?: Record<string, { type?: string }> }).properties ?? {};
  const required = (schema as { required?: string[] }).required ?? Object.keys(props);
  for (const name of required) {
    const type = props[name]?.type;
    args[name] =
      type === "number" || type === "integer"
        ? 1
        : type === "boolean"
          ? true
          : type === "array"
            ? []
            : type === "object"
              ? {}
              : "synthetic";
  }
  return args;
}

test("network MCP bridge proxies a running Mock Lab child over Streamable HTTP", async (t) => {
  const { base, server } = await startHarness();
  t.after(async () => {
    await fetch(`${base}/${MOCK_ID}/server/stop`, { method: "POST" }).catch(() => undefined);
    await new Promise<void>((done) => server.close(() => done()));
  });

  const startResponse = await fetch(`${base}/${MOCK_ID}/server/start`, { method: "POST" });
  assert.equal(startResponse.ok, true, "mock child should start");

  // Discovery reports the running server + its live tools as connected.
  const discovery = await (await fetch(`${base}/mcp-discovery?server=${MOCK_ID}`)).json();
  assert.equal(discovery.mock_id, MOCK_ID);
  assert.equal(discovery.running, true);
  assert.equal(discovery.connected, true);
  assert.ok(Array.isArray(discovery.tools) && discovery.tools.length > 0, "discovery should list tools");

  // A real MCP client connects over Streamable HTTP and proxies to the child.
  const client = new Client({ name: "mock-lab-bridge-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp/${MOCK_ID}`));
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    assert.ok(listed.tools.length > 0, "tools/list should be proxied from the child");

    const tool = listed.tools[0];
    const result = await client.callTool({ name: tool.name, arguments: sampleArgs(tool.inputSchema) });
    assert.ok(Array.isArray(result.content), "tools/call result must carry MCP content");
  } finally {
    await client.close();
  }
});

test("discovery reports an unknown server as not connected", async (t) => {
  const { base, server } = await startHarness();
  t.after(async () => {
    await new Promise<void>((done) => server.close(() => done()));
  });
  const discovery = await (await fetch(`${base}/mcp-discovery?server=does-not-exist`)).json();
  assert.equal(discovery.mock_id, null);
  assert.equal(discovery.connected, false);
});
