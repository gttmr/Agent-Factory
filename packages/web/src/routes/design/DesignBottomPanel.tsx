import type { Dispatch, SetStateAction } from "react";
import type { Selection } from "../../components/GraphCanvas";
import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import { approveCandidate, resolveMissingItem, setCandidateStatus } from "../../analyzer/moduleReview";
import type { AnalysisResult, GraphIR, ModuleCandidate, ModuleStatus, RuntimeContract } from "../../analyzer/types";
import { DESIGN_BOTTOM_TABS, nextDesignBottomTabAfterModuleSelect } from "../../design/designWorkbenchTabs";
import { ReviewNotesPanel } from "../../design/ReviewNotesPanel";
import { RuntimeContractSidebar } from "../../design/RuntimeContractPanel";
import { reviewNotesBadgeCount } from "../../design/reviewNotesModel";
import type { CommentAnchor, CommentRecord, CommentStage, HighlightRecord, CreateHighlightInput } from "../../state/useCollaboration";
import type { AuthorRole } from "../../state/useAuthor";
import { DesignA2ATab, type DesignA2AReviewRow } from "./DesignA2ATab";
import { ModuleReviewDetail, ModuleSidebar } from "./DesignModuleReview";
import type { SidebarTab } from "./designStageModel";

interface DesignBottomPanelProps {
  reqId: string;
  activeTab: SidebarTab;
  setActiveTab: Dispatch<SetStateAction<SidebarTab>>;
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  selectedReviewCandidate: ModuleCandidate | null;
  selectedContractId: string | null;
  selectedA2ARow: DesignA2AReviewRow | null;
  runtimeContracts: RuntimeContract[];
  a2aContracts: AnalysisResult["a2aContracts"];
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  anchor: CommentAnchor | null;
  authorName: string;
  authorRole: AuthorRole;
  saving: boolean;
  commentPending: boolean;
  highlightPending: boolean;
  onSelectReviewModule: (moduleId: string) => void;
  onSelectionChange: (selection: Selection) => void;
  onSaveCandidate: (candidateId: string, candidate: ModuleCandidate, syncStatus?: ModuleStatus) => void;
  onSelectContract: (contractId: string) => void;
  onSelectA2AModule: (moduleId: string) => void;
  onCreateA2AContract: (candidate: ModuleCandidate) => void;
  onImportLocalA2AProvider: (provider: LocalA2AProviderImport) => void;
  onSaveA2AContract: (contract: AnalysisResult["a2aContracts"][number]) => void;
  onAuthorNameChange: (value: string) => void;
  onAuthorRoleChange: (value: AuthorRole) => void;
  onCreateComment: (input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) => void;
  onUpdateComment: (id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>) => void;
  onDeleteComment: (id: string) => void;
  onCreateHighlight: (input: CreateHighlightInput) => void;
  onDeleteHighlight: (id: string) => void;
}

type ModuleReviewTabProps = Pick<
  DesignBottomPanelProps,
  | "analysis"
  | "graphIR"
  | "selectedReviewCandidate"
  | "saving"
  | "onSelectReviewModule"
  | "onSelectionChange"
  | "setActiveTab"
  | "onSaveCandidate"
>;

export function DesignBottomPanel({
  reqId,
  activeTab,
  setActiveTab,
  analysis,
  graphIR,
  selectedReviewCandidate,
  selectedContractId,
  selectedA2ARow,
  runtimeContracts,
  a2aContracts,
  comments,
  highlights,
  anchor,
  authorName,
  authorRole,
  saving,
  commentPending,
  highlightPending,
  onSelectReviewModule,
  onSelectionChange,
  onSaveCandidate,
  onSelectContract,
  onSelectA2AModule,
  onCreateA2AContract,
  onImportLocalA2AProvider,
  onSaveA2AContract,
  onAuthorNameChange,
  onAuthorRoleChange,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onCreateHighlight,
  onDeleteHighlight
}: DesignBottomPanelProps) {
  return (
    <div className="af-design-bottom" aria-label="모듈·계약·검토 메모 패널">
      <nav className="af-design-tabs" role="tablist">
        {DESIGN_BOTTOM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`af-design-tab${activeTab === tab.id ? " af-design-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === "reviewNotes" && reviewNotesBadgeCount(comments.length, highlights.length) > 0 ? (
              <span className="af-design-tab-count">{reviewNotesBadgeCount(comments.length, highlights.length)}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className={`af-design-sidebar-body${activeTab === "modules" ? " af-design-sidebar-body--modules" : ""}`}>
        {activeTab === "modules" ? (
          <ModuleReviewTab
            analysis={analysis}
            graphIR={graphIR}
            selectedReviewCandidate={selectedReviewCandidate}
            saving={saving}
            onSelectReviewModule={onSelectReviewModule}
            onSelectionChange={onSelectionChange}
            setActiveTab={setActiveTab}
            onSaveCandidate={onSaveCandidate}
          />
        ) : null}
        {activeTab === "runtime" ? (
          <RuntimeContractSidebar contracts={runtimeContracts} selectedContractId={selectedContractId} onSelect={onSelectContract} />
        ) : null}
        {activeTab === "a2a" ? (
          <DesignA2ATab
            reqId={reqId}
            analysis={analysis}
            a2aContracts={a2aContracts}
            selectedA2ARow={selectedA2ARow}
            saving={saving}
            onSelectA2AModule={onSelectA2AModule}
            onCreateA2AContract={onCreateA2AContract}
            onImportLocalA2AProvider={onImportLocalA2AProvider}
            onSaveA2AContract={onSaveA2AContract}
          />
        ) : null}
        {activeTab === "reviewNotes" ? (
          <ReviewNotesPanel
            reqId={reqId}
            graphIR={graphIR}
            comments={comments}
            highlights={highlights}
            commentAnchor={anchor}
            authorName={authorName}
            authorRole={authorRole}
            isCommentMutating={commentPending}
            isHighlightMutating={highlightPending}
            onAuthorNameChange={onAuthorNameChange}
            onAuthorRoleChange={onAuthorRoleChange}
            onCreateComment={onCreateComment}
            onUpdateComment={onUpdateComment}
            onDeleteComment={onDeleteComment}
            onSelectNode={(id) => onSelectionChange({ nodeId: id, edgeId: null })}
            onCreateHighlight={onCreateHighlight}
            onDeleteHighlight={onDeleteHighlight}
          />
        ) : null}
      </div>
    </div>
  );
}

function ModuleReviewTab({
  analysis,
  graphIR,
  selectedReviewCandidate,
  saving,
  onSelectReviewModule,
  onSelectionChange,
  setActiveTab,
  onSaveCandidate
}: ModuleReviewTabProps) {
  return (
    <div className="af-module-review-layout">
      <div className="af-module-review-list-pane">
        <ModuleSidebar
          candidates={analysis.moduleCandidates}
          selectedModuleId={selectedReviewCandidate?.id ?? null}
          onSelectModule={(moduleId) => {
            onSelectReviewModule(moduleId);
            if (!graphIR) return;
            const node = graphIR.nodes?.find((item) => item.module_id === moduleId);
            onSelectionChange({ nodeId: node?.id ?? null, edgeId: null });
            setActiveTab((currentTab) => nextDesignBottomTabAfterModuleSelect(currentTab));
          }}
        />
      </div>
      <ModuleReviewDetail
        key={selectedReviewCandidate?.id ?? "none"}
        candidate={selectedReviewCandidate}
        saving={saving}
        onResolveMissing={(candidate, item, note) => onSaveCandidate(candidate.id, resolveMissingItem(candidate, item, note))}
        onApprove={(candidate) => {
          const nextCandidate = approveCandidate(candidate);
          onSaveCandidate(candidate.id, nextCandidate, nextCandidate.status === "approved" ? "approved" : undefined);
        }}
        onDefer={(candidate) => onSaveCandidate(candidate.id, setCandidateStatus(candidate, "deferred"), "deferred")}
        onReject={(candidate) => onSaveCandidate(candidate.id, setCandidateStatus(candidate, "rejected"), "rejected")}
      />
    </div>
  );
}
