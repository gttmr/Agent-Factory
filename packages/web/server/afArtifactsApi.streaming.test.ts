import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { buildScaffoldPlan } from "../src/analyzer/scaffoldPlan.ts";
import { driftAnalysisResult } from "./artifactSyncFixtures.ts";
import {
  type ArtifactTestRequest,
  createRequester,
  createRoot,
  parseJsonBody,
  parseSse,
  responseJson,
  writeFakeScripts
} from "./artifactSyncTestHarness.ts";

async function assertVerifyRunStreams(request: ArtifactTestRequest): Promise<void> {
  const response = await request({
    url: "/req-stream/verify/run",
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"] ?? ""), /^text\/event-stream/);

  const events = parseSse(response.text());
  assert.deepEqual(events.map((entry) => entry.event), ["start", "stdout", "stderr", "done"]);
  assert.equal(events[0]?.data.command_key, "validate_artifact_root");
  assert.equal(events[1]?.data.chunk, "verify stdout line\n");
  assert.equal(events[2]?.data.chunk, "verify stderr line\n");
  assert.equal(events[3]?.data.ok, true);
  assert.equal(events[3]?.data.exit_code, 0);
  assert.equal(events[3]?.data.stdout, "verify stdout line\n");
  assert.equal(events[3]?.data.stderr, "verify stderr line\n");
  const manifest = responseJson<{
    readonly current_stage: string;
    readonly stages: { readonly verify: { readonly status: string } };
    readonly validation: { readonly commands: readonly string[]; readonly last_result: string };
  }>(
    await request({ url: "/req-stream/manifest" })
  );
  assert.equal(manifest.current_stage, "verify");
  assert.equal(manifest.stages.verify.status, "pending");
  assert.equal(manifest.validation.last_result, "not_run");
  assert.ok(manifest.validation.commands[0]?.startsWith("[validate_artifact_root] passed:"));

  const runtimeResponse = await request({
    url: "/req-stream/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_generated_runtime" }
  });
  assert.equal(runtimeResponse.status, 200);
  const completedManifest = responseJson<{
    readonly stages: { readonly verify: { readonly status: string } };
    readonly validation: { readonly commands: readonly string[]; readonly last_result: string };
  }>(await request({ url: "/req-stream/manifest" }));
  assert.equal(completedManifest.stages.verify.status, "complete");
  assert.equal(completedManifest.validation.last_result, "passed");
  assert.ok(completedManifest.validation.commands[1]?.startsWith("[validate_generated_runtime] passed:"));
}

async function assertRuntimeStubBuildStreams(request: ArtifactTestRequest): Promise<void> {
  const response = await request({
    url: "/req-stream/runtime-stub/build",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { streamProgress: true }
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"] ?? ""), /^text\/event-stream/);

  const events = parseSse(response.text());
  assert.deepEqual(events.map((entry) => entry.event), ["start", "stdout", "stderr", "done"]);
  assert.match(String(events[0]?.data.command), /^node scripts\/generate-adk-source\.mjs /);
  assert.equal(events[1]?.data.chunk, "build stdout line\n");
  assert.equal(events[2]?.data.chunk, "build stderr line\n");
  assert.equal(events[3]?.data.ok, true);
  assert.deepEqual(events[3]?.data.files, [{ path: "agent.py", bytes: 22 }]);

  const listing = responseJson<{ readonly exists: boolean; readonly files: readonly { readonly path: string; readonly bytes: number }[] }>(
    await request({ url: "/req-stream/runtime-stub" })
  );
  assert.equal(listing.exists, true);
  assert.deepEqual(listing.files, [{ path: "agent.py", bytes: 22 }]);
}

async function approveCompose(request: ArtifactTestRequest, reqId: string): Promise<void> {
  const response = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: false
    }
  });
  assert.equal(response.status, 200);
}

async function approveBuildHandoff(request: ArtifactTestRequest, reqId: string): Promise<void> {
  const response = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { stub_ready_for_followup: true }
  });
  assert.equal(response.status, 200);
}

async function assertVerifyRejectsBeforeBuild(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-verify-unready";
  await createRoot(request, reqId);
  const response = await request({
    url: `/${reqId}/verify/run`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(response.status, 409);
  assert.match(parseJsonBody<{ readonly error: string }>(response).error, /stub_ready_for_followup|Build/);
}

async function assertJsonPathsStillWork(request: ArtifactTestRequest): Promise<void> {
  const buildResponse = await request({ url: "/req-json/runtime-stub/build", method: "POST" });
  assert.equal(buildResponse.status, 200);
  assert.match(String(buildResponse.headers["content-type"] ?? ""), /^application\/json/);
  const build = responseJson<{
    readonly ok: boolean;
    readonly stdout: string;
    readonly stderr: string;
    readonly command: string;
    readonly files: readonly { readonly path: string; readonly bytes: number }[];
  }>(buildResponse);
  assert.deepEqual(Object.keys(build), ["ok", "files", "stdout", "stderr", "command"]);
  assert.equal(build.ok, true);
  assert.equal(build.stdout, "build stdout line\n");
  assert.equal(build.stderr, "build stderr line\n");
  assert.match(build.command, /^node scripts\/generate-adk-source\.mjs /);
  assert.deepEqual(build.files, [{ path: "agent.py", bytes: 22 }]);
  await approveBuildHandoff(request, "req-json");

  const handoffResponse = await request({ url: "/req-json/implementation-handoff.md" });
  assert.equal(handoffResponse.status, 200);
  assert.equal(handoffResponse.text(), "# Root implementation handoff\n");

  const verifyResponse = await request({
    url: "/req-json/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_artifact_root" }
  });
  assert.equal(verifyResponse.status, 200);
  assert.match(String(verifyResponse.headers["content-type"] ?? ""), /^application\/json/);
  const verify = responseJson<{ readonly ok: boolean; readonly stdout: string; readonly stderr: string; readonly command_key: string }>(
    verifyResponse
  );
  assert.equal(verify.ok, true);
  assert.equal(verify.command_key, "validate_artifact_root");
  assert.equal(verify.stdout, "verify stdout line\n");
  assert.equal(verify.stderr, "verify stderr line\n");
}

async function assertRetiredA2aContractsPathIsNotExposed(
  request: ArtifactTestRequest,
  root: string
): Promise<void> {
  await writeFile(join(root, "artifacts/af/req-json/a2a-contracts.json"), "[]\n", "utf8");

  for (const method of ["GET", "PUT"] as const) {
    const response = await request({
      url: "/req-json/a2a-contracts.json",
      method,
      headers: method === "PUT" ? { "content-type": "application/json" } : undefined,
      body: method === "PUT" ? [] : undefined
    });
    assert.equal(response.status, 404);
    assert.match(
      parseJsonBody<{ readonly error: string }>(response).error,
      /알 수 없는 아티팩트 경로입니다: a2a-contracts\.json/
    );
  }
}

async function assertRemovedCommonizationPathIsNotExposed(request: ArtifactTestRequest): Promise<void> {
  for (const method of ["GET", "PUT"] as const) {
    const response = await request({
      url: "/req-json/commonization-notes.json",
      method,
      headers: method === "PUT" ? { "content-type": "application/json" } : undefined,
      body: method === "PUT" ? {} : undefined
    });
    assert.equal(response.status, 404);
    assert.match(parseJsonBody<{ readonly error: string }>(response).error, /알 수 없는 아티팩트 경로/);
  }
}

async function assertDerivedJsonCannotBeWrittenDirectly(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-derived-write";
  await createRoot(request, reqId);
  for (const path of ["normalized-requirement.json", "asset-candidates.json", "graph-ir.json"] as const) {
    const response = await request({
      url: `/${reqId}/${path}`,
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: path === "asset-candidates.json" ? [] : {}
    });
    assert.equal(response.status, 405, path);
    assert.match(parseJsonBody<{ readonly error: string }>(response).error, /artifact sync|파생/i);
    assert.equal((await request({ url: `/${reqId}/${path}` })).status, 404);
  }
}

async function assertScaffoldPlanWriteIsFailClosed(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-scaffold-write";
  await createRoot(request, reqId);
  const analysis = driftAnalysisResult(reqId);
  assert.equal((await request({
    url: `/${reqId}/analysis-result.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: analysis
  })).status, 200);

  const plan = buildScaffoldPlan({
    normalizedRequirement: analysis.normalizedRequirement,
    assetCandidates: analysis.assetCandidates,
    graph: analysis.graph,
    runtimeContracts: analysis.runtimeContracts
  });
  const beforeApproval = await request({
    url: `/${reqId}/scaffold-plan.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: plan
  });
  assert.equal(beforeApproval.status, 409);
  assert.match(parseJsonBody<{ readonly error: string }>(beforeApproval).error, /boundaries_approved|runtime_contracts_approved/);

  await approveCompose(request, reqId);
  const malformed = await request({
    url: `/${reqId}/scaffold-plan.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: {}
  });
  assert.equal(malformed.status, 422);
  assert.match(parseJsonBody<{ readonly error: string }>(malformed).error, /scaffold-plan/);
  assert.equal((await request({ url: `/${reqId}/scaffold-plan.json` })).status, 404);

  const drifted = await request({
    url: `/${reqId}/scaffold-plan.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: { ...plan, graph: { ...plan.graph, graph_id: "drifted-plan-graph" } }
  });
  assert.equal(drifted.status, 422);
  assert.match(JSON.stringify(parseJsonBody(drifted)), /graph/i);

  assert.equal((await request({
    url: `/${reqId}/scaffold-plan.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: plan
  })).status, 200);
}

async function assertApprovalPatchesStayHierarchical(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-approval-hierarchy";
  await createRoot(request, reqId);

  const wrongType = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { boundaries_approved: "true" }
  });
  assert.equal(wrongType.status, 400);

  const unknown = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { arbitrary_gate: true }
  });
  assert.equal(unknown.status, 400);

  const skippedPredecessor = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { runtime_contracts_approved: true }
  });
  assert.equal(skippedPredecessor.status, 409);
  assert.match(parseJsonBody<{ readonly error: string }>(skippedPredecessor).error, /boundaries_approved/);

  await approveCompose(request, reqId);
  const noStub = await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { stub_ready_for_followup: true }
  });
  assert.equal(noStub.status, 409);
  assert.match(parseJsonBody<{ readonly error: string }>(noStub).error, /runtime-stub/);

  const lowered = responseJson<AfRunManifest>(await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { analysis_reviewed: false }
  }));
  assert.deepEqual(lowered.approvals, {
    analysis_reviewed: false,
    boundaries_approved: false,
    runtime_contracts_approved: false,
    stub_ready_for_followup: false
  });
}

async function assertManifestValidationIsServerOwned(request: ArtifactTestRequest): Promise<void> {
  const before = responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" }));
  const response = await request({
    url: "/req-json/manifest/validation",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { commands: ["forged"], last_result: "passed" }
  });
  assert.equal(response.status, 404);
  assert.deepEqual(responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" })), before);
}

async function assertAnalysisWritesInvalidateStaleApprovals(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-analysis-revision";
  await createRoot(request, reqId);
  const analysis = driftAnalysisResult(reqId);
  assert.equal((await request({
    url: `/${reqId}/analysis-result.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: analysis
  })).status, 200);
  await approveCompose(request, reqId);
  assert.equal((await request({ url: `/${reqId}/runtime-stub/build`, method: "POST" })).status, 200);
  await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: { stub_ready_for_followup: true }
  });
  assert.equal((await request({
    url: `/${reqId}/verify/run`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "validate_artifact_root" }
  })).status, 200);

  const designEdit = {
    ...analysis,
    graph: { ...analysis.graph, graph_id: "graph-revised-design" }
  };
  assert.equal((await request({
    url: `/${reqId}/analysis-result.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: designEdit
  })).status, 200);
  const afterDesign = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));
  assert.equal(afterDesign.current_stage, "design");
  assert.equal(afterDesign.approvals.analysis_reviewed, true);
  assert.equal(afterDesign.approvals.boundaries_approved, false);
  assert.equal(afterDesign.approvals.runtime_contracts_approved, false);
  assert.equal(afterDesign.approvals.stub_ready_for_followup, false);
  assert.equal(afterDesign.stages.design.status, "pending");
  assert.equal(afterDesign.stages.build.status, "pending");
  assert.deepEqual(afterDesign.validation, { commands: [], last_result: "not_run" });

  await approveCompose(request, reqId);
  const analyzeEdit = {
    ...designEdit,
    normalizedRequirement: { ...designEdit.normalizedRequirement, title: "Revised requirement" }
  };
  assert.equal((await request({
    url: `/${reqId}/analysis-result.json`,
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: analyzeEdit
  })).status, 200);
  const afterAnalyze = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));
  assert.equal(afterAnalyze.current_stage, "analyze");
  assert.deepEqual(afterAnalyze.approvals, {
    analysis_reviewed: false,
    boundaries_approved: false,
    runtime_contracts_approved: false,
    stub_ready_for_followup: false
  });
  assert.equal(afterAnalyze.stages.analyze.status, "pending");
}

async function assertVerifyRunRejectsArbitraryCommand(request: ArtifactTestRequest): Promise<void> {
  const before = responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" }));
  const response = await request({
    url: "/req-json/verify/run",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { command: "rm" }
  });

  assert.equal(response.status, 400);
  assert.equal(parseJsonBody<{ readonly error: string }>(response).error, "허용되지 않은 명령입니다: rm");
  assert.deepEqual(responseJson<AfRunManifest>(await request({ url: "/req-json/manifest" })), before);
}

async function assertRuntimeChatLifecycle(request: ArtifactTestRequest, root: string): Promise<void> {
  await writeFakeRuntimeStub(root, "req-runtime");
  const before = responseJson<{
    readonly installed: boolean;
    readonly port: number;
    readonly app_name: string;
    readonly server: { readonly status: string; readonly pid: number | null };
  }>(await request({ url: "/req-runtime/runtime-chat/status" }));
  assert.equal(before.installed, false);
  assert.equal(before.port, Number(process.env.AF_ADK_CHAT_PORT));
  assert.equal(before.app_name, "req_stream_adk");
  assert.equal(before.server.status, "stopped");

  const installResponse = await request({ url: "/req-runtime/runtime-chat/install", method: "POST" });
  assert.equal(installResponse.status, 405);
  const install = parseJsonBody<{ readonly error: string; readonly status: { readonly installed: boolean } }>(installResponse);
  assert.match(install.error, /설치는 지원하지 않습니다/);
  assert.equal(install.status.installed, false);

  await writeFakeSharedAdkRuntime(root);
  assert.equal(responseJson<{ readonly installed: boolean }>(await request({ url: "/req-runtime/runtime-chat/status" })).installed, true);
  const started = responseJson<{ readonly ok: boolean; readonly status: { readonly server: { readonly status: string; readonly pid: number | null } } }>(
    await request({ url: "/req-runtime/runtime-chat/start", method: "POST" })
  );
  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.ok(started.status.server.pid);
  assert.equal(responseJson<{ readonly ok: boolean }>(await request({ url: "/req-runtime/runtime-chat/stop", method: "POST" })).ok, true);

  const a2aStatus = responseJson<{
    readonly installed: boolean;
    readonly port: number;
    readonly app_name: string;
    readonly rpc_url: string;
    readonly agent_card_url: string;
    readonly server: { readonly status: string };
  }>(await request({ url: "/req-runtime/runtime-a2a/status" }));
  assert.equal(a2aStatus.installed, true);
  assert.equal(a2aStatus.port, Number(process.env.AF_ADK_A2A_PORT));
  assert.equal(a2aStatus.app_name, "req_stream_adk");
  assert.equal(a2aStatus.rpc_url, `http://127.0.0.1:${process.env.AF_ADK_A2A_PORT}/a2a/req_stream_adk`);
  assert.equal(
    a2aStatus.agent_card_url,
    `http://127.0.0.1:${process.env.AF_ADK_A2A_PORT}/a2a/req_stream_adk/.well-known/agent-card.json`
  );
  assert.equal(a2aStatus.server.status, "stopped");

  const card = responseJson<{
    readonly app_name: string;
    readonly rpc_url: string;
    readonly agent_card_url: string;
    readonly card: { readonly name: string; readonly url: string; readonly preferredTransport: string };
  }>(await request({ url: "/req-runtime/runtime-a2a/agent-card" }));
  assert.equal(card.app_name, "req_stream_adk");
  assert.equal(card.card.name, "req_stream_adk");
  assert.equal(card.card.url, card.rpc_url);
  assert.equal(card.card.preferredTransport, "JSONRPC");
}

async function writeFakeRuntimeStub(root: string, reqId: string): Promise<void> {
  const stubDir = join(root, `artifacts/af/${reqId}/runtime-stub`);
  await mkdir(join(stubDir, "req_stream_adk"), { recursive: true });
  await writeFile(join(stubDir, "req_stream_adk/workflow_manifest.json"), `${JSON.stringify({ package: "req_stream_adk" }, null, 2)}\n`);
}

async function writeFakeSharedAdkRuntime(root: string): Promise<void> {
  const binDir = join(root, ".agent-factory/runtime/.venv/bin");
  await mkdir(binDir, { recursive: true });
  await writeFile(join(binDir, "python"), "#!/bin/sh\nexit 0\n");
  await writeFile(
    join(binDir, "adk"),
    [
      "#!/usr/bin/env node",
      "const http = require('node:http');",
      "const args = process.argv.slice(2);",
      "const port = Number(args[args.indexOf('--port') + 1]);",
      "const host = args[args.indexOf('--host') + 1] || '127.0.0.1';",
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/list-apps') {",
      "    res.setHeader('content-type', 'application/json');",
      "    res.end(JSON.stringify(['req_stream_adk']));",
      "    return;",
      "  }",
      "  res.end('fake adk server started');",
      "});",
      "server.listen(port, host);",
      "process.on('SIGTERM', () => { server.close(); process.exit(0); });",
      "setInterval(() => undefined, 1000);",
      ""
    ].join("\n")
  );
  await chmod(join(binDir, "python"), 0o755);
  await chmod(join(binDir, "adk"), 0o755);
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not allocate a local test port."));
      });
    });
  });
}

const repoRoot = await mkdtemp(join(tmpdir(), "af-artifacts-api-stream-"));
const originalPath = process.env.PATH ?? "";
const originalRuntimePort = process.env.AF_ADK_CHAT_PORT;
const originalA2aPort = process.env.AF_ADK_A2A_PORT;

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  process.env.AF_ADK_CHAT_PORT = String(await getAvailablePort());
  process.env.AF_ADK_A2A_PORT = String(await getAvailablePort());
  const request = createRequester(repoRoot);

  await assertVerifyRejectsBeforeBuild(request);

  await createRoot(request, "req-stream");
  await approveCompose(request, "req-stream");
  await assertRuntimeStubBuildStreams(request);
  await approveBuildHandoff(request, "req-stream");
  await assertVerifyRunStreams(request);

  await createRoot(request, "req-json");
  await approveCompose(request, "req-json");
  await assertJsonPathsStillWork(request);
  await assertRetiredA2aContractsPathIsNotExposed(request, repoRoot);
  await assertRemovedCommonizationPathIsNotExposed(request);
  await assertVerifyRunRejectsArbitraryCommand(request);

  await assertDerivedJsonCannotBeWrittenDirectly(request);
  await assertScaffoldPlanWriteIsFailClosed(request);
  await assertApprovalPatchesStayHierarchical(request);
  await assertManifestValidationIsServerOwned(request);
  await assertAnalysisWritesInvalidateStaleApprovals(request);

  await createRoot(request, "req-runtime");
  await assertRuntimeChatLifecycle(request, repoRoot);
} finally {
  process.env.PATH = originalPath;
  if (originalRuntimePort === undefined) delete process.env.AF_ADK_CHAT_PORT;
  else process.env.AF_ADK_CHAT_PORT = originalRuntimePort;
  if (originalA2aPort === undefined) delete process.env.AF_ADK_A2A_PORT;
  else process.env.AF_ADK_A2A_PORT = originalA2aPort;
  await rm(repoRoot, { recursive: true, force: true });
}
