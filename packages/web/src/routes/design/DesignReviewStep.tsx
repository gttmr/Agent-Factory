import type { Dispatch, SetStateAction } from "react";
import type { GraphEditState, Selection } from "../../components/GraphCanvas";
import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import type {
  AnalysisResult,
  GraphEdge,
  GraphIR,
  GraphNode,
  ModuleCandidate,
  ModuleStatus,
  RuntimeContract
} from "../../analyzer/types";
import type { buildA2AReviewRows } from "../../design/A2AContractPanel";
import type {
  CommentAnchor,
  CommentRecord,
  CommentStage,
  CreateHighlightInput,
  HighlightRecord
} from "../../state/useCollaboration";
import type { AuthorRole } from "../../state/useAuthor";
import { useCatalog } from "../../state/useCatalog";
import { DesignBottomPanel } from "./DesignBottomPanel";
import { DesignGraphPanel } from "./DesignGraphPanel";
import type { SidebarTab } from "./designStageModel";

type A2AReviewRow = ReturnType<typeof buildA2AReviewRows>[number];

interface DesignReviewSelectionState {
  node: GraphNode | null;
  edge: GraphEdge | null;
  candidate: ModuleCandidate | null;
  reviewCandidate: ModuleCandidate | null;
}

interface DesignReviewContractState {
  selectedContract: RuntimeContract | null;
  selectedContractId: string | null;
  selectedA2ARow: A2AReviewRow | null;
  runtimeContracts: RuntimeContract[];
  a2aContracts: AnalysisResult["a2aContracts"];
}

interface DesignReviewCollaborationState {
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  anchor: CommentAnchor | null;
  authorName: string;
  authorRole: AuthorRole;
  commentPending: boolean;
  highlightPending: boolean;
}

export interface DesignReviewHandlers {
  onSelectionChange: (selection: Selection) => void;
  onEditStateChange: (state: GraphEditState | null) => void;
  onSaveGraphIR: (graphIR: GraphIR) => void;
  onOpenCatalogWorkflowPicker: () => void;
  onSaveRuntimeContract: (contract: RuntimeContract) => void;
  onSaveA2AContract: (contract: AnalysisResult["a2aContracts"][number]) => void;
  onSelectReviewModule: (moduleId: string) => void;
  onSaveCandidate: (candidateId: string, candidate: ModuleCandidate, syncStatus?: ModuleStatus) => void;
  onSelectContract: (contractId: string) => void;
  onSelectA2AModule: (moduleId: string) => void;
  onCreateA2AContract: (candidate: ModuleCandidate) => void;
  onImportLocalA2AProvider: (provider: LocalA2AProviderImport) => void;
  onAuthorNameChange: (value: string) => void;
  onAuthorRoleChange: (value: AuthorRole) => void;
  onCreateComment: (input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) => void;
  onUpdateComment: (id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>) => void;
  onDeleteComment: (id: string) => void;
  onCreateHighlight: (input: CreateHighlightInput) => void;
  onDeleteHighlight: (id: string) => void;
}

interface DesignReviewStepProps {
  reqId: string;
  activeTab: SidebarTab;
  setActiveTab: Dispatch<SetStateAction<SidebarTab>>;
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  normalizationError?: string;
  errorCount: number;
  selection: Selection;
  graphEditState: GraphEditState | null;
  selected: DesignReviewSelectionState;
  contracts: DesignReviewContractState;
  collaboration: DesignReviewCollaborationState;
  saving: boolean;
  nodeLabel: (id: string) => string;
  handlers: DesignReviewHandlers;
}

export function DesignReviewStep({
  reqId,
  activeTab,
  setActiveTab,
  analysis,
  graphIR,
  normalizationError,
  errorCount,
  selection,
  graphEditState,
  selected,
  contracts,
  collaboration,
  saving,
  nodeLabel,
  handlers
}: DesignReviewStepProps) {
  const catalog = useCatalog();
  const catalogContracts = catalog.data?.contracts ?? {};

  return (
    <div className="af-design-split">
      <DesignGraphPanel
        analysis={analysis}
        graphIR={graphIR}
        normalizationError={normalizationError}
        errorCount={errorCount}
        selection={selection}
        graphEditState={graphEditState}
        selectedNode={selected.node}
        selectedEdge={selected.edge}
        selectedCandidate={selected.candidate}
        a2aContracts={contracts.a2aContracts}
        catalogContracts={catalogContracts}
        comments={collaboration.comments}
        highlights={collaboration.highlights}
        saving={saving}
        nodeLabel={nodeLabel}
        onSelectionChange={handlers.onSelectionChange}
        onEditStateChange={handlers.onEditStateChange}
        onSaveGraphIR={handlers.onSaveGraphIR}
        onOpenCatalogWorkflowPicker={handlers.onOpenCatalogWorkflowPicker}
        onSetActiveTab={setActiveTab}
      />
      <DesignBottomPanel
        reqId={reqId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        analysis={analysis}
        graphIR={graphIR}
        selectedReviewCandidate={selected.reviewCandidate}
        selectedContract={contracts.selectedContract}
        selectedContractId={contracts.selectedContractId}
        selectedA2ARow={contracts.selectedA2ARow}
        runtimeContracts={contracts.runtimeContracts}
        a2aContracts={contracts.a2aContracts}
        comments={collaboration.comments}
        highlights={collaboration.highlights}
        anchor={collaboration.anchor}
        authorName={collaboration.authorName}
        authorRole={collaboration.authorRole}
        saving={saving}
        commentPending={collaboration.commentPending}
        highlightPending={collaboration.highlightPending}
        onSelectReviewModule={handlers.onSelectReviewModule}
        onSelectionChange={handlers.onSelectionChange}
        onSaveCandidate={handlers.onSaveCandidate}
        onSelectContract={handlers.onSelectContract}
        onSaveRuntimeContract={handlers.onSaveRuntimeContract}
        onSelectA2AModule={handlers.onSelectA2AModule}
        onCreateA2AContract={handlers.onCreateA2AContract}
        onImportLocalA2AProvider={handlers.onImportLocalA2AProvider}
        onSaveA2AContract={handlers.onSaveA2AContract}
        onAuthorNameChange={handlers.onAuthorNameChange}
        onAuthorRoleChange={handlers.onAuthorRoleChange}
        onCreateComment={handlers.onCreateComment}
        onUpdateComment={handlers.onUpdateComment}
        onDeleteComment={handlers.onDeleteComment}
        onCreateHighlight={handlers.onCreateHighlight}
        onDeleteHighlight={handlers.onDeleteHighlight}
      />
    </div>
  );
}
