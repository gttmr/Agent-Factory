import assert from "node:assert/strict";
import {
  baseAnalysis,
  createActionsHarness,
  normalWorkflowEntry,
  remoteWorkflowEntry,
  withAgentCardFetch
} from "./designWorkbenchActions.test-fixtures.ts";

const normalHarness = createActionsHarness(baseAnalysis());
await normalHarness.actions.insertCatalogWorkflow(normalWorkflowEntry());
assert.equal(normalHarness.savedAnalyses.length, 1);
const workflowCandidate = normalHarness.savedAnalyses[0]?.moduleCandidates[0];
const workflowNode = normalHarness.savedAnalyses[0]?.processFlow.nodes.find((node) => node.module_id === workflowCandidate?.id);
assert.equal(workflowCandidate?.module_category, "workflow");
assert.equal(workflowNode?.node_kind, "workflow_call");
assert.equal(workflowNode?.runtime_binding, "workflow_call");
assert.equal(normalHarness.selectedReviewModuleId, workflowCandidate?.id);
assert.equal(normalHarness.activeTab, "modules");
assert.equal(normalHarness.pickerOpen, false);

const remoteHarness = createActionsHarness(baseAnalysis());
await withAgentCardFetch(
  new Response(
    JSON.stringify({
      provider_req_id: "req-provider",
      app_name: "provider_app",
      rpc_url: "http://127.0.0.1:8001/a2a/provider_app",
      agent_card_url: "http://127.0.0.1:8001/a2a/provider_app/.well-known/agent-card.json",
      card: {
        name: "Provider App",
        description: "Prompt text is stored as card data only.",
        url: "http://127.0.0.1:8001/a2a/provider_app",
        version: "0.3.0",
        protocolVersion: "0.3.0",
        preferredTransport: "JSONRPC",
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["text/plain"],
        capabilities: { streaming: false },
        skills: [{ id: "provider", name: "Provider skill" }]
      }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  ),
  async () => {
    await remoteHarness.actions.insertCatalogWorkflow(remoteWorkflowEntry());
  }
);
assert.equal(remoteHarness.savedAnalyses.length, 1);
const remoteCandidate = remoteHarness.savedAnalyses[0]?.moduleCandidates[0];
const remoteContract = remoteHarness.savedAnalyses[0]?.a2aContracts?.[0];
const remoteNode = remoteHarness.savedAnalyses[0]?.processFlow.nodes.find((node) => node.module_id === remoteCandidate?.id);
assert.equal(remoteCandidate?.module_category, "remote_a2a");
assert.equal(remoteCandidate?.name, "Provider App");
assert.equal(remoteCandidate?.owner, "local artifact:req-provider");
assert.equal(remoteCandidate?.a2a_contract_id, remoteContract?.contract_id);
assert.equal(remoteContract?.target_agent_name, "Provider App");
assert.equal(remoteContract?.agent_card.agent_card_url, "http://127.0.0.1:8001/a2a/provider_app/.well-known/agent-card.json");
assert.equal(remoteNode?.node_kind, "remote_agent_call");
assert.equal(remoteNode?.runtime_binding, "remote_a2a");
assert.equal(remoteHarness.selectedA2AModuleId, remoteCandidate?.id);
assert.equal(remoteHarness.activeTab, "a2a");
assert.equal(remoteHarness.pickerOpen, false);
assert.deepEqual(
  remoteHarness.savedAnalyses[0]?.processFlow.edges.map((edge) => [edge.edge_kind, edge.a2a_contract_id]),
  [
    ["remote_a2a", remoteContract?.contract_id],
    ["remote_a2a", remoteContract?.contract_id]
  ]
);

const missingProviderHarness = createActionsHarness(baseAnalysis());
await missingProviderHarness.actions.insertCatalogWorkflow({ ...remoteWorkflowEntry(), a2a_provider_req_id: "" });
assert.equal(missingProviderHarness.savedAnalyses.length, 0);
assert.equal(missingProviderHarness.actionMessage, "Remote A2A workflow 항목에 a2a_provider_req_id 가 없습니다.");
assert.equal(missingProviderHarness.pickerOpen, true);

const failedFetchHarness = createActionsHarness(baseAnalysis());
await withAgentCardFetch(
  new Response(JSON.stringify({ error: "provider card unavailable" }), {
    status: 503,
    headers: { "content-type": "application/json" }
  }),
  async () => {
    await failedFetchHarness.actions.insertCatalogWorkflow(remoteWorkflowEntry());
  }
);
assert.equal(failedFetchHarness.savedAnalyses.length, 0);
assert.equal(failedFetchHarness.actionMessage, "provider card unavailable");
assert.equal(failedFetchHarness.pickerOpen, true);
