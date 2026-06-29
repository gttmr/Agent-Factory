import assert from "node:assert/strict";
import { buildArtifactSyncRunOptions } from "./artifactSyncRunOptions.ts";

// Given: the Build primary action runs before a saved scaffold-plan mode has loaded.
const defaultedRunOptions = buildArtifactSyncRunOptions({
  outputMode: "smoke",
  outputModeExplicitlyChosen: false,
  savedOutputMode: null
});

// Then: outputMode is omitted so the server can use its artifact-root default.
assert.deepEqual(defaultedRunOptions, {
  rebuildRuntimeStub: true,
  runValidation: true,
  streamProgress: true
});

// Given: a saved scaffold-plan mode is known before the Build primary action runs.
const savedModeRunOptions = buildArtifactSyncRunOptions({
  outputMode: "smoke",
  outputModeExplicitlyChosen: false,
  savedOutputMode: "runnable"
});

// Then: the saved mode is sent even if local UI state has not yet been initialized by an effect.
assert.deepEqual(savedModeRunOptions, {
  outputMode: "runnable",
  rebuildRuntimeStub: true,
  runValidation: true,
  streamProgress: true
});

// Given: the reviewer explicitly chooses a mode before running the primary action.
const explicitModeRunOptions = buildArtifactSyncRunOptions({
  outputMode: "smoke",
  outputModeExplicitlyChosen: true,
  savedOutputMode: "runnable"
});

// Then: the explicit choice wins over the saved scaffold-plan mode.
assert.deepEqual(explicitModeRunOptions, {
  outputMode: "smoke",
  rebuildRuntimeStub: true,
  runValidation: true,
  streamProgress: true
});
