import type { AssetCandidate, GraphEdge, GraphIR, GraphNode } from "../analyzer/types";
import { graphNodeKindToAssetType } from "../graph/graphDisplay";
import { Button } from "../ui/primitives";
import { CategoryBadge } from "./CategoryBadge";
import { assetRefForNode, graphRegionLabel, invocationControlLabel, isA2AProtocolBoundary } from "./graphElementEditorModel";

interface GraphInspectorProps {
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  graphIR: GraphIR;
  nodeLabel: (id: string) => string;
  asset: AssetCandidate | null;
  onClose: () => void;
}

export function GraphInspector({ selectedNode, selectedEdge, graphIR, nodeLabel, asset, onClose }: GraphInspectorProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="ui-panel graph-inspector empty">
        <p className="eyebrow">Inspector</p>
        <h2>선택 없음</h2>
        <p>Node 또는 Edge를 선택하면 Target Graph IR 필드를 확인할 수 있습니다.</p>
      </aside>
    );
  }
  return (
    <aside className="ui-panel graph-inspector">
      <header className="graph-inspector-head">
        <div><p className="eyebrow">Inspector</p><h2>{selectedNode ? selectedNode.label : selectedEdge?.id}</h2></div>
        <Button variant="ghost" type="button" onClick={onClose}>닫기</Button>
      </header>
      {selectedNode ? <NodeDetails node={selectedNode} graph={graphIR} asset={asset} /> : null}
      {selectedEdge ? <EdgeDetails edge={selectedEdge} nodeLabel={nodeLabel} /> : null}
    </aside>
  );
}

function NodeDetails({ node, graph, asset }: { node: GraphNode; graph: GraphIR; asset: AssetCandidate | null }) {
  const assetType = graphNodeKindToAssetType(node.node_kind);
  const memberships = graph.regions.filter((region) => region.node_ids.includes(node.id));
  return (
    <div className="graph-inspector-stack">
      <InspectorSection title="Node">
        <DefinitionList rows={[
          ["id", node.id], ["node_kind", node.node_kind], ["asset_ref", assetRefForNode(node) ?? "없음"]
        ]} />
        <div className="graph-inspector-badges">
          {assetType ? <CategoryBadge category={assetType} /> : null}
          {isA2AProtocolBoundary(node, asset) ? <span className="subtype-badge protocol-a2a">A2A protocol boundary</span> : null}
        </div>
      </InspectorSection>

      {node.node_kind === "agent" ? (
        <InspectorSection title="Agent 호출">
          <DefinitionList rows={[["agent_ref", node.agent_ref], ["available_tools", node.available_tools.map((item) => `${item.tool_ref} · ${invocationControlLabel(item.invocation_control)}`).join(", ") || "없음"]]} />
        </InspectorSection>
      ) : null}
      {node.node_kind === "tool" ? <InspectorSection title="Tool 호출"><DefinitionList rows={[["tool_ref", node.tool_ref], ["invocation_control", invocationControlLabel(node.invocation_control)]]} /></InspectorSection> : null}
      {node.node_kind === "function" ? <InspectorSection title="Function"><DefinitionList rows={[["role", node.role]]} /></InspectorSection> : null}
      {node.node_kind === "subworkflow" ? <InspectorSection title="Subworkflow"><DefinitionList rows={[["workflow_ref", node.workflow_ref]]} /></InspectorSection> : null}
      {node.node_kind === "human_input" ? (
        <InspectorSection title="사람 입력">
          <DefinitionList rows={[
            ["message", node.human_input_contract.message],
            ["payload_schema_ref", node.human_input_contract.payload_schema_ref ?? "없음"],
            ["response_schema_ref", node.human_input_contract.response_schema_ref ?? "없음"],
            ["choice_options", node.human_input_contract.choice_options?.join(", ") || "없음"],
            ["default_choice", node.human_input_contract.default_choice ?? "없음"]
          ]} />
        </InspectorSection>
      ) : null}

      <InspectorSection title="병렬·반복 실행 범위">
        {memberships.length ? memberships.map((region) => (
          <div key={region.id} className="graph-inspector-row">
            <strong>{region.id}</strong>
            <span>{graphRegionLabel(region.kind)}{region.entry_node_ids.includes(node.id) ? " · 진입" : ""}{region.exit_node_ids.includes(node.id) ? " · 종료" : ""}</span>
          </div>
        )) : <p className="graph-inspector-empty">포함된 실행 범위 없음</p>}
      </InspectorSection>

      {asset ? (
        <InspectorSection title="연결된 Asset">
          <DefinitionList rows={[
            ["asset_id", asset.asset_id], ["asset_type", asset.asset_type], ["owner", asset.owner],
            ["binding", asset.binding?.kind ?? "미정"], ["status", asset.status], ["risk_level", asset.risk_level]
          ]} />
        </InspectorSection>
      ) : null}
      <RawJson value={node} />
    </div>
  );
}

function EdgeDetails({ edge, nodeLabel }: { edge: GraphEdge; nodeLabel: (id: string) => string }) {
  return (
    <div className="graph-inspector-stack">
      <InspectorSection title="Edge">
        <DefinitionList rows={[
          ["id", edge.id], ["from", `${nodeLabel(edge.from)} (${edge.from})`], ["to", `${nodeLabel(edge.to)} (${edge.to})`]
        ]} />
      </InspectorSection>
      <InspectorSection title="Control">
        <DefinitionList rows={[
          ["kind", edge.control.kind], ["condition", edge.control.condition ?? "없음"],
          ["accepted_aliases", edge.control.accepted_aliases.join(", ") || "없음"], ["default", String(edge.control.default)],
          ["channel", edge.channel ?? "없음"]
        ]} />
        {edge.control.kind === "callback" || edge.control.kind === "resume" ? <p className="graph-inspector-note">비동기 흐름은 이 Edge control에서 표현됩니다.</p> : null}
      </InspectorSection>
      <RawJson value={edge} />
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="graph-inspector-section"><h3>{title}</h3>{children}</section>;
}

function DefinitionList({ rows }: { rows: Array<[string, string]> }) {
  return <dl className="graph-inspector-definition-list">{rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>;
}

function RawJson({ value }: { value: unknown }) {
  return <details className="graph-inspector-raw"><summary>원본 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
