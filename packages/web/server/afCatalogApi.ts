import { readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve, sep } from "node:path";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import { REQ_ID_PATTERN } from "./artifactRootStore";
import { adapterKinds, agentKinds, moduleCategories, remoteContractKinds, workflowKinds } from "../src/analyzer/types";
import { parseCatalogDelta } from "../src/catalog-hub/catalogDelta";

type MiddlewareNext = (error?: unknown) => void;
type CatalogCategory = (typeof moduleCategories)[number];
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

interface PublishProposal {
  category?: unknown;
  name?: unknown;
  module_category?: unknown;
  workflow_kind?: unknown;
  agent_kind?: unknown;
  adapter_kind?: unknown;
  remote_contract_kind?: unknown;
  owner_domain?: unknown;
  responsibility?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  composition?: unknown;
  notes?: unknown;
  source_candidate_id?: unknown;
}

interface PublishRequest {
  req_id?: unknown;
  proposal?: unknown;
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

      if (trimmed === "" || trimmed === "/") {
        return await handleCatalogIndex(catalogDir, res);
      }
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

  const category = proposal.category as CatalogCategory;
  const proposalDetails = await validatePublishedProposalSource(repoRoot, reqId, category, proposal);
  if (proposalDetails.length > 0) {
    sendJson(res, 422, { error: "catalog publish 요청이 유효하지 않습니다.", details: proposalDetails });
    return;
  }

  const target = targetCatalogFile(catalogDir, category);
  const result = await withPublishLock(async () => {
    const latest = await readPublishCatalog(target.path, target.key);
    const name = (proposal.name as string).trim();
    const current = latestPublishedEntryForName(latest.entries, name);
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
          version: current.version
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

function targetCatalogFile(catalogDir: string, category: CatalogCategory): { path: string; relative: string; key: string } {
  if (category === "agent") return { path: join(catalogDir, "agents.yaml"), relative: "catalog/agents.yaml", key: "agents" };
  if (category === "workflow") return { path: join(catalogDir, "workflows.yaml"), relative: "catalog/workflows.yaml", key: "workflows" };
  if (category === "adapter") return { path: join(catalogDir, "adapters.yaml"), relative: "catalog/adapters.yaml", key: "adapters" };
  return {
    path: join(catalogDir, "remote-a2a-contracts.yaml"),
    relative: "catalog/remote-a2a-contracts.yaml",
    key: "remote_a2a_contracts"
  };
}

function nextVersionForName(entries: unknown[], name: string): number {
  const versions = entries
    .filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.name === name)
    .map((entry) => (typeof entry.version === "number" && Number.isInteger(entry.version) ? entry.version : null))
    .filter((version): version is number => version !== null);
  if (versions.length === 0) return 1;
  return Math.max(...versions) + 1;
}

function latestPublishedEntryForName(entries: unknown[], name: string): Record<string, unknown> | null {
  const named = entries.filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.name === name);
  if (named.length === 0) return null;
  return named.reduce((latest, entry) => (entryVersion(entry) > entryVersion(latest) ? entry : latest));
}

function entryVersion(entry: Record<string, unknown>): number {
  return typeof entry.version === "number" && Number.isInteger(entry.version) ? entry.version : 0;
}

function buildPublishedEntry(proposal: PublishProposal, version: number, reqId: string): Record<string, unknown> {
  const category = proposal.category as CatalogCategory;
  const name = (proposal.name as string).trim();
  const entry: Record<string, unknown> = {
    id: `${category}-${name}`.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
    name,
    version,
    status: "published",
    provenance: "catalog_published",
    owner_domain: (proposal.owner_domain as string).trim(),
    published_at: new Date().toISOString(),
    published_from: reqId,
    module_category: category
  };

  if (typeof proposal.source_candidate_id === "string" && proposal.source_candidate_id.trim()) {
    entry.source_candidate_id = proposal.source_candidate_id.trim();
  }
  if (category === "agent") entry.agent_kind = proposal.agent_kind;
  if (category === "workflow") entry.workflow_kind = proposal.workflow_kind;
  if (category === "adapter") entry.adapter_kind = proposal.adapter_kind;
  if (category === "remote_a2a") entry.remote_contract_kind = proposal.remote_contract_kind;
  copyOptionalString(entry, "responsibility", proposal.responsibility);
  copyOptionalArray(entry, "inputs", proposal.inputs);
  copyOptionalArray(entry, "outputs", proposal.outputs);
  copyOptionalArray(entry, "composition", proposal.composition);
  copyOptionalString(entry, "notes", proposal.notes);
  return entry;
}

function validatePublishRequest(reqId: string, proposal: PublishProposal | null): string[] {
  const details: string[] = [];
  if (!reqId) details.push("req_id 는 필수입니다.");
  else if (!REQ_ID_PATTERN.test(reqId)) {
    details.push("req_id 형식이 올바르지 않습니다. 소문자/숫자/하이픈/언더스코어만 허용됩니다.");
  }
  if (!proposal) return [...details, "proposal 은 객체여야 합니다."];
  const category = typeof proposal.category === "string" ? proposal.category : "";
  if (!isOneOf(category, moduleCategories)) {
    details.push("category 는 agent, workflow, adapter, remote_a2a 중 하나여야 합니다.");
  }
  if (typeof proposal.module_category === "string" && proposal.module_category !== category) {
    details.push("module_category 는 category 와 같아야 합니다.");
  }
  const name = typeof proposal.name === "string" ? proposal.name.trim() : "";
  if (!name) {
    details.push("name 은 필수입니다.");
  } else if (!/^[a-z0-9_]+$/.test(name)) {
    details.push("name 은 ^[a-z0-9_]+$ 형식이어야 합니다.");
  }
  const owner = typeof proposal.owner_domain === "string" ? proposal.owner_domain.trim() : "";
  if (!owner) details.push("owner_domain 은 필수입니다.");
  if (isOneOf(category, moduleCategories)) {
    details.push(...validateSubtype(category, proposal));
  }
  details.push(...validateOptionalFieldSpecs("inputs", proposal.inputs));
  details.push(...validateOptionalFieldSpecs("outputs", proposal.outputs));
  details.push(...validateOptionalStringArray("composition", proposal.composition));
  return details;
}

function validateSubtype(category: CatalogCategory, proposal: PublishProposal): string[] {
  if (category === "agent") return validateEnumField("agent_kind", proposal.agent_kind, agentKinds);
  if (category === "workflow") return validateEnumField("workflow_kind", proposal.workflow_kind, workflowKinds);
  if (category === "adapter") return validateEnumField("adapter_kind", proposal.adapter_kind, adapterKinds);
  return validateEnumField("remote_contract_kind", proposal.remote_contract_kind, remoteContractKinds);
}

function validateEnumField(field: string, value: unknown, allowed: readonly string[]): string[] {
  if (typeof value !== "string" || !value.trim()) return [`${field} 은 필수입니다.`];
  if (!allowed.includes(value)) return [`${field} 값이 허용되지 않습니다: ${value}`];
  return [];
}

function validateOptionalFieldSpecs(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 배열이어야 합니다.`];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [`${field}[${index}] 는 객체여야 합니다.`];
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const type = typeof item.type === "string" ? item.type.trim() : "";
    const details: string[] = [];
    if (!name) details.push(`${field}[${index}].name 은 문자열이어야 합니다.`);
    if (!type) details.push(`${field}[${index}].type 은 문자열이어야 합니다.`);
    return details;
  });
}

function validateOptionalStringArray(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 문자열 배열이어야 합니다.`];
  return value.flatMap((item, index) => (typeof item === "string" ? [] : [`${field}[${index}] 는 문자열이어야 합니다.`]));
}

async function validatePublishedProposalSource(
  repoRoot: string,
  reqId: string,
  category: CatalogCategory,
  proposal: PublishProposal
): Promise<string[]> {
  const artifactsRoot = resolve(repoRoot, "artifacts/af");
  const rootDir = resolve(artifactsRoot, reqId);
  if (!rootDir.startsWith(artifactsRoot + sep) && rootDir !== artifactsRoot) {
    return ["artifact root 경로가 허용되지 않습니다."];
  }
  const rootStat = await stat(rootDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (!rootStat?.isDirectory()) {
    return [`artifact root 를 찾을 수 없습니다: artifacts/af/${reqId}`];
  }
  const deltaPath = resolve(rootDir, "catalog-delta.yaml");
  const deltaText = await readFile(deltaPath, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (deltaText === null) {
    return [`catalog-delta.yaml 을 찾을 수 없습니다: artifacts/af/${reqId}/catalog-delta.yaml`];
  }
  const parsed = parseCatalogDelta(deltaText);
  if (parsed.error) return [`catalog-delta.yaml 파싱 실패: ${parsed.error}`];
  const name = typeof proposal.name === "string" ? proposal.name.trim() : "";
  const matched = parsed.proposals.some((candidate) => candidate.module_category === category && candidate.name === name);
  if (!matched) {
    return [`catalog-delta.yaml 에 ${category}/${name} 과 일치하는 proposed_additions 항목이 없습니다.`];
  }
  return [];
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

function deepEqualPublishedFields(entry: Record<string, unknown>, proposal: PublishProposal): boolean {
  return JSON.stringify(publishedFieldSnapshot(entry)) === JSON.stringify(proposalFieldSnapshot(proposal));
}

function publishedFieldSnapshot(entry: Record<string, unknown>): Record<string, unknown> {
  const category = typeof entry.module_category === "string" ? entry.module_category : entry.category;
  return omitUndefined({
    category,
    subtype: subtypeFor(category, entry),
    owner_domain: readTrimmedString(entry.owner_domain),
    responsibility: readTrimmedString(entry.responsibility),
    inputs: readNonEmptyArray(entry.inputs),
    outputs: readNonEmptyArray(entry.outputs),
    composition: readNonEmptyArray(entry.composition),
    notes: readTrimmedString(entry.notes)
  });
}

function proposalFieldSnapshot(proposal: PublishProposal): Record<string, unknown> {
  const category = proposal.category;
  return omitUndefined({
    category,
    subtype: subtypeFor(category, proposal as Record<string, unknown>),
    owner_domain: readTrimmedString(proposal.owner_domain),
    responsibility: readTrimmedString(proposal.responsibility),
    inputs: readNonEmptyArray(proposal.inputs),
    outputs: readNonEmptyArray(proposal.outputs),
    composition: readNonEmptyArray(proposal.composition),
    notes: readTrimmedString(proposal.notes)
  });
}

function subtypeFor(category: unknown, entry: Record<string, unknown>): unknown {
  if (category === "agent") return entry.agent_kind;
  if (category === "workflow") return entry.workflow_kind;
  if (category === "adapter") return entry.adapter_kind;
  if (category === "remote_a2a") return entry.remote_contract_kind;
  return undefined;
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNonEmptyArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}

function omitUndefined(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function copyOptionalString(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === "string" && value.trim()) target[key] = value.trim();
}

function copyOptionalArray(target: Record<string, unknown>, key: string, value: unknown): void {
  if (Array.isArray(value) && value.length > 0) target[key] = value;
}

function isOneOf<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
