import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { matchingDelta, postPublish, validAdapterProposal, withTempRepo, writeDelta } from "./afCatalogApi.test-fixtures.ts";

await withTempRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, "catalog", "adapters.yaml"), "adapters: []\n", "utf8");

  const invalidReq = await postPublish(repoRoot, {
    req_id: "../bad",
    proposal: validAdapterProposal
  });
  assert.equal(invalidReq.status, 422);
  assert.match(JSON.stringify(invalidReq.body), /req_id/);

  const missingRoot = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(missingRoot.status, 422);
  assert.match(JSON.stringify(missingRoot.body), /artifact root/);

  await mkdir(join(repoRoot, "artifacts", "af", "req_one"), { recursive: true });
  const missingDelta = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(missingDelta.status, 422);
  assert.match(JSON.stringify(missingDelta.body), /catalog-delta\.yaml/);

  await writeDelta(repoRoot, "req_one", matchingDelta);
  const invalidFields = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validAdapterProposal,
      inputs: [{ name: "customer_id" }],
      composition: ["template_render", 1]
    }
  });
  assert.equal(invalidFields.status, 422);
  assert.match(JSON.stringify(invalidFields.body), /inputs/);
  assert.match(JSON.stringify(invalidFields.body), /composition/);

  const firstPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(firstPublish.status, 200);
  assert.equal(firstPublish.body.ok, true);
  assert.equal(firstPublish.body.name, validAdapterProposal.name);
  assert.equal(firstPublish.body.version, 1);
  assert.equal(firstPublish.body.file, "catalog/adapters.yaml");

  const catalogPath = join(repoRoot, "catalog", "adapters.yaml");
  const afterFirstPublish = await readFile(catalogPath, "utf8");
  assert.match(afterFirstPublish, /published_from: req_one/);

  const secondPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validAdapterProposal
  });
  assert.equal(secondPublish.status, 200);
  assert.equal(secondPublish.body.already_published, true);
  assert.equal(secondPublish.body.version, 1);
  assert.equal(secondPublish.body.file, "catalog/adapters.yaml");
  assert.equal(await readFile(catalogPath, "utf8"), afterFirstPublish);
});
