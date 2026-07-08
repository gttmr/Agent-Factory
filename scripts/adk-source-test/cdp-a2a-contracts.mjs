export function approvedRegistryA2AContract() {
  return {
    contract_id: "a2a-registry-001",
    remote_module_id: "mod-reviewed-remote-agent",
    target_agent_name: "Reviewed Remote Agent",
    contract_status: "approved",
    agent_card: {
      discovery_method: "well-known",
      agent_card_url: "http://127.0.0.1:8011/a2a/reviewed/.well-known/agent-card.json",
      version: "1.0.0",
      notes: ""
    },
    supported_interfaces: [{ url: "http://127.0.0.1:8011/a2a/reviewed", protocol_binding: "HTTP+JSON" }],
    skills: ["chat.delegate", "task.lifecycle.observe"],
    operations: ["SendMessage", "GetTask", "CancelTask"],
    task_lifecycle: {
      states: ["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING", "TASK_STATE_INPUT_REQUIRED", "TASK_STATE_COMPLETED"]
    },
    adk_runtime_policy: {
      timeout_seconds: 90,
      auth: { mode: "none", env_var: null, metadata_key: null },
      retry_handoff: null,
      fallback_handoff: null
    }
  };
}

export function approvedRemoteA2AContract() {
  return {
    contract_id: "a2a-001",
    remote_module_id: "mod-r",
    target_agent_name: "Partner Prime Agent",
    contract_status: "approved",
    agent_card: {
      discovery_method: "well-known",
      agent_card_url: "http://localhost:8001/a2a/test_agent/.well-known/agent-card.json",
      version: "1.0.0",
      notes: ""
    },
    adk_runtime_policy: { timeout_seconds: 60, auth: { mode: "none", env_var: null, metadata_key: null } }
  };
}
