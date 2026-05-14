import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { buildAdkSourceBundle } from "../src/analyzer/adkSource";
import type { AdkRuntimeMode } from "../src/analyzer/adkGraph";

type MiddlewareNext = (error?: unknown) => void;

interface RuntimeProcess {
  child: ChildProcess;
  appName: string;
  outputRoot: string;
  port: number;
  url: string;
  embedUrl: string;
}

let webProcess: RuntimeProcess | null = null;

export function createAdkRuntimeMiddleware(repoRoot: string) {
  return async function adkRuntimeMiddleware(req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "POST 요청만 지원합니다." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.action !== "string") {
        sendJson(res, 400, { error: "action이 필요합니다." });
        return;
      }

      const outputRoot = safeOutputRoot(repoRoot, typeof body.outputDir === "string" ? body.outputDir : undefined);
      if (body.action === "generate-plan") {
        if (!isRecord(body.scaffoldPlan)) {
          sendJson(res, 400, { error: "scaffoldPlan이 필요합니다." });
          return;
        }
        await writeBundle(outputRoot, {
          "scaffold-plan.json": `${JSON.stringify(body.scaffoldPlan, null, 2)}\n`
        });
        sendJson(res, 200, {
          outputRoot,
          files: ["scaffold-plan.json"],
          scaffoldPlan: body.scaffoldPlan
        });
        return;
      }

      if (body.action === "generate") {
        const bundle = buildBundle(body);
        if (isRecord(body.scaffoldPlan) && isRecord(body.scaffoldPlan.validation) && body.scaffoldPlan.validation.can_generate_source === false) {
          sendJson(res, 422, {
            appName: bundle.appName,
            error: "scaffold-plan 검증 오류가 있습니다.",
            blockers: Array.isArray(body.scaffoldPlan.validation.blockers) ? body.scaffoldPlan.validation.blockers : []
          });
          return;
        }
        if (!bundle.canRun) {
          sendJson(res, 422, { appName: bundle.appName, graphIr: bundle.graphIr, error: "Graph IR 검증 오류가 있습니다." });
          return;
        }
        await writeBundle(outputRoot, bundle.files);
        sendJson(res, 200, {
          appName: bundle.appName,
          outputRoot,
          files: Object.keys(bundle.files),
          commands: bundle.commands,
          graphIr: bundle.graphIr
        });
        return;
      }

      const appName = typeof body.appName === "string" && body.appName.trim() ? body.appName.trim() : null;
      if (!appName) {
        sendJson(res, 400, { error: "appName이 필요합니다." });
        return;
      }

      if (body.action === "install") {
        const steps = await installDependencies(outputRoot);
        sendJson(res, 200, { appName, outputRoot, steps });
        return;
      }

      if (body.action === "verify") {
        const python = pythonCommand(outputRoot);
        const compile = await runCommand(python, ["-m", "compileall", appName, "tests"], outputRoot, 30_000);
        const pytest = await runCommand(python, ["-m", "pytest", "-q"], outputRoot, 30_000);
        sendJson(res, 200, { appName, outputRoot, steps: [{ name: "compileall", ...compile }, { name: "pytest", ...pytest }] });
        return;
      }

      if (body.action === "run") {
        const adk = adkCommand(outputRoot);
        const query =
          typeof body.query === "string" && body.query.trim()
            ? body.query.trim()
            : "sample complaint for workflow smoke";
        const run = await runCommand(
          adk,
          ["run", "--jsonl", "--in_memory", "--timeout", "10s", appName, query],
          outputRoot,
          30_000
        );
        sendJson(res, 200, { appName, outputRoot, query, ...run });
        return;
      }

      if (body.action === "start-web") {
        const port = normalizePort(body.port, 8010);
        const result = await startAdkWeb(outputRoot, appName, port);
        sendJson(res, 200, { appName, outputRoot, ...result });
        return;
      }

      if (body.action === "check-web") {
        const port = normalizePort(body.port, webProcess?.port ?? 8010);
        const checks = await checkAdkWeb(outputRoot, appName, port);
        sendJson(res, checks.every((check) => check.ok) ? 200 : 502, {
          appName,
          outputRoot,
          url: `http://127.0.0.1:${port}/`,
          embedUrl: adkWebEmbedUrl(port, appName),
          checks
        });
        return;
      }

      if (body.action === "chat-smoke") {
        const port = normalizePort(body.port, webProcess?.port ?? 8010);
        const query =
          typeof body.query === "string" && body.query.trim()
            ? body.query.trim()
            : "sample complaint for workflow smoke";
        const result = await runChatSmoke(appName, query, port);
        sendJson(res, 200, {
          appName,
          outputRoot,
          url: `http://127.0.0.1:${port}/`,
          embedUrl: adkWebEmbedUrl(port, appName),
          query,
          ...result
        });
        return;
      }

      sendJson(res, 400, { error: `지원하지 않는 action입니다: ${body.action}` });
    } catch (error) {
      if (error instanceof Error) {
        sendJson(res, 500, { error: error.message });
        return;
      }
      next(error);
    }
  };
}

function buildBundle(body: Record<string, unknown>) {
  if (!isRecord(body.normalizedRequirement) || !isRecord(body.scaffoldPlan) || !isRecord(body.processFlow)) {
    throw new Error("normalizedRequirement, scaffoldPlan, processFlow가 필요합니다.");
  }
  const runtimeMode = typeof body.runtimeMode === "string" ? (body.runtimeMode as AdkRuntimeMode) : "stub";
  return buildAdkSourceBundle({
    normalizedRequirement: body.normalizedRequirement as never,
    processFlow: body.processFlow as never,
    scaffoldPlan: body.scaffoldPlan as never,
    runtimeMode
  });
}

async function writeBundle(outputRoot: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const target = resolve(outputRoot, relativePath);
      if (!isInside(outputRoot, target)) {
        throw new Error(`출력 경로가 허용 범위를 벗어났습니다: ${relativePath}`);
      }
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    })
  );
}

async function installDependencies(outputRoot: string) {
  const steps: Array<{ name: string; stdout: string; stderr: string; exitCode: number }> = [];
  steps.push({ name: "python3 -m venv .venv", ...(await runCommand("python3", ["-m", "venv", ".venv"], outputRoot, 60_000)) });
  const python = pythonCommand(outputRoot);
  steps.push({
    name: "pip install -r requirements.txt",
    ...(await runCommand(python, ["-m", "pip", "install", "-r", "requirements.txt"], outputRoot, 120_000))
  });
  return steps;
}

async function startAdkWeb(outputRoot: string, appName: string, port: number) {
  if (webProcess && !webProcess.child.killed) {
    if (webProcess.port === port && webProcess.outputRoot === outputRoot && webProcess.appName === appName) {
      return { url: webProcess.url, embedUrl: webProcess.embedUrl, port: webProcess.port, status: "already_running" };
    }
    stopWebProcess();
  }
  const adk = adkCommand(outputRoot);
  const child = spawn(adk, ["web", "--port", String(port), "--host", "127.0.0.1"], {
    cwd: outputRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });
  webProcess = {
    child,
    appName,
    outputRoot,
    port,
    url: `http://127.0.0.1:${port}/`,
    embedUrl: adkWebEmbedUrl(port, appName)
  };
  child.on("close", () => {
    if (webProcess?.child === child) {
      webProcess = null;
    }
  });
  await waitForHttp(`http://127.0.0.1:${port}/`, 10_000);
  return { url: `http://127.0.0.1:${port}/`, embedUrl: adkWebEmbedUrl(port, appName), port, status: "started" };
}

async function checkAdkWeb(outputRoot: string, appName: string, port: number) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const selectedUrl = adkWebEmbedUrl(port, appName);
  const htmlResponse = await fetchResponse(`${baseUrl}/`);
  const selectedResponse = await fetchResponse(selectedUrl);
  const appsText = await fetchText(`${baseUrl}/list-apps`);
  const fs = await import("node:fs/promises");
  const agentPy = await fs.readFile(join(outputRoot, appName, "agent.py"), "utf8");
  const manifestText = await fs.readFile(join(outputRoot, appName, "workflow_manifest.json"), "utf8");
  const manifest = parseJson(manifestText);
  const apps = parseJson(appsText);
  const appListed = Array.isArray(apps) && apps.includes(appName);
  const framePolicy = framePolicyFor(selectedResponse);
  return [
    { name: "ADK Web HTML loads", ok: htmlResponse.text.includes("Agent Development Kit Dev UI") },
    { name: `GET /list-apps contains ${appName}`, ok: appListed },
    {
      name: `selected app URL loads with ${appName}`,
      ok: selectedUrl.includes(encodeURIComponent(appName)) && selectedResponse.text.includes("Agent Development Kit Dev UI")
    },
    {
      name: "selected app URL allows iframe embedding",
      ok: framePolicy.allowsEmbedding
    },
    {
      name: "Agent Structure tokens are present",
      ok: hasGeneratedWorkflowStructure(agentPy, manifest)
    }
  ];
}

function hasGeneratedWorkflowStructure(agentPy: string, manifest: unknown): boolean {
  if (!agentPy.includes("from google.adk import Event, Workflow")) return false;
  if (!agentPy.includes("root_agent = Workflow(")) return false;
  if (!agentPy.includes('"START"')) return false;
  if (!isRecord(manifest)) return false;
  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : [];
  const activeFunctions = nodes.length
    ? nodes
        .filter((node): node is Record<string, unknown> => isRecord(node) && node.active_in_graph !== false)
        .map((node) => (typeof node.function === "string" ? node.function : ""))
        .filter(Boolean)
    : modulesToGeneratedFunctions(manifest);
  return activeFunctions.every((functionName) => agentPy.includes(`def ${functionName}`));
}

function modulesToGeneratedFunctions(manifest: Record<string, unknown>): string[] {
  const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
  return modules
    .filter((module): module is Record<string, unknown> => isRecord(module) && typeof module.id === "string")
    .map((module) => {
      const id = typeof module.id === "string" ? module.id : "";
      return `node_${id.replace(/[^A-Za-z0-9_]+/g, "_")}`;
    });
}

async function runChatSmoke(appName: string, query: string, port: number) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const userId = "agent_factory_smoke";
  const sessionId = `smoke_${Date.now()}`;
  const session = await fetchJson(`${baseUrl}/apps/${encodeURIComponent(appName)}/users/${userId}/sessions/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const events = await fetchJson(`${baseUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appName,
      userId,
      sessionId,
      newMessage: {
        role: "user",
        parts: [{ text: query }]
      }
    })
  });
  return {
    sessionId,
    userId,
    session,
    events,
    checks: [
      { name: "ADK session created", ok: isRecord(session) && session.id === sessionId },
      { name: "ADK /run returned events", ok: Array.isArray(events) && events.length > 0 }
    ]
  };
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} ${args.join(" ")} 시간이 초과되었습니다.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const output = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: exitCode ?? -1
      };
      if (exitCode === 0) {
        resolvePromise(output);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} 실패(code ${exitCode}): ${output.stderr || output.stdout}`));
    });
  });
}

function stopWebProcess() {
  if (webProcess && !webProcess.child.killed) {
    webProcess.child.kill("SIGTERM");
  }
  webProcess = null;
}

async function waitForHttp(url: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchText(url);
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error(`${url} 응답 대기 시간이 초과되었습니다.`);
}

async function fetchText(url: string) {
  return (await fetchResponse(url)).text;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} 응답 실패: ${response.status} ${text}`);
  }
  return parseJson(text);
}

async function fetchResponse(url: string) {
  const response = await fetch(url);
  if (!response.ok && response.status !== 405) {
    throw new Error(`${url} 응답 실패: ${response.status}`);
  }
  return {
    text: await response.text(),
    headers: response.headers
  };
}

function framePolicyFor(response: { headers: Headers }) {
  const xFrameOptions = response.headers.get("x-frame-options")?.toLowerCase() ?? "";
  const csp = response.headers.get("content-security-policy")?.toLowerCase() ?? "";
  const frameAncestors = csp.match(/frame-ancestors\s+([^;]+)/)?.[1] ?? "";
  const allowsEmbedding =
    xFrameOptions !== "deny" &&
    xFrameOptions !== "sameorigin" &&
    !frameAncestors.includes("'none'") &&
    !frameAncestors.includes("none");
  return { allowsEmbedding };
}

function pythonCommand(outputRoot: string): string {
  const local = join(outputRoot, ".venv/bin/python");
  return existsSync(local) ? local : "python3";
}

function adkCommand(outputRoot: string): string {
  const local = join(outputRoot, ".venv/bin/adk");
  return existsSync(local) ? local : "adk";
}

function adkWebEmbedUrl(port: number, appName: string): string {
  return `http://127.0.0.1:${port}/dev-ui/?app=${encodeURIComponent(appName)}`;
}

function normalizePort(value: unknown, fallback: number): number {
  const port = typeof value === "number" ? value : fallback;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("ADK Web port는 1024부터 65535 사이의 정수여야 합니다.");
  }
  return port;
}

function safeOutputRoot(repoRoot: string, outputDir?: string): string {
  const selected = outputDir && outputDir.trim() ? outputDir.trim() : "generated/adk-source";
  const resolved = isAbsolute(selected) ? resolve(selected) : resolve(repoRoot, selected);
  if (!isInside(repoRoot, resolved)) {
    throw new Error("outputDir은 repository 내부여야 합니다.");
  }
  return resolved;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolvePromise({});
        return;
      }
      try {
        resolvePromise(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
