import assert from "node:assert/strict";
import { dedupeKeepLatestPublished, entryVersion, latestByName, nextVersionForName } from "./catalogVersioning.ts";

const entries = [
  { name: "shared", version: 1, status: "published" },
  { name: "shared", version: 3, status: "deprecated" },
  { name: "shared", version: 2, status: "published" },
  { name: "other", version: 4, status: "published" }
];

assert.equal(entryVersion({ version: 2 }), 2);
// finite non-integer 버전도 그대로 점수화한다(원래 client hydration 의미). 비-숫자는 0.
assert.equal(entryVersion({ version: 2.5 }), 2.5);
assert.equal(entryVersion({ version: "2" }), 0);
assert.equal(entryVersion({ version: Infinity }), 0);

assert.deepEqual(latestByName(entries, "shared"), entries[1]);
assert.equal(nextVersionForName(entries, "shared"), 4);
assert.equal(nextVersionForName(entries, "new_name"), 1);

assert.deepEqual(dedupeKeepLatestPublished(entries), [entries[2], entries[3]]);
