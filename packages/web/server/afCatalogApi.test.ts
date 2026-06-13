import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createAfCatalogMiddleware } from "./afCatalogApi.ts";

const validAdapterProposal = {
  category: "adapter",
  module_category: "adapter",
  name: "customer_notice_template_mock_adapter",
  adapter_kind: "template",
  owner_domain: "고객",
  responsibility: "고객 안내 템플릿 preview 를 반환한다.",
  inputs: [{ name: "customer_id", type: "string" }],
  outputs: [{ name: "message", type: "string" }],
  composition: ["template_render"],
  notes: "Reuse Hub 신규 등록 제안",
  source_candidate_id: "module-1"
};

const matchingDelta = [
  "proposed_additions:",
  "  - category: adapter",
  "    name: customer_notice_template_mock_adapter",
  "    owner_domain: 고객",
  "    responsibility: 고객 안내 템플릿 preview 를 반환한다."
].join("\n");

await withTempRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, "catalog", "adapters.yaml"), "adapters: []\n", "utf8");

  const invalidReq = await postPublish(repoRoot, {
    req_id: "../bad",
    proposal: validAdapterProposal
  });
  assert.equal(invalidReq.status, 422);
  assert.match(JSON.stringify(invalidReq.body), /req_id/);

  const missingRoot = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(missingRoot.status, 422);
  assert.match(JSON.stringify(missingRoot.body), /artifact root/);

  await mkdir(join(repoRoot, "artifacts", "af", "req_one"), { recursive: true });
  const missingDelta = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(missingDelta.status, 422);
  assert.match(JSON.stringify(missingDelta.body), /catalog-delta\.yaml/);

  await writeDelta(repoRoot, "req_one", matchingDelta);
  const invalidFields = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validAdapterProposal,
      inputs: [{ name: "customer_id" }],
      composition: ["template_render", 1]
    }
  });
  assert.equal(invalidFields.status, 422);
  assert.match(JSON.stringify(invalidFields.body), /inputs/);
  assert.match(JSON.stringify(invalidFields.body), /composition/);

  const firstPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(firstPublish.status, 200);
  assert.equal(firstPublish.body.ok, true);
  assert.equal(firstPublish.body.name, validAdapterProposal.name);
  assert.equal(firstPublish.body.version, 1);

  const catalogPath = join(repoRoot, "catalog", "adapters.yaml");
  const afterFirstPublish = await readFile(catalogPath, "utf8");
  assert.match(afterFirstPublish, /published_from: req_one/);

  const secondPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(secondPublish.status, 200);
  assert.equal(secondPublish.body.already_published, true);
  assert.equal(secondPublish.body.version, 1);
  assert.equal(await readFile(catalogPath, "utf8"), afterFirstPublish);
});

async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const repoRoot = await mkdtemp(join(tmpdir(), "af-catalog-api-test-"));
  try {
    await mkdir(join(repoRoot, "catalog"), { recursive: true });
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function writeDelta(repoRoot: string, reqId: string, content: string): Promise<void> {
  const root = join(repoRoot, "artifacts", "af", reqId);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "catalog-delta.yaml"), `${content}\n`, "utf8");
}

async function postPublish(repoRoot: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const middleware = createAfCatalogMiddleware(repoRoot);
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.method = "POST";
  req.url = "/publish";
  const chunks: string[] = [];
  const res = {
    statusCode: 200,
    setHeader() {
      return this;
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk);
      return this;
    }
  } as unknown as ServerResponse;
  await middleware(req, res, (error) => {
    throw error instanceof Error ? error : new Error("unexpected catalog middleware next()");
  });
  return {
    status: res.statusCode,
    body: chunks.join("").trim() ? (JSON.parse(chunks.join("")) as Record<string, unknown>) : {}
  };
}
