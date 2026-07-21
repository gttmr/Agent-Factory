import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";

const catalogRoot = new URL("../../../../catalog/", import.meta.url);
const specs = [
  ["agents.yaml", "agents", "agent", 4],
  ["workflows.yaml", "workflows", "workflow", 2],
  ["tools.yaml", "tools", "tool", 6]
] as const;
const forbiddenKeys = new Set([
  "adapter_kind",
  "owner_domain",
  "access_protocol",
  "component_source",
  "runtime_binding",
  "module_category",
  "subtype",
  "mcp_server",
  "mcp_tool_name"
]);
const assetIds = new Set<string>();

for (const [file, key, assetType, count] of specs) {
  const parsed = parseYaml(readFileSync(new URL(file, catalogRoot), "utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed), [key]);
  const rows = parsed[key];
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, count, `${file} row count`);
  for (const row of rows as Array<Record<string, unknown>>) {
    assert.equal(row.asset_type, assetType);
    assert.equal(typeof row.asset_id, "string");
    assert.ok((row.asset_id as string).length > 0);
    assert.equal(assetIds.has(row.asset_id as string), false, `duplicate asset_id ${row.asset_id}`);
    assetIds.add(row.asset_id as string);
    for (const key of forbiddenKeys) assert.equal(key in row, false, `${row.asset_id} contains ${key}`);
  }
}

assert.equal(existsSync(new URL("adapters.yaml", catalogRoot)), false);
assert.equal(existsSync(new URL("remote-a2a-contracts.yaml", catalogRoot)), false);
