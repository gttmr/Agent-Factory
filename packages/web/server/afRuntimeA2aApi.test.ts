import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ArtifactTestRequest,
  createRequester,
  createRoot,
  parseJsonBody,
  responseJson
} from "./artifactSyncTestHarness.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-a2a-api-"));
const originalA2aPort = process.env.AF_ADK_A2A_PORT;

try {
  await assertResumePostsFunctionResponseDataPart();
  await assertWorkingResumePollsTaskGetStatus();
  await assertResumeRejectsMissingContextWithoutProviderCall();
} finally {
  if (originalA2aPort === undefined) delete process.env.AF_ADK_A2A_PORT;
  else process.env.AF_ADK_A2A_PORT = originalA2aPort;
  await rm(repoRoot, { recursive: true, force: true });
}

async function assertResumePostsFunctionResponseDataPart(): Promise<void> {
  const receivedBodies: unknown[] = [];
  const provider = await startFakeProvider(receivedBodies);
  process.env.AF_ADK_A2A_PORT = String(provider.port);
  const request = createRequester(repoRoot);
  await prepareRuntimeRoots(request, { consumerReqId: "req-consumer-happy", providerReqId: "req-provider-happy" });
  await writeStaleRuntimeProcessRecord("req-provider-happy", provider.port);

  try {
    const response = responseJson<{
      readonly ok: boolean;
      readonly provider_req_id: string;
      readonly task_id: string;
      readonly context_id: string;
      readonly provider_status_code: number;
      readonly message_send_status: string;
      readonly provider_task_state: string | null;
      readonly message_send_resume: unknown;
    }>(
      await request({
        url: "/req-consumer-happy/runtime-a2a/resume",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          provider_req_id: "req-provider-happy",
          task_id: "task-1",
          context_id: "ctx-1",
          interrupt_id: "interrupt-1",
          function_name: "adk_request_input",
          response: { approved: true }
        }
      })
    );

    assert.equal(response.ok, true);
    assert.equal(response.provider_req_id, "req-provider-happy");
    assert.equal(response.task_id, "task-1");
    assert.equal(response.context_id, "ctx-1");
    assert.equal(response.provider_status_code, 200);
    assert.equal(response.message_send_status, "ready");
    assert.equal(response.provider_task_state, "completed");
    assert.equal(response.message_send_resume, null);
    assert.deepEqual(receivedBodies, [
      {
        id: "af-runtime-a2a-resume-interrupt-1",
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          configuration: { blocking: false },
          message: {
            kind: "message",
            messageId: "af-runtime-a2a-resume-message-interrupt-1",
            role: "user",
            taskId: "task-1",
            contextId: "ctx-1",
            parts: [
              {
                kind: "data",
                metadata: { adk_type: "function_response" },
                data: {
                  id: "interrupt-1",
                  name: "adk_request_input",
                  response: { result: { approved: true } }
                }
              }
            ]
          }
        }
      }
    ]);

    const status = responseJson<{ readonly server: { readonly message_send_status: string; readonly message_send_resume: unknown } }>(
      await request({ url: "/req-provider-happy/runtime-a2a/status", method: "GET" })
    );
    assert.equal(status.server.message_send_status, "ready");
    assert.equal(status.server.message_send_resume, null);
  } finally {
    await provider.close();
  }
}

async function assertWorkingResumePollsTaskGetStatus(): Promise<void> {
  const receivedBodies: unknown[] = [];
  const provider = await startFakeProvider(receivedBodies, {
    resumeTaskState: "working",
    taskGetResult: {
      id: "task-1",
      contextId: "ctx-1",
      status: {
        state: "input-required",
        message: {
          parts: [
            {
              kind: "data",
              metadata: { adk_type: "function_call", adk_is_long_running: true },
              data: {
                id: "interrupt-2",
                name: "adk_request_input",
                args: {
                  message: "추가 분석을 수행할지 선택하세요.",
                  payload: "초기 추천 결과",
                  response_schema: null
                }
              }
            }
          ]
        }
      }
    }
  });
  process.env.AF_ADK_A2A_PORT = String(provider.port);
  const request = createRequester(repoRoot);
  await prepareRuntimeRoots(request, { consumerReqId: "req-consumer-working", providerReqId: "req-provider-working" });
  await writeStaleRuntimeProcessRecord("req-provider-working", provider.port);

  try {
    const resumeResponse = responseJson<{ readonly message_send_status: string }>(
      await request({
        url: "/req-consumer-working/runtime-a2a/resume",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          provider_req_id: "req-provider-working",
          task_id: "task-1",
          context_id: "ctx-1",
          interrupt_id: "interrupt-1",
          function_name: "adk_request_input",
          response: "확인했습니다"
        }
      })
    );
    assert.equal(resumeResponse.message_send_status, "working");

    const status = responseJson<{
      readonly server: {
        readonly message_send_status: string;
        readonly message_send_task_state: string | null;
        readonly message_send_resume: { readonly interrupt_id: string } | null;
      };
    }>(await request({ url: "/req-provider-working/runtime-a2a/status", method: "GET" }));

    assert.equal(status.server.message_send_status, "interactive_required");
    assert.equal(status.server.message_send_task_state, "input-required");
    assert.equal(status.server.message_send_resume?.interrupt_id, "interrupt-2");
    assert.ok(receivedBodies.some((body) => isRecord(body) && body.method === "tasks/get"));
  } finally {
    await provider.close();
  }
}

async function assertResumeRejectsMissingContextWithoutProviderCall(): Promise<void> {
  const receivedBodies: unknown[] = [];
  const provider = await startFakeProvider(receivedBodies);
  process.env.AF_ADK_A2A_PORT = String(provider.port);
  const request = createRequester(repoRoot);
  await prepareRuntimeRoots(request, { consumerReqId: "req-consumer-failure", providerReqId: "req-provider-failure" });

  try {
    const response = await request({
      url: "/req-consumer-failure/runtime-a2a/resume",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        provider_req_id: "req-provider-failure",
        task_id: "task-1",
        interrupt_id: "interrupt-1",
        function_name: "adk_request_input",
        response: "확인했습니다"
      }
    });

    assert.equal(response.status, 400);
    assert.match(parseJsonBody<{ readonly error: string }>(response).error, /context_id/);
    assert.deepEqual(receivedBodies, []);
  } finally {
    await provider.close();
  }
}

async function prepareRuntimeRoots(
  request: ArtifactTestRequest,
  input: { readonly consumerReqId: string; readonly providerReqId: string }
): Promise<void> {
  await createRoot(request, input.consumerReqId);
  await createRoot(request, input.providerReqId);
  const stubDir = join(repoRoot, "artifacts/af", input.providerReqId, "runtime-stub/provider_app");
  await mkdir(stubDir, { recursive: true });
  await writeFile(join(stubDir, "workflow_manifest.json"), `${JSON.stringify({ package: "provider_app" }, null, 2)}\n`, "utf8");
}

async function writeStaleRuntimeProcessRecord(providerReqId: string, port: number): Promise<void> {
  const stubDir = join(repoRoot, "artifacts/af", providerReqId, "runtime-stub");
  await mkdir(join(stubDir, ".adk"), { recursive: true });
  await writeFile(
    join(stubDir, ".adk/runtime-a2a-process.json"),
    `${JSON.stringify(
      {
        pid: process.pid,
        port,
        host: "127.0.0.1",
        appName: "provider_app",
        command: "fake provider",
        startedAt: new Date().toISOString(),
        lastMessageSendProbe: {
          status: "interactive_required",
          taskState: "input-required",
          message: "stale input required",
          resume: {
            task_id: "stale-task",
            context_id: "stale-context",
            interrupt_id: "stale-interrupt",
            function_name: "adk_request_input",
            response_schema: { type: "string" }
          },
          checkedAt: new Date().toISOString()
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

interface FakeProviderOptions {
  readonly resumeTaskState?: string;
  readonly taskGetResult?: Record<string, unknown>;
}

async function startFakeProvider(
  receivedBodies: unknown[],
  opts: FakeProviderOptions = {}
): Promise<{ readonly port: number; readonly close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    handleFakeProviderRequest(request, response, receivedBodies, opts);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    port: address.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

function handleFakeProviderRequest(
  request: IncomingMessage,
  response: ServerResponse,
  receivedBodies: unknown[],
  opts: FakeProviderOptions
): void {
  if (request.method === "GET" && request.url === "/a2a/provider_app/.well-known/agent-card.json") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name: "provider_app", skills: [] }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/a2a/provider_app") {
    response.statusCode = 404;
    response.end("{}");
    return;
  }
  let raw = "";
  request.on("data", (chunk) => {
    raw += String(chunk);
  });
  request.on("end", () => {
    const body: unknown = JSON.parse(raw);
    receivedBodies.push(body);
    response.setHeader("content-type", "application/json");
    const method = isRecord(body) ? body.method : null;
    const result =
      method === "tasks/get" && opts.taskGetResult
        ? opts.taskGetResult
        : { id: "task-1", contextId: "ctx-1", status: { state: opts.resumeTaskState ?? "completed" } };
    response.end(JSON.stringify({ id: isRecord(body) ? body.id : null, jsonrpc: "2.0", result }));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
