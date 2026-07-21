import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMockLabMiddleware } from "./mockLabApi";
import { MockSpecStore } from "./mockSpecStore";

const MOCK_ID = "mocklab-smoke-ocr";

function startHarness(repoRoot: string): Promise<{ base: string; server: HttpServer }> {
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

async function createFixtureRepo(): Promise<{ repoRoot: string; cleanup: () => Promise<void> }> {
  const testRoot = await mkdtemp(join(tmpdir(), "af-mock-lab-bridge-"));
  const repoRoot = join(testRoot, "repo");
  await mkdir(join(repoRoot, "catalog"), { recursive: true });
  const store = new MockSpecStore({ repoRoot });
  await store.writeSpec(MOCK_ID, {
    mock_id: MOCK_ID,
    server_name: "mocklab-smoke-ocr-mcp",
    protocol: "mcp_stdio",
    description: "Self-contained bridge test spec.",
    tools: [
      {
        name: "synthetic_ocr_tool",
        description: "Synthetic OCR bridge test tool.",
        inputSchema: {
          type: "object",
          properties: {
            document_uri: { type: "string" }
          },
          required: ["document_uri"],
          additionalProperties: false
        },
        outputSchema: {
          type: "object",
          properties: {
            ocr_text: { type: "string" }
          },
          required: ["ocr_text"],
          additionalProperties: false
        },
        successResponse: {
          ocr_text: "[SYNTHETIC] bridge OCR text"
        },
        errorScenarios: [],
        latencyMs: 0,
        riskSignals: [],
        auditRequired: true
      }
    ],
    guardrails: {
      synthetic_only: true,
      no_private_data: true,
      no_private_endpoint: true,
      no_credentials: true,
      no_production_business_logic: true
    }
  });
  return {
    repoRoot,
    cleanup: async () => {
      await rm(testRoot, { recursive: true, force: true });
    }
  };
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
  const fixture = await createFixtureRepo();
  const { base, server } = await startHarness(fixture.repoRoot);
  t.after(async () => {
    await fetch(`${base}/${MOCK_ID}/server/stop`, { method: "POST" }).catch(() => undefined);
    await new Promise<void>((done) => server.close(() => done()));
    await fixture.cleanup();
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
  const fixture = await createFixtureRepo();
  const { base, server } = await startHarness(fixture.repoRoot);
  t.after(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    await fixture.cleanup();
  });
  const discovery = await (await fetch(`${base}/mcp-discovery?server=does-not-exist`)).json();
  assert.equal(discovery.mock_id, null);
  assert.equal(discovery.connected, false);
});
