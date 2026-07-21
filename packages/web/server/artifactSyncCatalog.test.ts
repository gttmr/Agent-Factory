import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadServerScaffoldCatalog } from "./artifactSyncCatalog.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "artifact-sync-catalog-"));
const catalogDir = join(repoRoot, "catalog");
await mkdir(catalogDir, { recursive: true });

const common = [
  "    domain_scope: domain_neutral",
  "    business_domains: []",
  "    owner: AI공통플랫폼팀",
  "    reuse_status: reuse_existing",
  "    capability_tags: []"
];

try {
  await writeFile(join(catalogDir, "agents.yaml"), [
    "agents:",
    "  - asset_id: agent.summary",
    "    asset_type: agent",
    "    name: Summary Agent",
    ...common,
    "    binding: null",
    "    connection: null",
    "    workflow_profile: null",
    "    exposure: null"
  ].join("\n"), "utf8");
  await writeFile(join(catalogDir, "workflows.yaml"), [
    "workflows:",
    "  - asset_id: workflow.review",
    "    asset_type: workflow",
    "    name: Review Workflow",
    ...common,
    "    binding: null",
    "    connection: null",
    "    workflow_profile: { representation: graph, coordination: explicit, template_ref: null }",
    "    exposure: null"
  ].join("\n"), "utf8");
  await writeFile(join(catalogDir, "tools.yaml"), [
    "tools:",
    "  - asset_id: tool.fetch-case",
    "    asset_type: tool",
    "    name: Fetch Case Tool",
    ...common,
    "    binding: { kind: mcp, server_ref: mock-lab, tool_name: fetch_case }",
    "    connection: { transport: stdio }",
    "    workflow_profile: null",
    "    exposure: null",
    "    runtime_mock: { ok: true }"
  ].join("\n"), "utf8");

  const loaded = await loadServerScaffoldCatalog(repoRoot);
  assert.deepEqual(loaded.map((entry) => entry.asset_id), ["agent.summary", "workflow.review", "tool.fetch-case"]);
  assert.equal(loaded[2]?.binding?.kind, "mcp");
  assert.deepEqual(loaded[2]?.runtime_mock, { ok: true });

  await rm(join(catalogDir, "tools.yaml"));
  await assert.rejects(() => loadServerScaffoldCatalog(repoRoot), /tools\.yaml|ENOENT/);
  await writeFile(join(catalogDir, "tools.yaml"), "tools: invalid\n", "utf8");
  await assert.rejects(() => loadServerScaffoldCatalog(repoRoot), /tools 배열/);
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}
