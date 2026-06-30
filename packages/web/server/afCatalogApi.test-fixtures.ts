import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { ServerResponse } from "node:http";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createAfCatalogMiddleware } from "./afCatalogApi.ts";

export const validAdapterProposal = {
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

export const validRemoteA2aWorkflowProposal = {
  category: "workflow",
  module_category: "workflow",
  name: "remote_review_workflow",
  workflow_kind: "graph",
  owner_domain: "analysis",
  responsibility: "Route review work to an exposed A2A provider.",
  component_source: "remote_a2a",
  runtime_binding: "remote_a2a",
  a2a_provider_req_id: "req-example",
  inputs: [{ name: "case_id", type: "string", required: true }],
  outputs: [{ name: "decision", type: "string" }],
  composition: ["remote-review-agent"],
  risk_signals: ["audit_required"],
  required_before_approval: ["provider Agent Card route verified"],
  contract_status: "a2a_ready",
  notes: "Remote A2A workflow exposure.",
  source_candidate_id: "workflow-candidate"
};

export const matchingDelta = [
  "proposed_additions:",
  "  - category: adapter",
  "    name: customer_notice_template_mock_adapter",
  "    owner_domain: 고객",
  "    responsibility: 고객 안내 템플릿 preview 를 반환한다."
].join("\n");

export const matchingWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Route review work to an exposed A2A provider.",
  "    component_source: remote_a2a",
  "    runtime_binding: remote_a2a",
  "    a2a_provider_req_id: req-example",
  "    risk_signals:",
  "      - audit_required",
  "    required_before_approval:",
  "      - provider Agent Card route verified",
  "    contract_status: a2a_ready"
].join("\n");

export const staleWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Stale same-name workflow proposal without reviewed A2A exposure metadata."
].join("\n");

export const mismatchedWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Stale same-name workflow proposal with different reviewed provider metadata.",
  "    component_source: remote_a2a",
  "    runtime_binding: remote_a2a",
  "    a2a_provider_req_id: req-other"
].join("\n");

export const componentOnlyRemoteA2aWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Route review work to an exposed A2A provider.",
  "    component_source: remote_a2a",
  "    risk_signals:",
  "      - audit_required",
  "    required_before_approval:",
  "      - provider Agent Card route verified"
].join("\n");

export const runtimeOnlyRemoteA2aWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Route review work to an exposed A2A provider.",
  "    runtime_binding: remote_a2a",
  "    risk_signals:",
  "      - audit_required",
  "    required_before_approval:",
  "      - provider Agent Card route verified"
].join("\n");

export async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const repoRoot = await mkdtemp(join(tmpdir(), "af-catalog-api-test-"));
  try {
    await mkdir(join(repoRoot, "catalog"), { recursive: true });
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

export async function writeDelta(repoRoot: string, reqId: string, content: string): Promise<void> {
  const root = join(repoRoot, "artifacts", "af", reqId);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "catalog-delta.yaml"), `${content}\n`, "utf8");
}

export async function writeProviderRuntimeRoot(repoRoot: string, reqId: string): Promise<void> {
  const appDir = join(repoRoot, "artifacts", "af", reqId, "runtime-stub", "provider_app");
  await mkdir(appDir, { recursive: true });
  await writeFile(join(appDir, "workflow_manifest.json"), `${JSON.stringify({ package: "provider_app" }, null, 2)}\n`, "utf8");
}

export async function writeProviderAgentCard(repoRoot: string, reqId: string): Promise<void> {
  const appDir = join(repoRoot, "artifacts", "af", reqId, "runtime-stub", "provider_app");
  await mkdir(appDir, { recursive: true });
  await writeFile(
    join(appDir, "agent.json"),
    `${JSON.stringify(
      {
        name: "provider_app",
        description: "Pre-existing reviewed provider Agent Card.",
        url: "http://127.0.0.1:8001/a2a/provider_app",
        version: "0.1.0",
        preferredTransport: "JSONRPC",
        protocolVersion: "0.3.0",
        capabilities: {
          extensions: [],
          streaming: false,
          pushNotifications: false,
          stateTransitionHistory: true
        },
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["text/plain"],
        skills: [{ id: "provider_app_workflow", name: "Provider app", description: "Reviewed provider.", tags: ["agent-factory"] }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export async function postPublish(repoRoot: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const middleware = createAfCatalogMiddleware(repoRoot);
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.method = "POST";
  req.url = "/publish";
  const chunks: string[] = [];
  const res = new ServerResponse(req);
  res.setHeader = function setHeader() {
    return this;
  };
  res.end = function end(
    chunk?: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void
  ) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk.toString());
    if (typeof encodingOrCallback === "function") {
      encodingOrCallback();
    } else {
      callback?.();
    }
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
