import assert from "node:assert/strict";
import { findSimplePaths } from "./pathSearch.ts";
import type { GraphIR } from "../analyzer/types.ts";

const graph = {
  graph_id: "graph-paths",
  source_requirement_id: "req-paths",
  workflow_ref: "asset-root",
  nodes: [
    { id: "start", label: "Start", node_kind: "input" },
    { id: "a", label: "A", node_kind: "agent", agent_ref: "asset-a", available_tools: [] },
    { id: "b", label: "B", node_kind: "subworkflow", workflow_ref: "asset-b" },
    { id: "c", label: "C", node_kind: "tool", tool_ref: "asset-c", invocation_control: "workflow" },
    { id: "end", label: "End", node_kind: "output" }
  ],
  edges: [
    { id: "e-start-a", from: "start", to: "a", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "e-a-b", from: "a", to: "b", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "e-b-end", from: "b", to: "end", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "e-a-c", from: "a", to: "c", control: { kind: "fan_out", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "e-c-end", from: "c", to: "end", control: { kind: "fan_in", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "e-b-a", from: "b", to: "a", control: { kind: "loop_back", condition: null, accepted_aliases: [], default: false }, channel: null }
  ],
  regions: []
} satisfies GraphIR;

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
