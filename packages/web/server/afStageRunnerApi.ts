import type { IncomingMessage, ServerResponse } from "node:http";
import {
  applyStageRun,
  assertSkillRunnerStage,
  listStageRuns,
  readStageRunDetail,
  runStageSkill,
  type StageRunEvent,
  type StageRunRequestBody
} from "./stageRunner";
import type { ArtifactRootStore } from "./artifactRootStore";
import { ifMatchHeader, isRecord, readJsonBody, sendJson } from "./httpApi";

export async function handleStageRunner(
  repoRoot: string,
  store: ArtifactRootStore,
  locks: Set<string>,
  controllers: Map<string, AbortController>,
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
    const body = parseStageRunRequestBody(await readJsonBody(req));
    const abortController = new AbortController();
    locks.add(reqId);
    controllers.set(reqId, abortController);
    try {
      if (shouldStreamStageRun(req, body)) {
        await handleStageRunSse(repoRoot, store, reqId, stage, body, abortController.signal, res);
      } else {
        const summary = await runStageSkill({ repoRoot, store, reqId, stage, body, signal: abortController.signal });
        sendJson(res, summary.status === "failed" ? 422 : 200, summary);
      }
    } finally {
      controllers.delete(reqId);
      locks.delete(reqId);
    }
    return;
  }

  if (action === "cancel") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    const controller = controllers.get(reqId);
    if (!controller) {
      sendJson(res, 409, { error: "진행 중인 stage run 이 없습니다." });
      return;
    }
    controller.abort();
    sendJson(res, 202, { ok: true, status: "cancel_requested" });
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
  stage: "analyze" | "design" | "build" | "verify",
  body: StageRunRequestBody,
  signal: AbortSignal,
  res: ServerResponse
): Promise<void> {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const writeEvent = (event: StageRunEvent | { readonly phase: string; readonly message: string; readonly summary?: unknown }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const summary = await runStageSkill({
    repoRoot,
    store,
    reqId,
    stage,
    body,
    signal,
    onEvent: writeEvent
  });
  writeEvent({
    phase: summary.status === "failed" ? "failed" : "completed",
    message: summary.status === "failed" ? summary.last_error ?? "stage run failed" : "stage run completed",
    summary
  });
  res.end();
}

function shouldStreamStageRun(req: IncomingMessage, body: StageRunRequestBody): boolean {
  const accept = req.headers.accept;
  return body.streamProgress === true || (typeof accept === "string" && accept.includes("text/event-stream"));
}

function parseStageRunRequestBody(body: unknown): StageRunRequestBody {
  if (!isRecord(body)) return {};
  const input = isRecord(body.input)
    ? {
        rawText: typeof body.input.rawText === "string" ? body.input.rawText : undefined,
        domain: typeof body.input.domain === "string" ? body.input.domain : undefined
      }
    : undefined;
  return {
    execution_mode: body.execution_mode === "codex" || body.execution_mode === "fake" ? body.execution_mode : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    input,
    catalog: Array.isArray(body.catalog) ? body.catalog : undefined,
    verifyCommand: typeof body.verifyCommand === "string" ? body.verifyCommand : undefined,
    streamProgress: typeof body.streamProgress === "boolean" ? body.streamProgress : undefined
  };
}
