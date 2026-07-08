import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvedRemoteA2AContract } from "./cdp-a2a-contracts.mjs";
import { baseModules, discoverGeneratedPackage, generateBundle, remoteGraph, remoteModule, writeRemoteFixture } from "./fixtures.mjs";

export function generateRemoteA2aBundle() {
  const [agentBase] = baseModules(true);
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-cdp-a2a-launcher-"));
  try {
    writeRemoteFixture(artifactRoot, {
      modules: [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()],
      nodes: remoteGraph.nodes,
      edges: remoteGraph.edges,
      a2aContracts: [approvedRemoteA2AContract()]
    });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const packageName = discoverGeneratedPackage(outputRoot);
    return {
      agentSource: readFileSync(join(outputRoot, packageName, "agent.py"), "utf8"),
      launcherSource: readFileSync(join(outputRoot, "af_adk_a2a_server.py"), "utf8")
    };
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
}
