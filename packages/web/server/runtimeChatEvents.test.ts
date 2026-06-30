import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractRemoteInputRequiredFromAdkEvents } from "./runtimeChatEvents.ts";
import { runtimeChatInputRequiredFromStatus } from "./runtimeChatInputRequired.ts";
import type { RuntimeChatStatus } from "./runtimeChat.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-chat-events-"));

try {
  const event = remoteInputRequiredEvent();

  const parsed = extractRemoteInputRequiredFromAdkEvents([event]);

  assert.deepEqual(parsed, {
    kind: "remote_input_required",
    prompt: "<strong>목적/시나리오 분류 확인</strong>",
    payload: "분류체계와 맞지 않습니다.",
    function_name: "adk_request_input",
    interrupt_id: "interrupt-1",
    task_id: "task-1",
    context_id: null,
    task_state: "input-required",
    remote_path: "consumer@1/provider@1",
    response_schema: { type: "string" },
    resume_supported: false,
    resume_note: "현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다."
  });

  const resumable = extractRemoteInputRequiredFromAdkEvents([remoteInputRequiredEvent({ contextId: "ctx-1" })]);
  assert.equal(resumable?.task_id, "task-1");
  assert.equal(resumable?.context_id, "ctx-1");
  assert.equal(resumable?.interrupt_id, "interrupt-1");
  assert.equal(resumable?.function_name, "adk_request_input");
  assert.deepEqual(resumable?.response_schema, { type: "string" });
  assert.equal(resumable?.resume_supported, true);

  const stubDir = join(repoRoot, "artifacts/af/req-chat/runtime-stub");
  await mkdir(stubDir, { recursive: true });
  await writeFile(
    join(stubDir, "runtime-chat-smoke.json"),
    `${JSON.stringify({ appName: "consumer_app", userId: "af-reviewer", sessionId: "af-smoke" }, null, 2)}\n`,
    "utf8"
  );
  const server = createServer((request, response) => {
    handleSessionRequest(request, response, event);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await runtimeChatInputRequiredFromStatus(runtimeChatStatus(stubDir, address.port));

    assert.equal(result.session?.user_id, "af-reviewer");
    assert.equal(result.session?.session_id, "af-smoke");
    assert.equal(result.input_required?.prompt, "<strong>목적/시나리오 분류 확인</strong>");
    assert.equal(result.input_required?.task_state, "input-required");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}

function remoteInputRequiredEvent(input: { readonly contextId?: string } = {}): Record<string, unknown> {
  return {
    content: {
      parts: [
        {
          functionCall: {
            id: "interrupt-1",
            name: "adk_request_input",
            args: {
              message: "<strong>목적/시나리오 분류 확인</strong>",
              payload: "분류체계와 맞지 않습니다.",
              response_schema: { type: "string" }
            }
          },
          partMetadata: { adk_type: "function_call", adk_is_long_running: true }
        }
      ],
      role: "model"
    },
    customMetadata: {
      "a2a:task_id": "task-1",
      "a2a:response": {
        ...(input.contextId ? { contextId: input.contextId } : {}),
        status: { state: "input-required" }
      }
    },
    longRunningToolIds: ["interrupt-1"],
    nodeInfo: { path: "consumer@1/provider@1" }
  };
}

function handleSessionRequest(request: IncomingMessage, response: ServerResponse, event: Record<string, unknown>): void {
  if (request.method !== "GET" || request.url !== "/apps/consumer_app/users/af-reviewer/sessions/af-smoke") {
    response.statusCode = 404;
    response.end("{}");
    return;
  }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ id: "af-smoke", events: [event] }));
}

function runtimeChatStatus(stubDir: string, port: number): RuntimeChatStatus {
  return {
    port,
    host: "127.0.0.1",
    api_base_url: `http://127.0.0.1:${port}`,
    web_url: `http://127.0.0.1:${port}`,
    app_name: "consumer_app",
    installed: true,
    install_supported: false,
    setup_hint: "",
    paths: {
      runtime_stub_dir: stubDir,
      venv: join(repoRoot, ".venv"),
      python: join(repoRoot, ".venv/bin/python"),
      adk: join(repoRoot, ".venv/bin/adk")
    },
    server: {
      status: "running",
      pid: 1234,
      managed: true,
      owner_matches_runtime: true,
      can_stop: true,
      stale: false,
      started_stub_fingerprint: "fingerprint",
      current_stub_fingerprint: "fingerprint",
      message: null,
      port_owner_pid: null,
      port_owner_command: null,
      exit_code: null,
      stdout_tail: "",
      stderr_tail: ""
    }
  };
}
