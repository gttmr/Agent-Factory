import type { ProcessStreamEvent } from "../../state/useStreamingProcess";
import type { ScaffoldOutputMode } from "../../analyzer/types";
import type { ArtifactSyncRunOptions } from "../../state/useArtifactSync";

export interface BuildArtifactSyncRunOptionsInput {
  readonly outputMode: ScaffoldOutputMode;
  readonly outputModeExplicitlyChosen: boolean;
  readonly savedOutputMode: ScaffoldOutputMode | null;
  readonly onEvent?: (event: ProcessStreamEvent) => void;
}

export function buildArtifactSyncRunOptions({
  outputMode,
  outputModeExplicitlyChosen,
  savedOutputMode,
  onEvent
}: BuildArtifactSyncRunOptionsInput): ArtifactSyncRunOptions {
  const requestOutputMode = outputModeExplicitlyChosen ? outputMode : savedOutputMode;
  return {
    ...(requestOutputMode ? { outputMode: requestOutputMode } : {}),
    rebuildRuntimeStub: true,
    runValidation: true,
    streamProgress: true,
    ...(onEvent ? { onEvent } : {})
  };
}
