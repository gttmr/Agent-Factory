export const categories = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
export const adapterKinds = new Set([
  "legacy_api",
  "retrieval",
  "rule_registry",
  "data_query",
  "template",
  "computation",
  "external_service",
  "unknown"
]);
export const agentKinds = new Set(["specialist", "shared"]);
export const workflowKinds = new Set([
  "orchestration",
  "graph",
  "dynamic",
  "unknown"
]);
export const remoteKinds = new Set(["a2a", "unknown"]);
export const accessProtocols = new Set(["local", "http_rest", "mcp", "grpc", "message_queue", "unknown"]);
export const runtimeBindings = new Set(["unresolved", "direct_api", "mcp", "mcp_tool", "local_function", "remote_a2a", "workflow_call", "ui_input"]);
export const scaffoldOutputModes = new Set(["smoke", "runnable"]);
export const smokeScaffoldOutputs = {
  adapter: "contract_or_stub_only",
  agent: "agent_shell_only",
  workflow: "orchestration_shell_only",
  remote_a2a: "contract_placeholder_only"
};

// Graph IR (ADK 2.0). Mirrors the GRAPH_* constant exports in
// packages/web/src/analyzer/types.ts. The validator must stay
// dependency-free, so the lists are duplicated here.
export const graphNodeKinds = new Set([
  "input",
  "output",
  "agent",
  "function",
  "tool",
  "adapter",
  "adapter_call",
  "human_input",
  "callback_wait",
  "workflow",
  "workflow_call",
  "remote_a2a",
  "remote_agent_call",
  "join",
  "router",
  "loop_control"
]);
export const agentExecutionModes = new Set(["single_turn", "chat"]);
export const graphContainerKinds = new Set([
  "graph_workflow",
  "dynamic_workflow",
  "parallel_region",
  "loop_region",
  "human_review_region",
  "remote_boundary"
]);
export const graphEdgeKinds = new Set([
  "event_output",
  "event_message",
  "session_state",
  "temp_state",
  "user_state",
  "app_state",
  "artifact",
  "route",
  "control",
  "remote_a2a"
]);
export const graphStateEdgeKinds = new Set(["session_state", "temp_state", "user_state", "app_state"]);
export const graphStateScopePrefixByKind = { temp_state: "temp:", user_state: "user:", app_state: "app:" };
export const graphStateScopePrefixPattern = /^(temp:|user:|app:)/;
export const graphLaneIds = new Set([
  "input",
  "local_graph",
  "adapter",
  "human_input",
  "output",
  "remote_boundary"
]);
export const graphLayoutPolicies = new Set([
  "dag_with_routes",
  "fan_out_fan_in",
  "loop",
  "linear",
  "free"
]);
export const graphExecutionSemantics = new Set([
  "normal_transition",
  "fan_out",
  "fan_in",
  "loop_back",
  "loop_exit",
  "conditional",
  "boundary_crossing"
]);
export const graphInvokeBindings = new Set([
  "unresolved",
  "local_python",
  "direct_api",
  "mcp_tool",
  "mcp_toolset",
  "local_function",
  "internal_workflow",
  "ui_input",
  "remote_a2a",
  "callback_wait",
  "unknown"
]);
export const graphDecisionOwners = new Set(["workflow_code", "llm", "human", "remote_agent", "system", "unknown"]);
export const graphCallControls = new Set(["none", "fixed_by_workflow", "selected_by_llm", "selected_by_human", "event_callback", "resume", "unknown"]);
export const graphFlowKinds = new Set(["sequence", "route", "fan_out", "fan_in", "loop_back", "loop_exit", "fallback", "error", "resume", "callback", "unknown"]);
export const graphSideEffects = new Set(["none", "read", "write", "external_message", "transaction", "unknown"]);
export const graphPolicies = new Set([
  "none",
  "auth_required",
  "approval_required",
  "audit_required",
  "idempotency_required",
  "timeout_retry_required",
  "data_policy_required",
  "manual_fallback_required",
  "callback_resume_required",
  "compensation_required",
  "unknown"
]);
export const callbackInvokeBindings = new Set(["callback_wait"]);
export const callbackCallControls = new Set(["event_callback", "resume"]);
export const callbackFlowKinds = new Set(["callback", "resume"]);

// Synthetic / graph-semantics node kinds that MUST NOT bind to a module candidate.
export const syntheticNodeKindsStrict = new Set(["input", "output", "join", "router", "loop_control", "human_input", "callback_wait"]);
// Synthetic-ish kinds that MAY optionally bind to a candidate without erroring.
export const syntheticNodeKindsLenient = new Set(["function", "tool"]);
export const remoteAgentNodeKinds = new Set(["remote_a2a", "remote_agent_call"]);
export const adkHintKeys = new Set(["state_memory", "callbacks", "artifacts_events", "mcp_a2a", "streaming_grounding"]);
export const remoteRequiredFields = [
  "owner",
  "agent_card",
  "auth",
  "task_lifecycle",
  "timeout",
  "retry",
  "fallback",
  "audit",
  "data_policy"
];

// ---------------------------------------------------------------------------
// A2A 1.0 contract constants. Kept in lockstep with
// packages/web/src/analyzer/types.ts (A2A_OPERATION_NAMES, A2A_HTTP_PATHS,
// A2A_TASK_STATES, A2A_PART_FIELDS, A2A_ROLES, A2A_STREAM_WRAPPERS,
// A2A_STALE_NAMES, A2A_CONTRACT_STATUSES). Validator must stay dependency-free,
// so the lists are duplicated here. If you change one, change the other.
// ---------------------------------------------------------------------------
export const a2aOperationNames = new Set([
  "SendMessage",
  "SendStreamingMessage",
  "GetTask",
  "SubscribeToTask",
  "CancelTask",
  "ListTasks"
]);
export const a2aHttpPaths = new Set([
  "/message:send",
  "/message:stream",
  "/tasks/{id}",
  "/tasks/{id}:subscribe",
  "/tasks/{id}:cancel"
]);
export const a2aTaskStates = new Set([
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_AUTH_REQUIRED",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_REJECTED"
]);
export const a2aPartFields = new Set(["text", "raw", "url", "data"]);
export const a2aRoles = new Set(["ROLE_USER", "ROLE_AGENT"]);
export const a2aStreamWrappers = new Set(["task", "message", "taskStatusUpdate", "taskArtifactUpdate"]);
export const a2aContractStatuses = new Set(["draft", "needs_info", "approved"]);
export const a2aRuntimeAuthModes = new Set(["none", "bearer_env", "metadata_env"]);
export const a2aRuntimeFallbackModes = new Set(["none", "manual_review", "local_event"]);
export const runtimeContractKinds = new Set([
  "mcp_legacy_adapter",
  "eai_legacy_adapter",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
]);
export const runtimeContractStatuses = new Set(["draft", "needs_info", "approved", "rejected"]);
export const afRunStages = new Set(["analyze", "design", "build", "verify"]);
export const afRunStageStatuses = new Set(["pending", "complete", "blocked"]);
export const afRunValidationResults = new Set(["not_run", "passed", "failed"]);
export const afStageRunStatuses = new Set(["running", "completed", "failed", "applied", "canceled"]);
export const afStageRunCodexBackends = new Set(["sdk", "fake"]);
export const afStageRunIdPattern = /^\d{8}T\d{6}Z-(analyze|design|build|verify)-[a-f0-9]{6}$/;

// Required string fields on an A2AContract (top-level scalar string fields).
// Nested object fields are validated separately.
export const a2aContractRequiredStringFields = [
  "contract_id",
  "remote_module_id",
  "target_agent_name",
  "target_agent_purpose",
  "adk_host_mapping",
  "timeout",
  "retry",
  "fallback",
  "cancellation",
  "unsupported_operation",
  "get_task_fallback",
  "auth",
  "token_handling",
  "audit",
  "data_policy"
];
export const a2aContractRequiredArrayFields = [
  "supported_interfaces",
  "input_modes",
  "output_modes",
  "security_schemes",
  "security_requirements",
  "skills",
  "extensions",
  "operations",
  "http_paths"
];
export const a2aContractRequiredObjectFields = [
  "agent_card",
  "message_contract",
  "task_lifecycle",
  "streaming",
  "artifact_contract",
  "adk_runtime_policy"
];

// Stale terminology that must never appear inside a serialized contract.
export const a2aStaleNames = [
  "tasks/send",
  "tasks/sendSubscribe",
  "tasks/get",
  "tasks/cancel",
  "tasks/pushNotification/set",
  "tasks/pushNotification/get",
  "tasks/resubscribe",
  "tasks/list",
  "SendTaskRequest",
  "SendTaskResponse",
  "SendTaskStreamingRequest",
  "SendTaskStreamingResponse",
  "GetTaskRequest",
  "GetTaskResponse",
  "CancelTaskRequest",
  "CancelTaskResponse",
  "TaskSendParams",
  "TaskQueryParams",
  "TaskIdParams",
  "submitted",
  "working",
  "input-required",
  "completed",
  "failed",
  "canceled",
  "rejected",
  "auth-required",
  "SUBMITTED",
  "WORKING",
  "INPUT_REQUIRED",
  "AUTH_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REJECTED",
  "final",
  "TaskStatusUpdateEvent",
  "TaskArtifactUpdateEvent",
  "isFinal",
  "lastChunk",
  "TextPart",
  "FilePart",
  "DataPart",
  "file"
];

// A small allowlist of substrings that legitimately match stale tokens but
// are not themselves stale usage. The stale scan ignores any contract whose
// JSON contains *only* allowlisted occurrences. We keep this list narrow.
export const a2aStaleAllowlist = new Set([
  // none today; populate only if a real contract surfaces a false positive
]);
