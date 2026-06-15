import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from "reactflow";
import type { GraphEdgeData } from "./layout";

interface EdgeStyleSpec {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  className: string;
  showLabel: boolean;
  labelPrefix?: string;
}

function specForKind(kind: string | undefined): EdgeStyleSpec {
  switch (kind) {
    case "event_message":
      return {
        stroke: "var(--amber, #c08a2c)",
        strokeWidth: 2,
        strokeDasharray: "6 4",
        className: "graph-edge-event_message",
        showLabel: true
      };
    case "session_state":
      return {
        stroke: "var(--blue, #2c6ec0)",
        strokeWidth: 2,
        strokeDasharray: "1 5",
        className: "graph-edge-state",
        showLabel: true,
        labelPrefix: "state:"
      };
    case "temp_state":
      return {
        stroke: "var(--blue, #2c6ec0)",
        strokeWidth: 2,
        strokeDasharray: "1 5",
        className: "graph-edge-state",
        showLabel: true,
        labelPrefix: "temp:"
      };
    case "user_state":
      return {
        stroke: "var(--blue, #2c6ec0)",
        strokeWidth: 2,
        strokeDasharray: "1 5",
        className: "graph-edge-state",
        showLabel: true,
        labelPrefix: "user:"
      };
    case "app_state":
      return {
        stroke: "var(--blue, #2c6ec0)",
        strokeWidth: 2,
        strokeDasharray: "1 5",
        className: "graph-edge-state",
        showLabel: true,
        labelPrefix: "app:"
      };
    case "artifact":
      return {
        stroke: "var(--cat-input-line, #6b8e7f)",
        strokeWidth: 4,
        className: "graph-edge-artifact",
        showLabel: true,
        labelPrefix: "artifact:"
      };
    case "route":
      return {
        stroke: "var(--accent-strong, #1e7a4d)",
        strokeWidth: 2,
        className: "graph-edge-route",
        showLabel: true
      };
    case "control":
      return {
        stroke: "var(--red, #c0432c)",
        strokeWidth: 2,
        strokeDasharray: "4 4",
        className: "graph-edge-control",
        showLabel: true
      };
    case "remote_a2a":
      return {
        stroke: "var(--cat-remote-line, #c0432c)",
        strokeWidth: 5,
        className: "graph-edge-remote",
        showLabel: true
      };
    case "event_output":
    default:
      return {
        stroke: "var(--cat-agent-line, #2c6ec0)",
        strokeWidth: 2,
        className: "graph-edge-event_output",
        showLabel: false
      };
  }
}

function buildLabel(edgeData: GraphEdgeData["graphEdge"], prefix?: string): string {
  if (edgeData.edge_kind === "route") {
    return edgeData.route_condition || edgeData.data_label || "route";
  }
  if (edgeData.edge_kind === "remote_a2a") {
    const c = edgeData.a2a_contract_id ? `[${edgeData.a2a_contract_id}] ` : "";
    return `${c}${edgeData.data_label || "remote_a2a"}`;
  }
  if (edgeData.edge_kind === "control") {
    return edgeData.data_label || "control";
  }
  if (edgeData.edge_kind === "artifact") {
    return `${prefix ?? ""}${edgeData.artifact_key ?? edgeData.data_label ?? "artifact"}`;
  }
  if (
    edgeData.edge_kind === "session_state" ||
    edgeData.edge_kind === "temp_state" ||
    edgeData.edge_kind === "user_state" ||
    edgeData.edge_kind === "app_state"
  ) {
    return `${prefix ?? "state:"}${edgeData.state_key ?? edgeData.data_label ?? ""}`;
  }
  return edgeData.data_label || "";
}

function GraphEdgeBase(props: EdgeProps<GraphEdgeData>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, id } = props;
  const graphEdge = data?.graphEdge;
  const kind = graphEdge?.edge_kind ?? "event_output";
  const spec = specForKind(kind);

  const usePath = kind === "remote_a2a" ? getSmoothStepPath : getBezierPath;
  const [edgePath, labelX, labelY] = usePath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const label = spec.showLabel && graphEdge ? buildLabel(graphEdge, spec.labelPrefix) : "";
  const isSelected = data?.selected;
  const isHighlighted = Boolean(data?.highlightCount);
  const hasComment = Boolean(data?.commentCount);
  const selectedStrokeWidth = Math.max(spec.strokeWidth + 3, spec.strokeWidth * 1.8);
  const highlightStroke = data?.highlightColor ?? "var(--cat-workflow-line, #2f8a68)";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isHighlighted ? highlightStroke : spec.stroke,
          strokeWidth: isSelected || isHighlighted ? selectedStrokeWidth : spec.strokeWidth,
          strokeDasharray: spec.strokeDasharray,
          opacity: isSelected || isHighlighted ? 1 : 0.92,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          filter: isSelected || isHighlighted ? "drop-shadow(0 0 3px rgba(30, 122, 77, 0.35))" : undefined,
          transition: "stroke-width 120ms ease, opacity 120ms ease, filter 120ms ease"
        }}
      />
      {label || hasComment || isHighlighted ? (
        <EdgeLabelRenderer>
          <div
            className={`graph-edge-label ${spec.className}-label ${isSelected ? "is-selected" : ""} ${
              isHighlighted ? "is-highlighted" : ""
            }`}
            title={data?.commentTooltip}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (data && id) data.onSelect(id);
            }}
          >
            {label || "edge"}
            {hasComment ? <span className="graph-edge-comment-pin">{data?.commentCount}</span> : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = {
  event_output: GraphEdgeBase,
  event_message: GraphEdgeBase,
  session_state: GraphEdgeBase,
  temp_state: GraphEdgeBase,
  user_state: GraphEdgeBase,
  app_state: GraphEdgeBase,
  artifact: GraphEdgeBase,
  route: GraphEdgeBase,
  control: GraphEdgeBase,
  remote_a2a: GraphEdgeBase
};
