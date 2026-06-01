import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export interface RuntimeChatStatus {
  port: number;
  host: string;
  api_base_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
  paths: {
    runtime_stub_dir: string;
    python: string;
    adk: string;
  };
  server: {
    status: "stopped" | "running" | "failed";
    pid: number | null;
    exit_code: number | null;
    stdout_tail: string;
    stderr_tail: string;
  };
}

export interface RuntimeChatInstallResult {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  status: RuntimeChatStatus;
}

export interface RuntimeChatStartResult {
  ok: boolean;
  command: string;
  status: RuntimeChatStatus;
}

export interface RuntimeChatSessionResult {
  user_id: string;
  session_id: string;
  session: unknown;
}

export interface RuntimeChatMessageResult {
  user_id: string;
  session_id: string;
  events: unknown[];
  final_text: string;
}

export function useRuntimeChatStatus(reqId: string | undefined) {
  return useQuery<RuntimeChatStatus | null>({
    queryKey: ["af", reqId, "runtime-chat", "status"] as const,
    queryFn: async () => {
      if (!reqId) return null;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/status`);
      if (response.status === 404) return null;
      if (!response.ok) throw new AfApiError(response.status, "ADK runtime 상태 조회 실패");
      return (await response.json()) as RuntimeChatStatus;
    },
    enabled: Boolean(reqId)
  });
}

export function useInstallRuntimeChat(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/install`, { method: "POST" });
      const body = (await response.json()) as RuntimeChatInstallResult & { error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK dependency 설치 실패", body);
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-chat"] })
  });
}

export function useStartRuntimeChat(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/start`, { method: "POST" });
      const body = (await response.json()) as RuntimeChatStartResult & { error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK runtime 시작 실패", body);
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-chat"] })
  });
}

export function useStopRuntimeChat(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/stop`, { method: "POST" });
      const body = (await response.json()) as { ok: boolean; status: RuntimeChatStatus; error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK runtime 중지 실패", body);
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-chat"] })
  });
}

export function useCreateRuntimeChatSession(reqId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { user_id: string; session_id?: string }) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const body = (await response.json()) as RuntimeChatSessionResult & { error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK session 생성 실패", body);
      return body;
    }
  });
}

export function useSendRuntimeChatMessage(reqId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { user_id: string; session_id: string; text: string }) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const body = (await response.json()) as RuntimeChatMessageResult & { error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK message 전송 실패", body);
      return body;
    }
  });
}
