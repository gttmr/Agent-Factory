import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Button } from "../../ui/primitives";
import { AfApiError } from "../../state/apiClient";

export interface MockLabPrerequisiteEntry {
  readonly mock_server_id: string;
  readonly status: "missing" | "stopped" | "running";
  readonly running: boolean;
  readonly start_action: {
    readonly method: "POST";
    readonly url: string;
  };
}

interface MockLabPrerequisiteRowsProps {
  readonly prerequisites: readonly MockLabPrerequisiteEntry[] | null | undefined;
  readonly invalidateQueryKeys: readonly QueryKey[];
  readonly onActionMessage: (message: string | null) => void;
}

export function MockLabPrerequisiteRows({ prerequisites, invalidateQueryKeys, onActionMessage }: MockLabPrerequisiteRowsProps) {
  const queryClient = useQueryClient();
  const prerequisiteList = prerequisites ?? [];
  const visiblePrerequisites = prerequisiteList.filter((prerequisite) => !prerequisite.running);
  const allReady = prerequisiteList.length > 0 && visiblePrerequisites.length === 0;
  const startMockLab = useMutation({
    mutationFn: async (prerequisite: MockLabPrerequisiteEntry) => {
      const response = await fetch(prerequisite.start_action.url, { method: prerequisite.start_action.method });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new AfApiError(response.status, errorMessage(body) ?? "Mock Lab 시작 실패", body);
      }
      return prerequisite.mock_server_id;
    },
    onSuccess: async (mockServerId) => {
      onActionMessage(`Mock Lab 시작 요청 완료: ${mockServerId}`);
      await Promise.all(invalidateQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => onActionMessage(error instanceof Error ? error.message : "Mock Lab 시작 실패")
  });

  if (!allReady && visiblePrerequisites.length === 0) return null;

  return (
    <div className="af-run-prerequisites" role="status" aria-live="polite">
      {allReady ? <span className="af-run-prerequisite-row af-run-prerequisite-row-ready">Mock Lab: 준비됨</span> : null}
      {visiblePrerequisites.map((prerequisite) => {
        const isPending = startMockLab.isPending && startMockLab.variables?.mock_server_id === prerequisite.mock_server_id;
        return (
          <span className="af-run-prerequisite-row" key={prerequisite.mock_server_id}>
            <span>
              Mock Lab: <code>{prerequisite.mock_server_id}</code> {statusLabel(prerequisite.status)}
            </span>
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => startMockLab.mutate(prerequisite)}>
              {isPending ? "시작 중…" : "시작"}
            </Button>
          </span>
        );
      })}
    </div>
  );
}

function statusLabel(status: MockLabPrerequisiteEntry["status"]): string {
  switch (status) {
    case "missing":
      return "없음";
    case "stopped":
      return "중지됨";
    case "running":
      return "준비됨";
  }
}

function errorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  return typeof body.error === "string" ? body.error : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
