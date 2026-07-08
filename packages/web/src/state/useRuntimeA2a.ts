import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LocalA2AAgentCard } from "../analyzer/localA2aProvider";
import { AfApiError } from "./apiClient";
import type { MockLabPrerequisiteEntry } from "./useRuntimeChat";
import {
  invalidateRuntimeA2aResumeQueries,
  postRuntimeA2aResumeRequest,
  type RuntimeA2aResumeInput,
  type RuntimeA2aResumeResult
} from "./runtimeA2aResume";

export interface RuntimeA2aStatus {
  port: number;
  host: string;
  rpc_url: string;
  agent_card_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
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
    can_stop: boolean;
    stale: boolean;
    agent_card_ready: boolean;
    agent_card_status_code: number | null;
    message_send_ready: boolean;
    message_send_status: "not_checked" | "ready" | "working" | "interactive_required" | "failed";
    message_send_task_state: string | null;
    message_send_resume: RuntimeA2aMessageSendResume | null;
    mock_lab_prerequisites: MockLabPrerequisiteEntry[];
    message: string | null;
    started_stub_fingerprint: string | null;
    current_stub_fingerprint: string | null;
    stdout_tail: string;
    stderr_tail: string;
  };
}

export interface RuntimeA2aMessageSendResume {
  readonly task_id: string;
  readonly context_id: string;
  readonly interrupt_id: string;
  readonly function_name: string;
  readonly response_schema: unknown | null;
}

export interface RuntimeA2aAgentCardResult {
  provider_req_id: string;
  app_name: string;
  rpc_url: string;
  agent_card_url: string;
  card: LocalA2AAgentCard;
}

export interface RuntimeA2aStartResult {
  ok: boolean;
  command: string;
  status: RuntimeA2aStatus;
}

export function useRuntimeA2aStatus(reqId: string | undefined) {
  return useQuery<RuntimeA2aStatus | null>({
    queryKey: ["af", reqId, "runtime-a2a", "status"] as const,
    queryFn: async () => {
      if (!reqId) return null;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-a2a/status`);
      if (response.status === 404) return null;
      if (!response.ok) throw new AfApiError(response.status, "ADK A2A provider 상태 조회 실패");
      return (await response.json()) as RuntimeA2aStatus;
    },
    enabled: Boolean(reqId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  });
}

export function useResumeRuntimeA2a(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RuntimeA2aResumeInput) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const result = await postRuntimeA2aResumeRequest(reqId, input);
      if (!result.ok) throw new AfApiError(result.status, result.error, result.body);
      return result.value satisfies RuntimeA2aResumeResult;
    },
    onSuccess: (_result, input) => {
      if (reqId) invalidateRuntimeA2aResumeQueries(queryClient, reqId, input.providerReqId);
    }
  });
}

export function useStartRuntimeA2a(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-a2a/start`, { method: "POST" });
      const body = (await response.json()) as RuntimeA2aStartResult & { error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK A2A provider 시작 실패", body);
      if (!body.ok) throw new AfApiError(response.status, body.status.server.message ?? "ADK A2A provider 시작 실패", body);
      return body;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-a2a"] })
  });
}

export function useStopRuntimeA2a(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-a2a/stop`, { method: "POST" });
      const body = (await response.json()) as { ok: boolean; message: string | null; status: RuntimeA2aStatus; error?: string };
      if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK A2A provider 중지 실패", body);
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-a2a"] })
  });
}

export async function fetchRuntimeA2aAgentCard(reqId: string): Promise<RuntimeA2aAgentCardResult> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-a2a/agent-card`);
  const body = (await response.json()) as RuntimeA2aAgentCardResult & { error?: string };
  if (!response.ok) throw new AfApiError(response.status, body.error ?? "ADK A2A Agent Card 조회 실패", body);
  return body;
}
