import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  REQ_ID_PATTERN
} from "./artifactRootStore";
import { isRecord, readJsonBody, sendJson } from "./httpApi";

type MiddlewareNext = (error?: unknown) => void;

const COMMENT_PATH = "collaboration/comments.json";
const HIGHLIGHT_PATH = "collaboration/highlights.json";

const COMMENT_STAGES = new Set(["analyze", "design", "build", "verify"]);
const COMMENT_KINDS = new Set(["node", "edge", "container", "path", "section"]);
const COMMENT_STATUSES = new Set(["open", "resolved", "wontfix"]);
const AUTHOR_ROLES = new Set(["developer", "business", "reviewer", "unknown"]);

const HIGHLIGHT_KINDS = new Set(["path", "node_group", "edge_group", "container_focus"]);
const HIGHLIGHT_COLOR_TOKENS = new Set(["agent", "workflow", "adapter", "remote", "neutral"]);

interface CommentAnchor {
  kind: "node" | "edge" | "container" | "path" | "section";
  node_id?: string;
  edge_id?: string;
  container_id?: string;
  node_path?: string[];
  section?: string;
}

interface CommentReply {
  id: string;
  author: string;
  author_role: string;
  body_md: string;
  created_at: string;
  updated_at: string;
}

interface CommentRecord {
  id: string;
  stage: string;
  anchor: CommentAnchor;
  author: string;
  author_role: string;
  body_md: string;
  status: string;
  created_at: string;
  updated_at: string;
  replies: CommentReply[];
}

interface CommentsFile {
  version: 1;
  requirement_id: string;
  comments: CommentRecord[];
}

interface HighlightTarget {
  node_ids?: string[];
  edge_ids?: string[];
  container_id?: string;
  node_path?: string[];
}

interface HighlightRecord {
  id: string;
  stage: string;
  kind: string;
  label: string;
  color_token: string;
  target: HighlightTarget;
  author: string;
  created_at: string;
  note_md?: string;
}

interface HighlightsFile {
  version: 1;
  requirement_id: string;
  highlights: HighlightRecord[];
}

export function createAfCollaborationMiddleware(repoRoot: string) {
  const store = new ArtifactRootStore({ repoRoot });

  return async function afCollaborationMiddleware(
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
      const [reqId, kind, id] = url.segments;
      if (!reqId || !REQ_ID_PATTERN.test(reqId)) {
        sendJson(res, 400, { error: "requirement_id 형식이 올바르지 않습니다." });
        return;
      }
      if (kind === "comments") {
        if (id) return await handleCommentItem(store, reqId, id, req, res);
        return await handleCommentCollection(store, reqId, req, res);
      }
      if (kind === "highlights") {
        if (id) return await handleHighlightItem(store, reqId, id, req, res);
        return await handleHighlightCollection(store, reqId, req, res);
      }
      sendJson(res, 404, { error: `알 수 없는 협업 리소스입니다: ${kind ?? ""}` });
    } catch (error) {
      handleError(error, res, next);
    }
  };
}

// ===== Comments =====

async function handleCommentCollection(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "GET") {
    const file = await loadComments(store, reqId);
    sendJson(res, 200, file);
    return;
  }
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const validated = validateNewComment(body, reqId);
    const file = await loadComments(store, reqId);
    const next: CommentsFile = {
      ...file,
      comments: [...file.comments, validated].sort(byCreatedAt)
    };
    await saveComments(store, reqId, next);
    sendJson(res, 201, validated);
    return;
  }
  sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
}

async function handleCommentItem(
  store: ArtifactRootStore,
  reqId: string,
  id: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    if (!isRecord(body)) {
      sendJson(res, 400, { error: "본문은 객체여야 합니다." });
      return;
    }
    const file = await loadComments(store, reqId);
    const index = file.comments.findIndex((entry) => entry.id === id);
    if (index < 0) {
      sendJson(res, 404, { error: `comment를 찾을 수 없습니다: ${id}` });
      return;
    }
    const existing = file.comments[index];
    const updated: CommentRecord = {
      ...existing,
      body_md: typeof body.body_md === "string" ? body.body_md : existing.body_md,
      status: typeof body.status === "string" && COMMENT_STATUSES.has(body.status) ? body.status : existing.status,
      updated_at: new Date().toISOString()
    };
    const next: CommentsFile = {
      ...file,
      comments: [...file.comments.slice(0, index), updated, ...file.comments.slice(index + 1)].sort(byCreatedAt)
    };
    await saveComments(store, reqId, next);
    sendJson(res, 200, updated);
    return;
  }
  if (req.method === "DELETE") {
    const file = await loadComments(store, reqId);
    const filtered = file.comments.filter((entry) => entry.id !== id);
    if (filtered.length === file.comments.length) {
      sendJson(res, 404, { error: `comment를 찾을 수 없습니다: ${id}` });
      return;
    }
    await saveComments(store, reqId, { ...file, comments: filtered });
    res.statusCode = 204;
    res.end();
    return;
  }
  sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
}

async function loadComments(store: ArtifactRootStore, reqId: string): Promise<CommentsFile> {
  const result = await store
    .readArtifact(reqId, COMMENT_PATH)
    .catch((error) => (error instanceof ArtifactValidationError && error.statusCode === 404 ? null : Promise.reject(error)));
  if (!result) {
    return { version: 1, requirement_id: reqId, comments: [] };
  }
  const parsed = JSON.parse(result.content) as Partial<CommentsFile>;
  return {
    version: 1,
    requirement_id: reqId,
    comments: Array.isArray(parsed.comments) ? parsed.comments.filter((entry): entry is CommentRecord => isCommentRecord(entry)) : []
  };
}

async function saveComments(store: ArtifactRootStore, reqId: string, file: CommentsFile): Promise<void> {
  const serialized = `${JSON.stringify(file, null, 2)}\n`;
  await store.writeArtifact(reqId, COMMENT_PATH, serialized, null);
}

function validateNewComment(body: unknown, reqId: string): CommentRecord {
  if (!isRecord(body)) throw new ArtifactValidationError(400, "본문은 객체여야 합니다.");
  const stage = typeof body.stage === "string" && COMMENT_STAGES.has(body.stage) ? body.stage : null;
  if (!stage) throw new ArtifactValidationError(400, "stage 값이 올바르지 않습니다.");
  const anchor = validateAnchor(body.anchor);
  const author = typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 80) : "익명";
  const role = typeof body.author_role === "string" && AUTHOR_ROLES.has(body.author_role) ? body.author_role : "unknown";
  const body_md = typeof body.body_md === "string" ? body.body_md.trim() : "";
  if (!body_md) throw new ArtifactValidationError(400, "body_md 가 비어 있습니다.");
  const status = typeof body.status === "string" && COMMENT_STATUSES.has(body.status) ? body.status : "open";
  const now = new Date().toISOString();
  return {
    id: typeof body.id === "string" && /^cmt-[A-Za-z0-9-]{1,80}$/.test(body.id) ? body.id : `cmt-${randomUUID()}`,
    stage,
    anchor,
    author,
    author_role: role,
    body_md: body_md.slice(0, 4000),
    status,
    created_at: now,
    updated_at: now,
    replies: []
  };
}

function validateAnchor(value: unknown): CommentAnchor {
  if (!isRecord(value)) throw new ArtifactValidationError(400, "anchor 가 필요합니다.");
  const kind = typeof value.kind === "string" && COMMENT_KINDS.has(value.kind) ? (value.kind as CommentAnchor["kind"]) : null;
  if (!kind) throw new ArtifactValidationError(400, "anchor.kind 값이 올바르지 않습니다.");
  const anchor: CommentAnchor = { kind };
  if (kind === "node") {
    if (typeof value.node_id !== "string" || !value.node_id) throw new ArtifactValidationError(400, "anchor.node_id 가 필요합니다.");
    anchor.node_id = value.node_id;
  } else if (kind === "edge") {
    if (typeof value.edge_id !== "string" || !value.edge_id) throw new ArtifactValidationError(400, "anchor.edge_id 가 필요합니다.");
    anchor.edge_id = value.edge_id;
  } else if (kind === "container") {
    if (typeof value.container_id !== "string" || !value.container_id) throw new ArtifactValidationError(400, "anchor.container_id 가 필요합니다.");
    anchor.container_id = value.container_id;
  } else if (kind === "path") {
    if (!Array.isArray(value.node_path) || value.node_path.length === 0) throw new ArtifactValidationError(400, "anchor.node_path 가 필요합니다.");
    anchor.node_path = value.node_path.filter((entry: unknown): entry is string => typeof entry === "string" && entry.length > 0);
  } else if (kind === "section") {
    if (typeof value.section !== "string" || !value.section) throw new ArtifactValidationError(400, "anchor.section 이 필요합니다.");
    anchor.section = value.section.slice(0, 120);
  }
  return anchor;
}

function isCommentRecord(value: unknown): value is CommentRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.stage === "string" &&
    typeof value.body_md === "string" &&
    isRecord(value.anchor)
  );
}

function byCreatedAt(a: { created_at: string }, b: { created_at: string }) {
  return a.created_at.localeCompare(b.created_at);
}

// ===== Highlights =====

async function handleHighlightCollection(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "GET") {
    const file = await loadHighlights(store, reqId);
    sendJson(res, 200, file);
    return;
  }
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const validated = validateNewHighlight(body);
    const file = await loadHighlights(store, reqId);
    const next: HighlightsFile = {
      ...file,
      highlights: [...file.highlights, validated].sort(byCreatedAt)
    };
    await saveHighlights(store, reqId, next);
    sendJson(res, 201, validated);
    return;
  }
  sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
}

async function handleHighlightItem(
  store: ArtifactRootStore,
  reqId: string,
  id: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "DELETE") {
    const file = await loadHighlights(store, reqId);
    const filtered = file.highlights.filter((entry) => entry.id !== id);
    if (filtered.length === file.highlights.length) {
      sendJson(res, 404, { error: `highlight를 찾을 수 없습니다: ${id}` });
      return;
    }
    await saveHighlights(store, reqId, { ...file, highlights: filtered });
    res.statusCode = 204;
    res.end();
    return;
  }
  sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
}

async function loadHighlights(store: ArtifactRootStore, reqId: string): Promise<HighlightsFile> {
  const result = await store
    .readArtifact(reqId, HIGHLIGHT_PATH)
    .catch((error) => (error instanceof ArtifactValidationError && error.statusCode === 404 ? null : Promise.reject(error)));
  if (!result) {
    return { version: 1, requirement_id: reqId, highlights: [] };
  }
  const parsed = JSON.parse(result.content) as Partial<HighlightsFile>;
  return {
    version: 1,
    requirement_id: reqId,
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((entry): entry is HighlightRecord => isHighlightRecord(entry))
      : []
  };
}

async function saveHighlights(store: ArtifactRootStore, reqId: string, file: HighlightsFile): Promise<void> {
  const serialized = `${JSON.stringify(file, null, 2)}\n`;
  await store.writeArtifact(reqId, HIGHLIGHT_PATH, serialized, null);
}

function validateNewHighlight(body: unknown): HighlightRecord {
  if (!isRecord(body)) throw new ArtifactValidationError(400, "본문은 객체여야 합니다.");
  const stage = typeof body.stage === "string" && COMMENT_STAGES.has(body.stage) ? body.stage : null;
  if (!stage) throw new ArtifactValidationError(400, "stage 값이 올바르지 않습니다.");
  const kind = typeof body.kind === "string" && HIGHLIGHT_KINDS.has(body.kind) ? body.kind : null;
  if (!kind) throw new ArtifactValidationError(400, "kind 값이 올바르지 않습니다.");
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 200) : null;
  if (!label) throw new ArtifactValidationError(400, "label 이 필요합니다.");
  const color = typeof body.color_token === "string" && HIGHLIGHT_COLOR_TOKENS.has(body.color_token) ? body.color_token : "neutral";
  const target = validateHighlightTarget(body.target, kind);
  const author = typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 80) : "익명";
  const noteMd = typeof body.note_md === "string" ? body.note_md.trim().slice(0, 4000) : "";
  const record: HighlightRecord = {
    id: typeof body.id === "string" && /^hl-[A-Za-z0-9-]{1,80}$/.test(body.id) ? body.id : `hl-${randomUUID()}`,
    stage,
    kind,
    label,
    color_token: color,
    target,
    author,
    created_at: new Date().toISOString()
  };
  if (noteMd) record.note_md = noteMd;
  return record;
}

function validateHighlightTarget(value: unknown, kind: string): HighlightTarget {
  if (!isRecord(value)) throw new ArtifactValidationError(400, "target 이 필요합니다.");
  const target: HighlightTarget = {};
  if (Array.isArray(value.node_ids)) {
    target.node_ids = value.node_ids.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (Array.isArray(value.edge_ids)) {
    target.edge_ids = value.edge_ids.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value.container_id === "string" && value.container_id) {
    target.container_id = value.container_id;
  }
  if (Array.isArray(value.node_path)) {
    target.node_path = value.node_path.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (kind === "path" && (!target.node_path || target.node_path.length === 0)) {
    throw new ArtifactValidationError(400, "path highlight 는 target.node_path 가 필요합니다.");
  }
  if (kind === "node_group" && (!target.node_ids || target.node_ids.length === 0)) {
    throw new ArtifactValidationError(400, "node_group highlight 는 target.node_ids 가 필요합니다.");
  }
  if (kind === "edge_group" && (!target.edge_ids || target.edge_ids.length === 0)) {
    throw new ArtifactValidationError(400, "edge_group highlight 는 target.edge_ids 가 필요합니다.");
  }
  if (kind === "container_focus" && !target.container_id) {
    throw new ArtifactValidationError(400, "container_focus highlight 는 target.container_id 가 필요합니다.");
  }
  return target;
}

function isHighlightRecord(value: unknown): value is HighlightRecord {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.kind === "string" && typeof value.label === "string";
}

// ===== Shared utilities =====

function parsePath(req: IncomingMessage): { segments: string[] } | null {
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
    sendJson(res, 409, { error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
    return;
  }
  if (error instanceof Error) {
    console.error("[af-collaboration] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}
