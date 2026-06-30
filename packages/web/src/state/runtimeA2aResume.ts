export interface RuntimeA2aResumeInput {
  readonly providerReqId: string;
  readonly taskId: string;
  readonly contextId: string;
  readonly interruptId: string;
  readonly functionName: string;
  readonly response: unknown;
}

export interface RuntimeA2aResumeResult {
  readonly ok: true;
  readonly provider_req_id: string;
  readonly task_id: string;
  readonly context_id: string;
  readonly provider_status_code: number;
  readonly message_send_status: "not_checked" | "ready" | "working" | "interactive_required" | "failed";
  readonly provider_task_state: string | null;
  readonly message_send_resume: unknown | null;
  readonly provider_body: unknown;
}

export type RuntimeA2aResumePostResult =
  | {
      readonly ok: true;
      readonly value: RuntimeA2aResumeResult;
    }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly body: unknown;
    };

export interface RuntimeResumeQueryInvalidator {
  invalidateQueries(input: { readonly queryKey: readonly unknown[] }): unknown;
}

export async function postRuntimeA2aResumeRequest(reqId: string, input: RuntimeA2aResumeInput): Promise<RuntimeA2aResumePostResult> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-a2a/resume`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider_req_id: input.providerReqId,
      task_id: input.taskId,
      context_id: input.contextId,
      interrupt_id: input.interruptId,
      function_name: input.functionName,
      response: input.response
    })
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: responseErrorMessage(body) ?? "Workbench resume 전송 실패",
      body
    };
  }
  const parsed = parseRuntimeA2aResumeResult(body);
  if (!parsed) {
    return {
      ok: false,
      status: response.status,
      error: "Workbench resume 응답 형식이 올바르지 않습니다.",
      body
    };
  }
  return {
    ok: true,
    value: parsed
  };
}

export function invalidateRuntimeA2aResumeQueries(
  queryClient: RuntimeResumeQueryInvalidator,
  reqId: string,
  providerReqId: string
): void {
  queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-chat"] });
  queryClient.invalidateQueries({ queryKey: ["af", providerReqId, "runtime-a2a"] });
}

function responseErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const error = "error" in body ? body.error : null;
  return typeof error === "string" && error.trim() ? error : null;
}

function parseRuntimeA2aResumeResult(body: unknown): RuntimeA2aResumeResult | null {
  if (!isRecord(body)) return null;
  if (body.ok !== true) return null;
  if (typeof body.provider_req_id !== "string") return null;
  if (typeof body.task_id !== "string") return null;
  if (typeof body.context_id !== "string") return null;
  if (typeof body.provider_status_code !== "number") return null;
  if (!isMessageSendStatus(body.message_send_status)) return null;
  return {
    ok: true,
    provider_req_id: body.provider_req_id,
    task_id: body.task_id,
    context_id: body.context_id,
    provider_status_code: body.provider_status_code,
    message_send_status: body.message_send_status,
    provider_task_state: typeof body.provider_task_state === "string" ? body.provider_task_state : null,
    message_send_resume: body.message_send_resume ?? null,
    provider_body: body.provider_body
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMessageSendStatus(value: unknown): value is RuntimeA2aResumeResult["message_send_status"] {
  return value === "not_checked" || value === "ready" || value === "working" || value === "interactive_required" || value === "failed";
}
