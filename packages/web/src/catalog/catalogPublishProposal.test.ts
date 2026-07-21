import assert from "node:assert/strict";
import type { AnalysisResult, AssetCandidate } from "../analyzer/types.ts";
import { validatePublishRequest } from "../../server/catalogPublishValidation.ts";
import { applyCatalogPin, isCatalogPinCompatible } from "./catalogPin.ts";
import type { ProposedAddition } from "./catalogDelta.ts";
import type { CatalogHubEntry } from "./catalogIndex.ts";
import { buildPublishProposal } from "./catalogPublishProposal.ts";

const proposal: ProposedAddition = {
  asset_id: "tool.customer.notice-template",
  asset_type: "tool",
  name: "고객 안내 템플릿 Tool",
  domain_scope: "domain_specific",
  business_domains: ["고객"],
  owner: "AI공통플랫폼팀",
  reuse_status: "publish_candidate",
  capability_tags: ["template"],
  binding: { kind: "function" },
  connection: { transport: "in_process" },
  workflow_profile: null,
  exposure: null
};

assert.deepEqual(buildPublishProposal(proposal), proposal);
assert.deepEqual(validatePublishRequest("req-target-tool", proposal), []);
assert.match(
  validatePublishRequest("req-target-tool", { ...proposal, asset_type: "adapter" }).join("\n"),
  /agent, workflow, tool/
);

const entry: CatalogHubEntry = {
  ...proposal,
  reuse_status: "reuse_existing"
};
const candidate = {
  asset_id: "asset-001",
  source_requirement_id: "req-test",
  catalog_entry_id: null,
  asset_type: "tool",
  name: "Draft Tool",
  domain_scope: "domain_specific",
  business_domains: ["고객"],
  owner: "고객AI팀",
  reuse_status: "not_reviewed",
  capability_tags: [],
  binding: { kind: "unresolved" },
  connection: { transport: "unknown" },
  workflow_profile: null,
  exposure: null,
  inputs: [],
  outputs: []
} as unknown as AssetCandidate;
const analysis = {
  assetCandidates: [candidate],
  graph: { nodes: [{ id: "node-001", label: "Draft Tool", node_kind: "tool", tool_ref: "asset-001", invocation_control: "workflow" }], edges: [] }
} as unknown as AnalysisResult;

assert.equal(isCatalogPinCompatible(candidate, entry), true);
const pinned = applyCatalogPin(analysis, candidate.asset_id, entry);
assert.equal(pinned.assetCandidates[0]?.asset_id, candidate.asset_id);
assert.equal(pinned.assetCandidates[0]?.catalog_entry_id, proposal.asset_id);
const pinnedNode = pinned.graph.nodes[0];
assert.equal(pinnedNode?.node_kind, "tool");
assert.equal(pinnedNode?.node_kind === "tool" ? pinnedNode.tool_ref : null, candidate.asset_id);

const agentA2aEntry = {
  ...entry,
  asset_id: "agent.remote",
  asset_type: "agent",
  binding: { kind: "a2a", contract_ref: "a2a.remote.v1" },
  connection: { transport: "http" },
  exposure: { protocol: "a2a", contract_ref: "a2a.remote.v1" }
} as CatalogHubEntry;
assert.equal(isCatalogPinCompatible(candidate, agentA2aEntry), false, "pin compatibility is asset_type-only");
