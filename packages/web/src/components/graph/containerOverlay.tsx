import { useStore, type ReactFlowState } from "reactflow";
import { graphRegionLabel } from "../graphElementEditorModel";
import type { RegionRect } from "./layout";

interface RegionOverlayProps {
  rects: RegionRect[];
  highlightedIds?: Set<string>;
}

const transformSelector = (state: ReactFlowState): [number, number, number] => state.transform;

export function RegionOverlay({ rects, highlightedIds }: RegionOverlayProps) {
  const [tx, ty, zoom] = useStore(transformSelector);
  return (
    <div
      className="graph-container-overlay-root"
      aria-hidden
      style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: "0 0" }}
    >
      {rects.map(({ region, x, y, width, height }) => (
        <div
          key={region.id}
          className={`graph-container-overlay region-${region.kind} ${highlightedIds?.has(region.id) ? "is-highlighted" : ""}`}
          style={{ left: x, top: y, width, height }}
        >
          <div className="graph-container-overlay-head">
            <span className="graph-container-overlay-glyph">{region.kind === "loop" ? "↻" : "⫿"}</span>
            <span className="graph-container-overlay-eyebrow">{graphRegionLabel(region.kind)}</span>
            <span className="graph-container-overlay-label">{region.id}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
