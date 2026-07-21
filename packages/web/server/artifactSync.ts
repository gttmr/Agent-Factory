import { ArtifactRootStore, ArtifactValidationError } from "./artifactRootStore";
import { loadServerScaffoldCatalog } from "./artifactSyncCatalog";
import { validateAnalysisResult } from "./validators";
import { buildScaffoldPlan } from "../src/analyzer/scaffoldPlan";
import type {
  AnalysisResult,
  ScaffoldOutputMode,
  ScaffoldPlan
} from "../src/analyzer/types";
import type { CatalogEntry } from "../src/catalog/types";

const DERIVED_JSON_PATHS = [
  "normalized-requirement.json",
  "asset-candidates.json",
  "graph-ir.json",
  "scaffold-plan.json"
] as const;

type DerivedArtifactPath = (typeof DERIVED_JSON_PATHS)[number];

export type ArtifactSyncBeforeStatus = "stale" | "missing" | "unchanged";
export type ArtifactSyncAfterStatus = "synced" | "unchanged";

export interface ArtifactSyncDriftEntry {
  readonly path: DerivedArtifactPath;
  readonly status: ArtifactSyncBeforeStatus | ArtifactSyncAfterStatus;
}

export interface SyncArtifactRootInput {
  readonly repoRoot: string;
  readonly reqId: string;
  readonly store?: ArtifactRootStore;
  readonly outputMode?: ScaffoldOutputMode;
  readonly catalogEntries?: readonly CatalogEntry[];
}

export interface ArtifactSyncResult {
  readonly ok: true;
  readonly requirement_id: string;
  readonly output_mode: ScaffoldOutputMode;
  readonly drift: {
    readonly before: readonly ArtifactSyncDriftEntry[];
    readonly after: readonly ArtifactSyncDriftEntry[];
  };
  readonly artifacts_written: readonly DerivedArtifactPath[];
}

export async function syncArtifactRoot(input: SyncArtifactRootInput): Promise<ArtifactSyncResult> {
  const store = input.store ?? new ArtifactRootStore({ repoRoot: input.repoRoot });
  const analysis = await readCanonicalAnalysis(store, input.reqId);
  const outputMode = await resolveOutputMode(store, input.reqId, input.outputMode);
  const catalogEntries = input.catalogEntries ?? await loadServerScaffoldCatalog(input.repoRoot);
  const scaffoldPlan = buildScaffoldPlan({
    normalizedRequirement: analysis.normalizedRequirement,
    assetCandidates: analysis.assetCandidates,
    graph: analysis.graph,
    runtimeContracts: analysis.runtimeContracts,
    catalogEntries: [...catalogEntries],
    outputMode
  });
  const derived = serializeDerivedArtifacts(analysis, scaffoldPlan);
  const before = await collectBeforeDrift(store, input.reqId, derived);

  for (const artifact of derived) {
    await store.writeArtifact(input.reqId, artifact.path, artifact.content);
  }

  return {
    ok: true,
    requirement_id: input.reqId,
    output_mode: outputMode,
    drift: {
      before,
      after: before.map((entry) => ({
        path: entry.path,
        status: entry.status === "unchanged" ? "unchanged" : "synced"
      }))
    },
    artifacts_written: DERIVED_JSON_PATHS
  };
}

async function readCanonicalAnalysis(store: ArtifactRootStore, reqId: string): Promise<AnalysisResult> {
  const artifact = await store.readArtifact(reqId, "analysis-result.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(artifact.content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ArtifactValidationError(422, "analysis-result 검증 실패");
    }
    throw error;
  }
  const errors = validateAnalysisResult(parsed);
  if (errors.length > 0 || !isAnalysisResult(parsed)) {
    throw new ArtifactValidationError(422, "analysis-result 검증 실패");
  }
  return parsed;
}

async function resolveOutputMode(
  store: ArtifactRootStore,
  reqId: string,
  requested: ScaffoldOutputMode | undefined
): Promise<ScaffoldOutputMode> {
  if (requested !== undefined) {
    if (isOutputMode(requested)) return requested;
    throw new ArtifactValidationError(400, "outputMode 값은 smoke 또는 runnable 이어야 합니다.");
  }
  const saved = await readSavedOutputMode(store, reqId);
  return saved ?? "smoke";
}

async function readSavedOutputMode(store: ArtifactRootStore, reqId: string): Promise<ScaffoldOutputMode | null> {
  const artifact = await store.readArtifact(reqId, "scaffold-plan.json").catch((error) => {
    if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
    throw error;
  });
  if (!artifact) return null;
  const parsed: unknown = JSON.parse(artifact.content);
  if (!isRecord(parsed)) return null;
  return isOutputMode(parsed.output_mode) ? parsed.output_mode : null;
}

function serializeDerivedArtifacts(analysis: AnalysisResult, scaffoldPlan: ScaffoldPlan): Array<{
  readonly path: DerivedArtifactPath;
  readonly content: string;
}> {
  return [
    { path: "normalized-requirement.json", content: serializeJson(analysis.normalizedRequirement) },
    { path: "asset-candidates.json", content: serializeJson(analysis.assetCandidates) },
    { path: "graph-ir.json", content: serializeJson(analysis.graph) },
    { path: "scaffold-plan.json", content: serializeJson(scaffoldPlan) }
  ];
}

async function collectBeforeDrift(
  store: ArtifactRootStore,
  reqId: string,
  derived: readonly { readonly path: DerivedArtifactPath; readonly content: string }[]
): Promise<ArtifactSyncDriftEntry[]> {
  const entries: ArtifactSyncDriftEntry[] = [];
  for (const artifact of derived) {
    const current = await store.readArtifact(reqId, artifact.path).catch((error) => {
      if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
      throw error;
    });
    if (!current) {
      entries.push({ path: artifact.path, status: "missing" });
      continue;
    }
    entries.push({
      path: artifact.path,
      status: current.content === artifact.content ? "unchanged" : "stale"
    });
  }
  return entries;
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  return validateAnalysisResult(value).length === 0;
}

function isOutputMode(value: unknown): value is ScaffoldOutputMode {
  return value === "smoke" || value === "runnable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
