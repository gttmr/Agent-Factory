import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  functionRoles,
  graphChannels,
  graphControlKinds,
  type AssetCandidate,
  type GraphEdge,
  type GraphNode,
  type HumanInputContract
} from "../analyzer/types";
import { Button, Field, SelectField, TextareaField } from "../ui/primitives";
import { CategoryBadge } from "./CategoryBadge";
import { GraphElementTabs } from "./graph/GraphElementTabs";
import type { GraphEditState } from "./GraphCanvas";
import {
  assetRefForNode,
  availableGraphElementGroups,
  graphRegionLabel,
  isA2AProtocolBoundary,
  invocationControlLabel,
  nextGraphElementGroupAfterSelectionChange,
  type GraphElementGroup,
  type GraphElementGroupId
} from "./graphElementEditorModel";
import { graphNodeKindToAssetType } from "../graph/graphDisplay";

interface GraphElementEditorProps {
  editState: GraphEditState;
  assetCandidates: AssetCandidate[];
  onClose: () => void;
}

export function GraphElementEditor({ editState, assetCandidates, onClose }: GraphElementEditorProps) {
  const [activeGroup, setActiveGroup] = useState<GraphElementGroupId>("summary");
  const selectedAsset = findNodeAsset(editState.selectedNode, assetCandidates);
  const groups = useMemo(
    () =>
      availableGraphElementGroups({
        selectedNode: editState.selectedNode,
        selectedEdge: editState.selectedEdge,
        asset: selectedAsset
      }),
    [editState.selectedEdge, editState.selectedNode, selectedAsset]
  );
  const selectionKey = editState.selectedNode
    ? `node:${editState.selectedNode.id}`
    : editState.selectedEdge
      ? `edge:${editState.selectedEdge.id}`
      : "empty";

  useEffect(() => {
    setActiveGroup((current) => nextGraphElementGroupAfterSelectionChange(current, groups));
  }, [groups, selectionKey]);

  if (editState.selectedNode) {
    return (
      <NodeForm
        node={editState.selectedNode}
        asset={selectedAsset}
        assetCandidates={assetCandidates}
        editState={editState}
        groups={groups}
        activeGroup={activeGroup}
        onGroupChange={setActiveGroup}
        onClose={onClose}
      />
    );
  }
  if (editState.selectedEdge) {
    return (
      <EdgeForm
        edge={editState.selectedEdge}
        editState={editState}
        groups={groups}
        activeGroup={activeGroup}
        onGroupChange={setActiveGroup}
        onClose={onClose}
      />
    );
  }
  return <aside className="graph-element-editor empty">편집할 Node 또는 Edge를 선택하세요.</aside>;
}

function NodeForm({
  node,
  asset,
  assetCandidates,
  editState,
  groups,
  activeGroup,
  onGroupChange,
  onClose
}: {
  node: GraphNode;
  asset: AssetCandidate | null;
  assetCandidates: AssetCandidate[];
  editState: GraphEditState;
  groups: readonly GraphElementGroup[];
  activeGroup: GraphElementGroupId;
  onGroupChange: (group: GraphElementGroupId) => void;
  onClose: () => void;
}) {
  const assetType = graphNodeKindToAssetType(node.node_kind);
  const matchingAssets = assetType ? assetCandidates.filter((candidate) => candidate.asset_type === assetType) : [];
  const update = (next: GraphNode) => editState.replaceNode(next);

  return (
    <aside className="graph-element-editor">
      <EditorHeader eyebrow="Node 편집" title={node.label} code={node.id} onClose={onClose}>
        {assetType ? <CategoryBadge category={assetType} /> : null}
        {isA2AProtocolBoundary(node, asset) ? <span className="subtype-badge protocol-a2a">A2A protocol</span> : null}
      </EditorHeader>
      <GraphElementTabs activeGroup={activeGroup} groups={groups} ariaLabel="Graph Node 편집 그룹" onGroupChange={onGroupChange} />

      {activeGroup === "summary" ? (
        <EditorSection title="요약">
          <Field label="label">
            <input value={node.label} onChange={(event) => update({ ...node, label: event.target.value })} />
          </Field>
          <Field label="node_kind" hint="종류 변경은 삭제 후 다시 추가합니다.">
            <input value={node.node_kind} readOnly />
          </Field>
          {assetType ? (
            <SelectField
              label={node.node_kind === "agent" ? "agent_ref" : node.node_kind === "tool" ? "tool_ref" : "workflow_ref"}
              value={assetRefForNode(node) ?? ""}
              onChange={(event) => update(nodeWithAssetRef(node, event.target.value))}
            >
              <option value="">Target asset 선택</option>
              {matchingAssets.map((candidate) => (
                <option key={candidate.asset_id} value={candidate.asset_id}>
                  {candidate.name} ({candidate.asset_id})
                </option>
              ))}
            </SelectField>
          ) : null}
        </EditorSection>
      ) : null}

      {activeGroup === "io" ? (
        <EditorSection title="입출력">
          {asset ? (
            <>
              <FieldList title="Asset inputs" fields={asset.inputs} />
              <FieldList title="Asset outputs" fields={asset.outputs} />
            </>
          ) : null}
          {node.node_kind === "human_input" ? (
            <HumanInputFields contract={node.human_input_contract} onChange={(contract) => update({ ...node, human_input_contract: contract })} />
          ) : null}
        </EditorSection>
      ) : null}

      {activeGroup === "flow" ? (
        <EditorSection title="흐름">
          {node.node_kind === "function" ? (
            <SelectField label="role" value={node.role} onChange={(event) => update({ ...node, role: event.target.value as typeof node.role })}>
              {functionRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </SelectField>
          ) : null}
          {node.node_kind === "function" && node.role === "route" ? (
            <p className="graph-element-editor-hint">조건과 route alias는 이 Function에서 나가는 condition Edge에서 편집합니다.</p>
          ) : null}
          {node.node_kind === "human_input" ? <p className="graph-element-editor-hint">callback과 resume는 Edge control로 연결합니다.</p> : null}
          <RegionMembershipEditor node={node} editState={editState} />
        </EditorSection>
      ) : null}

      {activeGroup === "runtime" ? (
        <EditorSection title="호출·채널">
          {node.node_kind === "agent" ? (
            <AvailableToolsEditor
              node={node}
              tools={assetCandidates.filter((candidate) => candidate.asset_type === "tool")}
              onChange={(availableTools) => update({ ...node, available_tools: availableTools })}
            />
          ) : null}
          {node.node_kind === "tool" ? (
            <Field label="invocation_control" hint="Tool Node는 Workflow가 호출합니다."><input value={invocationControlLabel("workflow")} readOnly /></Field>
          ) : null}
          {node.node_kind === "subworkflow" ? <Field label="workflow_ref"><input value={node.workflow_ref} readOnly /></Field> : null}
        </EditorSection>
      ) : null}

      {activeGroup === "risk" ? (
        <EditorSection title="검토·리스크">
          {asset ? (
            <dl className="graph-element-editor-definition-list">
              <dt>status</dt><dd>{asset.status}</dd>
              <dt>risk_level</dt><dd>{asset.risk_level}</dd>
              <dt>risk_signals</dt><dd>{asset.risk_signals.join(", ") || "없음"}</dd>
              <dt>missing_information</dt><dd>{asset.missing_information.join(", ") || "없음"}</dd>
            </dl>
          ) : <p className="graph-element-editor-hint">연결된 Target asset이 없습니다.</p>}
        </EditorSection>
      ) : null}

      {activeGroup === "raw" ? <JsonSection title="Node JSON" value={node} /> : null}
      <div className="af-action-row"><Button variant="secondary" type="button" onClick={onClose}>닫기</Button></div>
    </aside>
  );
}

function EdgeForm({ edge, editState, groups, activeGroup, onGroupChange, onClose }: {
  edge: GraphEdge;
  editState: GraphEditState;
  groups: readonly GraphElementGroup[];
  activeGroup: GraphElementGroupId;
  onGroupChange: (group: GraphElementGroupId) => void;
  onClose: () => void;
}) {
  const updateControl = (patch: Partial<GraphEdge["control"]>) => editState.replaceEdge({ ...edge, control: { ...edge.control, ...patch } });
  return (
    <aside className="graph-element-editor">
      <EditorHeader eyebrow="Edge 편집" title={`${nodeLabel(editState.draft.nodes, edge.from)} → ${nodeLabel(editState.draft.nodes, edge.to)}`} code={edge.id} onClose={onClose} />
      <GraphElementTabs activeGroup={activeGroup} groups={groups} ariaLabel="Graph Edge 편집 그룹" onGroupChange={onGroupChange} />

      {activeGroup === "summary" ? (
        <EditorSection title="요약">
          <Field label="id"><input value={edge.id} readOnly /></Field>
          <Field label="from → to"><input value={`${edge.from} → ${edge.to}`} readOnly /></Field>
        </EditorSection>
      ) : null}

      {activeGroup === "flow" ? (
        <EditorSection title="흐름">
          <SelectField label="control.kind" value={edge.control.kind} onChange={(event) => updateControl({ kind: event.target.value as GraphEdge["control"]["kind"] })}>
            {graphControlKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </SelectField>
          <TextareaField label="control.condition" rows={2} value={edge.control.condition ?? ""} onChange={(event) => updateControl({ condition: nullableString(event.target.value) })} />
          <TextareaField label="control.accepted_aliases" rows={3} value={formatStringList(edge.control.accepted_aliases)} onChange={(event) => updateControl({ accepted_aliases: parseStringList(event.target.value) })} hint="한 줄에 하나씩 입력" />
          <label className="graph-element-editor-check">
            <input type="checkbox" checked={edge.control.default} onChange={(event) => updateControl({ default: event.target.checked })} />
            <span>default condition</span>
          </label>
        </EditorSection>
      ) : null}

      {activeGroup === "runtime" ? (
        <EditorSection title="호출·채널">
          <SelectField label="channel" value={edge.channel ?? ""} onChange={(event) => editState.replaceEdge({ ...edge, channel: event.target.value ? event.target.value as GraphEdge["channel"] : null })}>
            <option value="">없음</option>
            {graphChannels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
          </SelectField>
          <p className="graph-element-editor-hint">callback, resume, cancel, timeout은 별도 Node kind가 아니라 Edge control입니다.</p>
        </EditorSection>
      ) : null}

      {activeGroup === "raw" ? <JsonSection title="Edge JSON" value={edge} /> : null}
      <div className="af-action-row"><Button variant="secondary" type="button" onClick={onClose}>닫기</Button></div>
    </aside>
  );
}

function AvailableToolsEditor({ node, tools, onChange }: {
  node: Extract<GraphNode, { node_kind: "agent" }>;
  tools: AssetCandidate[];
  onChange: (value: Extract<GraphNode, { node_kind: "agent" }>["available_tools"]) => void;
}) {
  const selected = new Set(node.available_tools.map((item) => item.tool_ref));
  return (
    <fieldset className="graph-element-editor-section">
      <legend>available_tools</legend>
      {tools.length ? tools.map((tool) => (
        <label key={tool.asset_id} className="graph-element-editor-check">
          <input
            type="checkbox"
            checked={selected.has(tool.asset_id)}
            onChange={(event) => onChange(event.target.checked
              ? [...node.available_tools, { tool_ref: tool.asset_id, invocation_control: "agent" }]
              : node.available_tools.filter((item) => item.tool_ref !== tool.asset_id))}
          />
          <span>{tool.name} · {invocationControlLabel("agent")}</span>
        </label>
      )) : <p className="graph-element-editor-hint">선택 가능한 Tool asset이 없습니다.</p>}
    </fieldset>
  );
}

function RegionMembershipEditor({ node, editState }: { node: GraphNode; editState: GraphEditState }) {
  if (!editState.draft.regions.length) return <p className="graph-element-editor-hint">정의된 병렬·반복 실행 범위가 없습니다.</p>;
  const updateRegion = (regionId: string, field: "node_ids" | "entry_node_ids" | "exit_node_ids", checked: boolean) => {
    editState.replaceRegions(editState.draft.regions.map((region) => {
      if (region.id !== regionId) return region;
      const current = region[field];
      const next = checked ? [...new Set([...current, node.id])] : current.filter((id) => id !== node.id);
      if (field === "node_ids" && !checked) {
        return { ...region, node_ids: next, entry_node_ids: region.entry_node_ids.filter((id) => id !== node.id), exit_node_ids: region.exit_node_ids.filter((id) => id !== node.id) };
      }
      return { ...region, [field]: next };
    }));
  };
  return (
    <div>
      <h5>실행 범위 소속</h5>
      <p className="graph-element-editor-hint">실행 범위는 Graph 구조 표시이며 Workflow 실행 방식은 Workflow Profile에서 결정합니다.</p>
      {editState.draft.regions.map((region) => {
        const member = region.node_ids.includes(node.id);
        return (
          <div key={region.id} className="graph-element-editor-region-row">
            <strong>{region.id} · {graphRegionLabel(region.kind)}</strong>
            <label className="graph-element-editor-check"><input type="checkbox" checked={member} onChange={(event) => updateRegion(region.id, "node_ids", event.target.checked)} /><span>포함</span></label>
            <label className="graph-element-editor-check"><input type="checkbox" checked={region.entry_node_ids.includes(node.id)} disabled={!member} onChange={(event) => updateRegion(region.id, "entry_node_ids", event.target.checked)} /><span>진입</span></label>
            <label className="graph-element-editor-check"><input type="checkbox" checked={region.exit_node_ids.includes(node.id)} disabled={!member} onChange={(event) => updateRegion(region.id, "exit_node_ids", event.target.checked)} /><span>종료</span></label>
          </div>
        );
      })}
    </div>
  );
}

function HumanInputFields({ contract, onChange }: { contract: HumanInputContract; onChange: (value: HumanInputContract) => void }) {
  return (
    <>
      <Field label="message"><input value={contract.message} onChange={(event) => onChange({ ...contract, message: event.target.value })} /></Field>
      <Field label="payload_schema_ref"><input value={contract.payload_schema_ref ?? ""} onChange={(event) => onChange({ ...contract, payload_schema_ref: nullableString(event.target.value) })} /></Field>
      <Field label="response_schema_ref"><input value={contract.response_schema_ref ?? ""} onChange={(event) => onChange({ ...contract, response_schema_ref: nullableString(event.target.value) })} /></Field>
      <JsonMapField label="response_mapping" value={contract.response_mapping} onChange={(value) => onChange({ ...contract, response_mapping: value })} />
      <TextareaField label="choice_options" rows={3} value={formatStringList(contract.choice_options)} onChange={(event) => onChange({ ...contract, choice_options: nullableList(parseStringList(event.target.value)) })} />
      <StringArrayMapField label="accepted_aliases" value={contract.accepted_aliases} onChange={(value) => onChange({ ...contract, accepted_aliases: value })} />
      <Field label="default_choice"><input value={contract.default_choice ?? ""} onChange={(event) => onChange({ ...contract, default_choice: nullableString(event.target.value) })} /></Field>
    </>
  );
}

function JsonMapField({ label, value, onChange }: { label: string; value: Record<string, string> | null; onChange: (value: Record<string, string> | null) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(JSON.stringify(value ?? {}, null, 2)), [value]);
  return <TextareaField label={label} rows={4} value={text} aria-invalid={Boolean(error)} hint={error ?? "JSON string map"} onChange={(event) => setText(event.target.value)} onBlur={() => {
    const parsed = parseRecord(text, (entry) => typeof entry === "string");
    if (!parsed.ok) return setError(parsed.error);
    setError(null); onChange(parsed.value as Record<string, string> | null);
  }} />;
}

function StringArrayMapField({ label, value, onChange }: { label: string; value: Record<string, string[]> | null | undefined; onChange: (value: Record<string, string[]> | null) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(JSON.stringify(value ?? {}, null, 2)), [value]);
  return <TextareaField label={label} rows={5} value={text} aria-invalid={Boolean(error)} hint={error ?? "JSON string[] map"} onChange={(event) => setText(event.target.value)} onBlur={() => {
    const parsed = parseRecord(text, (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string" && item.trim()));
    if (!parsed.ok) return setError(parsed.error);
    setError(null); onChange(parsed.value as Record<string, string[]> | null);
  }} />;
}

function EditorHeader({ eyebrow, title, code, onClose, children }: { eyebrow: string; title: string; code: string; onClose: () => void; children?: ReactNode }) {
  return <header className="graph-element-editor-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><div className="graph-element-editor-meta"><code>{code}</code>{children}</div></div><Button variant="ghost" type="button" onClick={onClose}>닫기</Button></header>;
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="graph-element-editor-section"><h4>{title}</h4><div className="graph-element-editor-section-body">{children}</div></section>;
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return <EditorSection title={title}><pre className="graph-element-editor-json">{JSON.stringify(value, null, 2)}</pre></EditorSection>;
}

function FieldList({ title, fields }: { title: string; fields: AssetCandidate["inputs"] }) {
  return <div><h5>{title}</h5>{fields.length ? <ul>{fields.map((field) => <li key={field.name}><code>{field.name}</code> · {field.type}{field.required ? " · required" : ""}</li>)}</ul> : <p className="graph-element-editor-hint">없음</p>}</div>;
}

function nodeWithAssetRef(node: GraphNode, ref: string): GraphNode {
  if (node.node_kind === "agent") return { ...node, agent_ref: ref };
  if (node.node_kind === "tool") return { ...node, tool_ref: ref, invocation_control: "workflow" };
  if (node.node_kind === "subworkflow") return { ...node, workflow_ref: ref };
  return node;
}

function findNodeAsset(node: GraphNode | null, assets: AssetCandidate[]): AssetCandidate | null {
  const ref = assetRefForNode(node);
  return ref ? assets.find((asset) => asset.asset_id === ref) ?? null : null;
}

function nodeLabel(nodes: GraphNode[], nodeId: string): string {
  return nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}

function nullableString(value: string): string | null { return value === "" ? null : value; }
function nullableList(value: string[]): string[] | null { return value.length ? value : null; }
function formatStringList(value: string[] | null | undefined): string { return (value ?? []).join("\n"); }
function parseStringList(value: string): string[] { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }

function parseRecord(text: string, validValue: (value: unknown) => boolean): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  if (!text.trim()) return { ok: true, value: null };
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.entries(value).some(([key, entry]) => !key.trim() || !validValue(entry))) {
      return { ok: false, error: "요구된 JSON object 형식이 아닙니다." };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: "유효한 JSON을 입력하세요." };
  }
}
