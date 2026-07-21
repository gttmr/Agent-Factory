import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from "reactflow";
import type { GraphControlKind } from "../../analyzer/types";
import type { GraphEdgeData } from "./layout";

interface EdgeStyleSpec {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

function specForEdge(kind: GraphControlKind, channel: GraphEdgeData["graphEdge"]["channel"]): EdgeStyleSpec {
  if (kind === "condition") return { stroke: "var(--accent-strong)", strokeWidth: 2 };
  if (kind === "fan_out" || kind === "fan_in") return { stroke: "var(--cat-workflow-line)", strokeWidth: 3 };
  if (kind === "loop_back" || kind === "loop_exit") return { stroke: "var(--amber)", strokeWidth: 2, strokeDasharray: "6 4" };
  if (["retry", "fallback", "error", "cancel", "timeout"].includes(kind)) return { stroke: "var(--red)", strokeWidth: 2, strokeDasharray: "4 4" };
  if (kind === "callback" || kind === "resume") return { stroke: "var(--blue)", strokeWidth: 2, strokeDasharray: "2 5" };
  if (channel === "artifact") return { stroke: "var(--cat-input-line)", strokeWidth: 4 };
  if (channel === "state") return { stroke: "var(--blue)", strokeWidth: 2, strokeDasharray: "2 5" };
  return { stroke: "var(--cat-agent-line)", strokeWidth: 2 };
}

function edgeLabel(data: GraphEdgeData["graphEdge"]): string {
  const control = data.control;
  const parts = [
    control.kind === "condition" ? control.condition ?? "condition" : control.kind,
    control.accepted_aliases.length ? `alias: ${control.accepted_aliases.join(", ")}` : "",
    control.default ? "default" : "",
    data.channel ? `channel: ${data.channel}` : ""
  ];
  return parts.filter(Boolean).join(" · ");
}

function GraphEdgeBase(props: EdgeProps<GraphEdgeData>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, id } = props;
  const graphEdge = data?.graphEdge;
  const kind = graphEdge?.control.kind ?? "next";
  const spec = specForEdge(kind, graphEdge?.channel ?? null);
  const pathBuilder = kind === "loop_back" || kind === "loop_exit" ? getSmoothStepPath : getBezierPath;
  const [path, labelX, labelY] = pathBuilder({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const label = graphEdge ? edgeLabel(graphEdge) : "";
  const emphasized = Boolean(data?.selected || data?.highlightCount);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: data?.highlightColor ?? spec.stroke,
          strokeWidth: emphasized ? spec.strokeWidth + 2 : spec.strokeWidth,
          strokeDasharray: spec.strokeDasharray,
          opacity: emphasized ? 1 : 0.9,
          strokeLinecap: "round"
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`graph-edge-label graph-edge-${kind}-label ${data?.selected ? "is-selected" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            title={data?.commentTooltip}
            onClick={(event) => {
              event.stopPropagation();
              data?.onSelect(id);
            }}
          >
            {label}
            {data?.commentCount ? <span className="graph-edge-comment-pin">{data.commentCount}</span> : null}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = {
  next: GraphEdgeBase,
  condition: GraphEdgeBase,
  fan_out: GraphEdgeBase,
  fan_in: GraphEdgeBase,
  loop_back: GraphEdgeBase,
  loop_exit: GraphEdgeBase,
  retry: GraphEdgeBase,
  fallback: GraphEdgeBase,
  error: GraphEdgeBase,
  callback: GraphEdgeBase,
  resume: GraphEdgeBase,
  cancel: GraphEdgeBase,
  timeout: GraphEdgeBase
};
