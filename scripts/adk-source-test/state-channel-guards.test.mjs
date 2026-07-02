import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable rejects an agent with conflicting outgoing state channels", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "분기_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "B_Adapter" },
    { ...unconnectedAdapter, id: "mod-c", name: "C_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-channel-conflict-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "b", edge_kind: "session_state", state_key: "k1" },
        { from: "a", to: "c", edge_kind: "session_state", state_key: "k2" },
        { from: "b", to: "out1" },
        { from: "c", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /multiple distinct outgoing state channels/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects state channels consumed by non-connected adapter stubs", () => {
  const { unconnectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-b", name: "B_Adapter" },
    { ...unconnectedAdapter, id: "mod-c", name: "C_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-state-stub-consumer-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "b" },
        { from: "b", to: "c", edge_kind: "session_state", state_key: "handoff_payload" },
        { from: "c", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /state channel consumed by non-connected node/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
