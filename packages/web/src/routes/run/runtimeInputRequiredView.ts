import type { RuntimeChatRemoteInputRequired } from "../../state/useRuntimeChat";
import type { RuntimeA2aStatus } from "../../state/useRuntimeA2a";

export interface RemoteInputRequiredView {
  readonly visible: boolean;
  readonly title?: string;
  readonly prompt?: string;
  readonly payload?: string;
  readonly detail?: string;
  readonly taskState?: string;
  readonly resume?: RemoteInputRequiredResume;
}

export type RemoteInputRequiredResume =
  | {
      readonly supported: true;
      readonly taskId: string;
      readonly contextId: string;
      readonly interruptId: string;
      readonly functionName: string;
      readonly responseSchema: unknown | null;
      readonly note: string;
    }
  | {
      readonly supported: false;
      readonly note: string;
    };

export interface RuntimeResumeRequest {
  readonly providerReqId: string;
  readonly taskId: string;
  readonly contextId: string;
  readonly interruptId: string;
  readonly functionName: string;
  readonly response: string;
}

export interface RuntimeResumeFormView {
  readonly visible: boolean;
  readonly submitVisible: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly request: RuntimeResumeRequest | null;
  readonly warning: string | null;
}

const REMOTE_INPUT_DETAIL =
  "원격 Agent 가 input-required 상태로 사람 입력을 기다립니다. 현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다.";
const REMOTE_RESUME_DETAIL =
  "원격 Agent 가 input-required 상태로 사람 입력을 기다립니다. Workbench resume 은 같은 Remote A2A task 에 function_response DataPart 를 전송합니다.";

export function remoteInputRequiredView(
  inputRequired: RuntimeChatRemoteInputRequired | RuntimeA2aStatus | null | undefined,
  fallbackStatus?: RuntimeA2aStatus | null
): RemoteInputRequiredView {
  if (isRuntimeChatRemoteInputRequired(inputRequired)) {
    return {
      visible: true,
      title: "Remote A2A 입력 대기",
      prompt: inputRequired.prompt,
      payload: inputRequired.payload ?? undefined,
      detail: inputRequired.resume_supported ? inputRequired.resume_note : REMOTE_INPUT_DETAIL,
      taskState: inputRequired.task_state ?? undefined,
      resume: inputRequired.resume_supported
        ? {
            supported: true,
            taskId: inputRequired.task_id ?? "",
            contextId: inputRequired.context_id ?? "",
            interruptId: inputRequired.interrupt_id ?? "",
            functionName: inputRequired.function_name,
            responseSchema: inputRequired.response_schema,
            note: inputRequired.resume_note
          }
        : {
            supported: false,
            note: inputRequired.resume_note
          }
    };
  }
  const status = inputRequired ?? fallbackStatus;
  if (status?.server.message_send_status !== "interactive_required") return { visible: false };
  const resume = status.server.message_send_resume;
  return {
    visible: true,
    title: "Remote A2A 입력 대기",
    prompt: status.server.message ?? "Remote A2A provider 가 사람 입력을 기다립니다.",
    detail: resume ? REMOTE_RESUME_DETAIL : REMOTE_INPUT_DETAIL,
    taskState: status.server.message_send_task_state ?? undefined,
    resume: resume
      ? {
          supported: true,
          taskId: resume.task_id,
          contextId: resume.context_id,
          interruptId: resume.interrupt_id,
          functionName: resume.function_name,
          responseSchema: resume.response_schema,
          note: "provider probe 가 생성한 Remote A2A task 를 Workbench resume 으로 이어갈 수 있습니다."
        }
      : {
          supported: false,
          note: REMOTE_INPUT_DETAIL
        }
  };
}

export function runtimeResumeFormView(
  view: RemoteInputRequiredView,
  input: { readonly providerReqId: string | null | undefined; readonly responseText: string; readonly pending: boolean }
): RuntimeResumeFormView {
  const submitLabel = input.pending ? "Workbench resume 전송 중…" : "Workbench resume 전송";
  if (!view.visible || !view.resume) {
    return {
      visible: false,
      submitVisible: false,
      submitDisabled: true,
      submitLabel,
      request: null,
      warning: null
    };
  }
  if (!view.resume.supported) {
    return {
      visible: true,
      submitVisible: false,
      submitDisabled: true,
      submitLabel,
      request: null,
      warning: view.resume.note
    };
  }
  const providerReqId = input.providerReqId?.trim() ?? "";
  const response = input.responseText.trim();
  const missingTarget = !providerReqId;
  const missingResumeMetadata = !view.resume.taskId || !view.resume.contextId || !view.resume.interruptId || !view.resume.functionName;
  const missingResponse = !response;
  const submitDisabled = input.pending || missingTarget || missingResumeMetadata || missingResponse;
  return {
    visible: true,
    submitVisible: true,
    submitDisabled,
    submitLabel,
    request: submitDisabled
      ? null
      : {
          providerReqId,
          taskId: view.resume.taskId,
          contextId: view.resume.contextId,
          interruptId: view.resume.interruptId,
          functionName: view.resume.functionName,
          response
        },
    warning: missingTarget
      ? "provider artifact 를 확인한 뒤 Workbench resume 을 전송할 수 있습니다."
      : missingResumeMetadata
        ? "resume task metadata 를 확인한 뒤 Workbench resume 을 전송할 수 있습니다."
        : null
  };
}

function isRuntimeChatRemoteInputRequired(value: RuntimeChatRemoteInputRequired | RuntimeA2aStatus | null | undefined): value is RuntimeChatRemoteInputRequired {
  return Boolean(value && "kind" in value && value.kind === "remote_input_required");
}
