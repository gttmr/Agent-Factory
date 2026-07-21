import assert from "node:assert/strict";
import { parseCatalogIndexPayload, type CatalogIndex } from "./catalogIndex.ts";
import { catalogIndexToScaffoldCatalog } from "./scaffoldCatalog.ts";

const base = {
  domain_scope: "domain_neutral" as const,
  business_domains: [],
  owner: "AI공통플랫폼팀",
  reuse_status: "reuse_existing" as const,
  capability_tags: [],
  status: "published"
};
const index: CatalogIndex = {
  agents: [{
    ...base,
    asset_id: "agent.partner",
    asset_type: "agent",
    name: "Partner Agent",
    binding: { kind: "a2a", contract_ref: "a2a.partner.v1" },
    connection: { transport: "http" },
    workflow_profile: null,
    exposure: { protocol: "a2a", contract_ref: "a2a.partner.v1" }
  }],
  workflows: [{
    ...base,
    asset_id: "workflow.review",
    asset_type: "workflow",
    name: "Review Workflow",
    binding: null,
    connection: null,
    workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
    exposure: null
  }],
  tools: [{
    ...base,
    asset_id: "tool.lookup",
    asset_type: "tool",
    name: "Lookup Tool",
    binding: { kind: "mcp", server_ref: "lookup-mock", tool_name: "lookup" },
    connection: { transport: "stdio" },
    workflow_profile: null,
    exposure: null
  }]
};

const catalog = catalogIndexToScaffoldCatalog(index);
assert.deepEqual(catalog.map((entry) => entry.asset_id), ["agent.partner", "workflow.review", "tool.lookup"]);
assert.equal(catalog[0]?.binding?.kind, "a2a");
assert.equal(catalog[2]?.binding?.kind, "mcp");
assert.equal(catalog.every((entry) => entry.provenance === "seeded"), true);

const payload = {
  agents: { agents: index.agents },
  workflows: { workflows: index.workflows },
  tools: { tools: index.tools }
};
assert.deepEqual(parseCatalogIndexPayload(payload).tools[0]?.asset_id, "tool.lookup");
assert.throws(() => parseCatalogIndexPayload({ ...payload, adapters: { adapters: [] } }), /세 bucket만/);
assert.throws(
  () => parseCatalogIndexPayload({ ...payload, tools: { tools: [{ ...payload.tools.tools[0], owner: undefined }] } }),
  /owner/
);
assert.throws(
  () => parseCatalogIndexPayload({
    ...payload,
    tools: {
      tools: [{
        ...payload.tools.tools[0],
        binding: { kind: "mcp", server_ref: "lookup-mock", tool_name: "lookup", mcp_server: "legacy" }
      }]
    }
  }),
  /binding 필드 구성/
);
