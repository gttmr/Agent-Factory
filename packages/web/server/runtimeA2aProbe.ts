import { isRecord } from "./runtimeProcessControl";
import { extractMessageSendResume } from "./runtimeA2aMessageSendResume";
import type { RuntimeA2aMessageSendResume, RuntimeA2aStatus } from "./runtimeA2aTypes";

const A2A_READINESS_TEXT = "Agent Factory A2A semantic readiness probe.";

export interface AgentCardProbe {
  readonly ready: boolean;
  readonly statusCode: number | null;
  readonly message: string | null;
}

export interface MessageSendProbe {
  readonly status: RuntimeA2aStatus["server"]["message_send_status"];
  readonly taskState: string | null;
  readonly message: string | null;
  readonly taskId: string | null;
  readonly contextId: string | null;
  readonly resume: RuntimeA2aMessageSendResume | null;
}

export interface FunctionResponseResumeInput {
  readonly url: string;
  readonly taskId: string;
  readonly contextId: string;
  readonly interruptId: string;
  readonly functionName: string;
  readonly response: unknown;
  readonly timeoutMs?: number;
}

export interface FunctionResponseResumeResult {
  readonly ok: true;
  readonly provider_status_code: number;
  readonly provider_body: unknown;
  readonly message_send_probe: MessageSendProbe;
}

export async function probeAgentCard(input: { readonly url: string; readonly appName: string; readonly timeoutMs: number }): Promise<AgentCardProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, { signal: controller.signal });
    if (!response.ok) {
      return unavailableAgentCardProbe(response.status, `Agent Card route returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || body.name !== input.appName || !Array.isArray(body.skills)) {
      return unavailableAgentCardProbe(response.status, "Agent Card route did not return the expected A2A Agent Card.");
    }
    return { ready: true, statusCode: response.status, message: null };
  } catch (error) {
    if (error instanceof Error) {
      return unavailableAgentCardProbe(null, `Agent Card route is not reachable: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function unavailableAgentCardProbe(statusCode: number | null, message = "Agent Card route is not available."): AgentCardProbe {
  return { ready: false, statusCode, message };
}

export async function probeMessageSend(input: { readonly url: string; readonly timeoutMs: number }): Promise<MessageSendProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "af-runtime-readiness-probe",
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          configuration: { blocking: true },
          message: {
            kind: "message",
            messageId: "af-runtime-readiness-probe-message",
            role: "user",
            parts: [{ kind: "text", text: A2A_READINESS_TEXT }]
          }
        }
      })
    });
    if (!response.ok) {
      return failedMessageSendProbe(null, null, null, `message/send route returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    return classifyMessageSendResponse(body);
  } catch (error) {
    if (error instanceof Error) {
      return failedMessageSendProbe(null, null, null, `message/send probe is not reachable: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeTaskGet(input: { readonly url: string; readonly taskId: string; readonly timeoutMs: number }): Promise<MessageSendProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: `af-runtime-task-get-${input.taskId}`,
        jsonrpc: "2.0",
        method: "tasks/get",
        params: { id: input.taskId, historyLength: 20 }
      })
    });
    if (!response.ok) {
      return failedMessageSendProbe(input.taskId, null, null, `tasks/get route returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    return classifyMessageSendResponse(body);
  } catch (error) {
    if (error instanceof Error) {
      return failedMessageSendProbe(input.taskId, null, null, `tasks/get probe is not reachable: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function postFunctionResponseResume(input: FunctionResponseResumeInput): Promise<FunctionResponseResumeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);
  try {
    const response = await fetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildFunctionResponseMessageSend(input))
    });
    const providerBody: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`A2A message/send resume returned HTTP ${response.status}.`);
    }
    if (isRecord(providerBody) && isRecord(providerBody.error)) {
      throw new Error(`A2A message/send resume returned JSON-RPC error: ${extractText(providerBody.error) ?? "unknown error"}`);
    }
    return {
      ok: true,
      provider_status_code: response.status,
      provider_body: providerBody,
      message_send_probe: classifyMessageSendResponse(providerBody)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildFunctionResponseMessageSend(input: FunctionResponseResumeInput): Record<string, unknown> {
  return {
    id: `af-runtime-a2a-resume-${input.interruptId}`,
    jsonrpc: "2.0",
    method: "message/send",
    params: {
      configuration: { blocking: false },
      message: {
        kind: "message",
        messageId: `af-runtime-a2a-resume-message-${input.interruptId}`,
        role: "user",
        taskId: input.taskId,
        contextId: input.contextId,
        parts: [
          {
            kind: "data",
            metadata: { adk_type: "function_response" },
            data: {
              id: input.interruptId,
              name: input.functionName,
              response: { result: input.response }
            }
          }
        ]
      }
    }
  };
}

export function notCheckedMessageSendProbe(): MessageSendProbe {
  return { status: "not_checked", taskState: null, message: null, taskId: null, contextId: null, resume: null };
}

function classifyMessageSendResponse(body: unknown): MessageSendProbe {
  if (!isRecord(body)) return failedMessageSendProbe(null, null, null, "message/send did not return a JSON-RPC object.");
  if (isRecord(body.error)) {
    return failedMessageSendProbe(null, null, null, `message/send returned JSON-RPC error: ${extractText(body.error) ?? "unknown error"}`);
  }
  const result = body.result;
  if (!isRecord(result)) return failedMessageSendProbe(null, null, null, "message/send did not return an A2A task result.");
  const taskId = stringField(result.id) || null;
  const contextId = stringField(result.contextId) || null;
  const status = result.status;
  if (!isRecord(status)) return failedMessageSendProbe(taskId, contextId, null, "message/send result is missing task status.");
  const state = status.state;
  if (typeof state !== "string" || !state.trim()) {
    return failedMessageSendProbe(taskId, contextId, null, "message/send task status is missing state.");
  }
  const message = extractText(status.message);
  if (state === "completed") {
    return { status: "ready", taskState: state, message, taskId, contextId, resume: null };
  }
  if (state === "working") {
    return { status: "working", taskState: state, message, taskId, contextId, resume: null };
  }
  if (state === "input-required" || state === "auth-required") {
    const extracted = extractMessageSendResume(result);
    return {
      status: "interactive_required",
      taskState: state,
      message: message ?? inputRequiredMessage(extracted.prompt, extracted.payload) ?? `message/send returned ${state}.`,
      taskId,
      contextId,
      resume: extracted.resume
    };
  }
  if (state === "failed") {
    return failedMessageSendProbe(taskId, contextId, state, message ?? "message/send task failed.");
  }
  return failedMessageSendProbe(taskId, contextId, state, `message/send returned unsupported task state: ${state}.`);
}

function failedMessageSendProbe(taskId: string | null, contextId: string | null, taskState: string | null, message: string): MessageSendProbe {
  return { status: "failed", taskState, message, taskId, contextId, resume: null };
}

function inputRequiredMessage(prompt: string | null, payload: string | null): string | null {
  return [prompt, payload].filter((value): value is string => Boolean(value)).join("\n") || null;
}

function extractText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!isRecord(value)) return null;
  const text = value.text;
  if (typeof text === "string" && text.trim()) return text;
  const message = value.message;
  if (typeof message === "string" && message.trim()) return message;
  const data = value.data;
  if (isRecord(data)) {
    const nested = extractText(data);
    if (nested) return nested;
  }
  const parts = value.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const nested = extractText(part);
    if (nested) return nested;
  }
  return null;
}

function stringField(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}
