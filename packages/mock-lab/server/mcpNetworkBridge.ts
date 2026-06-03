import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { JsonRpcEnvelope } from "../src/types/mockSpec";
import type { MockProcessRegistry } from "./mockProcessRegistry";
import type { MockSpecStore } from "./mockSpecStore";

// ---------------------------------------------------------------------------
// Network MCP exposure for the Mock Lab.
//
// Each Mock Lab mock already runs as a stdio JSON-RPC MCP child keyed by
// mock_id (MockProcessRegistry). This bridge re-exposes that child over a
// Streamable-HTTP MCP endpoint so the generated ADK runnable bundle can connect
// via `streamablehttp_client(url)` and call tools. tools/list and tools/call are
// proxied verbatim to the running child (single source of truth + existing audit
// log); the bridge adds no business logic of its own. Synthetic Mock Lab only.
// ---------------------------------------------------------------------------

const MCP_BASE_PATH = "/api/mock-lab/mcp";
// Abandoned clients (that never DELETE/close) would otherwise leak transports.
const SESSION_TTL_MS = 10 * 60 * 1000;

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
  lastSeen: number;
}

export function createMcpNetworkBridge(registry: MockProcessRegistry, store: MockSpecStore) {
  // Stateful sessions keyed by the SDK-issued mcp-session-id. A session is bound
  // to the mock_id resolved from the URL at initialize time.
  const sessions = new Map<string, SessionEntry>();

  // Sweep on each new session (no background timer that would keep the process
  // alive); closing a stale transport fires its onclose, removing it from the map.
  function sweepStaleSessions(): void {
    const now = Date.now();
    for (const [id, entry] of sessions) {
      if (now - entry.lastSeen > SESSION_TTL_MS) {
        sessions.delete(id);
        void entry.transport.close();
      }
    }
  }

  function buildProxyServer(mockId: string): Server {
    const server = new Server(
      { name: `mock-lab-${mockId}`, version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const response = (await registry.sendJsonRpc(mockId, "tools/list", {})) as JsonRpcEnvelope;
      if (response.error) throw new McpError(response.error.code, response.error.message, response.error.data);
      const result = (response.result ?? {}) as { tools?: unknown };
      return { tools: Array.isArray(result.tools) ? result.tools : [] } as never;
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const response = (await registry.sendJsonRpc(mockId, "tools/call", {
        name: request.params.name,
        arguments: request.params.arguments ?? {}
      })) as JsonRpcEnvelope;
      if (response.error) throw new McpError(response.error.code, response.error.message, response.error.data);
      return (response.result ?? { content: [] }) as never;
    });
    return server;
  }

  async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, key: string): Promise<void> {
    const sessionId = headerValue(req, "mcp-session-id");

    // Existing session: route straight to its transport (handles POST/GET/DELETE).
    if (sessionId) {
      const entry = sessions.get(sessionId);
      if (!entry) {
        sendJson(res, 404, { error: "Unknown or expired mcp-session-id." });
        return;
      }
      entry.lastSeen = Date.now();
      await entry.transport.handleRequest(req, res);
      return;
    }

    // No session id: a new session must begin with an initialize POST.
    if (req.method !== "POST") {
      sendJson(res, 400, { error: "Missing mcp-session-id (initialize with POST first)." });
      return;
    }

    const mockId = await resolveMockId(store, key);
    if (!mockId) {
      sendJson(res, 404, { error: `No Mock Lab server matches "${key}".` });
      return;
    }
    const status = await registry.status(mockId);
    if (status.status !== "running") {
      sendJson(res, 409, { error: `Mock Lab server "${mockId}" is not running.` });
      return;
    }

    sweepStaleSessions();
    const server = buildProxyServer(mockId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server, lastSeen: Date.now() });
      }
    });
    // Only forget the session here; the SDK is already tearing the transport
    // down, so calling server.close() would re-enter this same close path.
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }

  async function handleDiscovery(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): Promise<void> {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "GET 요청만 지원합니다." });
      return;
    }
    const wantedServer = query.get("server");
    const wantedTool = query.get("tool");

    if (wantedServer) {
      const mockId = await resolveMockId(store, wantedServer);
      if (!mockId) {
        sendJson(res, 200, { server: wantedServer, mock_id: null, running: false, connected: false, mcp_url: null });
        return;
      }
      const tools = await liveTools(registry, mockId);
      const running = tools !== null;
      const connected = running && (!wantedTool || tools!.includes(wantedTool));
      sendJson(res, 200, {
        server: wantedServer,
        mock_id: mockId,
        running,
        connected,
        tools: tools ?? [],
        mcp_url: `${MCP_BASE_PATH}/${mockId}`
      });
      return;
    }

    const mocks = await store.listMocks();
    const servers = await Promise.all(
      mocks.map(async (mock) => {
        const spec = await store.readSpec(mock.mock_id).catch(() => null);
        const tools = await liveTools(registry, mock.mock_id);
        return {
          mock_id: mock.mock_id,
          server_name: mock.server_name,
          catalog_entry_name: spec?.source?.catalog_entry_name ?? null,
          running: tools !== null,
          tools: tools ?? (spec?.tools ?? []).map((tool) => tool.name),
          mcp_url: `${MCP_BASE_PATH}/${mock.mock_id}`
        };
      })
    );
    sendJson(res, 200, { servers });
  }

  return { handleMcpRequest, handleDiscovery };
}

// "Connected" means the process is running AND advertises tools. Returns the
// live tool-name list when running, or null when the server is not running /
// not reachable (the persisted server-state.json "running" is advisory only).
async function liveTools(registry: MockProcessRegistry, mockId: string): Promise<string[] | null> {
  const status = await registry.status(mockId).catch(() => null);
  if (!status || status.status !== "running") return null;
  try {
    const response = (await registry.sendJsonRpc(mockId, "tools/list", {})) as JsonRpcEnvelope;
    if (response.error) return null;
    const result = (response.result ?? {}) as { tools?: Array<{ name?: unknown }> };
    return Array.isArray(result.tools)
      ? result.tools.map((tool) => (typeof tool?.name === "string" ? tool.name : "")).filter(Boolean)
      : [];
  } catch {
    return null;
  }
}

// Resolve a path key to a mock_id. The catalog logical mcp_server name is not
// the mock_id, so accept mock_id (unique, wins), then server_name, then
// source.catalog_entry_name. Ambiguous alias matches resolve to null rather
// than silently binding the wrong mock.
async function resolveMockId(store: MockSpecStore, key: string): Promise<string | null> {
  const mocks = await store.listMocks();
  const exact = mocks.find((mock) => mock.mock_id === key);
  if (exact) return exact.mock_id;

  const byServerName = mocks.filter((mock) => mock.server_name === key);
  if (byServerName.length === 1) return byServerName[0].mock_id;
  if (byServerName.length > 1) return null;

  const byCatalogName: string[] = [];
  for (const mock of mocks) {
    const spec = await store.readSpec(mock.mock_id).catch(() => null);
    if (spec?.source?.catalog_entry_name && spec.source.catalog_entry_name === key) {
      byCatalogName.push(mock.mock_id);
    }
  }
  return byCatalogName.length === 1 ? byCatalogName[0] : null;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}
