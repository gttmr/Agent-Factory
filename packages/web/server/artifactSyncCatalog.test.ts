import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogIndex } from "../src/catalog/catalogIndex.ts";
import { catalogIndexToScaffoldCatalog } from "../src/catalog/scaffoldCatalog.ts";
import { loadServerScaffoldCatalog } from "./artifactSyncCatalog.ts";

const expectedIndex = {
  agents: [
    {
      id: "seed-agent-summary-v2",
      category: "agent",
      name: "Summary Agent",
      version: 2,
      agent_kind: "specialist",
      owner_domain: "analysis",
      status: "approved",
      component_source: "stub",
      responsibility: "Summarize reviewed evidence.",
      inputs: [{ name: "case_id", type: "string", required: true }],
      outputs: [{ name: "summary", type: "string" }],
      risk_signals: ["audit_required"],
      scaffold_output: "agents/summary_agent.py",
      notes: "Seeded for loader parity.",
      provenance: "seeded",
      published_at: "2026-06-29T00:00:00.000Z",
      published_from: "req-loader",
      source_candidate_id: "candidate-summary",
      runtime_mock: { response: "summary" },
      required_before_approval: ["owner_review"],
      subtype: "evidence"
    }
  ],
  workflows: [
    {
      id: "seed-workflow-review",
      category: "workflow",
      name: "Review Workflow",
      workflow_kind: "graph",
      owner_domain: "analysis",
      status: "approved",
      component_source: "remote_a2a",
      runtime_binding: "remote_a2a",
      a2a_provider_req_id: "req-example",
      responsibility: "Route review and adapter calls.",
      composition: ["seed-agent-summary-v2", "seed-adapter-mock-lab"],
      scaffold_output: "workflows/review_workflow.py",
      runtime_mock: null,
      required_before_approval: ["validation"]
    }
  ],
  adapters: [
    {
      id: "seed-adapter-mock-lab",
      category: "adapter",
      name: "Mock Lab Adapter",
      version: 3,
      adapter_kind: "external_service",
      owner_domain: "analysis",
      status: "approved",
      component_source: "mcp",
      access_protocol: "mcp",
      runtime_binding: "mcp",
      mcp_server: "mock-lab",
      mcp_tool_name: "fetch_case",
      mcp_schema_ref: "schemas/mock-lab.fetch_case.json",
      mcp_auth_mode: "none",
      contract_status: "approved",
      inputs: [{ name: "case_id", type: "string", required: true }],
      outputs: [{ name: "case", type: "object", required: true }],
      runtime_mock: { tool: "fetch_case", result: { ok: true } },
      risk_signals: ["external_message"]
    }
  ],
  remoteA2A: [
    {
      id: "remote_a2a:Remote Review Agent",
      category: "remote_a2a",
      name: "Remote Review Agent",
      remote_contract_kind: "a2a",
      owner_domain: "analysis",
      status: "needs_info",
      component_source: "remote_a2a",
      access_protocol: "http_rest",
      runtime_binding: "remote_a2a",
      contract_status: "draft",
      responsibility: "External review boundary.",
      inputs: [{ name: "task_id", type: "string", required: true }],
      outputs: [{ name: "decision", type: "string" }],
      notes: "Remote boundary remains high-friction."
    }
  ],
  domainOwners: null,
  contracts: {},
  riskGates: null
} satisfies CatalogIndex;

async function writeCatalogFixture(root: string): Promise<void> {
  const catalogDir = join(root, "catalog");
  await mkdir(catalogDir, { recursive: true });
  await Promise.all([
    writeFile(join(catalogDir, "agents.yaml"), agentsYaml, "utf8"),
    writeFile(join(catalogDir, "workflows.yaml"), workflowsYaml, "utf8"),
    writeFile(join(catalogDir, "adapters.yaml"), adaptersYaml, "utf8"),
    writeFile(join(catalogDir, "remote-a2a-contracts.yaml"), remoteA2aYaml, "utf8")
  ]);
}

const agentsYaml = `
agents:
  - id: seed-agent-summary
    name: Summary Agent
    version: 1
    status: approved
    agent_kind: specialist
    responsibility: Stale active row should not be selected.
    runtime_mock:
      response: stale
  - id: seed-agent-summary-deprecated
    name: Summary Agent
    version: 3
    status: deprecated
    agent_kind: specialist
    responsibility: Deprecated newer row should not be selected.
    runtime_mock:
      response: deprecated
  - id: seed-agent-summary-v2
    name: Summary Agent
    version: 2
    agent_kind: specialist
    owner_domain: analysis
    status: approved
    component_source: stub
    responsibility: Summarize reviewed evidence.
    inputs:
      - name: case_id
        type: string
        required: true
    outputs:
      - name: summary
        type: string
    risk_signals:
      - audit_required
    scaffold_output: agents/summary_agent.py
    notes: Seeded for loader parity.
    provenance: seeded
    published_at: "2026-06-29T00:00:00.000Z"
    published_from: req-loader
    source_candidate_id: candidate-summary
    runtime_mock:
      response: summary
    required_before_approval:
      - owner_review
    subtype: evidence
`;

const workflowsYaml = `
workflows:
  - id: seed-workflow-review
    name: Review Workflow
    workflow_kind: graph
    owner_domain: analysis
    status: approved
    component_source: remote_a2a
    runtime_binding: remote_a2a
    a2a_provider_req_id: req-example
    responsibility: Route review and adapter calls.
    composition:
      - seed-agent-summary-v2
      - seed-adapter-mock-lab
    scaffold_output: workflows/review_workflow.py
    runtime_mock: null
    required_before_approval:
      - validation
`;

const adaptersYaml = `
adapters:
  - id: seed-adapter-mock-lab
    name: Mock Lab Adapter
    version: 3
    adapter_kind: external_service
    owner_domain: analysis
    status: approved
    component_source: mcp
    access_protocol: mcp
    runtime_binding: mcp
    mcp_server: mock-lab
    mcp_tool_name: fetch_case
    mcp_schema_ref: schemas/mock-lab.fetch_case.json
    mcp_auth_mode: none
    contract_status: approved
    inputs:
      - name: case_id
        type: string
        required: true
    outputs:
      - name: case
        type: object
        required: true
    runtime_mock:
      tool: fetch_case
      result:
        ok: true
    risk_signals:
      - external_message
`;

const remoteA2aYaml = `
remote_a2a_contracts:
  - name: Remote Review Agent
    remote_contract_kind: a2a
    owner_domain: analysis
    status: needs_info
    component_source: remote_a2a
    access_protocol: http_rest
    runtime_binding: remote_a2a
    contract_status: draft
    responsibility: External review boundary.
    inputs:
      - name: task_id
        type: string
        required: true
    outputs:
      - name: decision
        type: string
    notes: Remote boundary remains high-friction.
`;

const repoRoot = await mkdtemp(join(tmpdir(), "artifact-sync-catalog-"));

try {
  await writeCatalogFixture(repoRoot);
  const loaded = await loadServerScaffoldCatalog(repoRoot);
  const expected = catalogIndexToScaffoldCatalog(expectedIndex);

  assert.deepEqual(loaded, expected);
  assert.equal(loaded.find((entry) => entry.id === "seed-agent-summary-v2")?.responsibility, "Summarize reviewed evidence.");
  assert.equal(loaded.some((entry) => entry.id === "seed-agent-summary-deprecated"), false);
  assert.equal(loaded.find((entry) => entry.id === "seed-adapter-mock-lab")?.runtime_binding, "mcp");
  assert.deepEqual(loaded.find((entry) => entry.id === "seed-adapter-mock-lab")?.runtime_mock, {
    tool: "fetch_case",
    result: { ok: true }
  });
  assert.equal(loaded.find((entry) => entry.id === "seed-workflow-review")?.component_source, "remote_a2a");
  assert.equal(loaded.find((entry) => entry.id === "seed-workflow-review")?.runtime_binding, "remote_a2a");
  assert.equal(loaded.find((entry) => entry.id === "seed-workflow-review")?.a2a_provider_req_id, "req-example");
  assert.equal(loaded.find((entry) => entry.id === "remote_a2a:Remote Review Agent")?.runtime_binding, "remote_a2a");
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}
