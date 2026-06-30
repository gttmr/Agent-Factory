import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export interface RuntimeChatStatus {
  port: number;
  host: string;
  api_base_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
  install_supported: boolean;
  setup_hint: string;
  paths: {
    runtime_stub_dir: string;
    venv: string;
    python: string;
    adk: string;
  };
  server: {
    status: "stopped" | "running" | "failed";
    pid: number | null;
    managed: boolean;
    owner_matches_runtime: boolean;
    can_stop: boolean;
    stale: boolean;
    started_stub_fingerprint: string | null;
    current_stub_fingerprint: string | null;
    message: string | null;
    port_owner_pid: number | null;
    port_owner_command: string | null;
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

export interface RuntimeChatRemoteInputRequired {
  readonly kind: "remote_input_required";
  readonly prompt: string;
  readonly payload: string | null;
  readonly function_name: string;
  readonly interrupt_id: string | null;
  readonly task_id: string | null;
  readonly task_state: string | null;
  readonly remote_path: string | null;
  readonly resume_supported: false;
  readonly resume_note: string;
}

export interface RuntimeChatInputRequiredResult {
  readonly input_required: RuntimeChatRemoteInputRequired | null;
  readonly session: {
    readonly app_name: string;
    readonly user_id: string;
    readonly session_id: string;
  } | null;
  readonly error: string | null;
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

export function useRuntimeChatInputRequired(reqId: string | undefined) {
  return useQuery<RuntimeChatInputRequiredResult | null>({
    queryKey: ["af", reqId, "runtime-chat", "input-required"] as const,
    queryFn: async () => {
      if (!reqId) return null;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-chat/input-required`);
      if (response.status === 404) return null;
      if (!response.ok) throw new AfApiError(response.status, "ADK input-required 이벤트 조회 실패");
      return (await response.json()) as RuntimeChatInputRequiredResult;
    },
    enabled: Boolean(reqId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true
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
      const body = (await response.json()) as { ok: boolean; message: string | null; status: RuntimeChatStatus; error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK runtime 중지 실패", body);
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-chat"] })
  });
}
