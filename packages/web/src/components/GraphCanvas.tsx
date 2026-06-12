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
import { mergeGraphIRValidation, validateGraphIRSoft } from "../analyzer/graphMigration";
import type {
  A2AContract,
  EdgeKind,
  ExecutionSemantics,
  GraphEdge,
  GraphIR,
  GraphNode,
  GraphValidationIssue,
  LaneId,
  ModuleCandidate
} from "../analyzer/types";
import { GRAPH_NODE_KINDS, type NodeKind } from "../analyzer/types";
import { ContainerOverlay } from "../graph/containerOverlay";
import { edgeTypes } from "../graph/edgeTypes";
import { layoutGraphIR, type GraphEdgeData, type GraphNodeData } from "../graph/layout";
import { nodeTypes } from "../graph/nodeTypes";
import { ValidationBanner } from "../graph/validationBanner";
import { GraphInspector } from "./GraphInspector";
import type { CommentRecord, HighlightRecord } from "../state/useCollaboration";

interface GraphCanvasProps {
  graphIR: GraphIR;
  moduleCandidates: ModuleCandidate[];
  a2aContracts: A2AContract[];
  onNavigateToA2AContracts?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  hideInspector?: boolean;
  comments?: CommentRecord[];
  highlights?: HighlightRecord[];
  editable?: boolean;
  onSaveGraph?: (next: GraphIR) => void;
  saving?: boolean;
}

export interface Selection {
  nodeId: string | null;
  edgeId: string | null;
}

export function GraphCanvas({
  graphIR,
  moduleCandidates,
  a2aContracts,
  onNavigateToA2AContracts,
  onContinue,
  continueLabel,
  selection: selectionProp,
  onSelectionChange,
  hideInspector = false,
  comments = [],
  highlights = [],
  editable = false,
  onSaveGraph,
  saving = false
}: GraphCanvasProps) {
  const [internalSelection, setInternalSelection] = useState<Selection>({ nodeId: null, edgeId: null });
  const [editMode, setEditMode] = useState(false);
  const [draftGraphIR, setDraftGraphIR] = useState<GraphIR | null>(null);
  const [dirty, setDirty] = useState(false);
  const [addKind, setAddKind] = useState<NodeKind>("agent");
  const [addLabel, setAddLabel] = useState("");
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [flowPositions, setFlowPositions] = useState<Record<string, XYPosition>>({});
  const pendingSaveRef = useRef(false);
  const previousGraphIRRef = useRef(graphIR);
  const edgeCreationGuardRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const isControlled = selectionProp !== undefined;
  const selection = isControlled ? selectionProp! : internalSelection;
  const setSelection = (next: Selection) => {
    if (!isControlled) setInternalSelection(next);
    onSelectionChange?.(next);
  };
  const editModeActive = editable && editMode && draftGraphIR !== null;
  const activeGraphIR = editModeActive && draftGraphIR ? draftGraphIR : graphIR;
  const draftValidation = useMemo(
    () => (editModeActive && draftGraphIR ? validateGraphIRSoft(draftGraphIR) : null),
    [draftGraphIR, editModeActive]
  );

  const updateDraft = useCallback((updater: (graph: GraphIR) => GraphIR) => {
    setDraftGraphIR((current) => (current ? updater(current) : current));
    setDirty(true);
    pendingSaveRef.current = false;
  }, []);

  const cancelConnectMode = useCallback(() => {
    setConnectMode(false);
    setConnectSourceId(null);
  }, []);

  const createDraftEdge = useCallback(
    (sourceId: string, targetId: string) => {
      if (!draftGraphIR) return;
      const pairKey = `${sourceId}->${targetId}`;
      if (edgeCreationGuardRef.current === pairKey) return;
      edgeCreationGuardRef.current = pairKey;
      window.setTimeout(() => {
        if (edgeCreationGuardRef.current === pairKey) edgeCreationGuardRef.current = null;
      }, 0);
      const result = buildEditableEdge(draftGraphIR, sourceId, targetId);
      if (!result.edge) {
        setEditNotice(result.message);
        return;
      }
      updateDraft((graph) => ({
        ...graph,
        edges: [...(graph.edges ?? []), result.edge!]
      }));
      setEditNotice(result.message);
      setSelection({ nodeId: null, edgeId: result.edge.id });
      cancelConnectMode();
    },
    [cancelConnectMode, draftGraphIR, updateDraft]
  );

  const handleNodeInteraction = useCallback(
    (nodeId: string) => {
      if (editModeActive && connectMode) {
        if (!connectSourceId) {
          setConnectSourceId(nodeId);
          setSelection({ nodeId, edgeId: null });
          setEditNotice("대상 노드를 클릭하세요");
          return;
        }
        createDraftEdge(connectSourceId, nodeId);
        return;
      }
      setSelection({ nodeId, edgeId: null });
    },
    [connectMode, connectSourceId, createDraftEdge, editModeActive]
  );

  const handleEdgeInteraction = useCallback((edgeId: string) => {
    if (editModeActive && connectMode) {
      cancelConnectMode();
    }
    setSelection({ nodeId: null, edgeId });
  }, [cancelConnectMode, connectMode, editModeActive]);

  const selectRef = useRef<(kind: "node" | "edge", id: string) => void>(() => undefined);
  selectRef.current = (kind, id) => {
    if (kind === "node") handleNodeInteraction(id);
    else handleEdgeInteraction(id);
  };
  const handleSelect = useCallback((kind: "node" | "edge", id: string) => {
    selectRef.current(kind, id);
  }, []);

  useEffect(() => {
    if (editable) return;
    setEditMode(false);
    setDraftGraphIR(null);
    setDirty(false);
    cancelConnectMode();
  }, [cancelConnectMode, editable]);

  useEffect(() => {
    const graphChanged = previousGraphIRRef.current !== graphIR;
    previousGraphIRRef.current = graphIR;
    if (!graphChanged || !pendingSaveRef.current || !editMode) return;
    pendingSaveRef.current = false;
    setDraftGraphIR(cloneGraphIR(graphIR));
    setDirty(false);
  }, [editMode, graphIR]);

  useEffect(() => {
    if (!editModeActive || !connectMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelConnectMode();
      setEditNotice("엣지 연결을 취소했습니다.");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelConnectMode, connectMode, editModeActive]);

  const enterEditMode = useCallback(() => {
    const draft = cloneGraphIR(graphIR);
    setDraftGraphIR(draft);
    setDirty(false);
    pendingSaveRef.current = false;
    setEditMode(true);
    setSelection({ nodeId: null, edgeId: null });
    cancelConnectMode();
    setEditNotice("편집 모드를 시작했습니다.");
  }, [cancelConnectMode, graphIR]);

  const cancelEditMode = useCallback(() => {
    setEditMode(false);
    setDraftGraphIR(null);
    setDirty(false);
    pendingSaveRef.current = false;
    cancelConnectMode();
    setEditNotice(null);
    setSelection({ nodeId: null, edgeId: null });
  }, [cancelConnectMode]);

  const toggleEditMode = useCallback(() => {
    if (!editModeActive) enterEditMode();
    else cancelEditMode();
  }, [cancelEditMode, editModeActive, enterEditMode]);

  const addNode = useCallback(
    (position: XYPosition | null) => {
      if (!draftGraphIR) return;
      const label = addLabel.trim();
      if (!label) {
        setEditNotice("노드 이름을 입력하세요.");
        return;
      }
      const nextPosition = position ?? nextNodeFallbackPosition(draftGraphIR, flowPositions);
      const node = buildEditableNode(draftGraphIR, addKind, label, nextPosition);
      updateDraft((graph) => ({
        ...graph,
        nodes: [...(graph.nodes ?? []), node]
      }));
      setAddLabel("");
      setSelection({ nodeId: node.id, edgeId: null });
      setEditNotice(`${node.id} 노드를 추가했습니다.`);
    },
    [addKind, addLabel, draftGraphIR, flowPositions, updateDraft]
  );

  const deleteSelection = useCallback(() => {
    if (!draftGraphIR) return;
    if (!selection.nodeId && !selection.edgeId) {
      setEditNotice("삭제할 노드 또는 엣지를 선택하세요.");
      return;
    }
    updateDraft((graph) => deleteFromGraph(graph, selection));
    setSelection({ nodeId: null, edgeId: null });
    cancelConnectMode();
    setEditNotice("선택 항목을 삭제했습니다.");
  }, [cancelConnectMode, draftGraphIR, selection, updateDraft]);

  const toggleConnectMode = useCallback(() => {
    if (!editModeActive) return;
    if (connectMode) {
      cancelConnectMode();
      setEditNotice("엣지 연결을 취소했습니다.");
      return;
    }
    setConnectMode(true);
    setConnectSourceId(null);
    setSelection({ nodeId: null, edgeId: null });
    setEditNotice("시작 노드를 클릭하세요");
  }, [cancelConnectMode, connectMode, editModeActive]);

  const saveDraft = useCallback(() => {
    if (!draftGraphIR || !onSaveGraph) return;
    const positioned = applyCurrentPositions(draftGraphIR, flowPositions);
    const soft = validateGraphIRSoft(positioned);
    const next = {
      ...positioned,
      validation: mergeGraphIRValidation(positioned.validation, soft)
    };
    pendingSaveRef.current = true;
    setDraftGraphIR(next);
    onSaveGraph(next);
  }, [draftGraphIR, flowPositions, onSaveGraph]);

  const updateNodePosition = useCallback(
    (nodeId: string, position: XYPosition) => {
      updateDraft((graph) => ({
        ...graph,
        nodes: (graph.nodes ?? []).map((node) =>
          node.id === nodeId ? { ...node, position: { x: position.x, y: position.y } } : node
        )
      }));
    },
    [updateDraft]
  );

  const layoutNodeId = editModeActive ? null : selection.nodeId;
  const layoutEdgeId = editModeActive ? null : selection.edgeId;
  const layout = useMemo(
    () =>
      layoutGraphIR(
        activeGraphIR,
        { nodeId: layoutNodeId, edgeId: layoutEdgeId },
        handleSelect
      ),
    [activeGraphIR, handleSelect, layoutEdgeId, layoutNodeId]
  );
  const collaborationMarks = useMemo(
    () => buildCollaborationMarks(activeGraphIR, comments, highlights),
    [activeGraphIR, comments, highlights]
  );

  const baseNodes = useMemo<ReactFlowNode<GraphNodeData>[]>(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        data: {
          ...(node.data as GraphNodeData),
          selected: false,
          commentCount: collaborationMarks.nodeCommentCounts.get(node.id) ?? 0,
          commentTooltip: collaborationMarks.nodeCommentTooltips.get(node.id),
          highlightCount: collaborationMarks.nodeHighlightCounts.get(node.id) ?? 0
        }
      })),
    [layout.nodes, collaborationMarks]
  );
  const baseEdges = useMemo<ReactFlowEdge<GraphEdgeData>[]>(
    () =>
      layout.edges.map((edge) => {
        const data = edge.data as GraphEdgeData;
        return {
          ...edge,
          zIndex:
            (collaborationMarks.edgeHighlightCounts.get(edge.id) ?? 0) > 0
              ? Math.max(edge.zIndex ?? 1, 18)
              : edge.zIndex,
          data: {
            ...data,
            selected: false,
            commentCount: collaborationMarks.edgeCommentCounts.get(edge.id) ?? 0,
            commentTooltip: collaborationMarks.edgeCommentTooltips.get(edge.id),
            highlightCount: collaborationMarks.edgeHighlightCounts.get(edge.id) ?? 0,
            highlightColor: collaborationMarks.edgeHighlightColors.get(edge.id)
          }
        };
      }),
    [layout.edges, collaborationMarks]
  );

  const nodeById = useMemo(() => new Map((activeGraphIR.nodes ?? []).map((n) => [n.id, n])), [activeGraphIR]);
  const edgeById = useMemo(
    () =>
      new Map<string, GraphEdge>(
        (activeGraphIR.edges ?? []).map((e, i) => [e.id ?? `edge-${i}`, e])
      ),
    [activeGraphIR]
  );
  const candidateByModuleId = useMemo(() => {
    const map = new Map<string, ModuleCandidate>();
    for (const c of moduleCandidates) map.set(c.id, c);
    return map;
  }, [moduleCandidates]);

  const selectedNode: GraphNode | null = selection.nodeId ? nodeById.get(selection.nodeId) ?? null : null;
  const selectedEdge: GraphEdge | null = selection.edgeId ? edgeById.get(selection.edgeId) ?? null : null;
  const selectedCandidate: ModuleCandidate | null =
    selectedNode && selectedNode.module_id ? candidateByModuleId.get(selectedNode.module_id) ?? null : null;

  const focusOn = (issue: GraphValidationIssue) => {
    if (!issue.target_id) return;
    if (issue.target_kind === "edge") {
      setSelection({ nodeId: null, edgeId: issue.target_id });
    } else if (issue.target_kind === "node") {
      setSelection({ nodeId: issue.target_id, edgeId: null });
    }
  };

  const nodeLabel = (id: string) => nodeById.get(id)?.label ?? id;

  return (
    // hideInspector 일 때는 내부 inspector 열을 비우지 말고 grid 자체를 1열로 만들어
    // 그래프 stage 가 전체 폭을 쓰게 한다(안 그러면 우측 inspector 열만큼 빈 공간이 남는다).
    <div className={`graph-canvas-root${hideInspector ? " graph-canvas-root--no-inspector" : ""}`}>
      <section className="panel graph-canvas-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ADK 2.0 Graph Workflow</p>
            <h2>그래프 워크플로우 검토</h2>
          </div>
          <span className="graph-canvas-stats">
            노드 {activeGraphIR.nodes?.length ?? 0} · 엣지 {activeGraphIR.edges?.length ?? 0} · 컨테이너 {activeGraphIR.containers?.length ?? 0}
          </span>
        </div>

        <div className="graph-canvas-workspace">
          <ReactFlowProvider>
            {editable ? (
              <GraphEditToolbar
                addKind={addKind}
                addLabel={addLabel}
                canSave={Boolean(onSaveGraph)}
                connectMode={connectMode}
                connectSourceId={connectSourceId}
                dirty={dirty}
                editModeActive={editModeActive}
                notice={editNotice}
                saving={saving}
                selection={selection}
                stageRef={stageRef}
                validation={draftValidation}
                onAddKindChange={setAddKind}
                onAddLabelChange={setAddLabel}
                onAddNode={addNode}
                onDeleteSelection={deleteSelection}
                onSave={saveDraft}
                onToggleConnectMode={toggleConnectMode}
                onToggleEditMode={toggleEditMode}
              />
            ) : null}
            <div ref={stageRef} className="graph-canvas-stage">
              <GraphFlowStage
                baseNodes={baseNodes}
                baseEdges={baseEdges}
                containerRects={layout.containerRects}
                highlightedContainerIds={collaborationMarks.containerHighlightIds}
                editModeActive={editModeActive}
                selection={selection}
                onConnect={createDraftEdge}
                onEdgeClick={handleEdgeInteraction}
                onNodeClick={handleNodeInteraction}
                onNodeDragStop={updateNodePosition}
                onPaneClick={() => {
                  if (editModeActive && connectMode) return;
                  setSelection({ nodeId: null, edgeId: null });
                }}
                onPositionsChange={setFlowPositions}
              />
            </div>
          </ReactFlowProvider>
        </div>

        <ValidationBanner validation={activeGraphIR.validation} onFocus={focusOn} />

        {onContinue ? (
          <div className="actions align-end graph-canvas-actions">
            <button type="button" className="primary" onClick={onContinue}>
              {continueLabel ?? "다음 단계"}
            </button>
          </div>
        ) : null}
      </section>

      {hideInspector ? null : (
        <GraphInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          nodeLabel={nodeLabel}
          candidate={selectedCandidate}
          a2aContracts={a2aContracts}
          onNavigateToA2AContracts={onNavigateToA2AContracts}
          onClose={() => setSelection({ nodeId: null, edgeId: null })}
        />
      )}
    </div>
  );
}

interface GraphEditToolbarProps {
  addKind: NodeKind;
  addLabel: string;
  canSave: boolean;
  connectMode: boolean;
  connectSourceId: string | null;
  dirty: boolean;
  editModeActive: boolean;
  notice: string | null;
  saving: boolean;
  selection: Selection;
  stageRef: RefObject<HTMLDivElement | null>;
  validation: ReturnType<typeof validateGraphIRSoft> | null;
  onAddKindChange: (kind: NodeKind) => void;
  onAddLabelChange: (label: string) => void;
  onAddNode: (position: XYPosition | null) => void;
  onDeleteSelection: () => void;
  onSave: () => void;
  onToggleConnectMode: () => void;
  onToggleEditMode: () => void;
}

function GraphEditToolbar({
  addKind,
  addLabel,
  canSave,
  connectMode,
  connectSourceId,
  dirty,
  editModeActive,
  notice,
  saving,
  selection,
  stageRef,
  validation,
  onAddKindChange,
  onAddLabelChange,
  onAddNode,
  onDeleteSelection,
  onSave,
  onToggleConnectMode,
  onToggleEditMode
}: GraphEditToolbarProps) {
  const reactFlow = useReactFlow();
  const connectHint = connectMode
    ? connectSourceId
      ? "대상 노드를 클릭하세요"
      : "시작 노드를 클릭하세요"
    : null;
  const hasSelection = Boolean(selection.nodeId || selection.edgeId);

  return (
    <div className="graph-edit-toolbar" aria-label="Graph IR 편집 도구">
      <label className="graph-edit-toggle">
        <input type="checkbox" checked={editModeActive} onChange={onToggleEditMode} />
        <span>편집 모드</span>
      </label>

      {editModeActive ? (
        <>
          <span className={`graph-edit-chip${dirty ? " is-dirty" : ""}`}>
            {dirty ? "변경 있음" : "변경 없음"}
          </span>
          {validation ? (
            <span className={`graph-edit-chip${validation.errors.length ? " has-errors" : validation.warnings.length ? " has-warnings" : ""}`}>
              오류 {validation.errors.length} · 경고 {validation.warnings.length}
            </span>
          ) : null}

          <div className="graph-edit-group" aria-label="노드 추가">
            <select
              aria-label="노드 종류"
              value={addKind}
              onChange={(event) => onAddKindChange(event.target.value as NodeKind)}
            >
              {GRAPH_NODE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <input
              aria-label="노드 라벨"
              value={addLabel}
              onChange={(event) => onAddLabelChange(event.target.value)}
              placeholder="노드 라벨"
            />
            <button
              type="button"
              className="secondary"
              onClick={() => onAddNode(projectStageCenter(reactFlow, stageRef.current))}
              disabled={!addLabel.trim()}
            >
              추가
            </button>
          </div>

          <div className="graph-edit-group" aria-label="엣지 편집">
            <button
              type="button"
              className={connectMode ? "secondary is-active" : "secondary"}
              onClick={onToggleConnectMode}
            >
              {connectMode ? "엣지 연결 취소" : "엣지 추가"}
            </button>
            <button type="button" className="secondary" onClick={onDeleteSelection} disabled={!hasSelection}>
              선택 항목 삭제
            </button>
          </div>

          <div className="graph-edit-group graph-edit-save" aria-label="저장">
            <button type="button" className="primary" onClick={onSave} disabled={!dirty || saving || !canSave}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button type="button" className="secondary" onClick={onToggleEditMode} disabled={saving}>
              취소
            </button>
          </div>
        </>
      ) : null}

      {connectHint ? <span className="graph-edit-hint">{connectHint}</span> : null}
      {notice ? <span className="graph-edit-notice">{notice}</span> : null}
    </div>
  );
}

interface GraphFlowStageProps {
  baseNodes: ReactFlowNode<GraphNodeData>[];
  baseEdges: ReactFlowEdge<GraphEdgeData>[];
  containerRects: ReturnType<typeof layoutGraphIR>["containerRects"];
  highlightedContainerIds: Set<string>;
  editModeActive: boolean;
  selection: Selection;
  onConnect: (sourceId: string, targetId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeDragStop: (nodeId: string, position: XYPosition) => void;
  onPaneClick: () => void;
  onPositionsChange: (positions: Record<string, XYPosition>) => void;
}

function GraphFlowStage({
  baseNodes,
  baseEdges,
  containerRects,
  highlightedContainerIds,
  editModeActive,
  selection,
  onConnect,
  onEdgeClick,
  onNodeClick,
  onNodeDragStop,
  onPaneClick,
  onPositionsChange
}: GraphFlowStageProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdgeData>(baseEdges);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  useEffect(() => {
    setEdges(baseEdges);
  }, [baseEdges, setEdges]);

  useEffect(() => {
    const next: Record<string, XYPosition> = {};
    for (const node of nodes) {
      next[node.id] = { x: node.position.x, y: node.position.y };
    }
    onPositionsChange(next);
  }, [nodes, onPositionsChange]);

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        draggable: editModeActive,
        data: {
          ...node.data,
          selected: selection.nodeId === node.id
        }
      })),
    [editModeActive, nodes, selection.nodeId]
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        zIndex: selection.edgeId === edge.id ? 20 : edge.zIndex,
        data: {
          ...edge.data,
          selected: selection.edgeId === edge.id
        }
      })),
    [edges, selection.edgeId]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (editModeActive) onNodesChange(changes);
    },
    [editModeActive, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (editModeActive) onEdgesChange(changes);
    },
    [editModeActive, onEdgesChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      onConnect(connection.source, connection.target);
    },
    [onConnect]
  );

  return (
    <ReactFlow
      nodes={renderedNodes}
      edges={renderedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      nodesDraggable={editModeActive}
      nodesConnectable={editModeActive}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      onConnect={handleConnect}
      onEdgesChange={handleEdgesChange}
      onNodesChange={handleNodesChange}
      onPaneClick={onPaneClick}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onEdgeClick={(_, edge) => onEdgeClick(edge.id)}
      onNodeDragStop={(_, node) => {
        if (editModeActive) onNodeDragStop(node.id, node.position);
      }}
    >
      <Background gap={18} size={1} />
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
      <ContainerOverlay rects={containerRects} highlightedIds={highlightedContainerIds} />
    </ReactFlow>
  );
}

function cloneGraphIR(graphIR: GraphIR): GraphIR {
  return JSON.parse(JSON.stringify(graphIR)) as GraphIR;
}

function projectStageCenter(reactFlow: unknown, stage: HTMLDivElement | null): XYPosition | null {
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  const screenPoint = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
  const flow = reactFlow as {
    screenToFlowPosition?: (point: XYPosition) => XYPosition;
    getViewport?: () => { x: number; y: number; zoom: number };
  };
  if (flow.screenToFlowPosition) return flow.screenToFlowPosition(screenPoint);
  const viewport = flow.getViewport?.();
  if (!viewport || !Number.isFinite(viewport.zoom) || viewport.zoom === 0) return null;
  return {
    x: (rect.width / 2 - viewport.x) / viewport.zoom,
    y: (rect.height / 2 - viewport.y) / viewport.zoom
  };
}

function buildEditableNode(graphIR: GraphIR, kind: NodeKind, label: string, position: XYPosition): GraphNode {
  return {
    id: nextNodeId(graphIR, kind),
    label,
    module_id: null,
    node_kind: kind,
    execution_kind: null,
    adk_node_role: null,
    owner_scope: kind === "remote_a2a" ? "remote" : "local",
    container_id: null,
    lane_id: laneForNodeKind(kind),
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "n/a",
    position: { x: position.x, y: position.y }
  };
}

function laneForNodeKind(kind: NodeKind): LaneId {
  if (kind === "input") return "input";
  if (kind === "output") return "output";
  if (kind === "human_input") return "human_input";
  if (kind === "tool" || kind === "adapter") return "adapter";
  if (kind === "remote_a2a") return "remote_boundary";
  return "local_graph";
}

function nextNodeId(graphIR: GraphIR, kind: NodeKind): string {
  const used = new Set((graphIR.nodes ?? []).map((node) => node.id));
  let index = 1;
  while (used.has(`node-${kind}-${index}`)) index += 1;
  return `node-${kind}-${index}`;
}

function nextEdgeId(graphIR: GraphIR): string {
  const used = new Set((graphIR.edges ?? []).map((edge) => edge.id));
  let index = 1;
  while (used.has(`edge-${index}`)) index += 1;
  return `edge-${index}`;
}

function buildEditableEdge(
  graphIR: GraphIR,
  sourceId: string,
  targetId: string
): { edge: GraphEdge | null; message: string } {
  if (sourceId === targetId) {
    return { edge: null, message: "자기 자신으로 연결할 수 없습니다." };
  }
  if ((graphIR.edges ?? []).some((edge) => edge.from === sourceId && edge.to === targetId)) {
    return { edge: null, message: "이미 같은 방향의 엣지가 있습니다." };
  }
  const source = (graphIR.nodes ?? []).find((node) => node.id === sourceId);
  const target = (graphIR.nodes ?? []).find((node) => node.id === targetId);
  if (!source || !target) {
    return { edge: null, message: "노드를 찾을 수 없어 엣지를 만들 수 없습니다." };
  }

  const sourceRemote = source.node_kind === "remote_a2a";
  const targetRemote = target.node_kind === "remote_a2a";
  const edgeKind: EdgeKind =
    sourceRemote || targetRemote ? "remote_a2a" : source.node_kind === "router" ? "route" : "event_output";
  const executionSemantics: ExecutionSemantics =
    source.node_kind === "router" ? "conditional" : "normal_transition";
  const edge: GraphEdge = {
    id: nextEdgeId(graphIR),
    from: sourceId,
    to: targetId,
    from_port: null,
    to_port: null,
    edge_kind: edgeKind,
    execution_semantics: executionSemantics,
    data_label: "",
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: null,
    is_remote_boundary_crossing: sourceRemote !== targetRemote
  };
  return { edge, message: `${edge.id} 엣지를 추가했습니다.` };
}

function deleteFromGraph(graphIR: GraphIR, selection: Selection): GraphIR {
  if (selection.nodeId) {
    const nodeId = selection.nodeId;
    return {
      ...graphIR,
      nodes: (graphIR.nodes ?? []).filter((node) => node.id !== nodeId),
      edges: (graphIR.edges ?? []).filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      containers: (graphIR.containers ?? []).map((container) => ({
        ...container,
        contains_node_ids: container.contains_node_ids.filter((id) => id !== nodeId),
        entry_node_ids: container.entry_node_ids.filter((id) => id !== nodeId),
        exit_node_ids: container.exit_node_ids.filter((id) => id !== nodeId)
      }))
    };
  }
  if (selection.edgeId) {
    return {
      ...graphIR,
      edges: (graphIR.edges ?? []).filter((edge, index) => edgeKey(edge, index) !== selection.edgeId)
    };
  }
  return graphIR;
}

function applyCurrentPositions(graphIR: GraphIR, positions: Record<string, XYPosition>): GraphIR {
  return {
    ...graphIR,
    nodes: (graphIR.nodes ?? []).map((node) => {
      const position = positions[node.id];
      if (position) return { ...node, position: { x: position.x, y: position.y } };
      if (hasFiniteNodePosition(node)) return { ...node, position: { x: node.position.x, y: node.position.y } };
      return { ...node, position: null };
    })
  };
}

function nextNodeFallbackPosition(graphIR: GraphIR, positions: Record<string, XYPosition>): XYPosition {
  const points = Object.values(positions).filter(isFinitePoint);
  if (points.length) {
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    return { x: maxX + 64, y: maxY + 64 };
  }
  const persisted = (graphIR.nodes ?? [])
    .filter(hasFiniteNodePosition)
    .map((node) => node.position);
  if (persisted.length) {
    const maxX = Math.max(...persisted.map((point) => point.x));
    const maxY = Math.max(...persisted.map((point) => point.y));
    return { x: maxX + 64, y: maxY + 64 };
  }
  return { x: 72, y: 96 };
}

function hasFiniteNodePosition(node: GraphNode): node is GraphNode & { position: XYPosition } {
  return isFinitePoint(node.position);
}

function isFinitePoint(value: unknown): value is XYPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    typeof (value as XYPosition).x === "number" &&
    Number.isFinite((value as XYPosition).x) &&
    typeof (value as XYPosition).y === "number" &&
    Number.isFinite((value as XYPosition).y)
  );
}

function edgeKey(edge: GraphEdge, index: number): string {
  return edge.id ?? `edge-${index}`;
}

interface CollaborationMarks {
  nodeCommentCounts: Map<string, number>;
  edgeCommentCounts: Map<string, number>;
  nodeCommentTooltips: Map<string, string>;
  edgeCommentTooltips: Map<string, string>;
  nodeHighlightCounts: Map<string, number>;
  edgeHighlightCounts: Map<string, number>;
  edgeHighlightColors: Map<string, string>;
  containerHighlightIds: Set<string>;
}

const HIGHLIGHT_COLORS: Record<HighlightRecord["color_token"], string> = {
  agent: "var(--cat-agent-line, #2c6ec0)",
  workflow: "var(--cat-workflow-line, #2f8a68)",
  adapter: "var(--cat-adapter-line, #8a6a2f)",
  remote: "var(--cat-remote-line, #c0432c)",
  neutral: "var(--line-strong, #64736b)"
};

function buildCollaborationMarks(
  graphIR: GraphIR,
  comments: CommentRecord[],
  highlights: HighlightRecord[]
): CollaborationMarks {
  const marks: CollaborationMarks = {
    nodeCommentCounts: new Map(),
    edgeCommentCounts: new Map(),
    nodeCommentTooltips: new Map(),
    edgeCommentTooltips: new Map(),
    nodeHighlightCounts: new Map(),
    edgeHighlightCounts: new Map(),
    edgeHighlightColors: new Map(),
    containerHighlightIds: new Set()
  };
  const edgeIdByPair = new Map((graphIR.edges ?? []).map((edge) => [`${edge.from}->${edge.to}`, edge.id]));

  const inc = (map: Map<string, number>, id: string | undefined) => {
    if (!id) return;
    map.set(id, (map.get(id) ?? 0) + 1);
  };
  const addComment = (countMap: Map<string, number>, tooltipMap: Map<string, string>, id: string | undefined, comment: CommentRecord) => {
    if (!id) return;
    inc(countMap, id);
    const summary = summarizeComment(comment);
    tooltipMap.set(id, tooltipMap.has(id) ? `${tooltipMap.get(id)}\n${summary}` : summary);
  };
  const pathEdgeIds = (nodePath: string[] | undefined) => {
    const result: string[] = [];
    if (!nodePath) return result;
    for (let index = 0; index < nodePath.length - 1; index += 1) {
      const edgeId = edgeIdByPair.get(`${nodePath[index]}->${nodePath[index + 1]}`);
      if (edgeId) result.push(edgeId);
    }
    return result;
  };

  for (const comment of comments) {
    const anchor = comment.anchor;
    if (anchor.kind === "node") addComment(marks.nodeCommentCounts, marks.nodeCommentTooltips, anchor.node_id, comment);
    if (anchor.kind === "edge") addComment(marks.edgeCommentCounts, marks.edgeCommentTooltips, anchor.edge_id, comment);
    if (anchor.kind === "path") {
      for (const nodeId of anchor.node_path ?? []) {
        addComment(marks.nodeCommentCounts, marks.nodeCommentTooltips, nodeId, comment);
      }
      for (const edgeId of pathEdgeIds(anchor.node_path)) {
        addComment(marks.edgeCommentCounts, marks.edgeCommentTooltips, edgeId, comment);
      }
    }
  }

  for (const highlight of highlights) {
    const color = HIGHLIGHT_COLORS[highlight.color_token] ?? HIGHLIGHT_COLORS.neutral;
    const markEdge = (edgeId: string | undefined) => {
      if (!edgeId) return;
      inc(marks.edgeHighlightCounts, edgeId);
      marks.edgeHighlightColors.set(edgeId, color);
    };
    if (highlight.kind === "path") {
      for (const nodeId of highlight.target.node_path ?? []) inc(marks.nodeHighlightCounts, nodeId);
      for (const edgeId of pathEdgeIds(highlight.target.node_path)) markEdge(edgeId);
    }
    if (highlight.kind === "node_group") {
      for (const nodeId of highlight.target.node_ids ?? []) inc(marks.nodeHighlightCounts, nodeId);
    }
    if (highlight.kind === "edge_group") {
      for (const edgeId of highlight.target.edge_ids ?? []) markEdge(edgeId);
    }
    if (highlight.kind === "container_focus" && highlight.target.container_id) {
      marks.containerHighlightIds.add(highlight.target.container_id);
    }
  }

  return marks;
}

function summarizeComment(comment: CommentRecord): string {
  const body = comment.body_md.replace(/\s+/g, " ").trim();
  const snippet = body.length > 96 ? `${body.slice(0, 96)}...` : body;
  return `${comment.author} · ${new Date(comment.created_at).toLocaleString()}: ${snippet}`;
}
