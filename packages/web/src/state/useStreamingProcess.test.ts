import assert from "node:assert/strict";
import { streamServerEvents } from "./useStreamingProcess.ts";

const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
let capturedInit: RequestInit | undefined;

try {
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
} finally {
  globalThis.fetch = originalFetch;
}
