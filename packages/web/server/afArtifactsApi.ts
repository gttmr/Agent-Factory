import { spawn } from "node:child_process";
import { stat, readdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve, sep } from "node:path";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  REQ_ID_PATTERN
} from "./artifactRootStore";
import {
  applyStageRun,
  assertSkillRunnerStage,
  listStageRuns,
  readStageRunDetail,
  runStageSkill,
  type StageRunEvent,
  type StageRunRequestBody
} from "./stageRunner";
import {
  type AfRunManifest,
  type AfRunValidationResult,
  afRunValidationResults
} from "../src/analyzer/afRunManifest";
import { validateAnalysisResult } from "./validators";

type MiddlewareNext = (error?: unknown) => void;

const MARKDOWN_PATHS = new Set([
  "analysis-summary.md",
  "boundary-design.md",
  "implementation-handoff.md",
  "validation-report.md"
]);

const JSON_ARTIFACT_PATHS = new Set([
  "analysis-result.json",
  "normalized-requirement.json",
  "module-candidates.json",
  "process-flow.json",
  "commonization-notes.json",
  "a2a-contracts.json",
  "scaffold-plan.json"
]);

const YAML_PATHS = new Set(["catalog-delta.yaml"]);

const VERIFY_COMMANDS: Record<string, { argv: string[]; description: string }> = {
  validate_artifact_root: {
    argv: ["node", "scripts/validate-artifacts.mjs"],
    description: "validate-artifacts.mjs against the artifact root"
  },
  build_web: {
    argv: ["npm", "run", "build", "--prefix", "packages/web"],
    description: "tsc --noEmit && vite build"
  },
  test_analyzer: {
    argv: ["npm", "run", "test:analyzer", "--prefix", "packages/web"],
    description: "analyzer unit tests"
  }
};

export function createAfArtifactsMiddleware(repoRoot: string) {
  const store = new ArtifactRootStore({ repoRoot });
  const stageRunLocks = new Set<string>();

  return async function afArtifactsMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> {
    try {
      const url = parsePath(req);
      if (!url) {
        sendJson(res, 404, { error: "경로를 해석할 수 없습니다." });
        return;
      }

      // Collection: /api/af  → mounted as "" by Vite's middlewares.use("/api/af", ...)
      if (url.segments.length === 0) {
        if (req.method === "GET") return await handleListRoots(store, res);
        if (req.method === "POST") return await handleCreateRoot(store, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      const [reqId, ...rest] = url.segments;
      if (!REQ_ID_PATTERN.test(reqId)) {
        sendJson(res, 400, { error: "requirement_id 형식이 올바르지 않습니다." });
        return;
      }

      // /api/af/:id  → manifest summary
      if (rest.length === 0) {
        if (req.method === "GET") return await handleGetSummary(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      const sub = rest.join("/");

      // /api/af/:id/stages/:stage/{run,cancel,runs...}
      if (rest[0] === "stages") {
        return await handleStageRunner(repoRoot, store, stageRunLocks, reqId, rest.slice(1), req, res);
      }

      // /api/af/:id/manifest
      if (sub === "manifest") {
        if (req.method === "GET") return await handleGetManifest(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/manifest/approvals
      if (sub === "manifest/approvals") {
        if (req.method === "PATCH") return await handlePatchApprovals(store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/manifest/validation
      if (sub === "manifest/validation") {
        if (req.method === "PATCH") return await handlePatchValidation(store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // JSON artifacts
      if (JSON_ARTIFACT_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetJson(store, reqId, sub, res);
        if (req.method === "PUT") return await handlePutJson(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // Markdown artifacts
      if (MARKDOWN_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "text/markdown", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // YAML artifacts
      if (YAML_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "application/yaml", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/runtime-stub  → list generated files
      if (sub === "runtime-stub") {
        if (req.method === "GET") return await handleListRuntimeStub(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/runtime-stub/build  → spawn scripts/generate-adk-source.mjs
      if (sub === "runtime-stub/build") {
        if (req.method === "POST") return await handleBuildRuntimeStub(repoRoot, store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/runtime-stub/files/<relative>  → read a generated file's text
      if (sub.startsWith("runtime-stub/files/")) {
        const relativeFile = sub.slice("runtime-stub/files/".length);
        if (req.method === "GET") return await handleReadRuntimeStubFile(store, reqId, relativeFile, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/verify/run  → execute an allowed command
      if (sub === "verify/run") {
        if (req.method === "POST") return await handleVerifyRun(repoRoot, store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/verify/commands  → list available command keys
      if (sub === "verify/commands") {
        if (req.method === "GET") {
          sendJson(
            res,
            200,
            Object.entries(VERIFY_COMMANDS).map(([key, value]) => ({
              key,
              argv: value.argv,
              description: value.description
            }))
          );
          return;
        }
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      sendJson(res, 404, { error: `알 수 없는 아티팩트 경로입니다: ${sub}` });
    } catch (error) {
      handleError(error, res, next);
    }
  };
}

async function handleStageRunner(
  repoRoot: string,
  store: ArtifactRootStore,
  locks: Set<string>,
  reqId: string,
  rest: string[],
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const [stageRaw, action, runId, subAction] = rest;
  const stage = assertSkillRunnerStage(stageRaw ?? "");

  if (action === "run") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    if (locks.has(reqId)) {
      sendJson(res, 409, { error: "이 artifact root 에서 이미 stage run 이 진행 중입니다." });
      return;
    }
    const body = (await readJsonBody(req)) as StageRunRequestBody;
    locks.add(reqId);
    try {
      if (shouldStreamStageRun(req, body)) {
        await handleStageRunSse(repoRoot, store, reqId, stage, body, res);
      } else {
        const summary = await runStageSkill({ repoRoot, store, reqId, stage, body });
        sendJson(res, summary.status === "failed" ? 422 : 200, summary);
      }
    } finally {
      locks.delete(reqId);
    }
    return;
  }

  if (action === "cancel") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 501, { error: "cancel 은 child-process registry 준비 후 후속 구현합니다." });
    return;
  }

  if (action === "runs" && !runId) {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    const runs = await listStageRuns({ store, reqId, stage });
    sendJson(res, 200, runs.slice(0, 20));
    return;
  }

  if (action === "runs" && runId && !subAction) {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    const detail = await readStageRunDetail({ store, reqId, stage, runId });
    sendJson(res, 200, detail);
    return;
  }

  if (action === "runs" && runId && subAction === "apply") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    const result = await applyStageRun({ store, reqId, stage, runId, ifMatch: ifMatchHeader(req.headers["if-match"]) });
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: "알 수 없는 stage runner 경로입니다." });
}

async function handleStageRunSse(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  stage: "analyze" | "design",
  body: StageRunRequestBody,
  res: ServerResponse
): Promise<void> {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const writeEvent = (event: StageRunEvent | { phase: string; message: string; summary?: unknown }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const summary = await runStageSkill({
    repoRoot,
    store,
    reqId,
    stage,
    body,
    onEvent: writeEvent
  });
  writeEvent({
    phase: summary.status === "failed" ? "failed" : "completed",
    message: summary.status === "failed" ? summary.last_error ?? "stage run failed" : "stage run completed",
    summary
  });
  res.end();
}

async function handleListRoots(store: ArtifactRootStore, res: ServerResponse): Promise<void> {
  const summaries = await store.listRoots();
  sendJson(res, 200, summaries);
}

async function handleCreateRoot(
  store: ArtifactRootStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req).catch(() => ({}));
  const requested = isRecord(body) ? body.requirement_id : undefined;
  const reqId = typeof requested === "string" && requested.trim() ? requested.trim() : await mintRequirementId(store);
  const created = await store.createRoot(reqId);
  sendJson(res, 201, created);
}

async function handleGetSummary(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, { manifest, etag });
}

async function handleGetManifest(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, manifest);
}

async function handlePatchApprovals(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const ifMatch = req.headers["if-match"];
  const { manifest } = await store.readManifest(reqId);
  const approvals = {
    analysis_reviewed:
      typeof body.analysis_reviewed === "boolean" ? body.analysis_reviewed : manifest.approvals.analysis_reviewed,
    boundaries_approved:
      typeof body.boundaries_approved === "boolean"
        ? body.boundaries_approved
        : manifest.approvals.boundaries_approved,
    runtime_contracts_approved:
      typeof body.runtime_contracts_approved === "boolean"
        ? body.runtime_contracts_approved
        : manifest.approvals.runtime_contracts_approved,
    stub_ready_for_followup:
      typeof body.stub_ready_for_followup === "boolean"
        ? body.stub_ready_for_followup
        : manifest.approvals.stub_ready_for_followup
  };
  // Mirror approval state onto stage status so downstream tools
  // (scripts/generate-adk-source.mjs, validate-artifacts.mjs) can read it.
  const next: AfRunManifest = {
    ...manifest,
    approvals,
    stages: {
      ...manifest.stages,
      analyze: {
        ...manifest.stages.analyze,
        status: approvals.analysis_reviewed ? "complete" : manifest.stages.analyze.status
      },
      design: {
        ...manifest.stages.design,
        status:
          approvals.boundaries_approved && approvals.runtime_contracts_approved
            ? "complete"
            : manifest.stages.design.status
      },
      build: {
        ...manifest.stages.build,
        status: approvals.stub_ready_for_followup ? "complete" : manifest.stages.build.status
      }
    }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

async function handlePatchValidation(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const ifMatch = req.headers["if-match"];
  const { manifest } = await store.readManifest(reqId);
  const commands = Array.isArray(body.commands)
    ? body.commands.filter((item): item is string => typeof item === "string")
    : manifest.validation.commands;
  const lastResult =
    typeof body.last_result === "string" && afRunValidationResults.includes(body.last_result as AfRunValidationResult)
      ? (body.last_result as AfRunValidationResult)
      : manifest.validation.last_result;
  const next: AfRunManifest = {
    ...manifest,
    validation: { commands, last_result: lastResult }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

async function handleGetJson(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  res: ServerResponse
): Promise<void> {
  const result = await store.readArtifact(reqId, relative).catch((error) => {
    if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
    throw error;
  });
  if (!result) {
    sendJson(res, 404, { error: `아티팩트를 찾을 수 없습니다: ${relative}` });
    return;
  }
  res.setHeader("ETag", result.etag);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(result.content);
}

async function handlePutJson(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  // analysis-result schema check
  if (relative === "analysis-result.json") {
    const errors = validateAnalysisResult(body);
    if (errors.length) {
      sendJson(res, 422, { error: "analysis-result 검증 실패", details: errors });
      return;
    }
  }
  const serialized = `${JSON.stringify(body, null, 2)}\n`;
  const written = await store.writeArtifact(reqId, relative, serialized, ifMatchHeader(req.headers["if-match"]));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

async function handleGetText(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  contentType: string,
  res: ServerResponse
): Promise<void> {
  const result = await store.readArtifact(reqId, relative).catch((error) => {
    if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
    throw error;
  });
  if (!result) {
    sendJson(res, 404, { error: `아티팩트를 찾을 수 없습니다: ${relative}` });
    return;
  }
  res.setHeader("ETag", result.etag);
  res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
  res.statusCode = 200;
  res.end(result.content);
}

async function handlePutText(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const content = await readRawBody(req);
  const written = await store.writeArtifact(reqId, relative, content, ifMatchHeader(req.headers["if-match"]));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

async function handleListRuntimeStub(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const exists = await stat(stubDir).then((s) => s.isDirectory()).catch(() => false);
  if (!exists) {
    sendJson(res, 200, { exists: false, files: [] });
    return;
  }
  const files = await collectFiles(stubDir, stubDir);
  sendJson(res, 200, { exists: true, files });
}

async function collectFiles(root: string, current: string): Promise<Array<{ path: string; bytes: number }>> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: Array<{ path: string; bytes: number }> = [];
  for (const entry of entries) {
    const abs = join(current, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(root, abs)));
    } else if (entry.isFile()) {
      const fileStat = await stat(abs);
      result.push({ path: relative(root, abs).split(sep).join("/"), bytes: fileStat.size });
    }
  }
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

async function handleReadRuntimeStubFile(
  store: ArtifactRootStore,
  reqId: string,
  relativeFile: string,
  res: ServerResponse
): Promise<void> {
  if (relativeFile.includes("..") || relativeFile.startsWith("/")) {
    sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const target = resolve(stubDir, relativeFile);
  if (!target.startsWith(stubDir + sep) && target !== stubDir) {
    sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }
  const fileStat = await stat(target).catch(() => null);
  if (!fileStat?.isFile()) {
    sendJson(res, 404, { error: `파일을 찾을 수 없습니다: ${relativeFile}` });
    return;
  }
  if (fileStat.size > 500_000) {
    sendJson(res, 413, { error: "파일이 500KB 를 초과합니다." });
    return;
  }
  const content = await readFile(target, "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(content);
}

async function handleBuildRuntimeStub(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const args = ["scripts/generate-adk-source.mjs", rootDir, stubDir];
  const result = await runProcess(repoRoot, "node", args);
  if (result.code !== 0) {
    sendJson(res, 422, {
      error: "runtime-stub 생성 실패",
      exit_code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      command: `node ${args.join(" ")}`
    });
    return;
  }
  const files = await collectFiles(stubDir, stubDir);
  sendJson(res, 200, {
    ok: true,
    files,
    stdout: result.stdout,
    stderr: result.stderr,
    command: `node ${args.join(" ")}`
  });
}

async function handleVerifyRun(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const key = typeof body.command === "string" ? body.command : "";
  const command = VERIFY_COMMANDS[key];
  if (!command) {
    sendJson(res, 400, { error: `허용되지 않은 명령입니다: ${key}` });
    return;
  }
  const rootDir = store.resolveRootDir(reqId);
  const argv =
    key === "validate_artifact_root" ? [...command.argv, rootDir] : [...command.argv];
  const result = await runProcess(repoRoot, argv[0], argv.slice(1));
  const passed = result.code === 0;

  // Update manifest.validation
  const { manifest } = await store.readManifest(reqId);
  const next: AfRunManifest = {
    ...manifest,
    validation: {
      commands: [`${argv.join(" ")}`],
      last_result: passed ? "passed" : "failed"
    }
  };
  await store.writeManifest(reqId, next, null);

  sendJson(res, passed ? 200 : 422, {
    ok: passed,
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    command: argv.join(" "),
    command_key: key
  });
}

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runProcess(cwd: string, command: string, args: string[]): Promise<ProcessResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
    });
    child.on("error", (error) => {
      resolvePromise({ code: -1, stdout, stderr: `${stderr}\n[spawn-error] ${error.message}` });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function mintRequirementId(store: ArtifactRootStore): Promise<string> {
  const existing = await store.listRoots();
  const used = new Set(existing.map((entry) => entry.requirement_id));
  for (let i = 1; i < 10_000; i += 1) {
    const candidate = `req-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return `req-${Date.now()}`;
}

function parsePath(req: IncomingMessage): { segments: string[] } | null {
  const raw = req.url ?? "";
  const pathname = raw.split("?")[0] ?? "";
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { segments: [] };
  const segments = trimmed.split("/").map((segment) => decodeURIComponent(segment));
  // Reject any segment with a path separator after decoding
  for (const segment of segments) {
    if (segment.includes("/") || segment.includes("\\") || segment === ".." || segment === ".") {
      return null;
    }
  }
  return { segments };
}

function shouldStreamStageRun(req: IncomingMessage, body: StageRunRequestBody): boolean {
  const accept = req.headers.accept;
  return body.streamProgress === true || (typeof accept === "string" && accept.includes("text/event-stream"));
}

function ifMatchHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof ArtifactValidationError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }
  if (error instanceof ArtifactConflictError) {
    sendJson(res, 409, {
      error: error.message,
      expected_etag: error.expectedEtag,
      actual_etag: error.actualEtag
    });
    return;
  }
  if (error instanceof SyntaxError) {
    sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
    return;
  }
  if (error instanceof Error) {
    console.error("[af-artifacts] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
