import assert from "node:assert/strict";
import test from "node:test";
import { generateRemoteA2aBundle } from "./cdp-a2a-fixtures.mjs";

test("Given temp runnable Remote A2A bundle When launcher is generated Then A2A resume uses ADK new executor", () => {
  const { agentSource, launcherSource } = generateRemoteA2aBundle();

  assert.match(agentSource, /= RemoteA2aAgent\(/, "fixture should generate a runnable Remote A2A node");
  assert.match(launcherSource, /def _patch_adk_a2a_resume_executor_version\(\) -> None:/);
  assert.match(launcherSource, /force_new_version=True/);
});
