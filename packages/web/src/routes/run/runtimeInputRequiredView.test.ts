import assert from "node:assert/strict";
import type { RuntimeChatRemoteInputRequired } from "../../state/useRuntimeChat";
import type { RuntimeA2aStatus } from "../../state/useRuntimeA2a";
import { remoteInputRequiredView, runtimeResumeFormView } from "./runtimeInputRequiredView";

const status: RuntimeA2aStatus = {
  port: 8001,
  host: "127.0.0.1",
  rpc_url: "http://127.0.0.1:8001/a2a/provider",
  agent_card_url: "http://127.0.0.1:8001/a2a/provider/.well-known/agent-card.json",
  web_url: "http://127.0.0.1:8001",
  app_name: "provider",
  installed: true,
  setup_hint: "",
  paths: {
    runtime_stub_dir: "/tmp/runtime-stub",
    venv: "/tmp/.venv",
    python: "/tmp/.venv/bin/python",
    adk: "/tmp/.venv/bin/adk"
  },
  server: {
    status: "running",
    pid: 1234,
    can_stop: true,
    stale: false,
    agent_card_ready: true,
    agent_card_status_code: 200,
    message_send_ready: false,
    message_send_status: "interactive_required",
    message_send_task_state: "input-required",
    message_send_resume: {
      task_id: "task-1",
      context_id: "ctx-1",
      interrupt_id: "interrupt-1",
      function_name: "adk_request_input",
      response_schema: { type: "string" }
    },
    mock_lab_prerequisites: [],
    message: "<script>alert('x')</script>목적/시나리오 분류 확인",
    started_stub_fingerprint: "old",
    current_stub_fingerprint: "old",
    stdout_tail: "",
    stderr_tail: ""
  }
};

assert.deepEqual(remoteInputRequiredView(status), {
  visible: true,
  title: "A2A Agent 입력 대기",
  prompt: "<script>alert('x')</script>목적/시나리오 분류 확인",
  detail:
    "원격 A2A Agent가 input-required 상태로 사람 입력을 기다립니다. Workbench resume은 같은 task에 function_response DataPart를 전송합니다.",
  taskState: "input-required",
  resume: {
    supported: true,
    taskId: "task-1",
    contextId: "ctx-1",
    interruptId: "interrupt-1",
    functionName: "adk_request_input",
    responseSchema: { type: "string" },
    note: "provider probe가 생성한 원격 A2A task를 Workbench resume으로 이어갈 수 있습니다."
  }
});

assert.equal(remoteInputRequiredView(null).visible, false);

const probeView = remoteInputRequiredView(status);
assert.deepEqual(runtimeResumeFormView(probeView, { providerReqId: "provider-1", responseText: "확인했습니다", pending: false }), {
  visible: true,
  submitVisible: true,
  submitDisabled: false,
  submitLabel: "Workbench resume 전송",
  request: {
    providerReqId: "provider-1",
    taskId: "task-1",
    contextId: "ctx-1",
    interruptId: "interrupt-1",
    functionName: "adk_request_input",
    response: "확인했습니다"
  },
  warning: null
});

const eventInputRequired: RuntimeChatRemoteInputRequired = {
  kind: "remote_input_required",
  prompt: "목적/시나리오 분류 확인",
  payload: "<script>alert('x')</script>분류체계와 맞지 않습니다.",
  function_name: "adk_request_input",
  interrupt_id: "interrupt-2",
  task_id: "task-2",
  context_id: null,
  task_state: "input-required",
  remote_path: "consumer@1/provider@1",
  response_schema: { type: "string" },
  resume_supported: false,
  resume_note: "현재 Workbench/ADK Web 텍스트 채팅은 같은 원격 A2A task의 resume 경로로 검증되지 않았습니다."
};

assert.deepEqual(remoteInputRequiredView(eventInputRequired, status), {
  visible: true,
  title: "A2A Agent 입력 대기",
  prompt: "목적/시나리오 분류 확인",
  detail:
    "원격 A2A Agent가 input-required 상태로 사람 입력을 기다립니다. 현재 Workbench/ADK Web 텍스트 채팅은 같은 task의 resume 경로로 검증되지 않았습니다.",
  taskState: "input-required",
  payload: "<script>alert('x')</script>분류체계와 맞지 않습니다.",
  resume: {
    supported: false,
    note: "현재 Workbench/ADK Web 텍스트 채팅은 같은 원격 A2A task의 resume 경로로 검증되지 않았습니다."
  }
});

const resumableInputRequired: RuntimeChatRemoteInputRequired = {
  ...eventInputRequired,
  interrupt_id: "interrupt-2",
  task_id: "task-2",
  context_id: "ctx-2",
  resume_supported: true,
  resume_note: "원격 A2A task의 resume 경로로 이어갈 수 있습니다."
};

const resumableView = remoteInputRequiredView(resumableInputRequired, status);
assert.equal(resumableView.resume?.supported, true);
assert.equal(
  resumableView.detail,
  "원격 A2A task의 resume 경로로 이어갈 수 있습니다."
);
assert.deepEqual(runtimeResumeFormView(resumableView, { providerReqId: "provider-1", responseText: "확인했습니다", pending: false }), {
  visible: true,
  submitVisible: true,
  submitDisabled: false,
  submitLabel: "Workbench resume 전송",
  request: {
    providerReqId: "provider-1",
    taskId: "task-2",
    contextId: "ctx-2",
    interruptId: "interrupt-2",
    functionName: "adk_request_input",
    response: "확인했습니다"
  },
  warning: null
});

assert.equal(
  runtimeResumeFormView(resumableView, { providerReqId: "provider-1", responseText: "확인했습니다", pending: true })
    .submitDisabled,
  true
);
assert.equal(
  runtimeResumeFormView(resumableView, { providerReqId: "provider-1", responseText: "", pending: false }).submitDisabled,
  true
);

const malformedResumableView = remoteInputRequiredView({ ...resumableInputRequired, task_id: null }, status);
assert.deepEqual(
  runtimeResumeFormView(malformedResumableView, { providerReqId: "provider-1", responseText: "확인했습니다", pending: false }),
  {
    visible: true,
    submitVisible: true,
    submitDisabled: true,
    submitLabel: "Workbench resume 전송",
    request: null,
    warning: "resume task metadata를 확인한 뒤 Workbench resume을 전송할 수 있습니다."
  }
);

const unsupportedView = remoteInputRequiredView(eventInputRequired, status);
assert.deepEqual(runtimeResumeFormView(unsupportedView, { providerReqId: "provider-1", responseText: "확인했습니다", pending: false }), {
  visible: true,
  submitVisible: false,
  submitDisabled: true,
  submitLabel: "Workbench resume 전송",
  request: null,
  warning: "현재 Workbench/ADK Web 텍스트 채팅은 같은 원격 A2A task의 resume 경로로 검증되지 않았습니다."
});
