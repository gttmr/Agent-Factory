import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { invalidateArtifactSyncSuccessQueries, runArtifactSync, type ArtifactSyncRunResult } from "./useArtifactSync.ts";
import { streamServerEvents } from "./useStreamingProcess.ts";

const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
let capturedInit: RequestInit | undefined;

try {
  // Given: a direct JSON-mode artifact sync response with validation metadata.
  let jsonModeInput: string | URL | Request | undefined;
  let jsonModeInit: RequestInit | undefined;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    jsonModeInput = input;
    jsonModeInit = init;
    return Response.json({
      ok: true,
      requirement_id: "req-json",
      output_mode: "runnable",
      drift: {
        before: [{ path: "graph-ir.json", status: "stale" }],
        after: [{ path: "graph-ir.json", status: "synced" }]
      },
      artifacts_written: ["graph-ir.json", "scaffold-plan.json"],
      validation: {
        ok: true,
        exit_code: 0,
        stdout: "valid\n",
        stderr: "",
        command: "node scripts/validate-artifacts.mjs artifacts/af/req-json",
        command_key: "validate_artifact_root"
      }
    });
  };

  // When: runArtifactSync executes without streamProgress.
  const jsonModeResult = await runArtifactSync("req-json", {
    outputMode: "runnable",
    rebuildRuntimeStub: false,
    runValidation: true
  });

  // Then: it sends JSON mode options and parses the structured validation command key.
  assert.equal(String(jsonModeInput), "/api/af/req-json/artifact-sync/run");
  assert.equal(jsonModeInit?.method, "POST");
  assert.equal(new Headers(jsonModeInit?.headers).get("accept"), null);
  assert.deepEqual(JSON.parse(String(jsonModeInit?.body)), {
    outputMode: "runnable",
    rebuildRuntimeStub: false,
    runValidation: true
  });
  assert.equal(jsonModeResult.output_mode, "runnable");
  assert.equal(jsonModeResult.validation?.command_key, "validate_artifact_root");
  assert.deepEqual(jsonModeResult.drift.before, [{ path: "graph-ir.json", status: "stale" }]);

  // Given: a non-2xx artifact sync response that still carries the renderable result contract.
  globalThis.fetch = async (): Promise<Response> =>
    Response.json(
      {
        ok: false,
        requirement_id: "req-json",
        output_mode: "smoke",
        drift: {
          before: [{ path: "asset-candidates.json", status: "unchanged" }],
          after: [{ path: "asset-candidates.json", status: "unchanged" }]
        },
        artifacts_written: [],
        error: "validation 실패",
        validation: {
          ok: false,
          exit_code: 1,
          stdout: "",
          stderr: "schema error",
          command: "node scripts/validate-artifacts.mjs artifacts/af/req-json",
          command_key: "validate_artifact_root"
        }
      },
      { status: 422 }
    );

  // When: the server rejects after producing an artifact-sync result.
  const nonOkResult = await runArtifactSync("req-json", { runValidation: true });

  // Then: the caller receives a renderable failure result instead of a thrown transport error.
  assert.equal(nonOkResult.ok, false);
  assert.equal(nonOkResult.error, "validation 실패");
  assert.equal(nonOkResult.validation?.command_key, "validate_artifact_root");

  // Given: populated artifact queries for the same root.
  const queryClient = new QueryClient();
  const invalidationKeys = [
    ["af", "req-json", "analysis-result"],
    ["af", "req-json", "scaffold-plan"],
    ["af", "req-json", "runtime-stub"],
    ["af", "req-json", "manifest"]
  ];
  for (const key of invalidationKeys) {
    queryClient.setQueryData(key, { ok: true });
  }
  const successfulSync = {
    ok: true,
    requirement_id: "req-json",
    output_mode: "smoke",
    drift: { before: [], after: [] },
    artifacts_written: []
  } satisfies ArtifactSyncRunResult;

  // When: the hook success handler sees an ok result.
  await invalidateArtifactSyncSuccessQueries(queryClient, "req-json", successfulSync);

  // Then: only the four artifact-root queries required by the Build UI are invalidated.
  for (const key of invalidationKeys) {
    assert.equal(queryClient.getQueryState(key)?.isInvalidated, true);
  }

  // Given: fresh query state and a non-ok artifact sync result that still wrote derived artifacts and validation.
  for (const key of invalidationKeys) {
    queryClient.setQueryData(key, { ok: true });
    await queryClient.resetQueries({ queryKey: key, exact: true });
  }
  const partialWriteFailure = {
    ok: false,
    requirement_id: "req-json",
    output_mode: "smoke",
    drift: { before: [], after: [] },
    artifacts_written: ["scaffold-plan.json"],
    generation: {
      ok: false,
      exit_code: 1,
      stdout: "",
      stderr: "generation failed",
      command: "node scripts/generate-adk-source.mjs artifacts/af/req-json artifacts/af/req-json/runtime-stub"
    },
    validation: {
      ok: false,
      exit_code: 1,
      stdout: "",
      stderr: "schema error",
      command: "node scripts/validate-artifacts.mjs artifacts/af/req-json",
      command_key: "validate_artifact_root"
    },
    error: "validation 실패"
  } satisfies ArtifactSyncRunResult;

  // When: the hook success handler receives a non-ok result with side effects.
  await invalidateArtifactSyncSuccessQueries(queryClient, "req-json", partialWriteFailure);

  // Then: only affected artifact-root queries are invalidated so the UI cannot keep stale writes.
  assert.equal(queryClient.getQueryState(["af", "req-json", "analysis-result"])?.isInvalidated, false);
  assert.equal(queryClient.getQueryState(["af", "req-json", "scaffold-plan"])?.isInvalidated, true);
  assert.equal(queryClient.getQueryState(["af", "req-json", "runtime-stub"])?.isInvalidated, true);
  assert.equal(queryClient.getQueryState(["af", "req-json", "manifest"])?.isInvalidated, true);

  // Given: fresh query state and a pre-sync transport-like non-ok result with no side effects.
  for (const key of invalidationKeys) {
    queryClient.setQueryData(key, { ok: true });
    await queryClient.resetQueries({ queryKey: key, exact: true });
  }
  const preSyncFailure = {
    ok: false,
    requirement_id: "req-json",
    output_mode: "smoke",
    drift: { before: [], after: [] },
    artifacts_written: [],
    error: "권한 확인 실패"
  } satisfies ArtifactSyncRunResult;

  // When: the hook success handler receives a non-ok result with no persisted side effects.
  await invalidateArtifactSyncSuccessQueries(queryClient, "req-json", preSyncFailure);

  // Then: cached artifacts remain valid for renderable error inspection.
  for (const key of invalidationKeys) {
    assert.equal(queryClient.getQueryState(key)?.isInvalidated, false);
  }

  queryClient.clear();

  // Given: a generic SSE process response.
  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    capturedInit = init;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: start\ndata: {"command":"demo"}\n\n'));
        controller.enqueue(encoder.encode('event: stdout\ndata: {"chunk":"hello\\n"}\n\n'));
        controller.enqueue(encoder.encode('event: done\ndata: {"ok":true,"stdout":"hello\\n"}\n\n'));
        controller.close();
      }
    });
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    });
  };

  const events: string[] = [];

  // When: a streaming process helper reads SSE events.
  const result = await streamServerEvents<{ ok: boolean; stdout: string }>(
    "/api/demo",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamProgress: true })
    },
    (event) => events.push(event.event)
  );

  assert.deepEqual(events, ["start", "stdout", "done"]);
  assert.deepEqual(result, { ok: true, stdout: "hello\n" });
  assert.equal(new Headers(capturedInit?.headers).get("accept"), "text/event-stream");
  assert.equal(new Headers(capturedInit?.headers).get("content-type"), "application/json");

  // Given: artifact sync SSE emits intermediate sync and final validation metadata.
  let artifactSyncInput: string | URL | Request | undefined;
  let artifactSyncInit: RequestInit | undefined;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    artifactSyncInput = input;
    artifactSyncInit = init;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: sync\ndata: {"drift":{"before":[],"after":[]},"artifacts_written":[]}\n\n'));
        controller.enqueue(
          encoder.encode(
            'event: done\ndata: {"ok":true,"requirement_id":"req-demo","output_mode":"smoke","drift":{"before":[],"after":[]},"artifacts_written":[],"validation":{"ok":true,"exit_code":0,"stdout":"","stderr":"","command":"node scripts/validate-artifacts.mjs artifacts/af/req-demo","command_key":"validate_artifact_root"}}\n\n'
          )
        );
        controller.close();
      }
    });
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    });
  };

  const artifactSyncEvents: string[] = [];

  // When: artifact sync runs in SSE mode.
  const artifactSyncResult = await runArtifactSync("req-demo", {
    outputMode: "smoke",
    rebuildRuntimeStub: true,
    runValidation: true,
    streamProgress: true,
    onEvent: (event) => artifactSyncEvents.push(event.event)
  });

  assert.equal(String(artifactSyncInput), "/api/af/req-demo/artifact-sync/run");
  assert.equal(artifactSyncInit?.method, "POST");
  assert.equal(new Headers(artifactSyncInit?.headers).get("accept"), "text/event-stream");
  assert.deepEqual(JSON.parse(String(artifactSyncInit?.body)), {
    outputMode: "smoke",
    rebuildRuntimeStub: true,
    runValidation: true,
    streamProgress: true
  });
  assert.deepEqual(artifactSyncEvents, ["sync", "done"]);
  assert.equal(artifactSyncResult.ok, true);
  assert.equal(artifactSyncResult.output_mode, "smoke");
  assert.equal(artifactSyncResult.validation?.command_key, "validate_artifact_root");
} finally {
  globalThis.fetch = originalFetch;
}
