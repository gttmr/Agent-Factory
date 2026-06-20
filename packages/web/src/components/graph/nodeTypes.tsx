import { Handle, Position, type NodeProps } from "reactflow";
import { CategoryBadge, SubtypeBadge } from "../CategoryBadge";
import type { GraphNodeData } from "./layout";
import type { ModuleCategory } from "../../analyzer/types";

function moduleCategoryFromKind(kind: string | undefined): ModuleCategory | null {
  if (kind === "workflow_call") return "workflow";
  if (kind === "adapter_call") return "adapter";
  if (kind === "remote_agent_call") return "remote_a2a";
  if (kind === "agent" || kind === "workflow" || kind === "adapter" || kind === "remote_a2a") {
    return kind;
  }
  return null;
}

function reviewChip(status: string | undefined) {
  if (!status || status === "n/a") return null;
  const cls =
    status === "approved"
      ? "graph-node-review approved"
      : status === "needs_info"
      ? "graph-node-review needs"
      : status === "deferred"
      ? "graph-node-review deferred"
      : "graph-node-review rejected";
  return <span className={cls}>{status}</span>;
}

function agentModeChip(graphNode: GraphNodeData["graphNode"], kind: "agent" | "workflow" | "adapter" | "remote_a2a") {
  if (kind !== "agent") return null;
  const mode = graphNode.agent_execution_mode === "chat" ? "chat" : "single_turn";
  return (
    <span className={`graph-node-mode ${mode === "chat" ? "is-chat" : ""}`}>
      {mode === "chat" ? "chat · history" : "single turn"}
    </span>
  );
}

function CollaborationBadges({ data }: { data: GraphNodeData }) {
  const commentCount = data.commentCount ?? 0;
  const highlightCount = data.highlightCount ?? 0;
  if (!commentCount && !highlightCount) return null;
  return (
    <span className="graph-node-collab" title={data.commentTooltip ?? `comments ${commentCount}, highlights ${highlightCount}`}>
      {commentCount ? <span className="graph-node-comment-pin">{commentCount}</span> : null}
      {highlightCount ? <span className="graph-node-highlight-pin">{highlightCount}</span> : null}
    </span>
  );
}

function HandleStrip() {
  return (
    <>
      <Handle type="target" position={Position.Left} className="graph-node-handle" />
      <Handle type="source" position={Position.Right} className="graph-node-handle" />
    </>
  );
}

function ModuleCard({ data, kind }: NodeProps<GraphNodeData> & { kind: "agent" | "workflow" | "adapter" | "remote_a2a" }) {
  const { graphNode, selected, onSelect } = data;
  const cat = moduleCategoryFromKind(kind);
  const sub = graphNode.execution_kind && graphNode.execution_kind !== kind ? graphNode.execution_kind : null;
  return (
    <div
      className={`graph-node graph-node-card cat-${cat ?? "agent"} ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <div className="graph-node-head">
        {cat ? <CategoryBadge category={cat} /> : null}
        {sub ? <SubtypeBadge value={sub} /> : null}
        {agentModeChip(graphNode, kind)}
      </div>
      <strong className="graph-node-label">{graphNode.label}</strong>
      <div className="graph-node-meta">
        {graphNode.module_id ? <span className="graph-node-mod">{graphNode.module_id}</span> : null}
        {reviewChip(graphNode.review_status)}
      </div>
    </div>
  );
}

function FunctionToolNode({ data, kind }: NodeProps<GraphNodeData> & { kind: "function" | "tool" }) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-square graph-node-${kind} ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <span className="graph-node-eyebrow">{kind}</span>
      <strong className="graph-node-label graph-node-mono">{graphNode.label}</strong>
    </div>
  );
}

function HumanInputNode({ data }: NodeProps<GraphNodeData>) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-card graph-node-human ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <span className="graph-node-eyebrow">human ⏸︎</span>
      <strong className="graph-node-label">{graphNode.label}</strong>
      {graphNode.execution_kind ? (
        <span className="graph-node-mod">{graphNode.execution_kind}</span>
      ) : null}
    </div>
  );
}

function RouterNode({ data }: NodeProps<GraphNodeData>) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-router ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <div className="graph-node-router-inner">
        <span className="graph-node-eyebrow">router</span>
        <strong>{graphNode.label}</strong>
      </div>
    </div>
  );
}

function JoinNode({ data }: NodeProps<GraphNodeData>) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-join ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <span className="graph-node-join-dot" aria-hidden />
      <span className="graph-node-join-label">{graphNode.label}</span>
    </div>
  );
}

function LoopControlNode({ data }: NodeProps<GraphNodeData>) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-loop ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <span className="graph-node-loop-glyph">↻</span>
      <strong className="graph-node-label">{graphNode.label}</strong>
    </div>
  );
}

function PillNode({ data, kind }: NodeProps<GraphNodeData> & { kind: "input" | "output" }) {
  const { graphNode, selected, onSelect } = data;
  return (
    <div
      className={`graph-node graph-node-pill graph-node-${kind} ${selected ? "is-selected" : ""} ${
        data.highlightCount ? "has-highlight" : ""
      }`}
      onClick={() => onSelect(graphNode.id)}
    >
      <HandleStrip />
      <CollaborationBadges data={data} />
      <strong className="graph-node-label">{graphNode.label}</strong>
    </div>
  );
}

export const nodeTypes = {
  agent: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="agent" />,
  workflow: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="workflow" />,
  workflow_call: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="workflow" />,
  adapter: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="adapter" />,
  adapter_call: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="adapter" />,
  remote_a2a: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="remote_a2a" />,
  remote_agent_call: (p: NodeProps<GraphNodeData>) => <ModuleCard {...p} kind="remote_a2a" />,
  function: (p: NodeProps<GraphNodeData>) => <FunctionToolNode {...p} kind="function" />,
  tool: (p: NodeProps<GraphNodeData>) => <FunctionToolNode {...p} kind="tool" />,
  human_input: HumanInputNode,
  router: RouterNode,
  join: JoinNode,
  loop_control: LoopControlNode,
  input: (p: NodeProps<GraphNodeData>) => <PillNode {...p} kind="input" />,
  output: (p: NodeProps<GraphNodeData>) => <PillNode {...p} kind="output" />
};
