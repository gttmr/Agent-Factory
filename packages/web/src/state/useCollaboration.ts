import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export type CommentAnchorKind = "node" | "edge" | "container" | "path" | "section";
export type CommentStage = "analyze" | "design" | "build" | "verify";
export type CommentStatus = "open" | "resolved" | "wontfix";
export type CommentAuthorRole = "developer" | "business" | "reviewer" | "unknown";

export interface CommentAnchor {
  kind: CommentAnchorKind;
  node_id?: string;
  edge_id?: string;
  container_id?: string;
  node_path?: string[];
  section?: string;
}

export interface CommentRecord {
  id: string;
  stage: CommentStage;
  anchor: CommentAnchor;
  author: string;
  author_role: CommentAuthorRole;
  body_md: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
  replies: Array<{
    id: string;
    author: string;
    author_role: CommentAuthorRole;
    body_md: string;
    created_at: string;
    updated_at: string;
  }>;
}

export interface CommentsFile {
  version: 1;
  requirement_id: string;
  comments: CommentRecord[];
}

export interface HighlightTarget {
  node_ids?: string[];
  edge_ids?: string[];
  container_id?: string;
  node_path?: string[];
}

export interface HighlightRecord {
  id: string;
  stage: CommentStage;
  kind: "path" | "node_group" | "edge_group" | "container_focus";
  label: string;
  color_token: "agent" | "workflow" | "tool" | "a2a" | "neutral";
  target: HighlightTarget;
  author: string;
  created_at: string;
  note_md?: string;
}

export interface HighlightsFile {
  version: 1;
  requirement_id: string;
  highlights: HighlightRecord[];
}

export interface CreateCommentInput {
  stage: CommentStage;
  anchor: CommentAnchor;
  body_md: string;
  author: string;
  author_role: CommentAuthorRole;
  status?: CommentStatus;
}

export interface CreateHighlightInput {
  stage: CommentStage;
  kind: HighlightRecord["kind"];
  label: string;
  color_token?: HighlightRecord["color_token"];
  target: HighlightTarget;
  author: string;
  note_md?: string;
}

async function readResponseError(response: Response, fallback: string): Promise<AfApiError> {
  try {
    const body = (await response.json()) as { error?: string; details?: unknown };
    return new AfApiError(response.status, body.error ?? fallback, body.details);
  } catch {
    return new AfApiError(response.status, fallback);
  }
}

async function fetchComments(reqId: string): Promise<CommentsFile> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/comments`);
  if (!response.ok) throw await readResponseError(response, "comments 조회 실패");
  return (await response.json()) as CommentsFile;
}

async function postComment(reqId: string, input: CreateCommentInput): Promise<CommentRecord> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw await readResponseError(response, "comment 생성 실패");
  return (await response.json()) as CommentRecord;
}

async function patchComment(reqId: string, id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>): Promise<CommentRecord> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/comments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await readResponseError(response, "comment 수정 실패");
  return (await response.json()) as CommentRecord;
}

async function deleteComment(reqId: string, id: string): Promise<void> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/comments/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok && response.status !== 204) throw await readResponseError(response, "comment 삭제 실패");
}

async function fetchHighlights(reqId: string): Promise<HighlightsFile> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/highlights`);
  if (!response.ok) throw await readResponseError(response, "highlights 조회 실패");
  return (await response.json()) as HighlightsFile;
}

async function postHighlight(reqId: string, input: CreateHighlightInput): Promise<HighlightRecord> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw await readResponseError(response, "highlight 생성 실패");
  return (await response.json()) as HighlightRecord;
}

async function deleteHighlight(reqId: string, id: string): Promise<void> {
  const response = await fetch(`/api/af-collab/${encodeURIComponent(reqId)}/highlights/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok && response.status !== 204) throw await readResponseError(response, "highlight 삭제 실패");
}

export function useComments(reqId: string | undefined) {
  return useQuery<CommentsFile>({
    queryKey: ["af", reqId, "comments"] as const,
    queryFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return fetchComments(reqId);
    },
    enabled: Boolean(reqId)
  });
}

export function useCreateComment(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return postComment(reqId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "comments"] })
  });
}

export function useUpdateComment(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Pick<CommentRecord, "body_md" | "status">> }) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return patchComment(reqId, id, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "comments"] })
  });
}

export function useDeleteComment(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      await deleteComment(reqId, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "comments"] })
  });
}

export function useHighlights(reqId: string | undefined) {
  return useQuery<HighlightsFile>({
    queryKey: ["af", reqId, "highlights"] as const,
    queryFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return fetchHighlights(reqId);
    },
    enabled: Boolean(reqId)
  });
}

export function useCreateHighlight(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHighlightInput) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return postHighlight(reqId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "highlights"] })
  });
}

export function useDeleteHighlight(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      await deleteHighlight(reqId, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "highlights"] })
  });
}
