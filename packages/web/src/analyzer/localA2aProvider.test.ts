import assert from "node:assert/strict";
import { importLocalA2AProvider } from "./localA2aProvider.ts";
import { strictAnalysisFixture } from "./targetContract.testFixture.ts";

const imported = importLocalA2AProvider(strictAnalysisFixture(), {
  providerReqId: "req-provider",
  appName: "remote-review",
  agentCardUrl: "http://127.0.0.1:9000/.well-known/agent-card.json",
  rpcUrl: "http://127.0.0.1:9000",
  card: { name: "Remote reviewer", protocolVersion: "1.0", preferredTransport: "JSONRPC" }
});
const candidate = imported.analysis.assetCandidates.find((entry) => entry.asset_id === imported.assetId);
assert.equal(candidate?.asset_type, "agent");
assert.deepEqual(candidate?.binding, { kind: "a2a", contract_ref: imported.contractId });
assert.equal(imported.analysis.a2aContracts[imported.analysis.a2aContracts.length - 1]?.agent_ref, imported.assetId);
assert.equal(imported.analysis.graph.nodes[imported.analysis.graph.nodes.length - 1]?.node_kind, "agent");
console.log("local A2A provider Target import tests passed");
