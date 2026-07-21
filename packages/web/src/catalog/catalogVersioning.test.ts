import assert from "node:assert/strict";
import {
  dedupeKeepLatestPublished,
  entryVersion,
  latestByAssetId,
  nextVersionForAssetId
} from "./catalogVersioning.ts";

const entries = [
  { asset_id: "tool.shared", name: "Shared", version: 1, status: "published" },
  { asset_id: "tool.shared", name: "Renamed shared", version: 3, status: "deprecated" },
  { asset_id: "tool.shared", name: "Renamed shared", version: 2, status: "published" },
  { asset_id: "tool.other", name: "Shared", version: 4, status: "published" }
];

assert.equal(entryVersion({ version: 2 }), 2);
assert.equal(entryVersion({ version: 2.5 }), 2.5);
assert.equal(entryVersion({ version: "2" }), 0);
assert.equal(entryVersion({ version: Infinity }), 0);

assert.deepEqual(latestByAssetId(entries, "tool.shared"), entries[1]);
assert.equal(nextVersionForAssetId(entries, "tool.shared"), 4);
assert.equal(nextVersionForAssetId(entries, "tool.new"), 1);
assert.deepEqual(dedupeKeepLatestPublished(entries), [entries[2], entries[3]]);
