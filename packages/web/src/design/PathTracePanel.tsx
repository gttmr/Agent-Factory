import { useMemo, useState } from "react";
import type { GraphIR } from "../analyzer/types";
import { Button, EmptyState } from "../ui/primitives";
import type { CreateHighlightInput } from "../state/useCollaboration";
import { findSimplePaths, type GraphPath } from "./pathSearch";

interface PathTracePanelProps {
  graphIR: GraphIR | null;
  author: string;
  saving: boolean;
  onSelectNode: (id: string) => void;
  onCreateHighlight: (input: CreateHighlightInput) => void;
}

export function PathTracePanel({ graphIR, author, saving, onSelectNode, onCreateHighlight }: PathTracePanelProps) {
  const nodes = graphIR?.nodes ?? [];
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [label, setLabel] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const paths = useMemo(() => {
    if (!graphIR || !fromId || !toId) return [];
    return findSimplePaths(graphIR, fromId, toId, 5);
  }, [graphIR, fromId, toId]);

  const selectedPath: GraphPath | undefined = paths[selectedIndex] ?? paths[0];
  const nodeLabel = (id: string) => graphIR?.nodes.find((node) => node.id === id)?.label ?? id;

  if (!graphIR || nodes.length === 0) {
    return <EmptyState title="그래프 없음" description="경로 하이라이트를 만들려면 먼저 설계 그래프가 필요합니다." />;
  }

  const defaultLabel = fromId && toId ? `${nodeLabel(fromId)} -> ${nodeLabel(toId)}` : "검토 경로";

  return (
    <div className="af-path-panel">
      <p className="af-design-empty">두 노드를 선택해 검토할 경로를 찾고 하이라이트로 저장합니다.</p>
      <label>
        시작 노드
        <select
          value={fromId}
          onChange={(event) => {
            setFromId(event.target.value);
            setSelectedIndex(0);
            if (event.target.value) onSelectNode(event.target.value);
          }}
        >
          <option value="">선택</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label} ({node.id})
            </option>
          ))}
        </select>
      </label>
      <label>
        종료 노드
        <select
          value={toId}
          onChange={(event) => {
            setToId(event.target.value);
            setSelectedIndex(0);
            if (event.target.value) onSelectNode(event.target.value);
          }}
        >
          <option value="">선택</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label} ({node.id})
            </option>
          ))}
        </select>
      </label>
      <label>
        라벨
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={defaultLabel}
        />
      </label>

      {fromId && toId ? (
        paths.length > 0 ? (
          <ul className="af-path-candidates">
            {paths.map((path, index) => (
              <li key={path.nodeIds.join("->")}>
                <button
                  type="button"
                  className={`af-path-candidate${selectedIndex === index ? " af-path-candidate-active" : ""}`}
                  onClick={() => {
                    setSelectedIndex(index);
                    onSelectNode(path.nodeIds[path.nodeIds.length - 1] ?? toId);
                  }}
                >
                  <strong>경로 {index + 1}</strong>
                  <span>{path.nodeIds.map(nodeLabel).join(" -> ")}</span>
                  <small>{path.edgeIds.length} edges</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="af-comment-warn">두 노드는 연결되어 있지 않습니다.</p>
        )
      ) : null}

      <Button
        type="button"
        variant="primary"
        disabled={!selectedPath || saving}
        onClick={() => {
          if (!selectedPath) return;
          onCreateHighlight({
            stage: "design",
            kind: "path",
            label: label.trim() || defaultLabel,
            color_token: "workflow",
            target: { node_path: selectedPath.nodeIds },
            author: author.trim() || "익명"
          });
        }}
      >
        {saving ? "저장 중..." : "하이라이트로 저장"}
      </Button>
    </div>
  );
}
