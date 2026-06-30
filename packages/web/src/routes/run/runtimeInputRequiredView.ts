import type { RuntimeChatRemoteInputRequired } from "../../state/useRuntimeChat";
import type { RuntimeA2aStatus } from "../../state/useRuntimeA2a";

export interface RemoteInputRequiredView {
  readonly visible: boolean;
  readonly title?: string;
  readonly prompt?: string;
  readonly payload?: string;
  readonly detail?: string;
  readonly taskState?: string;
}

const REMOTE_INPUT_DETAIL =
  "원격 Agent 가 input-required 상태로 사람 입력을 기다립니다. 현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다.";

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
      detail: REMOTE_INPUT_DETAIL,
      taskState: inputRequired.task_state ?? undefined
    };
  }
  const status = inputRequired ?? fallbackStatus;
  if (status?.server.message_send_status !== "interactive_required") return { visible: false };
  return {
    visible: true,
    title: "Remote A2A 입력 대기",
    prompt: status.server.message ?? "Remote A2A provider 가 사람 입력을 기다립니다.",
    detail: REMOTE_INPUT_DETAIL,
    taskState: status.server.message_send_task_state ?? undefined
  };
}

function isRuntimeChatRemoteInputRequired(value: RuntimeChatRemoteInputRequired | RuntimeA2aStatus | null | undefined): value is RuntimeChatRemoteInputRequired {
  return Boolean(value && "kind" in value && value.kind === "remote_input_required");
}
