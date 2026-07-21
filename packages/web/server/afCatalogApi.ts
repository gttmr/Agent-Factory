import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import type { AssetType } from "../src/analyzer/types";
import { parseCatalogDocument, parseCatalogIndexPayload } from "../src/catalog/catalogIndex";
import { latestByAssetId, nextVersionForAssetId } from "../src/catalog/catalogVersioning";
import { buildPublishedEntry, deepEqualPublishedFields } from "./catalogPublishEntry";
import { targetCatalogFile } from "./catalogPublishTarget";
import {
  validatePublishedProposalSource,
  validatePublishRequest,
  type PublishProposal,
  type PublishRequest
} from "./catalogPublishValidation";
import { isRecord, readJsonBody, sendJson } from "./httpApi";

type MiddlewareNext = (error?: unknown) => void;
type CatalogDoc = Record<string, unknown>;
let publishQueue: Promise<void> = Promise.resolve();

export function createAfCatalogMiddleware(repoRoot: string) {
  const catalogDir = resolve(repoRoot, "catalog");
  return async function afCatalogMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> {
    try {
      const trimmed = ((req.url ?? "").split("?")[0] ?? "").replace(/^\/+|\/+$/g, "");
      if (trimmed === "publish") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        return await handleCatalogPublish(repoRoot, catalogDir, req, res);
      }
      if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
      if (trimmed === "") return await handleCatalogIndex(catalogDir, res);
      sendJson(res, 404, { error: `알 수 없는 카탈로그 경로입니다: ${trimmed}` });
    } catch (error) {
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
  const assetType = proposal.asset_type as AssetType;
  const assetId = (proposal.asset_id as string).trim();
  const sourceDetails = await validatePublishedProposalSource(repoRoot, reqId, assetType, proposal);
  if (sourceDetails.length > 0) {
    sendJson(res, 422, { error: "catalog publish 요청이 유효하지 않습니다.", details: sourceDetails });
    return;
  }

  const target = targetCatalogFile(catalogDir, assetType);
  const result = await withPublishLock(async () => {
    const latest = await readPublishCatalog(target.path, target.key, assetType);
    const current = latestByAssetId(latest.entries, assetId);
    if (current && current.status === "published" && deepEqualPublishedFields(current, proposal)) {
      return {
        ok: true,
        already_published: true,
        id: assetId,
        asset_id: assetId,
        name: current.name,
        version: current.version,
        file: target.relative
      };
    }
    const entries = latest.entries.map((entry) =>
      isRecord(entry) && entry.asset_id === assetId ? { ...entry, status: "deprecated" } : entry
    );
    const version = nextVersionForAssetId(latest.entries, assetId);
    const published = buildPublishedEntry(proposal, version, reqId);
    const nextDoc: CatalogDoc = { [target.key]: [...entries, published] };
    await writeCatalogAtomic(target.path, dumpYaml(nextDoc, { lineWidth: -1, noRefs: true }));
    return {
      ok: true,
      id: assetId,
      asset_id: assetId,
      name: published.name,
      version: published.version,
      file: target.relative
    };
  });
  sendJson(res, 200, result);
}

async function handleCatalogIndex(catalogDir: string, res: ServerResponse): Promise<void> {
  const [agents, workflows, tools] = await Promise.all([
    readCanonicalCatalog(join(catalogDir, "agents.yaml")),
    readCanonicalCatalog(join(catalogDir, "workflows.yaml")),
    readCanonicalCatalog(join(catalogDir, "tools.yaml"))
  ]);
  const payload = { agents, workflows, tools };
  parseCatalogIndexPayload(payload);
  sendJson(res, 200, payload);
}

async function readCanonicalCatalog(path: string): Promise<unknown> {
  return parseYaml(await readFile(path, "utf8"));
}

async function readPublishCatalog(
  path: string,
  key: "agents" | "workflows" | "tools",
  assetType: AssetType
): Promise<{ doc: CatalogDoc; entries: unknown[] }> {
  const parsed = parseYaml(await readFile(path, "utf8"));
  parseCatalogDocument(parsed, key, assetType);
  if (!isRecord(parsed) || !Array.isArray(parsed[key])) throw new Error(`${path} catalog 문서가 유효하지 않습니다.`);
  return { doc: parsed, entries: parsed[key] };
}

async function writeCatalogAtomic(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, path);
}

async function withPublishLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = publishQueue.then(operation, operation);
  publishQueue = run.then(() => undefined, () => undefined);
  return await run;
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof Error) {
    console.error("[af-catalog] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}
