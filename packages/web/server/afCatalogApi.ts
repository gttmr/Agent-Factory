import { readFile, readdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

type MiddlewareNext = (error?: unknown) => void;

interface CatalogPayload {
  agents: unknown;
  workflows: unknown;
  adapters: unknown;
  remoteA2A: unknown;
  domainOwners: unknown;
  riskGates: unknown;
  contracts: Record<string, unknown>;
  loaded_at: string;
}

export function createAfCatalogMiddleware(repoRoot: string) {
  const catalogDir = resolve(repoRoot, "catalog");

  return async function afCatalogMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> {
    try {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return;
      }
      const url = (req.url ?? "").split("?")[0] ?? "";
      const trimmed = url.replace(/^\/+|\/+$/g, "");

      if (trimmed === "" || trimmed === "/") {
        return await handleCatalogIndex(catalogDir, res);
      }
      sendJson(res, 404, { error: `알 수 없는 카탈로그 경로입니다: ${trimmed}` });
    } catch (error) {
      handleError(error, res, next);
    }
  };
}

async function handleCatalogIndex(catalogDir: string, res: ServerResponse): Promise<void> {
  const [agents, workflows, adapters, remoteA2A, domainOwners, riskGates, contracts] = await Promise.all([
    readYamlFile(join(catalogDir, "agents.yaml")),
    readYamlFile(join(catalogDir, "workflows.yaml")),
    readYamlFile(join(catalogDir, "adapters.yaml")),
    readYamlFile(join(catalogDir, "remote-a2a-contracts.yaml")),
    readYamlFile(join(catalogDir, "domain-owners.yaml")),
    readYamlFile(join(catalogDir, "risk-gates.yaml")),
    readContractsDir(join(catalogDir, "contracts"))
  ]);

  const payload: CatalogPayload = {
    agents,
    workflows,
    adapters,
    remoteA2A,
    domainOwners,
    riskGates,
    contracts,
    loaded_at: new Date().toISOString()
  };
  sendJson(res, 200, payload);
}

async function readYamlFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  });
  if (!text.trim()) return [];
  try {
    return parseYaml(text);
  } catch (error) {
    console.warn(`[af-catalog] YAML 파싱 실패: ${path}`, error);
    return [];
  }
}

async function readContractsDir(dir: string): Promise<Record<string, unknown>> {
  const entries = await readdir(dir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
    throw error;
  });
  const result: Record<string, unknown> = {};
  for (const name of entries) {
    if (!name.endsWith(".yaml") && !name.endsWith(".yml") && !name.endsWith(".json")) continue;
    const path = join(dir, name);
    const text = await readFile(path, "utf8").catch(() => "");
    if (!text.trim()) continue;
    try {
      result[name] = name.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
    } catch (error) {
      console.warn(`[af-catalog] contracts/${name} 파싱 실패`, error);
    }
  }
  return result;
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof Error) {
    console.error("[af-catalog] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}
