import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  getCatalog,
  postPublish,
  validAgentA2aProposal,
  validToolProposal,
  withTempRepo,
  writeCanonicalCatalogs,
  writeDelta
} from "./afCatalogApi.test-fixtures.ts";

await withTempRepo(async (repoRoot) => {
  await writeCanonicalCatalogs(repoRoot);
  const catalog = await getCatalog(repoRoot);
  assert.equal(catalog.status, 200);
  assert.deepEqual(Object.keys(catalog.body).sort(), ["agents", "tools", "workflows"]);
  assert.deepEqual(catalog.body, { agents: { agents: [] }, workflows: { workflows: [] }, tools: { tools: [] } });
});

await withTempRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, "catalog", "agents.yaml"), "agents: []\n", "utf8");
  await writeFile(join(repoRoot, "catalog", "workflows.yaml"), "workflows: []\n", "utf8");
  const missing = await getCatalog(repoRoot);
  assert.equal(missing.status, 500);
  assert.match(String(missing.body.error), /tools\.yaml|ENOENT/);
});

await withTempRepo(async (repoRoot) => {
  await writeCanonicalCatalogs(repoRoot);
  await writeFile(join(repoRoot, "catalog", "tools.yaml"), "tools: [not-valid\n", "utf8");
  const malformed = await getCatalog(repoRoot);
  assert.equal(malformed.status, 500);
});

await withTempRepo(async (repoRoot) => {
  await writeCanonicalCatalogs(repoRoot);
  const oldCategory = await postPublish(repoRoot, {
    req_id: "req_old",
    proposal: { ...validToolProposal, asset_type: "adapter" }
  });
  assert.equal(oldCategory.status, 422);
  assert.match(JSON.stringify(oldCategory.body), /agent, workflow, tool/);

  await writeDelta(repoRoot, "req_one", [validToolProposal]);
  const first = await postPublish(repoRoot, { req_id: "req_one", proposal: validToolProposal });
  assert.equal(first.status, 200);
  assert.equal(first.body.asset_id, validToolProposal.asset_id);
  assert.equal(first.body.version, 1);
  assert.equal(first.body.file, "catalog/tools.yaml");

  const firstText = await readFile(join(repoRoot, "catalog", "tools.yaml"), "utf8");
  assert.doesNotMatch(firstText, /module_category|adapter_kind|owner_domain|runtime_binding/);
  const firstDoc = parseYaml(firstText) as { tools: Array<Record<string, unknown>> };
  assert.deepEqual(firstDoc.tools[0]?.runtime_mock, validToolProposal.runtime_mock);
  const repeated = await postPublish(repoRoot, { req_id: "req_one", proposal: validToolProposal });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.already_published, true);
  assert.equal(await readFile(join(repoRoot, "catalog", "tools.yaml"), "utf8"), firstText);

  const renamed = { ...validToolProposal, name: "고객 안내문 Tool" };
  await writeDelta(repoRoot, "req_two", [renamed]);
  const second = await postPublish(repoRoot, { req_id: "req_two", proposal: renamed });
  assert.equal(second.status, 200);
  assert.equal(second.body.version, 2, "display name changes stay on the asset_id version line");

  const sameNameDifferentId = { ...renamed, asset_id: "tool.customer.notice-template-v2" };
  await writeDelta(repoRoot, "req_three", [sameNameDifferentId]);
  const independent = await postPublish(repoRoot, { req_id: "req_three", proposal: sameNameDifferentId });
  assert.equal(independent.status, 200);
  assert.equal(independent.body.version, 1, "same display name does not merge different asset IDs");

  await writeDelta(repoRoot, "req_agent", [validAgentA2aProposal]);
  const agent = await postPublish(repoRoot, { req_id: "req_agent", proposal: validAgentA2aProposal });
  assert.equal(agent.status, 200);
  assert.equal(agent.body.file, "catalog/agents.yaml");
  const agentDoc = parseYaml(await readFile(join(repoRoot, "catalog", "agents.yaml"), "utf8")) as {
    agents: Array<Record<string, unknown>>;
  };
  assert.equal((agentDoc.agents[0]?.binding as Record<string, unknown>).kind, "a2a");
  assert.deepEqual(agentDoc.agents[0]?.exposure, { protocol: "a2a", contract_ref: "a2a.partner.remote-review.v1" });
});

await withTempRepo(async (repoRoot) => {
  await writeCanonicalCatalogs(repoRoot);
  const toolsBefore = await readFile(join(repoRoot, "catalog", "tools.yaml"), "utf8");
  const unresolvedTool = {
    ...validToolProposal,
    asset_id: "tool.unresolved",
    binding: { kind: "unresolved" },
    connection: { transport: "unknown" }
  };
  await writeDelta(repoRoot, "req_unresolved_tool", [unresolvedTool]);
  const toolResponse = await postPublish(repoRoot, { req_id: "req_unresolved_tool", proposal: unresolvedTool });
  assert.equal(toolResponse.status, 422);
  assert.match(JSON.stringify(toolResponse.body), /binding.*unresolved|transport.*unknown/);
  assert.equal(await readFile(join(repoRoot, "catalog", "tools.yaml"), "utf8"), toolsBefore);

  const workflowsBefore = await readFile(join(repoRoot, "catalog", "workflows.yaml"), "utf8");
  const unresolvedWorkflow = {
    asset_id: "workflow.unresolved",
    asset_type: "workflow",
    name: "Unresolved Workflow",
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "AI공통플랫폼팀",
    reuse_status: "publish_candidate",
    capability_tags: [],
    binding: null,
    connection: null,
    workflow_profile: { representation: "unresolved", coordination: "explicit", template_ref: null },
    exposure: null,
    responsibility: "검토되지 않은 실행 구조"
  };
  await writeDelta(repoRoot, "req_unresolved_workflow", [unresolvedWorkflow]);
  const workflowResponse = await postPublish(repoRoot, { req_id: "req_unresolved_workflow", proposal: unresolvedWorkflow });
  assert.equal(workflowResponse.status, 422);
  assert.match(JSON.stringify(workflowResponse.body), /workflow_profile.*unresolved/);
  assert.equal(await readFile(join(repoRoot, "catalog", "workflows.yaml"), "utf8"), workflowsBefore);
});
