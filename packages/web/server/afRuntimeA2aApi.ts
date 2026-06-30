import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeA2aManager } from "./runtimeA2a";
import { isRecord, readJsonBody, sendJson } from "./httpApi";
import { postFunctionResponseResume } from "./runtimeA2aProbe";

interface RuntimeA2aResumeRequest {
  readonly providerReqId: string;
  readonly taskId: string;
  readonly contextId: string;
  readonly interruptId: string;
  readonly functionName: string;
  readonly response: unknown;
}

export async function handleRuntimeA2a(
  runtimeA2a: RuntimeA2aManager,
  reqId: string,
  rest: string[],
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const [action] = rest;
  if (action === "status") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.status(reqId));
    return;
  }
  if (action === "agent-card") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.agentCard(reqId));
    return;
  }
  if (action === "install") {
    sendJson(res, 405, {
      error: "웹에서 ADK dependency 설치는 지원하지 않습니다. 공유 venv를 수동으로 준비하세요.",
      status: await runtimeA2a.status(reqId)
    });
    return;
  }
  if (action === "start") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.start(reqId));
    return;
  }
  if (action === "stop") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.stop(reqId));
    return;
  }
  if (action === "resume") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    const parsed = parseResumeRequest(await readJsonBody(req));
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return;
    }
    const provider = await runtimeA2a.agentCard(parsed.value.providerReqId);
    const result = await postFunctionResponseResume({
      url: provider.rpc_url,
      taskId: parsed.value.taskId,
      contextId: parsed.value.contextId,
      interruptId: parsed.value.interruptId,
      functionName: parsed.value.functionName,
      response: parsed.value.response
    });
    await runtimeA2a.recordMessageSendProbe(parsed.value.providerReqId, result.message_send_probe);
    sendJson(res, 200, {
      ok: true,
      provider_req_id: parsed.value.providerReqId,
      task_id: parsed.value.taskId,
      context_id: parsed.value.contextId,
      provider_status_code: result.provider_status_code,
      message_send_status: result.message_send_probe.status,
      provider_task_state: result.message_send_probe.taskState,
      message_send_resume: result.message_send_probe.resume,
      provider_body: result.provider_body
    });
    return;
  }
  sendJson(res, 404, { error: "알 수 없는 runtime-a2a 경로입니다." });
}

function parseResumeRequest(
  value: unknown
): { readonly ok: true; readonly value: RuntimeA2aResumeRequest } | { readonly ok: false; readonly error: string } {
  if (!isRecord(value)) return { ok: false, error: "요청 JSON 객체가 필요합니다." };
  const providerReqId = stringField(value.provider_req_id);
  const taskId = stringField(value.task_id);
  const contextId = stringField(value.context_id);
  const interruptId = stringField(value.interrupt_id);
  const functionName = stringField(value.function_name);
  if (!providerReqId) return { ok: false, error: "provider_req_id is required." };
  if (!taskId) return { ok: false, error: "task_id is required." };
  if (!contextId) return { ok: false, error: "context_id is required." };
  if (!interruptId) return { ok: false, error: "interrupt_id is required." };
  if (!functionName) return { ok: false, error: "function_name is required." };
  if (!Object.prototype.hasOwnProperty.call(value, "response")) return { ok: false, error: "response is required." };
  return {
    ok: true,
    value: {
      providerReqId,
      taskId,
      contextId,
      interruptId,
      functionName,
      response: value.response
    }
  };
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
