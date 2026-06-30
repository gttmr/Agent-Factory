import assert from "node:assert/strict";
import type { RuntimeChatRemoteInputRequired } from "../../state/useRuntimeChat";
import type { RuntimeA2aStatus } from "../../state/useRuntimeA2a";
import { remoteInputRequiredView } from "./runtimeInputRequiredView";

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
  title: "Remote A2A 입력 대기",
  prompt: "<script>alert('x')</script>목적/시나리오 분류 확인",
  detail:
    "원격 Agent 가 input-required 상태로 사람 입력을 기다립니다. 현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다.",
  taskState: "input-required"
});

assert.equal(remoteInputRequiredView(null).visible, false);

const eventInputRequired: RuntimeChatRemoteInputRequired = {
  kind: "remote_input_required",
  prompt: "목적/시나리오 분류 확인",
  payload: "<script>alert('x')</script>분류체계와 맞지 않습니다.",
  function_name: "adk_request_input",
  interrupt_id: "interrupt-2",
  task_id: "task-2",
  task_state: "input-required",
  remote_path: "consumer@1/provider@1",
  resume_supported: false,
  resume_note: "현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다."
};

assert.deepEqual(remoteInputRequiredView(eventInputRequired, status), {
  visible: true,
  title: "Remote A2A 입력 대기",
  prompt: "목적/시나리오 분류 확인",
  detail:
    "원격 Agent 가 input-required 상태로 사람 입력을 기다립니다. 현재 Workbench/ADK Web 텍스트 채팅은 같은 Remote A2A task resume bridge 로 검증되지 않았습니다.",
  taskState: "input-required",
  payload: "<script>alert('x')</script>분류체계와 맞지 않습니다."
});
