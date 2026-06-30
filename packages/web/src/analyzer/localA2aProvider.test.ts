import assert from "node:assert/strict";
import { importLocalA2AProvider } from "./localA2aProvider.ts";
import type { AnalysisResult } from "./types.ts";

const ADK_A2A_EXTENSION_URI = "https://google.github.io/adk-docs/a2a/a2a-extension/";

const localProviderAnalysis: AnalysisResult = {
  normalizedRequirement: {
    id: "req-consumer",
    title: "Consumer",
    raw_text: "Call a local A2A provider.",
    domain: "공통",
    requester: { team: "Workbench", role: "reviewer" },
    business_goal: "Use local A2A provider",
    current_process: [],
    inputs: [],
    outputs: [],
    systems: [],
    risk_signals: [],
    missing_information: [],
    contradictions: [],
    status: "reviewed"
  },
  evidence: {
    requested_goal: "Call a local A2A provider.",
    business_domain_hint: "공통",
    user_role: "reviewer",
    input_data: [],
    output_data: [],
    systems_mentioned: [],
    decisions_implied: [],
    risk_signals: [],
    missing_information: [],
    contradictions: [],
    assumptions: []
  },
  moduleCandidates: [],
  a2aContracts: [],
  runtimeContracts: [],
  processFlow: {
    requirement_id: "req-consumer",
    graph_id: "graph-consumer",
    root_workflow_module_id: null,
    nodes: [],
    edges: [],
    containers: [],
    lanes: [],
    validation: { ok: true, errors: [], warnings: [] }
  }
};

const imported = importLocalA2AProvider(localProviderAnalysis, {
  providerReqId: "req-page-recommendation-required",
  appName: "req_page_recommendation_required_adk",
  agentCardUrl: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk/.well-known/agent-card.json",
  rpcUrl: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk",
  card: {
    name: "req_page_recommendation_required_adk",
    description: "Recommend pages from reviewed page metadata.",
    url: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk",
    version: "0.3.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: {
      streaming: false,
      extensions: [
        {
          uri: ADK_A2A_EXTENSION_URI,
          required: false,
          description:
            "ADK 2.3 A2A executor metadata; RequestInput is surfaced as the A2A input-required state with adk_request_input, but this does not claim verified remote HITL resume support."
        }
      ]
    },
    skills: [{ id: "page_recommendation", name: "Page recommendation", description: "Recommend pages.", tags: ["page"] }]
  }
});

const importedCandidate = imported.analysis.moduleCandidates[0];
const importedContract = imported.analysis.a2aContracts[0];
const importedNode = imported.analysis.processFlow?.nodes[0];

assert.equal(imported.candidateId, importedCandidate?.id);
assert.equal(imported.contractId, importedContract?.contract_id);
assert.equal(importedCandidate?.module_category, "remote_a2a");
assert.equal(importedCandidate?.status, "needs_info");
assert.equal(importedCandidate?.a2a_contract_id, importedContract?.contract_id);
assert.equal(importedNode?.node_kind, "remote_agent_call");
assert.equal(importedNode?.module_id, importedCandidate?.id);
assert.equal(importedNode?.runtime_binding, "remote_a2a");
assert.equal(importedContract?.agent_card.agent_card_url, "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk/.well-known/agent-card.json");
assert.equal(importedContract?.supported_interfaces[0]?.url, "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk");
assert.deepEqual(importedContract?.security_schemes, [{ name: "local_dev_none", scheme: "none" }]);
assert.deepEqual(importedContract?.security_requirements, [{ scheme_name: "local_dev_none", scopes: ["local_dev"] }]);
assert.deepEqual(importedContract?.adk_runtime_policy.auth, { mode: "none", env_var: null, metadata_key: null });
assert.deepEqual(importedContract?.operations, ["SendMessage", "GetTask", "CancelTask"]);
assert.ok(importedContract?.extensions.some((extension) => extension.includes(ADK_A2A_EXTENSION_URI)));
assert.ok(importedContract?.extensions.some((extension) => extension.includes("adk_request_input")));
assert.ok(importedContract?.extensions.some((extension) => extension.includes("does not claim verified remote HITL resume")));
assert.ok(importedContract?.task_lifecycle.states.includes("TASK_STATE_INPUT_REQUIRED"));
assert.ok(importedContract?.task_lifecycle.states.includes("TASK_STATE_AUTH_REQUIRED"));
assert.ok(
  importedContract?.task_lifecycle.allowed_transitions.some(
    (transition) => transition.from === "TASK_STATE_WORKING" && transition.to === "TASK_STATE_INPUT_REQUIRED"
  )
);
assert.ok(
  importedContract?.task_lifecycle.allowed_transitions.some(
    (transition) => transition.from === "TASK_STATE_WORKING" && transition.to === "TASK_STATE_AUTH_REQUIRED"
  )
);
assert.ok(
  importedContract?.task_lifecycle.allowed_transitions.some(
    (transition) => transition.from === "TASK_STATE_INPUT_REQUIRED" && transition.to === "TASK_STATE_WORKING"
  )
);

const rewired = importLocalA2AProvider(
  {
    ...localProviderAnalysis,
    processFlow: {
      ...localProviderAnalysis.processFlow,
      nodes: [
        {
          id: "node-input",
          label: "Input",
          module_id: null,
          node_kind: "input",
          execution_kind: null,
          adk_node_role: "synthetic",
          owner_scope: "local",
          container_id: "container-root",
          lane_id: "input",
          input_ports: [],
          output_ports: [{ id: "node-input:out", label: "message", schema_ref: null }],
          schema_refs: [],
          review_status: "n/a",
          position: null,
          runtime_binding: "ui_input",
          invoke_binding: "ui_input",
          decision_owner: "human",
          call_control: "none",
          side_effect: "none",
          policy: "none"
        },
        {
          id: "node-output",
          label: "Output",
          module_id: null,
          node_kind: "output",
          execution_kind: null,
          adk_node_role: "synthetic",
          owner_scope: "local",
          container_id: "container-root",
          lane_id: "output",
          input_ports: [{ id: "node-output:in", label: "result", schema_ref: null }],
          output_ports: [],
          schema_refs: [],
          review_status: "n/a",
          position: null,
          runtime_binding: "unresolved",
          invoke_binding: "unresolved",
          decision_owner: "system",
          call_control: "none",
          side_effect: "none",
          policy: "none"
        }
      ],
      edges: [
        {
          id: "edge-input-output",
          from: "node-input",
          to: "node-output",
          from_port: "node-input:out",
          to_port: "node-output:in",
          edge_kind: "event_message",
          execution_semantics: "normal_transition",
          data_label: "message",
          schema_ref: null,
          route_condition: null,
          state_key: null,
          artifact_key: null,
          a2a_contract_id: null,
          is_remote_boundary_crossing: false,
          flow_kind: "sequence",
          call_control: "none"
        }
      ]
    }
  },
  {
    providerReqId: "req-page-recommendation-required",
    appName: "req_page_recommendation_required_adk",
    agentCardUrl: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk/.well-known/agent-card.json",
    rpcUrl: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk",
    card: {
      name: "req_page_recommendation_required_adk",
      url: "http://127.0.0.1:8001/a2a/req_page_recommendation_required_adk",
      version: "0.3.0",
      protocolVersion: "0.3.0",
      preferredTransport: "JSONRPC",
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      capabilities: { streaming: false },
      skills: [{ id: "page_recommendation", name: "Page recommendation" }]
    }
  }
);

assert.equal(rewired.analysis.processFlow.edges.length, 2);
assert.deepEqual(rewired.analysis.processFlow.edges.map((edge) => edge.id), ["edge-001", "edge-002"]);
assert.deepEqual(
  rewired.analysis.processFlow.edges.map((edge) => [edge.edge_kind, edge.execution_semantics, edge.a2a_contract_id, edge.is_remote_boundary_crossing]),
  [
    ["remote_a2a", "boundary_crossing", rewired.contractId, true],
    ["remote_a2a", "boundary_crossing", rewired.contractId, true]
  ]
);
