import { isRecord } from "./runtimeProcessControl";
import type { RuntimeA2aMessageSendResume } from "./runtimeA2aTypes";

export interface ExtractedMessageSendResume {
  readonly resume: RuntimeA2aMessageSendResume | null;
  readonly prompt: string | null;
  readonly payload: string | null;
}

interface FunctionCallExtraction {
  readonly interruptId: string;
  readonly functionName: string;
  readonly responseSchema: unknown | null;
  readonly prompt: string | null;
  readonly payload: string | null;
}

export function extractMessageSendResume(result: Record<string, unknown>): ExtractedMessageSendResume {
  const taskId = stringField(result.id);
  const contextId = stringField(result.contextId);
  const status = result.status;
  const functionCall = isRecord(status) ? extractFunctionCall(status.message) : null;
  if (!taskId || !contextId || !functionCall) {
    return { resume: null, prompt: functionCall?.prompt ?? null, payload: functionCall?.payload ?? null };
  }
  return {
    resume: {
      task_id: taskId,
      context_id: contextId,
      interrupt_id: functionCall.interruptId,
      function_name: functionCall.functionName,
      response_schema: functionCall.responseSchema
    },
    prompt: functionCall.prompt,
    payload: functionCall.payload
  };
}

function extractFunctionCall(value: unknown): FunctionCallExtraction | null {
  if (!isRecord(value)) return null;
  const fromData = extractFunctionCallData(value);
  if (fromData) return fromData;
  const parts = value.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const nested = extractFunctionCall(part);
    if (nested) return nested;
  }
  return null;
}

function extractFunctionCallData(value: Record<string, unknown>): FunctionCallExtraction | null {
  const metadata = value.metadata;
  const data = value.data;
  if (!isRecord(metadata) || metadata.adk_type !== "function_call" || !isRecord(data)) return null;
  const interruptId = stringField(data.id);
  const functionName = stringField(data.name);
  if (!interruptId || !functionName) return null;
  const args = isRecord(data.args) ? data.args : {};
  return {
    interruptId,
    functionName,
    responseSchema: args.response_schema ?? null,
    prompt: stringField(args.message) || null,
    payload: stringField(args.payload) || null
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}
