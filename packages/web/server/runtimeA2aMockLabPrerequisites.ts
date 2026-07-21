import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeA2aMockLabPrerequisite } from "./runtimeA2aTypes";
import { isFile, isPidAlive } from "./runtimeProcessControl";

export interface MockLabPrerequisiteInput {
  readonly repoRoot: string;
  readonly stubDir: string;
}

export async function mockLabPrerequisites(input: MockLabPrerequisiteInput): Promise<RuntimeA2aMockLabPrerequisite[]> {
  const mockServerIds = await requiredMockLabServerIds(input);
  return await Promise.all(mockServerIds.map((mockServerId) => mockLabPrerequisite(input.repoRoot, mockServerId)));
}

async function requiredMockLabServerIds(input: MockLabPrerequisiteInput): Promise<string[]> {
  const scaffoldPlan = await readJson(join(input.stubDir, "scaffold-plan.json"));
  if (!scaffoldPlan) return [];

  const discovered = new Set<string>();
  collectMockLabServerIds(scaffoldPlan, discovered);

  const localIds = await Promise.all(
    Array.from(discovered)
      .sort()
      .map(async (mockServerId) => {
        if (await isFile(join(input.repoRoot, "artifacts/mock-lab", mockServerId, "mock-spec.json"))) return mockServerId;
        return mockServerId;
      })
  );
  return localIds.filter((mockServerId): mockServerId is string => mockServerId !== null);
}

function collectMockLabServerIds(value: unknown, discovered: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMockLabServerIds(item, discovered);
    return;
  }
  if (!isRecord(value)) return;

  const binding = value.binding;
  const connection = value.connection;
  if (
    value.asset_type === "tool" &&
    isRecord(binding) &&
    binding.kind === "mcp" &&
    typeof binding.server_ref === "string" &&
    binding.server_ref.trim() &&
    isRecord(connection) &&
    connection.transport === "stdio"
  ) {
    discovered.add(binding.server_ref);
  }

  for (const child of Object.values(value)) collectMockLabServerIds(child, discovered);
}

async function mockLabPrerequisite(repoRoot: string, mockServerId: string): Promise<RuntimeA2aMockLabPrerequisite> {
  const startUrl = `/api/mock-lab/${encodeURIComponent(mockServerId)}/server/start`;
  const mcpUrl = `/api/mock-lab/mcp/${encodeURIComponent(mockServerId)}`;
  if (!(await isFile(join(repoRoot, "artifacts/mock-lab", mockServerId, "mock-spec.json")))) {
    return {
      mock_server_id: mockServerId,
      status: "missing",
      running: false,
      start_action: { method: "POST", url: startUrl },
      mcp_url: mcpUrl,
      message: `Mock Lab MCP prerequisite "${mockServerId}" is missing. Create the local synthetic mock spec before starting the ADK A2A provider.`
    };
  }

  const serverState = await readJson(join(repoRoot, "artifacts/mock-lab", mockServerId, "server-state.json"));
  const status = isRecord(serverState) && serverState.status === "running" && typeof serverState.pid === "number" && isPidAlive(serverState.pid) ? "running" : "stopped";
  return {
    mock_server_id: mockServerId,
    status,
    running: status === "running",
    start_action: { method: "POST", url: startUrl },
    mcp_url: mcpUrl,
    message:
      status === "running"
        ? null
        : `Mock Lab MCP prerequisite "${mockServerId}" is stopped. Start it with POST ${startUrl} before starting the ADK A2A provider.`
  };
}

async function readJson(path: string): Promise<unknown | null> {
  const text = await readFile(path, "utf8").catch(() => null);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
