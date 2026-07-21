import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge as ReactFlowEdge,
  type EdgeChange,
  type Node as ReactFlowNode,
  type NodeChange,
  type XYPosition
} from "reactflow";
import "reactflow/dist/style.css";
import type {
  AssetCandidate,
  GraphEdge,
  GraphIR,
  GraphNode,
  GraphRegion,
  GraphRegionKind,
  NodeKind
} from "../analyzer/types";
import { graphAssetSubtype, graphEdgeId } from "../graph/graphDisplay";
import type { CommentRecord, HighlightRecord } from "../state/useCollaboration";
import { GraphInspector } from "./GraphInspector";
import { RegionOverlay } from "./graph/containerOverlay";
import { edgeTypes } from "./graph/edgeTypes";
import { layoutGraphIR, type GraphEdgeData, type GraphNodeData } from "./graph/layout";
import { nodeTypes } from "./graph/nodeTypes";
import { TARGET_NODE_KIND_OPTIONS, assetRefForNode, graphRegionLabel, isA2AProtocolBoundary } from "./graphElementEditorModel";

interface GraphCanvasProps {
  graphIR: GraphIR;
  assetCandidates: AssetCandidate[];
  onContinue?: () => void;
  continueLabel?: string;
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  hideInspector?: boolean;
  comments?: CommentRecord[];
  highlights?: HighlightRecord[];
  editable?: boolean;
  onSaveGraph?: (next: GraphIR) => void;
  onEditStateChange?: (state: GraphEditState | null) => void;
  saving?: boolean;
}

export interface Selection {
  nodeId: string | null;
  edgeId: string | null;
}

export interface GraphEditState {
  editModeActive: boolean;
  draft: GraphIR;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  replaceNode: (node: GraphNode) => void;
  replaceEdge: (edge: GraphEdge) => void;
  replaceRegions: (regions: GraphRegion[]) => void;
}

export function GraphCanvas({
  graphIR,
  assetCandidates,
  onContinue,
  continueLabel,
  selection: selectionProp,
  onSelectionChange,
  hideInspector = false,
  comments = [],
  highlights = [],
  editable = false,
  onSaveGraph,
  onEditStateChange,
  saving = false
}: GraphCanvasProps) {
  const [internalSelection, setInternalSelection] = useState<Selection>({ nodeId: null, edgeId: null });
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<GraphIR | null>(null);
  const [dirty, setDirty] = useState(false);
  const [addKind, setAddKind] = useState<NodeKind>("agent");
  const [addLabel, setAddLabel] = useState("");
  const [regionKind, setRegionKind] = useState<GraphRegionKind>("parallel");
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [presentationPositions, setPresentationPositions] = useState<Map<string, XYPosition>>(new Map());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const edgeCreationGuardRef = useRef<string | null>(null);
  const selection = selectionProp ?? internalSelection;
  const editModeActive = editable && editMode && draft !== null;
  const activeGraph = editModeActive && draft ? draft : graphIR;

  const setSelection = useCallback((next: Selection) => {
    if (selectionProp === undefined) setInternalSelection(next);
    onSelectionChange?.(next);
  }, [onSelectionChange, selectionProp]);

  const updateDraft = useCallback((updater: (current: GraphIR) => GraphIR) => {
    setDraft((current) => current ? updater(current) : current);
    setDirty(true);
  }, []);

  const replaceNode = useCallback((nextNode: GraphNode) => {
    updateDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nextNode.id ? nextNode : node) }));
  }, [updateDraft]);

  const replaceEdge = useCallback((nextEdge: GraphEdge) => {
    updateDraft((current) => ({ ...current, edges: current.edges.map((edge) => edge.id === nextEdge.id ? nextEdge : edge) }));
  }, [updateDraft]);

  const replaceRegions = useCallback((regions: GraphRegion[]) => {
    updateDraft((current) => ({ ...current, regions }));
  }, [updateDraft]);

  const cancelConnectMode = useCallback(() => {
    setConnectMode(false);
    setConnectSourceId(null);
  }, []);

  useEffect(() => {
    if (editable) return;
    setEditMode(false);
    setDraft(null);
    setDirty(false);
    cancelConnectMode();
  }, [cancelConnectMode, editable]);

  const enterEditMode = useCallback(() => {
    const nextDraft = cloneGraph(graphIR);
    const initial = layoutGraphIR(nextDraft, { nodeId: null, edgeId: null }, () => undefined);
    setPresentationPositions(new Map(initial.nodes.map((node) => [node.id, { ...node.position }])));
    setDraft(nextDraft);
    setDirty(false);
    setEditMode(true);
    setSelection({ nodeId: null, edgeId: null });
    setNotice("편집 모드를 시작했습니다. 배치 좌표는 현재 화면에서만 유지됩니다.");
  }, [graphIR, setSelection]);

  const cancelEditMode = useCallback(() => {
    setEditMode(false);
    setDraft(null);
    setDirty(false);
    setPresentationPositions(new Map());
    cancelConnectMode();
    setSelection({ nodeId: null, edgeId: null });
    setNotice(null);
  }, [cancelConnectMode, setSelection]);

  const createEdge = useCallback((sourceId: string, targetId: string) => {
    if (!draft) return;
    const guardKey = `${sourceId}->${targetId}`;
    if (edgeCreationGuardRef.current === guardKey) return;
    edgeCreationGuardRef.current = guardKey;
    window.setTimeout(() => { if (edgeCreationGuardRef.current === guardKey) edgeCreationGuardRef.current = null; }, 0);
    const result = buildEditableEdge(draft, sourceId, targetId);
    if (!result.edge) return setNotice(result.message);
    updateDraft((current) => ({ ...current, edges: [...current.edges, result.edge!] }));
    setSelection({ nodeId: null, edgeId: result.edge.id });
    setNotice(result.message);
    cancelConnectMode();
  }, [cancelConnectMode, draft, setSelection, updateDraft]);

  const handleNodeInteraction = useCallback((nodeId: string) => {
    if (editModeActive && connectMode) {
      if (!connectSourceId) {
        setConnectSourceId(nodeId);
        setSelection({ nodeId, edgeId: null });
        setNotice("대상 Node를 선택하세요.");
      } else {
        createEdge(connectSourceId, nodeId);
      }
      return;
    }
    setSelection({ nodeId, edgeId: null });
  }, [connectMode, connectSourceId, createEdge, editModeActive, setSelection]);

  const handleEdgeInteraction = useCallback((edgeId: string) => {
    if (connectMode) cancelConnectMode();
    setSelection({ nodeId: null, edgeId });
  }, [cancelConnectMode, connectMode, setSelection]);

  const selectRef = useRef<(kind: "node" | "edge", id: string) => void>(() => undefined);
  selectRef.current = (kind, id) => kind === "node" ? handleNodeInteraction(id) : handleEdgeInteraction(id);
  const handleSelect = useCallback((kind: "node" | "edge", id: string) => selectRef.current(kind, id), []);

  const addNode = useCallback((position: XYPosition | null) => {
    if (!draft) return;
    const label = addLabel.trim();
    if (!label) return setNotice("Node label을 입력하세요.");
    const result = buildEditableNode(draft, addKind, label, assetCandidates);
    if (!result.node) return setNotice(result.message);
    const node = result.node;
    const nextPosition = position ?? nextNodePosition(presentationPositions);
    setPresentationPositions((current) => new Map(current).set(node.id, nextPosition));
    updateDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setAddLabel("");
    setSelection({ nodeId: node.id, edgeId: null });
    setNotice(result.message);
  }, [addKind, addLabel, assetCandidates, draft, presentationPositions, setSelection, updateDraft]);

  const addRegion = useCallback(() => {
    if (!draft || !selection.nodeId) return setNotice("실행 범위에 넣을 Node를 먼저 선택하세요.");
    const region: GraphRegion = {
      id: nextRegionId(draft, regionKind),
      kind: regionKind,
      node_ids: [selection.nodeId],
      entry_node_ids: [selection.nodeId],
      exit_node_ids: [selection.nodeId],
      parent_region_id: null
    };
    updateDraft((current) => ({ ...current, regions: [...current.regions, region] }));
    setNotice(`${region.id} ${graphRegionLabel(region.kind)}를 추가했습니다. Node 편집기에서 포함·진입·종료 Node를 조정하세요.`);
  }, [draft, regionKind, selection.nodeId, updateDraft]);

  const deleteSelection = useCallback(() => {
    if (!selection.nodeId && !selection.edgeId) return setNotice("삭제할 Node 또는 Edge를 선택하세요.");
    updateDraft((current) => deleteFromGraph(current, selection));
    if (selection.nodeId) {
      setPresentationPositions((current) => { const next = new Map(current); next.delete(selection.nodeId!); return next; });
    }
    setSelection({ nodeId: null, edgeId: null });
    setNotice("선택 항목을 삭제했습니다.");
  }, [selection, setSelection, updateDraft]);

  const validation = useMemo(() => editModeActive ? validateDraftGraph(activeGraph, assetCandidates) : [], [activeGraph, assetCandidates, editModeActive]);
  const saveDraft = useCallback(() => {
    if (!draft || !onSaveGraph) return;
    const errors = validateDraftGraph(draft, assetCandidates);
    if (errors.length) return setNotice(`저장할 수 없습니다: ${errors[0]}`);
    onSaveGraph(cloneGraph(draft));
    setDirty(false);
    setNotice("Graph IR 저장을 요청했습니다.");
  }, [assetCandidates, draft, onSaveGraph]);

  const layout = useMemo(
    () => layoutGraphIR(activeGraph, { nodeId: null, edgeId: null }, handleSelect, presentationPositions),
    [activeGraph, handleSelect, presentationPositions]
  );
  const assetById = useMemo(() => new Map(assetCandidates.map((asset) => [asset.asset_id, asset])), [assetCandidates]);
  const marks = useMemo(() => buildCollaborationMarks(activeGraph, comments, highlights), [activeGraph, comments, highlights]);
  const baseNodes = useMemo<ReactFlowNode<GraphNodeData>[]>(() => layout.nodes.map((node) => {
    const graphNode = node.data.graphNode;
    const asset = assetById.get(assetRefForNode(graphNode) ?? "") ?? null;
    return {
      ...node,
      data: {
        ...node.data,
        asset,
        a2aBoundary: isA2AProtocolBoundary(graphNode, asset),
        assetSubtype: graphAssetSubtype(asset),
        commentCount: marks.nodeCommentCounts.get(node.id) ?? 0,
        commentTooltip: marks.nodeCommentTooltips.get(node.id),
        highlightCount: marks.nodeHighlightCounts.get(node.id) ?? 0
      }
    };
  }), [assetById, layout.nodes, marks]);
  const baseEdges = useMemo<ReactFlowEdge<GraphEdgeData>[]>(() => layout.edges.map((edge) => {
    const data = edge.data as GraphEdgeData;
    return {
    ...edge,
    data: {
      ...data,
      commentCount: marks.edgeCommentCounts.get(edge.id) ?? 0,
      commentTooltip: marks.edgeCommentTooltips.get(edge.id),
      highlightCount: marks.edgeHighlightCounts.get(edge.id) ?? 0,
      highlightColor: marks.edgeHighlightColors.get(edge.id)
    }
  };}), [layout.edges, marks]);

  const nodeById = useMemo(() => new Map(activeGraph.nodes.map((node) => [node.id, node])), [activeGraph.nodes]);
  const edgeById = useMemo(() => new Map(activeGraph.edges.map((edge) => [edge.id, edge])), [activeGraph.edges]);
  const selectedNode = selection.nodeId ? nodeById.get(selection.nodeId) ?? null : null;
  const selectedEdge = selection.edgeId ? edgeById.get(selection.edgeId) ?? null : null;
  const selectedAsset = assetById.get(assetRefForNode(selectedNode) ?? "") ?? null;

  useEffect(() => {
    if (!editModeActive || !draft) return onEditStateChange?.(null);
    onEditStateChange?.({ editModeActive, draft, selectedNode, selectedEdge, replaceNode, replaceEdge, replaceRegions });
  }, [draft, editModeActive, onEditStateChange, replaceEdge, replaceNode, replaceRegions, selectedEdge, selectedNode]);

  return (
    <div className={`graph-canvas-root${hideInspector ? " graph-canvas-root--no-inspector" : ""}`}>
      <section className="ui-panel graph-canvas-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Target Graph IR</p><h2>Workflow 실행 그래프</h2></div>
          <span className="graph-canvas-stats">Node {activeGraph.nodes.length} · Edge {activeGraph.edges.length} · 실행 범위 {activeGraph.regions.length}</span>
        </div>
        <div className="graph-canvas-workspace">
          <ReactFlowProvider>
            {editable ? (
              <GraphEditToolbar
                addKind={addKind}
                addLabel={addLabel}
                regionKind={regionKind}
                editModeActive={editModeActive}
                dirty={dirty}
                saving={saving}
                canSave={Boolean(onSaveGraph) && validation.length === 0}
                connectMode={connectMode}
                connectSourceId={connectSourceId}
                hasSelection={Boolean(selection.nodeId || selection.edgeId)}
                hasSelectedNode={Boolean(selection.nodeId)}
                notice={notice}
                validation={validation}
                stageRef={stageRef}
                onAddKindChange={setAddKind}
                onAddLabelChange={setAddLabel}
                onRegionKindChange={setRegionKind}
                onAddNode={addNode}
                onAddRegion={addRegion}
                onDelete={deleteSelection}
                onSave={saveDraft}
                onToggleConnect={() => {
                  if (connectMode) { cancelConnectMode(); setNotice("Edge 연결을 취소했습니다."); }
                  else { setConnectMode(true); setConnectSourceId(null); setNotice("시작 Node를 선택하세요."); }
                }}
                onToggleEdit={() => editModeActive ? cancelEditMode() : enterEditMode()}
              />
            ) : null}
            <div ref={stageRef} className="graph-canvas-stage">
              <GraphFlowStage
                baseNodes={baseNodes}
                baseEdges={baseEdges}
                regionRects={layout.regionRects}
                editModeActive={editModeActive}
                selection={selection}
                onConnect={createEdge}
                onEdgeClick={handleEdgeInteraction}
                onNodeClick={handleNodeInteraction}
                onPaneClick={() => { if (!connectMode) setSelection({ nodeId: null, edgeId: null }); }}
                onPositionCommit={(nodeId, position) => setPresentationPositions((current) => new Map(current).set(nodeId, position))}
              />
            </div>
          </ReactFlowProvider>
        </div>
        {onContinue ? <div className="actions align-end graph-canvas-actions"><button type="button" className="primary" onClick={onContinue}>{continueLabel ?? "다음 단계"}</button></div> : null}
      </section>
      {hideInspector ? null : (
        <GraphInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          graphIR={activeGraph}
          nodeLabel={(id) => nodeById.get(id)?.label ?? id}
          asset={selectedAsset}
          onClose={() => setSelection({ nodeId: null, edgeId: null })}
        />
      )}
    </div>
  );
}

function GraphEditToolbar({
  addKind, addLabel, regionKind, editModeActive, dirty, saving, canSave, connectMode, connectSourceId,
  hasSelection, hasSelectedNode, notice, validation, stageRef, onAddKindChange, onAddLabelChange,
  onRegionKindChange, onAddNode, onAddRegion, onDelete, onSave, onToggleConnect, onToggleEdit
}: {
  addKind: NodeKind; addLabel: string; regionKind: GraphRegionKind; editModeActive: boolean; dirty: boolean;
  saving: boolean; canSave: boolean; connectMode: boolean; connectSourceId: string | null; hasSelection: boolean;
  hasSelectedNode: boolean; notice: string | null; validation: string[]; stageRef: RefObject<HTMLDivElement | null>;
  onAddKindChange: (kind: NodeKind) => void; onAddLabelChange: (label: string) => void;
  onRegionKindChange: (kind: GraphRegionKind) => void; onAddNode: (position: XYPosition | null) => void;
  onAddRegion: () => void; onDelete: () => void; onSave: () => void; onToggleConnect: () => void; onToggleEdit: () => void;
}) {
  const reactFlow = useReactFlow();
  return (
    <div className="graph-edit-toolbar" aria-label="Graph IR 편집 도구">
      <label className="graph-edit-toggle"><input type="checkbox" checked={editModeActive} onChange={onToggleEdit} /><span>편집 모드</span></label>
      {editModeActive ? (
        <>
          <span className={`graph-edit-chip${dirty ? " is-dirty" : ""}`}>{dirty ? "변경 있음" : "변경 없음"}</span>
          <span className={`graph-edit-chip${validation.length ? " has-errors" : ""}`}>오류 {validation.length}</span>
          <div className="graph-edit-group" aria-label="Node 추가">
            <select aria-label="Node kind" value={addKind} onChange={(event) => onAddKindChange(event.target.value as NodeKind)}>
              {TARGET_NODE_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input aria-label="Node label" value={addLabel} onChange={(event) => onAddLabelChange(event.target.value)} placeholder="Node label" />
            <button type="button" className="secondary" disabled={!addLabel.trim()} onClick={() => onAddNode(projectStageCenter(reactFlow, stageRef.current))}>추가</button>
          </div>
          <div className="graph-edit-group" aria-label="Edge와 실행 범위 편집">
            <button type="button" className={connectMode ? "secondary is-active" : "secondary"} onClick={onToggleConnect}>{connectMode ? "Edge 취소" : "Edge 추가"}</button>
            <select aria-label="실행 범위 종류" title="Graph 구조 표시이며 Workflow 실행 방식은 Workflow Profile에서 결정합니다." value={regionKind} onChange={(event) => onRegionKindChange(event.target.value as GraphRegionKind)}><option value="parallel">병렬 실행 범위</option><option value="loop">반복 실행 범위</option></select>
            <button type="button" className="secondary" onClick={onAddRegion} disabled={!hasSelectedNode}>실행 범위 추가</button>
            <button type="button" className="secondary" onClick={onDelete} disabled={!hasSelection}>선택 삭제</button>
          </div>
          <div className="graph-edit-group graph-edit-save"><button type="button" className="primary" onClick={onSave} disabled={!dirty || saving || !canSave}>{saving ? "저장 중..." : "저장"}</button><button type="button" className="secondary" onClick={onToggleEdit} disabled={saving}>취소</button></div>
        </>
      ) : null}
      {connectMode ? <span className="graph-edit-hint">{connectSourceId ? "대상 Node를 선택하세요" : "시작 Node를 선택하세요"}</span> : null}
      {notice ? <span className="graph-edit-notice">{notice}</span> : null}
      {validation.length ? <span className="graph-edit-notice" title={validation.join("\n")}>{validation[0]}</span> : null}
    </div>
  );
}

function GraphFlowStage({ baseNodes, baseEdges, regionRects, editModeActive, selection, onConnect, onEdgeClick, onNodeClick, onPaneClick, onPositionCommit }: {
  baseNodes: ReactFlowNode<GraphNodeData>[]; baseEdges: ReactFlowEdge<GraphEdgeData>[];
  regionRects: ReturnType<typeof layoutGraphIR>["regionRects"]; editModeActive: boolean; selection: Selection;
  onConnect: (source: string, target: string) => void; onEdgeClick: (id: string) => void; onNodeClick: (id: string) => void;
  onPaneClick: () => void; onPositionCommit: (nodeId: string, position: XYPosition) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdgeData>(baseEdges);
  useEffect(() => setNodes(baseNodes), [baseNodes, setNodes]);
  useEffect(() => setEdges(baseEdges), [baseEdges, setEdges]);
  const renderedNodes = useMemo(() => nodes.map((node) => ({ ...node, draggable: editModeActive, data: { ...node.data, selected: selection.nodeId === node.id } })), [editModeActive, nodes, selection.nodeId]);
  const renderedEdges = useMemo(() => edges.map((edge) => ({ ...edge, zIndex: selection.edgeId === edge.id ? 20 : edge.zIndex, data: { ...edge.data, selected: selection.edgeId === edge.id } })), [edges, selection.edgeId]);
  const handleNodesChange = useCallback((changes: NodeChange[]) => { if (editModeActive) onNodesChange(changes); }, [editModeActive, onNodesChange]);
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => { if (editModeActive) onEdgesChange(changes); }, [editModeActive, onEdgesChange]);
  const handleConnect = useCallback((connection: Connection) => { if (connection.source && connection.target) onConnect(connection.source, connection.target); }, [onConnect]);
  return (
    <ReactFlow
      nodes={renderedNodes} edges={renderedEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
      nodesDraggable={editModeActive} nodesConnectable={editModeActive} elementsSelectable proOptions={{ hideAttribution: true }}
      onConnect={handleConnect} onEdgesChange={handleEdgesChange} onNodesChange={handleNodesChange} onPaneClick={onPaneClick}
      onNodeClick={(_, node) => onNodeClick(node.id)} onEdgeClick={(_, edge) => onEdgeClick(edge.id)}
      onNodeDragStop={(_, node) => { if (editModeActive) onPositionCommit(node.id, node.position); }}
    >
      <Background gap={18} size={1} /><MiniMap pannable zoomable /><Controls showInteractive={false} />
      <RegionOverlay rects={regionRects} />
    </ReactFlow>
  );
}

function buildEditableNode(graph: GraphIR, kind: NodeKind, label: string, assets: AssetCandidate[]): { node: GraphNode | null; message: string } {
  const id = nextNodeId(graph, kind);
  if (kind === "input" || kind === "join" || kind === "output") return { node: { id, label, node_kind: kind }, message: `${id} Node를 추가했습니다.` };
  if (kind === "function") return { node: { id, label, node_kind: "function", role: "transform" }, message: `${id} Node를 추가했습니다.` };
  if (kind === "human_input") return { node: { id, label, node_kind: "human_input", human_input_contract: { message: label, payload_schema_ref: null, response_schema_ref: null, response_mapping: null, choice_options: null, accepted_aliases: null, default_choice: null } }, message: `${id} Node를 추가했습니다.` };
  const assetType = kind === "subworkflow" ? "workflow" : kind;
  const asset = assets.find((candidate) => candidate.asset_type === assetType);
  if (!asset) return { node: null, message: `${assetType} asset이 없어 ${kind} Node를 추가할 수 없습니다.` };
  if (kind === "agent") return { node: { id, label, node_kind: "agent", agent_ref: asset.asset_id, available_tools: [] }, message: `${id} Node를 추가했습니다.` };
  if (kind === "tool") return { node: { id, label, node_kind: "tool", tool_ref: asset.asset_id, invocation_control: "workflow" }, message: `${id} Node를 추가했습니다.` };
  return { node: { id, label, node_kind: "subworkflow", workflow_ref: asset.asset_id }, message: `${id} Node를 추가했습니다.` };
}

function buildEditableEdge(graph: GraphIR, sourceId: string, targetId: string): { edge: GraphEdge | null; message: string } {
  if (sourceId === targetId) return { edge: null, message: "자기 자신으로 연결할 수 없습니다." };
  if (graph.edges.some((edge) => edge.from === sourceId && edge.to === targetId)) return { edge: null, message: "이미 같은 방향의 Edge가 있습니다." };
  const source = graph.nodes.find((node) => node.id === sourceId);
  const target = graph.nodes.find((node) => node.id === targetId);
  if (!source || !target) return { edge: null, message: "Node를 찾을 수 없습니다." };
  const isRoute = source.node_kind === "function" && source.role === "route";
  const edge: GraphEdge = {
    id: nextEdgeId(graph), from: sourceId, to: targetId,
    control: { kind: isRoute ? "condition" : "next", condition: null, accepted_aliases: [], default: false },
    channel: isRoute ? null : "event"
  };
  return { edge, message: `${edge.id} Edge를 추가했습니다.` };
}

function deleteFromGraph(graph: GraphIR, selection: Selection): GraphIR {
  if (selection.nodeId) {
    const nodeId = selection.nodeId;
    return {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      regions: graph.regions.map((region) => ({ ...region, node_ids: region.node_ids.filter((id) => id !== nodeId), entry_node_ids: region.entry_node_ids.filter((id) => id !== nodeId), exit_node_ids: region.exit_node_ids.filter((id) => id !== nodeId) })).filter((region) => region.node_ids.length)
    };
  }
  return selection.edgeId ? { ...graph, edges: graph.edges.filter((edge) => edge.id !== selection.edgeId) } : graph;
}

function validateDraftGraph(graph: GraphIR, assets: AssetCandidate[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const assetById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  for (const node of graph.nodes) {
    if (!node.id.trim() || nodeIds.has(node.id)) errors.push(`Node id가 비어 있거나 중복됩니다: ${node.id || "(empty)"}`);
    nodeIds.add(node.id);
    const ref = assetRefForNode(node);
    const expected = node.node_kind === "subworkflow" ? "workflow" : node.node_kind === "agent" || node.node_kind === "tool" ? node.node_kind : null;
    if (expected && assetById.get(ref ?? "")?.asset_type !== expected) errors.push(`${node.id}의 typed ref가 ${expected} asset을 가리키지 않습니다.`);
    if (node.node_kind === "agent" && node.available_tools.some((tool) => tool.invocation_control !== "agent" || assetById.get(tool.tool_ref)?.asset_type !== "tool")) errors.push(`${node.id}.available_tools가 Tool asset과 agent invocation control을 사용해야 합니다.`);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge.id.trim() || edgeIds.has(edge.id)) errors.push(`Edge id가 비어 있거나 중복됩니다: ${edge.id || "(empty)"}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`${edge.id}가 존재하지 않는 Node를 가리킵니다.`);
    if (edge.control.kind === "condition" && !edge.control.condition?.trim()) errors.push(`${edge.id}.control.condition이 필요합니다.`);
  }
  for (const region of graph.regions) {
    if (!region.node_ids.length || region.node_ids.some((id) => !nodeIds.has(id))) errors.push(`${region.id} Region membership이 유효하지 않습니다.`);
    if (region.entry_node_ids.some((id) => !region.node_ids.includes(id)) || region.exit_node_ids.some((id) => !region.node_ids.includes(id))) errors.push(`${region.id} entry/exit는 Region member여야 합니다.`);
  }
  return errors;
}

function nextNodeId(graph: GraphIR, kind: NodeKind): string { return nextId(new Set(graph.nodes.map((node) => node.id)), `node-${kind}`); }
function nextEdgeId(graph: GraphIR): string { return nextId(new Set(graph.edges.map((edge) => edge.id)), "edge"); }
function nextRegionId(graph: GraphIR, kind: GraphRegionKind): string { return nextId(new Set(graph.regions.map((region) => region.id)), `region-${kind}`); }
function nextId(used: Set<string>, prefix: string): string { let index = 1; while (used.has(`${prefix}-${index}`)) index += 1; return `${prefix}-${index}`; }
function cloneGraph(graph: GraphIR): GraphIR { return JSON.parse(JSON.stringify(graph)) as GraphIR; }
function nextNodePosition(positions: ReadonlyMap<string, XYPosition>): XYPosition { const values = [...positions.values()]; return values.length ? { x: Math.max(...values.map((point) => point.x)) + 64, y: Math.max(...values.map((point) => point.y)) + 64 } : { x: 72, y: 96 }; }

function projectStageCenter(reactFlow: unknown, stage: HTMLDivElement | null): XYPosition | null {
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  const flow = reactFlow as { screenToFlowPosition?: (point: XYPosition) => XYPosition };
  return flow.screenToFlowPosition?.({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) ?? null;
}

interface CollaborationMarks {
  nodeCommentCounts: Map<string, number>; edgeCommentCounts: Map<string, number>;
  nodeCommentTooltips: Map<string, string>; edgeCommentTooltips: Map<string, string>;
  nodeHighlightCounts: Map<string, number>; edgeHighlightCounts: Map<string, number>; edgeHighlightColors: Map<string, string>;
}

const HIGHLIGHT_COLORS: Partial<Record<HighlightRecord["color_token"], string>> = {
  agent: "var(--cat-agent-line)",
  workflow: "var(--cat-workflow-line)",
  tool: "var(--cat-tool-line)",
  a2a: "var(--protocol-a2a-line)",
  neutral: "var(--line-strong)"
};

function buildCollaborationMarks(graph: GraphIR, comments: CommentRecord[], highlights: HighlightRecord[]): CollaborationMarks {
  const marks: CollaborationMarks = { nodeCommentCounts: new Map(), edgeCommentCounts: new Map(), nodeCommentTooltips: new Map(), edgeCommentTooltips: new Map(), nodeHighlightCounts: new Map(), edgeHighlightCounts: new Map(), edgeHighlightColors: new Map() };
  const edgeByPair = new Map(graph.edges.map((edge) => [`${edge.from}->${edge.to}`, graphEdgeId(edge, 0)]));
  const increment = (map: Map<string, number>, id: string | undefined) => { if (id) map.set(id, (map.get(id) ?? 0) + 1); };
  const pathEdges = (path: string[] | undefined) => (path ?? []).slice(0, -1).map((from, index) => edgeByPair.get(`${from}->${path![index + 1]}`)).filter((id): id is string => Boolean(id));
  for (const comment of comments) {
    const anchor = comment.anchor;
    const add = (kind: "node" | "edge", id: string | undefined) => {
      if (!id) return;
      const counts = kind === "node" ? marks.nodeCommentCounts : marks.edgeCommentCounts;
      const tips = kind === "node" ? marks.nodeCommentTooltips : marks.edgeCommentTooltips;
      increment(counts, id); tips.set(id, `${comment.author}: ${comment.body_md.replace(/\s+/g, " ").slice(0, 96)}`);
    };
    if (anchor.kind === "node") add("node", anchor.node_id);
    if (anchor.kind === "edge") add("edge", anchor.edge_id);
    if (anchor.kind === "path") { for (const id of anchor.node_path ?? []) add("node", id); for (const id of pathEdges(anchor.node_path)) add("edge", id); }
  }
  for (const highlight of highlights) {
    const color = HIGHLIGHT_COLORS[highlight.color_token] ?? "var(--line-strong)";
    const markEdge = (id: string) => { increment(marks.edgeHighlightCounts, id); marks.edgeHighlightColors.set(id, color); };
    if (highlight.kind === "path") { for (const id of highlight.target.node_path ?? []) increment(marks.nodeHighlightCounts, id); for (const id of pathEdges(highlight.target.node_path)) markEdge(id); }
    if (highlight.kind === "node_group") for (const id of highlight.target.node_ids ?? []) increment(marks.nodeHighlightCounts, id);
    if (highlight.kind === "edge_group") for (const id of highlight.target.edge_ids ?? []) markEdge(id);
  }
  return marks;
}
