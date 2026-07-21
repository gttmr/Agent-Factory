import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";
import { streamServerEvents, type ProcessStreamEvent } from "./useStreamingProcess";

export interface VerifyCommandInfo {
  key: string;
  label: string;
  description: string;
}

export const VERIFY_COMMANDS: VerifyCommandInfo[] = [
  {
    key: "validate_artifact_root",
    label: "validate-artifacts.mjs",
    description: "현재 artifact root 의 모든 산출물을 schema 로 검증합니다."
  },
  {
    key: "validate_generated_runtime",
    label: "generated runtime smoke",
    description: "생성 Python을 compile하고 bundle의 계약·import pytest를 실행합니다."
  },
  {
    key: "build_web",
    label: "npm run build (packages/web)",
    description: "tsc --noEmit 과 vite build 를 실행하여 TS 회귀를 잡습니다."
  },
  {
    key: "test_analyzer",
    label: "npm run test:analyzer",
    description: "analyzer 단위 테스트를 실행합니다."
  }
];

export interface VerifyRunResult {
  ok: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  command: string;
  command_key: string;
}

export interface RunVerifyOptions {
  commandKey: string;
  streamProgress?: boolean;
  onEvent?: (event: ProcessStreamEvent) => void;
}

export function useRunVerify(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | RunVerifyOptions): Promise<VerifyRunResult> => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const options: RunVerifyOptions = typeof input === "string" ? { commandKey: input } : input;
      const commandKey = options.commandKey;
      if (options.streamProgress) {
        return await streamServerEvents<VerifyRunResult>(
          `/api/af/${encodeURIComponent(reqId)}/verify/run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: commandKey, streamProgress: true })
          },
          options.onEvent
        );
      }
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/verify/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandKey })
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (response.status === 422) {
        return body as unknown as VerifyRunResult;
      }
      if (!response.ok) {
        throw new AfApiError(response.status, typeof body.error === "string" ? body.error : "verify 실행 실패");
      }
      return body as unknown as VerifyRunResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] })
  });
}
