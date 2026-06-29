import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { streamServerEvents, type ProcessStreamEvent } from "./useStreamingProcess";
import type { ScaffoldOutputMode } from "../analyzer/types";

export type ArtifactSyncBeforeStatus = "stale" | "missing" | "unchanged";
export type ArtifactSyncAfterStatus = "synced" | "unchanged";
export type ArtifactSyncDriftStatus = ArtifactSyncBeforeStatus | ArtifactSyncAfterStatus;

export interface ArtifactSyncDriftEntry {
  readonly path: string;
  readonly status: ArtifactSyncDriftStatus;
}

export interface ArtifactSyncProcessResult {
  readonly ok: boolean;
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
  readonly command_key?: string;
  readonly files?: readonly { readonly path: string; readonly bytes: number }[];
}

export interface ArtifactSyncRunResult {
  readonly ok: boolean;
  readonly requirement_id: string;
  readonly output_mode: ScaffoldOutputMode;
  readonly drift: {
    readonly before: readonly ArtifactSyncDriftEntry[];
    readonly after: readonly ArtifactSyncDriftEntry[];
  };
  readonly artifacts_written: readonly string[];
  readonly generation?: ArtifactSyncProcessResult;
  readonly validation?: ArtifactSyncProcessResult;
  readonly error?: string;
}

export interface ArtifactSyncRunOptions {
  readonly outputMode?: ScaffoldOutputMode;
  readonly rebuildRuntimeStub?: boolean;
  readonly runValidation?: boolean;
  readonly streamProgress?: boolean;
  readonly onEvent?: (event: ProcessStreamEvent) => void;
}

export class ArtifactSyncError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ArtifactSyncError";
    this.status = status;
    this.details = details;
  }
}

interface ArtifactSyncRunBody {
  readonly outputMode?: ScaffoldOutputMode;
  readonly rebuildRuntimeStub: boolean;
  readonly runValidation: boolean;
  readonly streamProgress?: true;
}

export async function runArtifactSync(
  reqId: string,
  options: ArtifactSyncRunOptions = {}
): Promise<ArtifactSyncRunResult> {
  const body = buildArtifactSyncRunBody(options);
  if (options.streamProgress) {
    const result = await streamServerEvents<unknown>(
      `/api/af/${encodeURIComponent(reqId)}/artifact-sync/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      },
      options.onEvent
    );
    return parseArtifactSyncRunResult(result);
  }

  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/artifact-sync/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json();
  if (!response.ok && !isArtifactSyncLike(payload)) {
    const message = readErrorMessage(payload) ?? "artifact sync 실행 실패";
    throw new ArtifactSyncError(response.status, message, payload);
  }
  return parseArtifactSyncRunResult(payload);
}

export function useArtifactSync(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (options?: ArtifactSyncRunOptions): Promise<ArtifactSyncRunResult> => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return await runArtifactSync(reqId, options ?? {});
    },
    onSuccess: (result) => invalidateArtifactSyncSuccessQueries(queryClient, reqId, result)
  });
}

export async function invalidateArtifactSyncSuccessQueries(
  queryClient: QueryClient,
  reqId: string | undefined,
  result: ArtifactSyncRunResult
): Promise<void> {
  if (!reqId) return;
  const queryNames = artifactSyncInvalidationQueryNames(result);
  if (queryNames.length === 0) return;
  await Promise.all(queryNames.map((name) => queryClient.invalidateQueries({ queryKey: ["af", reqId, name] })));
}

type ArtifactSyncInvalidationQueryName = "analysis-result" | "scaffold-plan" | "runtime-stub" | "manifest";

function artifactSyncInvalidationQueryNames(
  result: ArtifactSyncRunResult
): readonly ArtifactSyncInvalidationQueryName[] {
  if (result.ok) return ["analysis-result", "scaffold-plan", "runtime-stub", "manifest"];
  const names = new Set<ArtifactSyncInvalidationQueryName>();
  if (result.artifacts_written.length > 0) names.add("scaffold-plan");
  if (result.generation) names.add("runtime-stub");
  if (result.validation) names.add("manifest");
  return [...names];
}

function buildArtifactSyncRunBody(options: ArtifactSyncRunOptions): ArtifactSyncRunBody {
  return {
    ...(options.outputMode ? { outputMode: options.outputMode } : {}),
    rebuildRuntimeStub: options.rebuildRuntimeStub ?? true,
    runValidation: options.runValidation ?? true,
    ...(options.streamProgress ? { streamProgress: true } : {})
  };
}

function parseArtifactSyncRunResult(value: unknown): ArtifactSyncRunResult {
  if (!isRecord(value)) {
    throw new ArtifactSyncError(500, "artifact sync 응답이 객체가 아닙니다.", value);
  }
  const outputMode = value.output_mode === "runnable" ? "runnable" : "smoke";
  const drift = isRecord(value.drift) ? value.drift : {};
  return {
    ok: value.ok === true,
    requirement_id: typeof value.requirement_id === "string" ? value.requirement_id : "",
    output_mode: outputMode,
    drift: {
      before: parseDriftEntries(drift.before),
      after: parseDriftEntries(drift.after)
    },
    artifacts_written: parseStringArray(value.artifacts_written),
    ...(isRecord(value.generation) ? { generation: parseProcessResult(value.generation) } : {}),
    ...(isRecord(value.validation) ? { validation: parseProcessResult(value.validation) } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {})
  };
}

function parseProcessResult(value: Record<string, unknown>): ArtifactSyncProcessResult {
  return {
    ok: value.ok === true,
    exit_code: typeof value.exit_code === "number" ? value.exit_code : 0,
    stdout: typeof value.stdout === "string" ? value.stdout : "",
    stderr: typeof value.stderr === "string" ? value.stderr : "",
    command: typeof value.command === "string" ? value.command : "",
    ...(typeof value.command_key === "string" ? { command_key: value.command_key } : {}),
    ...(Array.isArray(value.files) ? { files: parseFileEntries(value.files) } : {})
  };
}

function parseFileEntries(values: readonly unknown[]): readonly { readonly path: string; readonly bytes: number }[] {
  return values.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || typeof entry.bytes !== "number") return [];
    return [{ path: entry.path, bytes: entry.bytes }];
  });
}

function parseDriftEntries(value: unknown): readonly ArtifactSyncDriftEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || !isDriftStatus(entry.status)) return [];
    return [{ path: entry.path, status: entry.status }];
  });
}

function parseStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function isArtifactSyncLike(value: unknown): boolean {
  return isRecord(value) && typeof value.ok === "boolean" && isRecord(value.drift);
}

function readErrorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

function isDriftStatus(value: unknown): value is ArtifactSyncDriftStatus {
  return value === "stale" || value === "missing" || value === "unchanged" || value === "synced";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
