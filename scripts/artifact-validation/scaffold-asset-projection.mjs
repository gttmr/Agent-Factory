import { isDeepStrictEqual } from "node:util";

export function scaffoldAssetProjectionErrors(candidates, assets, label = "scaffold-plan.json.assets") {
  if (!Array.isArray(candidates) || !Array.isArray(assets)) {
    return [`${label} must project approved analysis Asset candidates.`];
  }

  const errors = [];
  const approved = candidates.filter((candidate) => candidate?.status === "approved");
  const candidateById = new Map(candidates.map((candidate) => [candidate?.asset_id, candidate]));
  const assetById = new Map();
  for (const asset of assets) {
    if (assetById.has(asset?.asset_id)) errors.push(`${label} duplicates ${asset?.asset_id ?? "unknown"}.`);
    assetById.set(asset?.asset_id, asset);
  }
  if (assets.length !== approved.length) {
    errors.push(`${label} must include every approved Asset candidate exactly once.`);
  }

  for (const candidate of approved) {
    const asset = assetById.get(candidate.asset_id);
    if (!asset) {
      errors.push(`${label} is missing approved Asset ${candidate.asset_id}.`);
      continue;
    }
    const unresolved = (candidate.missing_information ?? []).filter(
      (item) => !(candidate.resolved_missing_information ?? []).includes(item)
    );
    if (unresolved.length > 0) {
      errors.push(`${label} ${candidate.asset_id} has unresolved missing information.`);
      continue;
    }
    if (!matchesApprovedAssetProjection(candidate, asset)) {
      errors.push(`${label} ${candidate.asset_id} drifts from the approved candidate contract.`);
    }
  }
  for (const asset of assets) {
    const candidate = candidateById.get(asset?.asset_id);
    if (!candidate) errors.push(`${label} ${asset?.asset_id ?? "unknown"} has no Asset candidate.`);
    else if (candidate.status !== "approved") errors.push(`${label} ${asset.asset_id} is not approved.`);
  }
  return [...new Set(errors)];
}

export function matchesApprovedAssetProjection(candidate, asset) {
  if (isDeepStrictEqual(candidate, asset)) return true;
  if (candidate?.asset_type !== "tool" || asset?.asset_type !== "tool") return false;
  const { binding: _candidateBinding, connection: _candidateConnection, ...candidateContract } = candidate;
  const { binding, connection, ...assetContract } = asset;
  return (
    isDeepStrictEqual(candidateContract, assetContract) &&
    binding?.kind === "mcp" &&
    typeof binding.server_ref === "string" &&
    binding.server_ref.trim().length > 0 &&
    typeof binding.tool_name === "string" &&
    binding.tool_name.trim().length > 0 &&
    connection?.transport === "stdio"
  );
}
