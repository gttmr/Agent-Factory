import assert from "node:assert/strict";
import { findSimplePaths } from "./pathSearch.ts";
import type { GraphIR } from "../analyzer/types.ts";

const graph = {
  version: 1,
  nodes: [
    { id: "start", label: "Start", node_kind: "input", lane_id: "input" },
    { id: "a", label: "A", node_kind: "agent", lane_id: "local_graph", module_id: "mod-a" },
    { id: "b", label: "B", node_kind: "workflow", lane_id: "local_graph", module_id: "mod-b" },
    { id: "c", label: "C", node_kind: "adapter", lane_id: "adapter", module_id: "mod-c" },
    { id: "end", label: "End", node_kind: "output", lane_id: "output" }
  ],
  edges: [
    { id: "e-start-a", from: "start", to: "a", edge_kind: "event_output", execution_semantics: "sync" },
    { id: "e-a-b", from: "a", to: "b", edge_kind: "event_output", execution_semantics: "sync" },
    { id: "e-b-end", from: "b", to: "end", edge_kind: "event_output", execution_semantics: "sync" },
    { id: "e-a-c", from: "a", to: "c", edge_kind: "event_output", execution_semantics: "sync" },
    { id: "e-c-end", from: "c", to: "end", edge_kind: "event_output", execution_semantics: "sync" },
    { id: "e-b-a", from: "b", to: "a", edge_kind: "control", execution_semantics: "async" }
  ],
  containers: [],
  validation: { errors: [], warnings: [] }
} as unknown as GraphIR;

const paths = findSimplePaths(graph, "start", "end", 5);
assert.deepEqual(paths.map((path) => path.nodeIds), [
  ["start", "a", "b", "end"],
  ["start", "a", "c", "end"]
]);
assert.deepEqual(paths[0]?.edgeIds, ["e-start-a", "e-a-b", "e-b-end"]);
assert.deepEqual(paths[1]?.edgeIds, ["e-start-a", "e-a-c", "e-c-end"]);

assert.deepEqual(findSimplePaths(graph, "c", "start", 5), []);
assert.deepEqual(findSimplePaths(graph, "start", "start", 5), [{ nodeIds: ["start"], edgeIds: [] }]);
assert.equal(findSimplePaths(graph, "start", "end", 1).length, 1);
