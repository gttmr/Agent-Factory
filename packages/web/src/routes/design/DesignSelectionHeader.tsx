import type { Selection } from "../../components/GraphCanvas";
import type { GraphIR } from "../../analyzer/types";
import { SectionHeader } from "../../ui/primitives";

export function SelectionHeader({ selection, graphIR }: { selection: Selection; graphIR: GraphIR | null }) {
  if (!graphIR) {
    return <SectionHeader eyebrow="선택 없음" title="Inspector" description="Graph IR 이 없어 인스펙터를 표시할 수 없습니다." />;
  }
  if (selection.nodeId) {
    const node = graphIR.nodes?.find((item) => item.id === selection.nodeId);
    return (
      <SectionHeader
        eyebrow={`Node ${selection.nodeId}`}
        title={node?.label ?? selection.nodeId}
        description={`node_kind ${node?.node_kind ?? "?"} · lane ${node?.lane_id ?? "?"}`}
      />
    );
  }
  if (selection.edgeId) {
    const edge = graphIR.edges?.find((item) => item.id === selection.edgeId);
    return (
      <SectionHeader
        eyebrow={`Edge ${selection.edgeId}`}
        title={edge ? `${edge.from} → ${edge.to}` : selection.edgeId}
        description={`edge_kind ${edge?.edge_kind ?? "?"} · ${edge?.execution_semantics ?? "?"}`}
      />
    );
  }
  return (
    <SectionHeader
      eyebrow="선택 없음"
      title="Inspector"
      description="Graph IR 에서 노드/엣지를 선택하면 여기에서 코멘트를 남길 수 있습니다."
    />
  );
}
