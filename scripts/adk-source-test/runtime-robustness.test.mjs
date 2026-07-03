import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable connected MCP adapter failure degrades to a JSON-safe synthetic payload", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-mcp-degraded-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules: [
        { ...connectedAdapter, id: "mod-lookup", name: "Lookup Adapter" },
        { ...agentBase, id: "mod-agent", name: "Summary Agent" }
      ],
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "lookup", node_kind: "adapter_call", module_id: "mod-lookup" },
        { id: "agent", node_kind: "agent", module_id: "mod-agent" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "lookup" },
        { from: "lookup", to: "agent" },
        { from: "agent", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /import asyncio/);
    assert.match(source, /async with asyncio\.timeout\(5\):/);
    assert.match(source, /except Exception as exc:/, "MCP connect\/init\/call failures must be handled locally");
    assert.match(source, /"connection_status": "mcp_degraded"/);
    assert.match(source, /"status": "mcp_unreachable_degraded"/);
    assert.match(source, /"server": "test-mcp"/);
    assert.match(source, /"url": url/);
    assert.match(source, /"tool": "lookup_test_data"/);
    assert.match(source, /"reason": _short_error_reason\(exc\)/);
    assert.doesNotMatch(source, /"previous": node_input/);
    assert.doesNotMatch(source, /return node_input/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
