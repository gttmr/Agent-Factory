import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  discoverGeneratedPackage,
  generateBundle,
  repoRoot,
  writeChannelFixture
} from "./fixtures.mjs";

test("runnable merges reviewed route branches that converge on one runtime target", () => {
  const analysis = JSON.parse(
    readFileSync(
      join(
        repoRoot,
        "templates",
        "regression-scenarios",
        "scenario-l-route-convergence",
        "analysis-result.json"
      ),
      "utf8"
    )
  );
  const graphModuleIds = new Set(analysis.processFlow.nodes.map((node) => node.module_id).filter(Boolean));
  const modules = analysis.moduleCandidates.filter((module) => graphModuleIds.has(module.id));
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-route-convergence-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: analysis.processFlow.nodes,
      edges: analysis.processFlow.edges,
      containers: analysis.processFlow.containers
    });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const source = readFileSync(join(outputRoot, discoverGeneratedPackage(outputRoot), "agent.py"), "utf8");
    const routeMap = source.match(/\(node_router_001,\s*\{([\s\S]*?)\}\s*\),/);
    assert.ok(routeMap, "generated Workflow must contain the reviewed router dispatch map");
    const routeRows = [...routeMap[1].matchAll(/^\s*"([^"]+)":\s*([A-Za-z_]\w*),$/gm)].map((match) => ({
      route: match[1],
      target: match[2]
    }));
    const runtimePairs = routeRows.map((row) => `node_router_001->${row.target}`);
    assert.equal(
      new Set(runtimePairs).size,
      runtimePairs.length,
      `generated Workflow contains duplicate (from,to) route edges: ${runtimePairs.join(", ")}`
    );
    assert.deepEqual(routeRows, [{ route: "path_alpha|path_beta", target: "node_mod_sink" }]);
    assert.match(
      source,
      /if _route_text_matches\(text, \["path_alpha", "path alpha", "path-alpha", "alpha_alias"\]\):\s*return Event\(route="path_alpha\|path_beta", output=_json_safe_node_value\(node_input\)\)/
    );
    assert.match(
      source,
      /if _route_text_matches\(text, \["path_beta", "path beta", "path-beta", "beta_alias"\]\):\s*return Event\(route="path_alpha\|path_beta", output=_json_safe_node_value\(node_input\)\)/
    );
    assert.equal(
      source.match(
        /return Event\(route="path_alpha\|path_beta", output=_json_safe_node_value\(node_input\)\)/g
      )?.length,
      3,
      "both reviewed matches and the default fallback must preserve the payload under the merged route key"
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
