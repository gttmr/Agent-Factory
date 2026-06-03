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
    enabled: Boolean(reqId),
    // ADK 프로세스는 UI 밖에서도 죽거나 멈출 수 있어, server.status / web_url 이
    // stale 해지지 않도록 주기적으로 갱신한다(특히 '실행' 화면의 dev UI 링크).
    refetchInterval: 5000,
    refetchOnWindowFocus: true
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

// NOTE: AF 자체 간이 챗(세션/메시지)은 제거됐다 — 실행 화면이 ADK 공식 dev UI 로 링크한다.
// 클라이언트 훅(useCreateRuntimeChatSession / useSendRuntimeChatMessage)과 서버
// /runtime-chat/{session,message} 엔드포인트(RuntimeChatManager.createSession/sendMessage)도
// 함께 삭제했다. status/install/start/stop 만 남는다.
