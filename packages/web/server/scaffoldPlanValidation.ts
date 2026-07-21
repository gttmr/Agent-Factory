import { isDeepStrictEqual } from "node:util";
import { validateAgainstSchema } from "../../../scripts/artifact-validation/json-schema.mjs";
import { scaffoldAssetProjectionErrors } from "../../../scripts/artifact-validation/scaffold-asset-projection.mjs";
import { buildScaffoldPlan } from "../src/analyzer/scaffoldPlan";
import type { AnalysisResult, ScaffoldPlan } from "../src/analyzer/types";
import { ArtifactValidationError, type ArtifactRootStore } from "./artifactRootStore";
import { loadServerScaffoldCatalog } from "./artifactSyncCatalog";
import { validateAnalysisResult } from "./validators";

export async function validateScaffoldPlanWrite(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  value: unknown
): Promise<string[]> {
  const errors = validateAgainstSchema(value, "scaffold-plan.schema.json", "scaffold-plan.json");
  if (errors.length > 0) return errors;

  const plan = value as ScaffoldPlan;
  if (plan.package_name && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(plan.package_name)) {
    errors.push("scaffold-plan.json.package_name must be a valid ASCII Python package identifier.");
  }

  const analysis = await readCanonicalAnalysis(store, reqId);
  const catalogEntries = await loadServerScaffoldCatalog(repoRoot);
  const expected = buildScaffoldPlan({
    normalizedRequirement: analysis.normalizedRequirement,
    assetCandidates: analysis.assetCandidates,
    graph: analysis.graph,
    runtimeContracts: analysis.runtimeContracts,
    catalogEntries,
    outputMode: plan.output_mode,
    ...(plan.package_name ? { packageName: plan.package_name } : {})
  });

  if (plan.requirement_id !== reqId || plan.requirement_id !== analysis.normalizedRequirement.id) {
    errors.push("scaffold-plan.json.requirement_id must match the canonical requirement.");
  }
  if (!isDeepStrictEqual(plan.graph, expected.graph)) {
    errors.push("scaffold-plan.json.graph must match analysis-result.json.graph.");
  }
  if (!isDeepStrictEqual(plan.runtime_contracts, expected.runtime_contracts)) {
    errors.push("scaffold-plan.json.runtime_contracts must match analysis-result.json.runtimeContracts.");
  }
  errors.push(...scaffoldAssetProjectionErrors(analysis.assetCandidates, plan.assets));
  if (!isDeepStrictEqual(plan.excluded_assets, expected.excluded_assets)) {
    errors.push("scaffold-plan.json.excluded_assets must match the non-approved Asset projection.");
  }
  if (!isDeepStrictEqual(plan.manifest, expected.manifest)) {
    errors.push("scaffold-plan.json.manifest must match the current Catalog projection.");
  }
  if (!isDeepStrictEqual(plan.validation, expected.validation)) {
    errors.push("scaffold-plan.json.validation must be recomputed from the canonical design.");
  }
  return errors;
}

async function readCanonicalAnalysis(store: ArtifactRootStore, reqId: string): Promise<AnalysisResult> {
  const artifact = await store.readArtifact(reqId, "analysis-result.json");
  let value: unknown;
  try {
    value = JSON.parse(artifact.content) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ArtifactValidationError(422, "기존 analysis-result.json JSON 파싱 실패");
    }
    throw error;
  }
  const errors = validateAnalysisResult(value);
  if (errors.length > 0) {
    throw new ArtifactValidationError(422, `기존 analysis-result.json 검증 실패: ${errors.join("; ")}`);
  }
  return value as AnalysisResult;
}
