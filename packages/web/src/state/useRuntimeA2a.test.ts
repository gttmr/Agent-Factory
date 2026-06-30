import assert from "node:assert/strict";
import { invalidateRuntimeA2aResumeQueries, postRuntimeA2aResumeRequest } from "./runtimeA2aResume";

const originalFetch = globalThis.fetch;

try {
  await assertResumePostsStructuredWorkbenchResponse();
  await assertResumeSurfacesEndpointErrorMessage();
  assertResumeInvalidatesRuntimeAndChatStatus();
} finally {
  globalThis.fetch = originalFetch;
}

async function assertResumePostsStructuredWorkbenchResponse(): Promise<void> {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedBody: unknown = null;
  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedMethod = init?.method ?? "GET";
    capturedBody = JSON.parse(String(init?.body));
    return Response.json({
      ok: true,
      provider_req_id: "provider-1",
      task_id: "task-1",
      context_id: "ctx-1",
      provider_status_code: 200,
      message_send_status: "ready",
      provider_task_state: "completed",
      message_send_resume: null,
      provider_body: { result: { status: { state: "completed" } } }
    });
  };

  const result = await postRuntimeA2aResumeRequest("consumer-1", {
    providerReqId: "provider-1",
    taskId: "task-1",
    contextId: "ctx-1",
    interruptId: "interrupt-1",
    functionName: "adk_request_input",
    response: "<b>확인했습니다</b>"
  });

  assert.equal(capturedUrl, "/api/af/consumer-1/runtime-a2a/resume");
  assert.equal(capturedMethod, "POST");
  assert.deepEqual(capturedBody, {
    provider_req_id: "provider-1",
    task_id: "task-1",
    context_id: "ctx-1",
    interrupt_id: "interrupt-1",
    function_name: "adk_request_input",
    response: "<b>확인했습니다</b>"
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      ok: true,
      provider_req_id: "provider-1",
      task_id: "task-1",
      context_id: "ctx-1",
      provider_status_code: 200,
      message_send_status: "ready",
      provider_task_state: "completed",
      message_send_resume: null,
      provider_body: { result: { status: { state: "completed" } } }
    }
  });
}

async function assertResumeSurfacesEndpointErrorMessage(): Promise<void> {
  globalThis.fetch = async () => Response.json({ error: "context_id is required." }, { status: 400 });

  const result = await postRuntimeA2aResumeRequest("consumer-1", {
    providerReqId: "provider-1",
    taskId: "task-1",
    contextId: "",
    interruptId: "interrupt-1",
    functionName: "adk_request_input",
    response: "확인했습니다"
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "context_id is required.",
    body: { error: "context_id is required." }
  });
}

function assertResumeInvalidatesRuntimeAndChatStatus(): void {
  const invalidatedKeys: Array<readonly unknown[]> = [];
  const queryClient = {
    invalidateQueries: (input: { readonly queryKey: readonly unknown[] }) => {
      invalidatedKeys.push(input.queryKey);
    }
  };

  invalidateRuntimeA2aResumeQueries(queryClient, "consumer-1", "provider-1");

  assert.deepEqual(invalidatedKeys, [
    ["af", "consumer-1", "runtime-chat"],
    ["af", "provider-1", "runtime-a2a"]
  ]);
}
