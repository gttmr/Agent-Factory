import type { AnalysisResult, AssetCandidate, AssetType } from "../analyzer/types";
import type { CatalogHubEntry } from "./catalogIndex";

export function catalogEntryAssetType(entry: CatalogHubEntry): AssetType {
  return entry.asset_type;
}

export function isCatalogPinCompatible(candidate: AssetCandidate, entry: CatalogHubEntry): boolean {
  return candidate.asset_type === entry.asset_type;
}

export function applyCatalogPin(
  analysis: AnalysisResult,
  candidateAssetId: string,
  entry: CatalogHubEntry
): AnalysisResult {
  return {
    ...analysis,
    assetCandidates: analysis.assetCandidates.map((candidate) => {
      if (candidate.asset_id !== candidateAssetId) return candidate;
      const updated: AssetCandidate = {
        ...candidate,
        catalog_entry_id: entry.asset_id,
        asset_type: entry.asset_type,
        domain_scope: entry.domain_scope,
        business_domains: entry.business_domains,
        owner: entry.owner,
        reuse_status: "reuse_existing",
        capability_tags: entry.capability_tags,
        binding: entry.binding ?? candidate.binding,
        connection: entry.connection ?? candidate.connection,
        workflow_profile: entry.workflow_profile,
        exposure: entry.exposure,
        name: entry.name
      };
      if (entry.inputs && entry.inputs.length > 0 && candidate.inputs.length === 0) updated.inputs = entry.inputs;
      if (entry.outputs && entry.outputs.length > 0 && candidate.outputs.length === 0) updated.outputs = entry.outputs;
      return updated;
    }),
    graph: analysis.graph
  };
}
