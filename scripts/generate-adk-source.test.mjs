#!/usr/bin/env node

import test from "node:test";
import { assertPregeneratedRunnableBundle, assertSmokeBundle } from "./adk-source-test/assertions.mjs";
import { readBundle } from "./adk-source-test/fixtures.mjs";

import "./adk-source-test/basic-bundle.test.mjs";
import "./adk-source-test/reused-chat-projection.test.mjs";
import "./adk-source-test/route-choices.test.mjs";
import "./adk-source-test/toolsets.test.mjs";
import "./adk-source-test/workflow-call.test.mjs";
import "./adk-source-test/dynamic-loop-lowering.test.mjs";
import "./adk-source-test/dynamic-loop-decisions.test.mjs";
import "./adk-source-test/dynamic-loop-guards.test.mjs";
import "./adk-source-test/graph-ir-rejections.test.mjs";
import "./adk-source-test/state-channels-lowering.test.mjs";
import "./adk-source-test/state-channel-guards.test.mjs";
import "./adk-source-test/artifact-channels.test.mjs";
import "./adk-source-test/remote-a2a.test.mjs";
import "./adk-source-test/cdp-a2a-registry-provider.test.mjs";
import "./adk-source-test/cdp-a2a-launcher.test.mjs";
import "./adk-source-test/cdp-a2a-owner-route.test.mjs";
import "./adk-source-test/cdp-a2a-super-agent-route-context.test.mjs";
import "./adk-source-test/route-type-decision.test.mjs";
import "./adk-source-test/runtime-robustness.test.mjs";
import "./adk-source-test/terminal-output.test.mjs";

const cliOutputRoot = process.argv[2];
if (cliOutputRoot) {
  test(`pre-generated bundle at ${cliOutputRoot} is consistent`, () => {
    const { manifest } = readBundle(cliOutputRoot);
    if (manifest.output_mode === "runnable") assertPregeneratedRunnableBundle(cliOutputRoot);
    else assertSmokeBundle(cliOutputRoot);
  });
}
