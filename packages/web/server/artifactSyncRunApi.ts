import type { IncomingMessage, ServerResponse } from "node:http";
import type { ScaffoldOutputMode } from "../src/analyzer/types";
import type { ArtifactRootStore } from "./artifactRootStore";
import { ArtifactValidationError } from "./artifactRootStore";
import { syncArtifactRoot, type ArtifactSyncResult } from "./artifactSync";
import {
  buildGenerationCommand,
  buildValidationCommand,
  runGenerationStep,
  runValidationStep,
  type ArtifactSyncProcessSummary,
  type ArtifactSyncValidationSummary
} from "./artifactSyncProcessSteps";
import { isRecord, readJsonBody, sendJson } from "./httpApi";
import { beginSse, shouldStreamProcess, writeSseEvent } from "./processStreaming";

interface ArtifactSyncRunBody {
  readonly outputMode?: ScaffoldOutputMode;
  readonly rebuildRuntimeStub: boolean;
  readonly runValidation: boolean;
  readonly streamProgress?: boolean;
}

type ArtifactSyncRunResponse = Omit<ArtifactSyncResult, "ok"> & {
  readonly ok: boolean;
  readonly generation?: ArtifactSyncProcessSummary;
  readonly validation?: ArtifactSyncValidationSummary;
};

export async function handleArtifactSyncRun(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readJsonBody(req);
  const body = parseArtifactSyncRunBody(rawBody);
  if (shouldStreamProcess(req, body)) {
    await handleArtifactSyncRunSse(repoRoot, store, reqId, body, res);
    return;
  }

  const sync = await runArtifactSyncStep(repoRoot, store, reqId, body.outputMode, res);
  if (!sync) return;

  let generation: ArtifactSyncProcessSummary | undefined;
  if (body.rebuildRuntimeStub) {
    const command = buildGenerationCommand(store, reqId);
    generation = await runGenerationStep(repoRoot, command);
    if (!generation.ok) {
      sendJson(res, 422, composeArtifactSyncResponse(sync, false, generation));
      return;
    }
  }

  let validation: ArtifactSyncValidationSummary | undefined;
  if (body.runValidation) {
    const command = buildValidationCommand(store, reqId);
    validation = await runValidationStep(repoRoot, store, reqId, command);
    if (!validation.ok) {
      sendJson(res, 422, composeArtifactSyncResponse(sync, false, generation, validation));
      return;
    }
  }

  sendJson(res, 200, composeArtifactSyncResponse(sync, true, generation, validation));
}

async function handleArtifactSyncRunSse(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  body: ArtifactSyncRunBody,
  res: ServerResponse
): Promise<void> {
  beginSse(res);
  const abortController = new AbortController();
  const abortOnClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on("close", abortOnClose);
  writeSseEvent(res, "start", {
    requirement_id: reqId,
    output_mode: body.outputMode ?? null,
    rebuild_runtime_stub: body.rebuildRuntimeStub,
    run_validation: body.runValidation,
    started_at: new Date().toISOString()
  });

  try {
    const sync = await syncArtifactRoot({ repoRoot, store, reqId, outputMode: body.outputMode });
    writeSseEvent(res, "sync", sync);

    let generation: ArtifactSyncProcessSummary | undefined;
    if (body.rebuildRuntimeStub) {
      const command = buildGenerationCommand(store, reqId);
      generation = await runGenerationStep(repoRoot, command, abortController.signal, res);
      if (!generation.ok) {
        writeSseEvent(res, "error", {
          ...composeArtifactSyncResponse(sync, false, generation),
          error: "runtime-stub 생성 실패"
        });
        return;
      }
    }

    let validation: ArtifactSyncValidationSummary | undefined;
    if (body.runValidation) {
      const command = buildValidationCommand(store, reqId);
      validation = await runValidationStep(repoRoot, store, reqId, command, abortController.signal, res);
      if (!validation.ok) {
        writeSseEvent(res, "error", {
          ...composeArtifactSyncResponse(sync, false, generation, validation),
          error: "verify 실행 실패"
        });
        return;
      }
    }

    writeSseEvent(res, "done", composeArtifactSyncResponse(sync, true, generation, validation));
  } catch (error) { // no-excuse-ok: catch
    writeSseEvent(res, "error", artifactSyncErrorPayload(error));
  } finally {
    res.off("close", abortOnClose);
    res.end();
  }
}

async function runArtifactSyncStep(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  outputMode: ScaffoldOutputMode | undefined,
  res: ServerResponse
): Promise<ArtifactSyncResult | null> {
  try {
    return await syncArtifactRoot({ repoRoot, store, reqId, outputMode });
  } catch (error) {
    if (error instanceof ArtifactValidationError) {
      sendJson(res, error.statusCode, { ok: false, error: error.message });
      return null;
    }
    throw error;
  }
}

function parseArtifactSyncRunBody(body: unknown): ArtifactSyncRunBody {
  if (!isRecord(body)) {
    throw new ArtifactValidationError(400, "본문은 객체여야 합니다.");
  }
  return {
    outputMode: parseOutputMode(body.outputMode),
    rebuildRuntimeStub: typeof body.rebuildRuntimeStub === "boolean" ? body.rebuildRuntimeStub : true,
    runValidation: typeof body.runValidation === "boolean" ? body.runValidation : true,
    streamProgress: typeof body.streamProgress === "boolean" ? body.streamProgress : undefined
  };
}

function parseOutputMode(value: unknown): ScaffoldOutputMode | undefined {
  if (value === undefined) return undefined;
  if (value === "smoke" || value === "runnable") return value;
  throw new ArtifactValidationError(400, "outputMode 값은 smoke 또는 runnable 이어야 합니다.");
}

function composeArtifactSyncResponse(
  sync: ArtifactSyncResult,
  ok: boolean,
  generation?: ArtifactSyncProcessSummary,
  validation?: ArtifactSyncValidationSummary
): ArtifactSyncRunResponse {
  return {
    ...sync,
    ok,
    ...(generation ? { generation } : {}),
    ...(validation ? { validation } : {})
  };
}

function artifactSyncErrorPayload(error: unknown): { readonly ok: false; readonly error: string } {
  if (error instanceof ArtifactValidationError) return { ok: false, error: error.message };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "artifact sync 실행 실패" };
}
