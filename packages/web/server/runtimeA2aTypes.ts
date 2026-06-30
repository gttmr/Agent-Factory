import type { ArtifactRootStore } from "./artifactRootStore";
import type { LocalAgentCard } from "./runtimeA2aCard";

export interface RuntimeA2aStatus {
  port: number;
  host: string;
  rpc_url: string;
  agent_card_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
  setup_hint: string;
  paths: {
    runtime_stub_dir: string;
    venv: string;
    python: string;
    adk: string;
  };
  server: {
    status: "stopped" | "running" | "failed";
    pid: number | null;
    can_stop: boolean;
    stale: boolean;
    agent_card_ready: boolean;
    agent_card_status_code: number | null;
    message_send_ready: boolean;
    message_send_status: "not_checked" | "ready" | "working" | "interactive_required" | "failed";
    message_send_task_state: string | null;
    message_send_resume: RuntimeA2aMessageSendResume | null;
    mock_lab_prerequisites: RuntimeA2aMockLabPrerequisite[];
    message: string | null;
    started_stub_fingerprint: string | null;
    current_stub_fingerprint: string | null;
    stdout_tail: string;
    stderr_tail: string;
  };
}

export interface RuntimeA2aMessageSendResume {
  readonly task_id: string;
  readonly context_id: string;
  readonly interrupt_id: string;
  readonly function_name: string;
  readonly response_schema: unknown | null;
}

export interface RuntimeA2aMockLabPrerequisite {
  readonly mock_server_id: string;
  readonly status: "missing" | "stopped" | "running";
  readonly running: boolean;
  readonly start_action: {
    readonly method: "POST";
    readonly url: string;
  };
  readonly mcp_url: string;
  readonly message: string | null;
}

export interface RuntimeA2aStartResult {
  ok: boolean;
  command: string;
  status: RuntimeA2aStatus;
}

export interface RuntimeA2aStopResult {
  ok: boolean;
  message: string | null;
  status: RuntimeA2aStatus;
}

export interface RuntimeA2aAgentCardResult {
  provider_req_id: string;
  app_name: string;
  rpc_url: string;
  agent_card_url: string;
  card: LocalAgentCard;
}

export interface RuntimeA2aManagerOptions {
  repoRoot: string;
  store: ArtifactRootStore;
  port?: number;
  host?: string;
  startupProbeTimeoutMs?: number;
  statusProbeTimeoutMs?: number;
}
