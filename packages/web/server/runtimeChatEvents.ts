export interface RemoteInputRequiredDisplayState {
  kind: "remote_input_required";
  prompt: string;
  payload: string | null;
  function_name: string;
  interrupt_id: string | null;
  task_id: string | null;
  context_id: string | null;
  task_state: string | null;
  remote_path: string | null;
  response_schema: unknown | null;
  resume_supported: boolean;
  resume_note: string;
}

const REMOTE_INPUT_RESUME_NOTE =
  "현재 Workbench/ADK Web 텍스트 채팅은 같은 원격 A2A task의 resume 경로로 검증되지 않았습니다.";

export function extractRemoteInputRequiredFromAdkEvents(events: readonly unknown[]): RemoteInputRequiredDisplayState | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!isRecord(event) || !isRemoteA2aEvent(event) || !isRecord(event.content) || !Array.isArray(event.content.parts)) {
      continue;
    }
    const longRunningToolIds = stringSet(event.longRunningToolIds);
    for (const part of event.content.parts) {
      const functionCall = remoteInputFunctionCall(part, longRunningToolIds);
      if (!functionCall) continue;
      const args = isRecord(functionCall.args) ? functionCall.args : null;
      const interruptId = nonEmptyString(functionCall.id) ?? (args ? nonEmptyString(args.interruptId) : null);
      const taskId = a2aTaskId(event);
      const contextId = a2aContextId(event);
      return {
        kind: "remote_input_required",
        prompt: inputPrompt(args) ?? "원격 A2A Agent가 사람 입력을 기다립니다.",
        payload: args ? nonEmptyString(args.payload) : null,
        function_name: functionCall.name,
        interrupt_id: interruptId,
        task_id: taskId,
        context_id: contextId,
        task_state: a2aTaskState(event),
        remote_path: nodePath(event),
        response_schema: args?.response_schema ?? null,
        resume_supported: Boolean(taskId && contextId && interruptId && functionCall.name),
        resume_note: REMOTE_INPUT_RESUME_NOTE
      };
    }
  }
  return null;
}

function remoteInputFunctionCall(part: unknown, longRunningToolIds: ReadonlySet<string>): { name: string; id: unknown; args: unknown } | null {
  if (!isRecord(part) || !isRecord(part.functionCall)) return null;
  const functionCall = part.functionCall;
  const name = nonEmptyString(functionCall.name);
  if (name !== "adk_request_input") return null;
  const id = nonEmptyString(functionCall.id);
  const metadata = part.partMetadata;
  const metadataLongRunning = isRecord(metadata) && metadata.adk_is_long_running === true;
  if (!metadataLongRunning && (!id || !longRunningToolIds.has(id))) return null;
  return { name, id: functionCall.id, args: functionCall.args };
}

function isRemoteA2aEvent(event: Record<string, unknown>): boolean {
  const customMetadata = event.customMetadata;
  if (isRecord(customMetadata) && isRecord(customMetadata["a2a:response"])) return true;
  const path = nodePath(event);
  return Boolean(path?.includes("@1/"));
}

function inputPrompt(args: Record<string, unknown> | null): string | null {
  if (!args) return null;
  return nonEmptyString(args.message) ?? nonEmptyString(args.prompt) ?? nonEmptyString(args.payload);
}

function a2aTaskId(event: Record<string, unknown>): string | null {
  const customMetadata = event.customMetadata;
  if (!isRecord(customMetadata)) return null;
  const response = customMetadata["a2a:response"];
  return (
    nonEmptyString(customMetadata["a2a:task_id"]) ??
    (isRecord(response) ? nonEmptyString(response.id) ?? nonEmptyString(response.taskId) ?? nonEmptyString(response.task_id) : null)
  );
}

function a2aContextId(event: Record<string, unknown>): string | null {
  const customMetadata = event.customMetadata;
  if (!isRecord(customMetadata)) return null;
  const response = customMetadata["a2a:response"];
  if (!isRecord(response)) return nonEmptyString(customMetadata["a2a:context_id"]);
  const context = response.context;
  return (
    nonEmptyString(response.contextId) ??
    nonEmptyString(response.context_id) ??
    (isRecord(context) ? nonEmptyString(context.id) : null) ??
    nonEmptyString(customMetadata["a2a:context_id"])
  );
}

function a2aTaskState(event: Record<string, unknown>): string | null {
  const customMetadata = event.customMetadata;
  if (!isRecord(customMetadata)) return null;
  const response = customMetadata["a2a:response"];
  if (!isRecord(response)) return null;
  const status = response.status;
  return isRecord(status) ? nonEmptyString(status.state) : null;
}

function nodePath(event: Record<string, unknown>): string | null {
  const nodeInfo = event.nodeInfo;
  return isRecord(nodeInfo) ? nonEmptyString(nodeInfo.path) : null;
}

function stringSet(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0));
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
