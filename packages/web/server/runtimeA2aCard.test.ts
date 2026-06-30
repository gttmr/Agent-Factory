import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { refreshAgentCard } from "./runtimeA2aCard.ts";

const ADK_A2A_EXTENSION_URI = "https://google.github.io/adk-docs/a2a/a2a-extension/";

const rootDir = await mkdtemp(join(tmpdir(), "af-runtime-a2a-card-"));

try {
  const stubDir = join(rootDir, "runtime-stub");
  const appName = "req_a2a_input_required_adk";
  await mkdir(join(stubDir, appName), { recursive: true });
  await writeFile(
    join(stubDir, appName, "workflow_manifest.json"),
    `${JSON.stringify({ package: appName, requirement: { title: "A2A input required" } }, null, 2)}\n`,
    "utf8"
  );

  const card = await refreshAgentCard({
    stubDir,
    appName,
    rpcUrl: `http://127.0.0.1:8001/a2a/${appName}`
  });
  const persistedCard: unknown = JSON.parse(await readFile(join(stubDir, appName, "agent.json"), "utf8"));

  assert.equal("resume" in card.capabilities, false);
  assert.equal("hitlResume" in card.capabilities, false);
  assert.deepEqual(persistedCard, card);
  assert.equal(card.capabilities.extensions[0]?.uri, ADK_A2A_EXTENSION_URI);
  assert.equal(card.capabilities.extensions[0]?.required, false);
  assert.match(card.capabilities.extensions[0]?.description ?? "", /input-required/);
  assert.match(card.capabilities.extensions[0]?.description ?? "", /adk_request_input/);
  assert.match(card.capabilities.extensions[0]?.description ?? "", /does not claim verified remote HITL resume/);
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
