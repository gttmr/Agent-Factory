import type { AssetCandidate, ScaffoldPlan } from "../analyzer/types";

export interface MockLabRouteInput {
  toolName?: string | null;
  reqId?: string | null;
}

export interface MockLabBindingSelection {
  serverRef: string;
  toolName: string;
}

type McpBinding = Extract<NonNullable<AssetCandidate["binding"]>, { kind: "mcp" }>;
type McpBoundTool = Pick<AssetCandidate, "asset_type" | "binding"> & {
  asset_type: "tool";
  binding: McpBinding;
};

export function buildMockLabRoute(input: MockLabRouteInput = {}): string {
  const params = new URLSearchParams();
  if (input.toolName) params.set("tool", input.toolName);
  if (input.reqId) params.set("req", input.reqId);
  const query = params.toString();
  return query ? `/mock-lab?${query}` : "/mock-lab";
}

export function isMcpBoundTool(
  asset: Pick<AssetCandidate, "asset_type" | "binding">
): asset is McpBoundTool {
  return (
    asset.asset_type === "tool" &&
    asset.binding?.kind === "mcp" &&
    Boolean(asset.binding.server_ref) &&
    Boolean(asset.binding.tool_name)
  );
}

export function mockLabToolBindingTargets(plan: Pick<ScaffoldPlan, "assets">): AssetCandidate[] {
  return plan.assets.filter((asset) => asset.asset_type === "tool");
}

export function hasMockLabBindingTargets(plan: Pick<ScaffoldPlan, "assets">): boolean {
  return mockLabToolBindingTargets(plan).length > 0;
}

export function applyMockLabBinding(
  plan: ScaffoldPlan,
  assetId: string,
  selection: MockLabBindingSelection
): ScaffoldPlan {
  return {
    ...plan,
    assets: plan.assets.map((asset) =>
      asset.asset_id === assetId
        ? {
            ...asset,
            binding: { kind: "mcp", server_ref: selection.serverRef, tool_name: selection.toolName },
            connection: { transport: "stdio" }
          }
        : asset
    )
  };
}
