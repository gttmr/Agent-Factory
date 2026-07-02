import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import {
  readJson,
  runValidatorExpectingFailure,
  savedFixturesRoot,
  tempArtifactRoot,
  validator,
  writeJson
} from "./validate-artifacts-test-utils.mjs";

test("validate-artifacts accepts saved-analysis catalog snapshots", () => {
  execFileSync(process.execPath, [validator, savedFixturesRoot], { encoding: "utf8", stdio: "pipe" });
});

test("validate-artifacts rejects saved-analysis catalog ids missing from the saved snapshot", () => {
  const fixtureRoot = tempSavedFixtureRoot((record) => {
    mutateSavedCandidate(record, "mod-002", (candidate) => {
      candidate.catalog_entry_id = "missing-catalog-entry";
    });
  });

  const result = runValidatorExpectingFailure(fixtureRoot);
  assert.match(result.stderr, /catalog_entry_id missing-catalog-entry is not in the saved catalog snapshot/);
});

test("validate-artifacts rejects saved-analysis MCP refs that drift from the saved catalog entry", () => {
  const fixtureRoot = tempSavedFixtureRoot((record) => {
    const entry = record.catalogEntries.find((catalogEntry) => catalogEntry.id === "seed-adapter-legacy_core_sql_query_adapter");
    assert.ok(entry);
    entry.mcp_schema_ref = "catalog.banking.legacy_core_sql.changed.v1";
  });

  const result = runValidatorExpectingFailure(fixtureRoot);
  assert.match(result.stderr, /mcp_schema_ref does not match saved catalog entry/);
});

test("validate-artifacts rejects saved-analysis live MCP fallback refs without a contract", () => {
  const fixtureRoot = tempSavedFixtureRoot((record) => {
    mutateSavedCandidate(record, "mod-002", (candidate) => {
      candidate.catalog_entry_id = null;
      candidate.mcp_schema_ref = "catalog.banking.missing_contract.v1";
    });
  });

  const result = runValidatorExpectingFailure(fixtureRoot);
  assert.match(result.stderr, /mcp_schema_ref catalog\.banking\.missing_contract\.v1 has no catalog\/contracts\/mcp contract/);
});

function tempSavedFixtureRoot(mutate) {
  const fixtureRoot = tempArtifactRoot("af-validator-saved-analysis-");
  const record = readJson(join(savedFixturesRoot, "catalog-scaffold-ready.json"));
  mutate(record);
  writeJson(join(fixtureRoot, "catalog-scaffold-ready.json"), record);
  return fixtureRoot;
}

function mutateSavedCandidate(record, candidateId, mutate) {
  for (const candidateList of [record.analysis.moduleCandidates, record.moduleCandidates]) {
    const candidate = candidateList.find((item) => item.id === candidateId);
    assert.ok(candidate);
    mutate(candidate);
  }
}
