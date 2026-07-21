import type { AssetCandidate, AssetType } from "../analyzer/types";

export const categoryGlyph: Record<AssetType, string> = {
  agent: "◆",
  workflow: "▶",
  tool: "⚙"
};

const categoryLabel: Record<AssetType, string> = {
  agent: "Agent",
  workflow: "Workflow",
  tool: "Tool"
};

export function ProtocolBadge({ value }: { value: "mcp" | "a2a" }) {
  return (
    <span className={`protocol-badge protocol-${value}`}>
      <span className="cat-glyph protocol-glyph" aria-hidden="true">
        {value === "a2a" ? "A2A" : "M"}
      </span>
      {value.toUpperCase()}
    </span>
  );
}
export function categoryClass(category: AssetType): string {
  return `cat-${category}`;
}

export function CategoryBadge({ category }: { category: AssetType }) {
  return (
    <span className={`category-badge ${categoryClass(category)}`}>
      <span className="cat-glyph" aria-hidden="true">
        {categoryGlyph[category]}
      </span>
      {categoryLabel[category]}
    </span>
  );
}

export function CandidateCategoryBadge({ candidate }: { candidate: AssetCandidate }) {
  const protocol = candidate.binding?.kind === "a2a" || candidate.exposure?.protocol === "a2a"
    ? "a2a"
    : candidate.binding?.kind === "mcp"
      ? "mcp"
      : null;
  return (
    <div className="candidate-cat-row">
      <CategoryBadge category={candidate.asset_type} />
      {protocol ? <ProtocolBadge value={protocol} /> : null}
    </div>
  );
}
