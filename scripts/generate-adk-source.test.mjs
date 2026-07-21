#!/usr/bin/env node

import test from "node:test";
import { readBundle } from "./adk-source-test/fixtures.mjs";

import "./adk-source-test/target-only-contract.test.mjs";
import "./adk-source-test/target-behavior-matrix.test.mjs";

const cliOutputRoot = process.argv[2];
if (cliOutputRoot) {
  test(`pre-generated Target bundle at ${cliOutputRoot} is consistent`, () => {
    const { manifest } = readBundle(cliOutputRoot);
    if (manifest.contract_version !== "2.0") throw new Error("generated manifest must use contract_version 2.0");
  });
}
