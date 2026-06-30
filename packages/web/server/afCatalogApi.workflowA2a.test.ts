import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  matchingDelta,
  componentOnlyRemoteA2aWorkflowDelta,
  matchingWorkflowDelta,
  mismatchedWorkflowDelta,
  postPublish,
  runtimeOnlyRemoteA2aWorkflowDelta,
  staleWorkflowDelta,
  validAdapterProposal,
  validRemoteA2aWorkflowProposal,
  withTempRepo,
  writeDelta,
  writeProviderAgentCard,
  writeProviderRuntimeRoot
} from "./afCatalogApi.test-fixtures.ts";

await withTempRepo(async (repoRoot) => {
  await writeDelta(repoRoot, "req_adapter", matchingDelta);
  const adapterProviderMetadataPublish = await postPublish(repoRoot, {
    req_id: "req_adapter",
    proposal: {
      ...validAdapterProposal,
      a2a_provider_req_id: "req-example"
    }
  });
  assert.equal(adapterProviderMetadataPublish.status, 422);
  assert.match(JSON.stringify(adapterProviderMetadataPublish.body), /a2a_provider_req_id/);

  const adapterRemoteExposurePublish = await postPublish(repoRoot, {
    req_id: "req_adapter",
    proposal: {
      ...validAdapterProposal,
      component_source: "remote_a2a",
      runtime_binding: "remote_a2a"
    }
  });
  assert.equal(adapterRemoteExposurePublish.status, 422);
  assert.match(JSON.stringify(adapterRemoteExposurePublish.body), /remote_a2a/);
  await assert.rejects(readFile(join(repoRoot, "catalog", "adapters.yaml"), "utf8"), /ENOENT/);

  await writeFile(
    join(repoRoot, "catalog", "workflows.yaml"),
    [
      "workflows:",
      "  - id: workflow-remote_review_workflow-v1",
      "    name: remote_review_workflow",
      "    version: 1",
      "    status: published",
      "    module_category: workflow",
      "    workflow_kind: graph",
      "    owner_domain: analysis",
      "    responsibility: Existing published version."
    ].join("\n"),
    "utf8"
  );

  const workflowsPath = join(repoRoot, "catalog", "workflows.yaml");
  await writeDelta(repoRoot, "req_one", staleWorkflowDelta);
  const beforeStaleWorkflowPublish = await readFile(workflowsPath, "utf8");
  const staleWorkflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(staleWorkflowPublish.status, 422);
  assert.match(JSON.stringify(staleWorkflowPublish.body), /catalog-delta\.yaml/);
  assert.match(JSON.stringify(staleWorkflowPublish.body), /component_source|runtime_binding|a2a_provider_req_id/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeStaleWorkflowPublish);

  await writeDelta(repoRoot, "req_one", mismatchedWorkflowDelta);
  const beforeMismatchedWorkflowPublish = await readFile(workflowsPath, "utf8");
  const mismatchedWorkflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(mismatchedWorkflowPublish.status, 422);
  assert.match(JSON.stringify(mismatchedWorkflowPublish.body), /catalog-delta\.yaml/);
  assert.match(JSON.stringify(mismatchedWorkflowPublish.body), /a2a_provider_req_id/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeMismatchedWorkflowPublish);

  await writeDelta(repoRoot, "req_one", componentOnlyRemoteA2aWorkflowDelta);
  const beforeComponentOnlyRemoteA2a = await readFile(workflowsPath, "utf8");
  const componentOnlyRemoteA2aPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      runtime_binding: undefined,
      a2a_provider_req_id: undefined,
      contract_status: undefined
    }
  });
  assert.equal(componentOnlyRemoteA2aPublish.status, 422);
  assert.match(JSON.stringify(componentOnlyRemoteA2aPublish.body), /runtime_binding|a2a_provider_req_id|contract_status/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeComponentOnlyRemoteA2a);

  await writeDelta(repoRoot, "req_one", runtimeOnlyRemoteA2aWorkflowDelta);
  const beforeRuntimeOnlyRemoteA2a = await readFile(workflowsPath, "utf8");
  const runtimeOnlyRemoteA2aPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      component_source: undefined,
      a2a_provider_req_id: undefined,
      contract_status: undefined
    }
  });
  assert.equal(runtimeOnlyRemoteA2aPublish.status, 422);
  assert.match(JSON.stringify(runtimeOnlyRemoteA2aPublish.body), /component_source|a2a_provider_req_id|contract_status/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeRuntimeOnlyRemoteA2a);

  await writeDelta(repoRoot, "req_one", matchingWorkflowDelta);
  const missingProviderId = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      a2a_provider_req_id: undefined
    }
  });
  assert.equal(missingProviderId.status, 422);
  assert.match(JSON.stringify(missingProviderId.body), /a2a_provider_req_id/);

  const incoherentRemoteBinding = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      component_source: "stub"
    }
  });
  assert.equal(incoherentRemoteBinding.status, 422);
  assert.match(JSON.stringify(incoherentRemoteBinding.body), /component_source/);

  const invalidRuntimeBinding = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      runtime_binding: "workflow_call"
    }
  });
  assert.equal(invalidRuntimeBinding.status, 422);
  assert.match(JSON.stringify(invalidRuntimeBinding.body), /runtime_binding/);

  const invalidProviderId = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: {
      ...validRemoteA2aWorkflowProposal,
      a2a_provider_req_id: "Req Example"
    }
  });
  assert.equal(invalidProviderId.status, 422);
  assert.match(JSON.stringify(invalidProviderId.body), /a2a_provider_req_id/);

  const missingProviderRootWorkflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(missingProviderRootWorkflowPublish.status, 422);
  assert.match(JSON.stringify(missingProviderRootWorkflowPublish.body), /req-example/);
  assert.match(JSON.stringify(missingProviderRootWorkflowPublish.body), /Agent Card|provider|runtime-a2a/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeMismatchedWorkflowPublish);

  await mkdir(join(repoRoot, "artifacts", "af", "req-example"), { recursive: true });
  const providerWithoutAgentCardRoutePublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(providerWithoutAgentCardRoutePublish.status, 422);
  assert.match(JSON.stringify(providerWithoutAgentCardRoutePublish.body), /Agent Card|runtime-stub/);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeMismatchedWorkflowPublish);

  await writeProviderRuntimeRoot(repoRoot, "req-example");
  const providerAgentCardPath = join(repoRoot, "artifacts", "af", "req-example", "runtime-stub", "provider_app", "agent.json");
  const providerWithManifestOnlyWorkflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(providerWithManifestOnlyWorkflowPublish.status, 422);
  assert.match(JSON.stringify(providerWithManifestOnlyWorkflowPublish.body), /Agent Card|agent\.json|runtime-stub/);
  assert.equal(await fileExists(providerAgentCardPath), false);
  assert.equal(await readFile(workflowsPath, "utf8"), beforeMismatchedWorkflowPublish);

  await writeProviderAgentCard(repoRoot, "req-example");
  const providerAgentCardBefore = await readFile(providerAgentCardPath, "utf8");
  const providerAgentCardStatBefore = await stat(providerAgentCardPath);
  const workflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(workflowPublish.status, 200);
  assert.equal(workflowPublish.body.ok, true);
  assert.equal(workflowPublish.body.name, validRemoteA2aWorkflowProposal.name);
  assert.equal(workflowPublish.body.version, 2);
  assert.equal(workflowPublish.body.file, "catalog/workflows.yaml");
  assert.equal(await readFile(providerAgentCardPath, "utf8"), providerAgentCardBefore);
  assert.equal((await stat(providerAgentCardPath)).mtimeMs, providerAgentCardStatBefore.mtimeMs);

  const afterWorkflowPublish = await readFile(workflowsPath, "utf8");
  assert.match(afterWorkflowPublish, /component_source: remote_a2a/);
  assert.match(afterWorkflowPublish, /runtime_binding: remote_a2a/);
  assert.match(afterWorkflowPublish, /a2a_provider_req_id: req-example/);
  assert.match(afterWorkflowPublish, /contract_status: a2a_ready/);
  assert.match(afterWorkflowPublish, /risk_signals:/);
  assert.match(afterWorkflowPublish, /audit_required/);
  assert.match(afterWorkflowPublish, /required_before_approval:/);
  assert.match(afterWorkflowPublish, /provider Agent Card route verified/);
  assert.match(afterWorkflowPublish, /published_from: req_one/);
  assert.match(afterWorkflowPublish, /source_candidate_id: workflow-candidate/);
  assert.match(afterWorkflowPublish, /workflow_kind: graph/);
  assert.match(afterWorkflowPublish, /composition:/);

  const repeatedWorkflowPublish = await postPublish(repoRoot, {
    req_id: "req_one",
    proposal: validRemoteA2aWorkflowProposal
  });
  assert.equal(repeatedWorkflowPublish.status, 200);
  assert.equal(repeatedWorkflowPublish.body.already_published, true);
  assert.equal(repeatedWorkflowPublish.body.version, 2);
  assert.equal(repeatedWorkflowPublish.body.file, "catalog/workflows.yaml");
  assert.equal(await readFile(workflowsPath, "utf8"), afterWorkflowPublish);
});

async function fileExists(path: string): Promise<boolean> {
  return await stat(path)
    .then(() => true)
    .catch((error: unknown) => {
      if (isErrnoException(error) && error.code === "ENOENT") return false;
      throw error;
    });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
