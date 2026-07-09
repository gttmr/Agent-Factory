import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve } from "node:path";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import { buildPublishedEntry, deepEqualPublishedFields } from "./catalogPublishEntry";
import { targetCatalogFile } from "./catalogPublishTarget";
import { isRecord, readJsonBody, sendJson } from "./httpApi";
import {
  validatePublishedProposalSource,
  validatePublishRequest,
  validateWorkflowA2aProvider,
  type CatalogCategory,
  type PublishProposal,
  type PublishRequest
} from "./catalogPublishValidation";
import { latestByName, nextVersionForName } from "../src/catalog/catalogVersioning";

type MiddlewareNext = (error?: unknown) => void;
type CatalogDoc = Record<string, unknown>;

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

let publishQueue: Promise<void> = Promise.resolve();

export function createAfCatalogMiddleware(repoRoot: string) {
  const catalogDir = resolve(repoRoot, "catalog");

  return async function afCatalogMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> {
    try {
      const url = (req.url ?? "").split("?")[0] ?? "";
      const trimmed = url.replace(/^\/+|\/+$/g, "");

      if (trimmed === "publish") {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST 요청만 지원합니다." });
          return;
        }
        return await handleCatalogPublish(repoRoot, catalogDir, req, res);
      }

      if (req.method !== "GET") {
        sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return;
      }

      if (trimmed === "") {
        return await handleCatalogIndex(catalogDir, res);
      }
      sendJson(res, 404, { error: `알 수 없는 카탈로그 경로입니다: ${trimmed}` });
    } catch (error) {
      if (!(error instanceof Error)) {
        next(error);
        return;
      }
      handleError(error, res, next);
    }
  };
}

async function handleCatalogPublish(
  repoRoot: string,
  catalogDir: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "요청 JSON을 파싱하지 못했습니다." });
    return;
  }

  const request = isRecord(body) ? (body as PublishRequest) : {};
  const reqId = typeof request.req_id === "string" ? request.req_id.trim() : "";
  const proposal = isRecord(request.proposal) ? (request.proposal as PublishProposal) : null;
  const details = validatePublishRequest(reqId, proposal);
  if (details.length > 0 || !proposal) {
    sendJson(res, 422, { error: "catalog publish 요청이 유효하지 않습니다.", details });
    return;
  }

  const category = proposal.category as CatalogCategory;
  const proposalDetails = await validatePublishedProposalSource(repoRoot, reqId, category, proposal);
  if (proposalDetails.length > 0) {
    sendJson(res, 422, { error: "catalog publish 요청이 유효하지 않습니다.", details: proposalDetails });
    return;
  }
  const providerDetails = await validateWorkflowA2aProvider(repoRoot, category, proposal);
  if (providerDetails.length > 0) {
    sendJson(res, 422, { error: "catalog publish 요청이 유효하지 않습니다.", details: providerDetails });
    return;
  }

  const target = targetCatalogFile(catalogDir, category);
  const result = await withPublishLock(async () => {
    const latest = await readPublishCatalog(target.path, target.key);
    const name = (proposal.name as string).trim();
    const current = latestByName(latest.entries, name);
    if (
      current &&
      current.status === "published" &&
      current.published_from === reqId &&
      deepEqualPublishedFields(current, proposal)
    ) {
      return {
        body: {
          ok: true,
          already_published: true,
          id: current.id,
          name: current.name,
          version: current.version,
          file: target.relative
        }
      };
    }

    const entries = latest.entries.map((entry) => {
      if (isRecord(entry) && entry.name === name) {
        return { ...entry, status: "deprecated" };
      }
      return entry;
    });
    const version = nextVersionForName(latest.entries, name);
    const published = buildPublishedEntry(proposal, version, reqId);
    const nextDoc: CatalogDoc = {
      ...latest.doc,
      [target.key]: [...entries, published]
    };
    const serialized = dumpYaml(nextDoc, { lineWidth: -1, noRefs: true });
    await writeCatalogAtomic(target.path, serialized);
    return {
      body: {
        ok: true,
        id: published.id,
        name: published.name,
        version: published.version,
        file: target.relative
      }
    };
  });
  sendJson(res, 200, result.body);
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

async function readPublishCatalog(path: string, key: string): Promise<{ doc: CatalogDoc; entries: unknown[] }> {
  const text = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  });
  const parsed = text.trim() ? parseYaml(text) : { [key]: [] };
  if (!isRecord(parsed)) throw new Error(`${path} 은 YAML 객체여야 합니다.`);
  const entries = Array.isArray(parsed[key]) ? parsed[key] : [];
  return { doc: parsed, entries };
}

async function writeCatalogAtomic(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, path);
}

async function withPublishLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = publishQueue.then(operation, operation);
  publishQueue = run.then(
    () => undefined,
    () => undefined
  );
  return await run;
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
    if (!(error instanceof Error)) throw error;
    console.warn(`[af-catalog] YAML 파싱 실패: ${path}`, error);
    return [];
  }
}

async function readContractsDir(dir: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  await readContractsInto(dir, dir, result);
  return result;
}

async function readContractsInto(rootDir: string, currentDir: string, result: Record<string, unknown>): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
    throw error;
  });
  for (const entry of entries) {
    const name = typeof entry === "string" ? entry : entry.name;
    const path = join(currentDir, name);
    if (typeof entry !== "string" && entry.isDirectory()) {
      await readContractsInto(rootDir, path, result);
      continue;
    }
    if (!name.endsWith(".yaml") && !name.endsWith(".yml") && !name.endsWith(".json")) continue;
    const text = await readFile(path, "utf8").catch(() => "");
    if (!text.trim()) continue;
    try {
      const parsed = name.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
      const rel = relativeContractPath(rootDir, path);
      result[rel] = parsed;
      const schemaRef = contractSchemaRef(parsed);
      if (schemaRef) result[schemaRef] = parsed;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      console.warn(`[af-catalog] contracts/${relativeContractPath(rootDir, path)} 파싱 실패`, error);
    }
  }
}

function contractSchemaRef(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const schemaRef = value.schema_ref;
  return typeof schemaRef === "string" && schemaRef.trim() ? schemaRef : null;
}

function relativeContractPath(rootDir: string, path: string): string {
  return relative(rootDir, path).split("\\").join("/");
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof Error) {
    console.error("[af-catalog] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}
