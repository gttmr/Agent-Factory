import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import test from "node:test";
import { assertLegacyRouteAliasCompatibility } from "./assertions.mjs";
import { collectGeneratorSourceFiles, repoRoot } from "./fixtures.mjs";
import { GENERATOR_NEUTRAL_LITERAL_ALLOWLIST } from "./generator-neutrality-allowlist.mjs";
import {
  collectReviewedFixtureVocabulary,
  extractQuotedAtoms,
  findGeneratorNeutralityViolations,
  formatGeneratorNeutralityViolations
} from "./generator-neutrality.mjs";

test("generator-neutrality allowlist is immutable, unique, sorted, provenance-backed, and live", () => {
  assert.equal(Object.isFrozen(GENERATOR_NEUTRAL_LITERAL_ALLOWLIST), true);
  const tokens = GENERATOR_NEUTRAL_LITERAL_ALLOWLIST.map((entry) => entry.token);
  assert.deepEqual(tokens, [...new Set(tokens)].sort());
  const vocabulary = collectReviewedFixtureVocabulary();
  const sources = collectGeneratorSourceFiles().map((path) => ({
    path: relative(repoRoot, path),
    source: readFileSync(path, "utf8")
  }));
  const consultedAllowlistTokens = new Set();
  findGeneratorNeutralityViolations({
    sources,
    vocabulary,
    allowlist: GENERATOR_NEUTRAL_LITERAL_ALLOWLIST,
    consultedAllowlistTokens
  });
  for (const entry of GENERATOR_NEUTRAL_LITERAL_ALLOWLIST) {
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(typeof entry.source, "string");
    assert.ok(entry.source.trim(), `${entry.token} must cite contract or protocol provenance`);
    assert.ok(
      consultedAllowlistTokens.has(entry.token),
      `${entry.token} is stale: removing it would not create a generator-neutrality violation`
    );
  }
});

test("generator sources contain no unreviewed scenario vocabulary", () => {
  const vocabulary = collectReviewedFixtureVocabulary();
  const sources = collectGeneratorSourceFiles().map((path) => ({
    path: relative(repoRoot, path),
    source: readFileSync(path, "utf8")
  }));
  const violations = findGeneratorNeutralityViolations({
    sources,
    vocabulary,
    allowlist: GENERATOR_NEUTRAL_LITERAL_ALLOWLIST
  });
  assert.deepEqual(violations, [], `generator-neutrality violations:\n${formatGeneratorNeutralityViolations(violations)}`);
});

test("generator-neutrality detector catches the three campaign canaries", () => {
  const vocabulary = new Map([
    ["analysis_input_bundle", new Set(["templates/regression-scenarios/canary/scaffold-plan.json"])],
    ["agent_registry_snapshot", new Set(["scripts/adk-source-test/canary-fixture.mjs"])],
    ["Super Agent", new Set(["scripts/adk-source-test/canary-fixture.mjs"])]
  ]);
  const violations = findGeneratorNeutralityViolations({
    sources: [{
      path: "scripts/adk-source/canary.mjs",
      source: `const wrapper = "analysis_input_bundle";\nconst state = "agent_registry_snapshot";\nconst guidance = \`Route through Super Agent.\`;`
    }],
    vocabulary,
    allowlist: []
  });
  assert.deepEqual(new Set(violations.map((violation) => violation.token)), new Set([
    "analysis_input_bundle",
    "agent_registry_snapshot",
    "Super Agent"
  ]));
});

test("generator-neutrality detector ignores comments and regular-expression literals", () => {
  const vocabulary = new Map([["analysis_input_bundle", new Set(["fixture.json"])]]);
  const violations = findGeneratorNeutralityViolations({
    sources: [{
      path: "scripts/adk-source/comment-and-regex.mjs",
      source: `// analysis_input_bundle\nconst matcher = /analysis_input_bundle|agent_registry_snapshot/;\n/* Super Agent */`
    }],
    vocabulary,
    allowlist: []
  });
  assert.deepEqual(violations, []);
});

test("generator-neutrality detector uses identifier boundaries for reviewed fixture containment", () => {
  const vocabulary = new Map([
    ["human_review", new Set(["fixture.json"])],
    ["Remote A2A", new Set(["fixture.json"])]
  ]);
  const violations = findGeneratorNeutralityViolations({
    sources: [{
      path: "scripts/adk-source/canary.mjs",
      source: [
        'const region = "prefix human_review_region suffix";',
        'const combiningMark = "prefix human_review\u0301tail suffix";',
        'const connector = "prefix human_review\u203Ftail suffix";',
        'const zwnj = "prefix human_review\u200Ctail suffix";',
        'const dollar = "prefix human_review$tail suffix";',
        'const prefixedCombiningMark = "prefix tail\u0301human_review suffix";',
        'const prefixedDollar = "prefix $human_review suffix";',
        'const embeddedPhrase = "XRemote A2AAgent";',
        'const boundedPhrase = "Use Remote A2A provider";',
        'const laterBoundedOccurrence = "human_review_region then human_review";'
      ].join("\n")
    }],
    vocabulary,
    allowlist: []
  });
  assert.deepEqual(
    violations.filter((violation) => violation.token === "human_review").map((violation) => violation.line),
    [10]
  );
  assert.equal(violations.filter((violation) => violation.token === "Remote A2A").length, 1);
});

test("generator-neutrality detector catches snake-case literals inside generated templates", () => {
  const violations = findGeneratorNeutralityViolations({
    sources: [{ path: "scripts/adk-source/canary.mjs", source: 'const generated = `VALUE = "brand_new_scenario"`;' }],
    vocabulary: new Map(),
    allowlist: []
  });
  assert.equal(violations.some((violation) => violation.token === "brand_new_scenario"), true);
});

test("generator-neutrality allowlist consultation rejects identifier-substring liveness", () => {
  const consultedAllowlistTokens = new Set();
  findGeneratorNeutralityViolations({
    sources: [{
      path: "scripts/adk-source/canary.mjs",
      source: 'const region = "prefix human_review_region suffix";'
    }],
    vocabulary: new Map([["human_review", new Set(["fixture.json"])]]),
    allowlist: [{ token: "human_review", source: "canary" }],
    consultedAllowlistTokens
  });
  assert.equal(consultedAllowlistTokens.has("human_review"), false);
});

test("generator-neutrality allowlist consultation counts exact snake-case entries as live", () => {
  const consultedAllowlistTokens = new Set();
  const violations = findGeneratorNeutralityViolations({
    sources: [{ path: "scripts/adk-source/canary.mjs", source: 'const value = "human_review";' }],
    vocabulary: new Map(),
    allowlist: [{ token: "human_review", source: "canary" }],
    consultedAllowlistTokens
  });
  assert.deepEqual(violations, []);
  assert.equal(consultedAllowlistTokens.has("human_review"), true);
});

test("generator-neutrality allowlist consultation counts containment-only entries as live", () => {
  const consultedAllowlistTokens = new Set();
  const violations = findGeneratorNeutralityViolations({
    sources: [{
      path: "scripts/adk-source/canary.mjs",
      source: 'const phrase = "prefix human_review suffix";'
    }],
    vocabulary: new Map([["human_review", new Set(["fixture.json"])]]),
    allowlist: [{ token: "human_review", source: "canary" }],
    consultedAllowlistTokens
  });
  assert.deepEqual(violations, []);
  assert.equal(consultedAllowlistTokens.has("human_review"), true);
});

test("generator-neutrality extractor captures quoted fields inside generated Python templates", () => {
  const source = readFileSync(new URL("../adk-source/emitters/runtime-tool-inputs.mjs", import.meta.url), "utf8");
  const atoms = new Set(extractQuotedAtoms(source).map((atom) => atom.value));
  assert.equal(atoms.has("input_map"), true);
});

test("generator-neutrality token extraction handles prose, Markdown, triple quotes, and interpolation without substring liveness", () => {
  const source = [
    'const prose = `ADK\'s "input_map" field`;',
    'const unicodeProse = `café\'s "unicode_contract_field" field`;',
    'const decomposedUnicodeProse = `cafe\u0301\'s "decomposed_contract_field" field`;',
    'const markdown = `# Use "response_schema_ref"`;',
    'const python = `VALUE = """runtime_contracts"""`;',
    'const composed = `human_review_${"region"}`;'
  ].join("\n");
  const atoms = new Set(extractQuotedAtoms(source).map((atom) => atom.value));
  assert.equal(atoms.has("input_map"), true);
  assert.equal(atoms.has("unicode_contract_field"), true);
  assert.equal(atoms.has("decomposed_contract_field"), true);
  assert.equal(atoms.has("response_schema_ref"), true);
  assert.equal(atoms.has("runtime_contracts"), true);
  assert.equal(atoms.has("region"), true);
  assert.equal(atoms.has("human_review"), false);
  assert.equal(atoms.has('s "input_map" field'), false);
});

test("legacy route aliases remain isolated to the marked compatibility boundary", () => {
  assertLegacyRouteAliasCompatibility();
});
