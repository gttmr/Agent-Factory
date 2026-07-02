import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generator, writeFixture } from "./fixtures.mjs";

test("runnable mode rejects Graph IR shapes it cannot lower (v1: DAG + fan-out/fan-in)", () => {
  const cases = [
    { name: "module-bound human_input node", mutate: (pf) => pf.nodes.push({ id: "h1", node_kind: "human_input", module_id: "mod-gen-agent" }) },
    { name: "module-bound input node", mutate: (pf) => { pf.nodes.find((n) => n.id === "in1").module_id = "mod-gen-agent"; } },
    { name: "module-bound output node", mutate: (pf) => { pf.nodes.find((n) => n.id === "out1").module_id = "mod-gen-adapter"; } },
    { name: "module_id-null function node", mutate: (pf) => pf.nodes.push({ id: "f1", node_kind: "function", module_id: null }) },
    { name: "conditional edge", mutate: (pf) => { pf.edges[0].execution_semantics = "conditional"; } },
    { name: "remote boundary edge", mutate: (pf) => { pf.edges[0].is_remote_boundary_crossing = true; } },
    { name: "input->output passthrough", mutate: (pf) => pf.edges.push({ from: "in1", to: "out1", edge_kind: "event_output", execution_semantics: "normal_transition" }) },
    { name: "dangling edge endpoint", mutate: (pf) => pf.edges.push({ from: "mod-gen-agent", to: "ghost", edge_kind: "event_output", execution_semantics: "normal_transition" }) },
    {
      name: "router route to output terminal",
      mutate: (pf) => {
        pf.nodes.push({ id: "done-router", node_kind: "router", module_id: null });
        pf.edges = [
          { from: "in1", to: "mod-gen-agent" },
          { from: "mod-gen-agent", to: "done-router" },
          {
            from: "done-router",
            to: "out1",
            edge_kind: "route",
            execution_semantics: "conditional",
            route_condition: "choice == done"
          }
        ];
      }
    },
    {
      name: "dynamic workflow mixed with router route",
      mutate: (pf) => {
        pf.nodes.push({ id: "done-router", node_kind: "router", module_id: null });
        pf.edges = [
          { from: "in1", to: "mod-gen-agent" },
          { from: "mod-gen-agent", to: "done-router" },
          {
            from: "done-router",
            to: "mod-gen-adapter",
            edge_kind: "route",
            execution_semantics: "conditional",
            route_condition: "choice == done"
          },
          { from: "mod-gen-adapter", to: "out1" }
        ];
        pf.containers = [
          ...(Array.isArray(pf.containers) ? pf.containers : []),
          {
            id: "container-dynamic",
            container_kind: "dynamic_workflow",
            contains_node_ids: ["mod-gen-agent", "done-router", "mod-gen-adapter"],
            entry_node_ids: ["mod-gen-agent"],
            exit_node_ids: ["mod-gen-adapter"]
          }
        ];
      }
    },
    {
      name: "dynamic workflow with module-bound router node",
      mutate: (pf) => {
        pf.nodes.push({ id: "router-module", node_kind: "router", module_id: "mod-gen-agent" });
        pf.edges = [
          { from: "in1", to: "router-module" },
          { from: "router-module", to: "out1" }
        ];
        pf.containers = [
          ...(Array.isArray(pf.containers) ? pf.containers : []),
          {
            id: "container-dynamic",
            container_kind: "dynamic_workflow",
            contains_node_ids: ["router-module"],
            entry_node_ids: ["router-module"],
            exit_node_ids: ["router-module"]
          }
        ];
      }
    },
    { name: "loop_control without loop edges", mutate: (pf) => { pf.nodes.push({ id: "loop-control", node_kind: "loop_control", module_id: null }); } }
  ];
  for (const testCase of cases) {
    const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reject-"));
    try {
      writeFixture(artifactRoot, { runnable: true });
      const pfPath = join(artifactRoot, "process-flow.json");
      const pf = JSON.parse(readFileSync(pfPath, "utf8"));
      testCase.mutate(pf);
      writeFileSync(pfPath, JSON.stringify(pf));
      assert.throws(
        () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
        /does not support|cannot lower/,
        `expected runnable generation to reject: ${testCase.name}`
      );
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  }
});
