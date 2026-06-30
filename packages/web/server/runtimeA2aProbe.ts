import { isRecord } from "./runtimeProcessControl";
import type { RuntimeA2aStatus } from "./runtimeA2aTypes";

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
      return failedMessageSendProbe(null, `message/send route returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    return classifyMessageSendResponse(body);
  } catch (error) {
    if (error instanceof Error) {
      return failedMessageSendProbe(null, `message/send probe is not reachable: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function notCheckedMessageSendProbe(): MessageSendProbe {
  return { status: "not_checked", taskState: null, message: null };
}

function classifyMessageSendResponse(body: unknown): MessageSendProbe {
  if (!isRecord(body)) return failedMessageSendProbe(null, "message/send did not return a JSON-RPC object.");
  if (isRecord(body.error)) {
    return failedMessageSendProbe(null, `message/send returned JSON-RPC error: ${extractText(body.error) ?? "unknown error"}`);
  }
  const result = body.result;
  if (!isRecord(result)) return failedMessageSendProbe(null, "message/send did not return an A2A task result.");
  const status = result.status;
  if (!isRecord(status)) return failedMessageSendProbe(null, "message/send result is missing task status.");
  const state = status.state;
  if (typeof state !== "string" || !state.trim()) return failedMessageSendProbe(null, "message/send task status is missing state.");
  const message = extractText(status.message);
  if (state === "completed") {
    return { status: "ready", taskState: state, message };
  }
  if (state === "input-required" || state === "auth-required") {
    return { status: "interactive_required", taskState: state, message: message ?? `message/send returned ${state}.` };
  }
  if (state === "failed") {
    return failedMessageSendProbe(state, message ?? "message/send task failed.");
  }
  return failedMessageSendProbe(state, `message/send returned unsupported task state: ${state}.`);
}

function failedMessageSendProbe(taskState: string | null, message: string): MessageSendProbe {
  return { status: "failed", taskState, message };
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
