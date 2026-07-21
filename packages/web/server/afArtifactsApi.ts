import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  REQ_ID_PATTERN
} from "./artifactRootStore";
import {
  handleCreateRoot,
  handleGetJson,
  handleGetManifest,
  handleGetSummary,
  handleGetText,
  handleListRoots,
  handlePatchApprovals,
  handlePutJson,
  handlePutText
} from "./afArtifactCrudApi";
import { handleArtifactSyncRun } from "./artifactSyncRunApi";
import { handleRuntimeA2a } from "./afRuntimeA2aApi";
import { handleRuntimeChat } from "./afRuntimeChatApi";
import {
  handleBuildRuntimeStub,
  handleListRuntimeStub,
  handleReadRuntimeStubFile
} from "./afRuntimeStubApi";
import { handleStageRunner } from "./afStageRunnerApi";
import { handleVerifyCommands, handleVerifyRun } from "./afVerifyRunApi";
import { sendJson } from "./httpApi";
import { RuntimeA2aManager } from "./runtimeA2a";
import { RuntimeChatManager } from "./runtimeChat";

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
  "asset-candidates.json",
  "graph-ir.json",
  "scaffold-plan.json"
]);

const DERIVED_JSON_PATHS = new Set([
  "normalized-requirement.json",
  "asset-candidates.json",
  "graph-ir.json"
]);

const YAML_PATHS = new Set(["catalog-delta.yaml"]);

export function createAfArtifactsMiddleware(repoRoot: string) {
  const store = new ArtifactRootStore({ repoRoot });
  const stageRunLocks = new Set<string>();
  const stageRunControllers = new Map<string, AbortController>();
  const runtimeA2a = new RuntimeA2aManager({ repoRoot, store });
  const runtimeChat = new RuntimeChatManager({ repoRoot, store });

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

      if (rest.length === 0) {
        if (req.method === "GET") return await handleGetSummary(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      const sub = rest.join("/");

      if (rest[0] === "stages") {
        return await handleStageRunner(repoRoot, store, stageRunLocks, stageRunControllers, reqId, rest.slice(1), req, res);
      }

      if (sub === "manifest") {
        if (req.method === "GET") return await handleGetManifest(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub === "manifest/approvals") {
        if (req.method === "PATCH") return await handlePatchApprovals(store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (JSON_ARTIFACT_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetJson(store, reqId, sub, res);
        if (req.method === "PUT") {
          if (DERIVED_JSON_PATHS.has(sub)) {
            sendJson(res, 405, { error: `${sub}은 artifact sync가 생성하는 파생 artifact이므로 직접 저장할 수 없습니다.` });
            return;
          }
          return await handlePutJson(repoRoot, store, reqId, sub, req, res);
        }
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (MARKDOWN_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "text/markdown", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (YAML_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "application/yaml", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub === "runtime-stub") {
        if (req.method === "GET") return await handleListRuntimeStub(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (rest[0] === "runtime-chat") {
        return await handleRuntimeChat(runtimeChat, reqId, rest.slice(1), req, res);
      }

      if (rest[0] === "runtime-a2a") {
        return await handleRuntimeA2a(runtimeA2a, reqId, rest.slice(1), req, res);
      }

      if (sub === "runtime-stub/build") {
        if (req.method === "POST") return await handleBuildRuntimeStub(repoRoot, store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub === "artifact-sync/run") {
        if (req.method === "POST") return await handleArtifactSyncRun(repoRoot, store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub.startsWith("runtime-stub/files/")) {
        const relativeFile = sub.slice("runtime-stub/files/".length);
        if (req.method === "GET") return await handleReadRuntimeStubFile(store, reqId, relativeFile, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub === "verify/run") {
        if (req.method === "POST") return await handleVerifyRun(repoRoot, store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      if (sub === "verify/commands") {
        if (req.method === "GET") {
          handleVerifyCommands(res);
          return;
        }
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      sendJson(res, 404, { error: `알 수 없는 아티팩트 경로입니다: ${sub}` });
    } catch (error) { // no-excuse-ok: catch
      handleError(error, res, next);
    }
  };
}

function parsePath(req: IncomingMessage): { readonly segments: readonly string[] } | null {
  const raw = req.url ?? "";
  const pathname = raw.split("?")[0] ?? "";
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { segments: [] };
  const segments = trimmed.split("/").map((segment) => decodeURIComponent(segment));
  for (const segment of segments) {
    if (segment.includes("/") || segment.includes("\\") || segment === ".." || segment === ".") {
      return null;
    }
  }
  return { segments };
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
