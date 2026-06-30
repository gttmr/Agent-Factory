import assert from "node:assert/strict";
import { catalogIndexToScaffoldCatalog } from "./scaffoldCatalog.ts";
import type { CatalogIndex } from "./catalogIndex.ts";

const index: CatalogIndex = {
  agents: [],
  workflows: [
    {
      id: "workflow:loan_review",
      category: "workflow",
      name: "loan_review",
      version: 2,
      workflow_kind: "graph",
      owner_domain: "여신",
      status: "published",
      responsibility: "여신 workflow",
      inputs: [{ name: "application", type: "object", required: true }],
      outputs: [{ name: "decision", type: "object", required: true }],
      composition: ["review"]
    }
  ],
  adapters: [],
  remoteA2A: [
    {
      id: "remote_a2a:partner",
      category: "remote_a2a",
      name: "partner",
      remote_contract_kind: "a2a"
    }
  ],
  domainOwners: null,
  contracts: {},
  riskGates: null
};

const catalog = catalogIndexToScaffoldCatalog(index);

assert.equal(catalog.length, 2);
assert.equal(catalog[0]?.module_category, "workflow");
assert.equal(catalog[0]?.owner_domain, "여신");
assert.deepEqual(catalog[0]?.composition, ["review"]);
assert.equal(catalog[0]?.runtime_binding, "unresolved");
assert.equal(catalog[1]?.module_category, "remote_a2a");
assert.equal(catalog[1]?.remote_contract_kind, "a2a");
assert.equal(catalog[1]?.runtime_binding, "remote_a2a");
