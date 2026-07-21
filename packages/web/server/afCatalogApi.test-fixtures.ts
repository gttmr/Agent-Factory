import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { dump as dumpYaml } from "js-yaml";
import { createAfCatalogMiddleware } from "./afCatalogApi.ts";

export const validToolProposal = {
  asset_id: "tool.customer.notice-template",
  asset_type: "tool",
  name: "고객 안내 템플릿 Tool",
  domain_scope: "domain_specific",
  business_domains: ["고객"],
  owner: "AI공통플랫폼팀",
  reuse_status: "publish_candidate",
  capability_tags: ["template"],
  binding: { kind: "function" },
  connection: { transport: "in_process" },
  workflow_profile: null,
  exposure: null,
  responsibility: "고객 안내 템플릿 preview를 반환한다.",
  inputs: [{ name: "customer_id", type: "string" }],
  outputs: [{ name: "message", type: "string" }],
  runtime_mock: {
    synthetic: true,
    message: "합성 고객 안내문"
  },
  source_candidate_id: "asset-1"
} as const;

export const validAgentA2aProposal = {
  asset_id: "agent.partner.remote-review",
  asset_type: "agent",
  name: "Partner Review Agent",
  domain_scope: "cross_domain",
  business_domains: ["심사"],
  owner: "AI공통플랫폼팀",
  reuse_status: "publish_candidate",
  capability_tags: ["remote-review"],
  binding: { kind: "a2a", contract_ref: "a2a.partner.remote-review.v1" },
  connection: { transport: "http" },
  workflow_profile: null,
  exposure: { protocol: "a2a", contract_ref: "a2a.partner.remote-review.v1" },
  responsibility: "A2A 경계에서 합성 심사 요청을 처리한다."
} as const;

export async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const repoRoot = await mkdtemp(join(tmpdir(), "af-catalog-api-test-"));
  try {
    await mkdir(join(repoRoot, "catalog"), { recursive: true });
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

export async function writeCanonicalCatalogs(repoRoot: string): Promise<void> {
  await Promise.all([
    writeFile(join(repoRoot, "catalog", "agents.yaml"), "agents: []\n", "utf8"),
    writeFile(join(repoRoot, "catalog", "workflows.yaml"), "workflows: []\n", "utf8"),
    writeFile(join(repoRoot, "catalog", "tools.yaml"), "tools: []\n", "utf8")
  ]);
}

export async function writeDelta(repoRoot: string, reqId: string, proposals: readonly object[]): Promise<void> {
  const root = join(repoRoot, "artifacts", "af", reqId);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "catalog-delta.yaml"), dumpYaml({ proposed_additions: proposals }, { lineWidth: -1 }), "utf8");
}

export async function postPublish(repoRoot: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return invoke(repoRoot, "POST", "/publish", body);
}

export async function getCatalog(repoRoot: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return invoke(repoRoot, "GET", "/", null);
}

async function invoke(
  repoRoot: string,
  method: string,
  url: string,
  body: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  const middleware = createAfCatalogMiddleware(repoRoot);
  const req = Readable.from(body === null ? [] : [JSON.stringify(body)]) as IncomingMessage;
  req.method = method;
  req.url = url;
  const chunks: string[] = [];
  const res = new ServerResponse(req);
  res.setHeader = function setHeader() { return this; };
  res.end = function end(chunk?: string | Uint8Array, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk.toString());
    if (typeof encodingOrCallback === "function") encodingOrCallback();
    else callback?.();
    return this;
  };
  await middleware(req, res, (error) => {
    throw error instanceof Error ? error : new Error("unexpected catalog middleware next()");
  });
  return {
    status: res.statusCode,
    body: chunks.join("").trim() ? (JSON.parse(chunks.join("")) as Record<string, unknown>) : {}
  };
}
