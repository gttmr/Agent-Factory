import { useStore, type ReactFlowState } from "reactflow";
import type { ContainerRect } from "./layout";

interface ContainerOverlayProps {
  rects: ContainerRect[];
}

const transformSelector = (s: ReactFlowState): [number, number, number] => s.transform;

const KIND_LABEL: Record<string, string> = {
  graph_workflow: "GRAPH",
  dynamic_workflow: "DYNAMIC",
  parallel_region: "PARALLEL",
  loop_region: "LOOP",
  human_review_region: "HUMAN REVIEW",
  remote_boundary: "REMOTE A2A"
};

const KIND_GLYPH: Record<string, string> = {
  parallel_region: "⫿",
  loop_region: "↻",
  human_review_region: "⏸︎",
  remote_boundary: "⇨"
};

export function ContainerOverlay({ rects }: ContainerOverlayProps) {
  const [tx, ty, zoom] = useStore(transformSelector);
  return (
    <div
      className="graph-container-overlay-root"
      aria-hidden
      style={{
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        transformOrigin: "0 0"
      }}
    >
      {rects.map(({ container, x, y, width, height }) => {
        const kind = container.container_kind;
        const eyebrow = KIND_LABEL[kind] ?? kind;
        const glyph = KIND_GLYPH[kind];
        return (
          <div
            key={container.id}
            className={`graph-container-overlay kind-${kind}`}
            style={{ left: x, top: y, width, height }}
          >
            <div className="graph-container-overlay-head">
              {glyph ? <span className="graph-container-overlay-glyph">{glyph}</span> : null}
              <span className="graph-container-overlay-eyebrow">{eyebrow}</span>
              <span className="graph-container-overlay-label">{container.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
