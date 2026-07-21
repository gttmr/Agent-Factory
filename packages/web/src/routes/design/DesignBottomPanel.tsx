import type { Dispatch, SetStateAction } from "react";
import type { Selection } from "../../components/GraphCanvas";
import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import { approveCandidate, resolveMissingItem, setCandidateStatus } from "../../analyzer/assetReview";
import type { AnalysisResult, AssetCandidate, GraphIR, RuntimeContract } from "../../analyzer/types";
import { DESIGN_BOTTOM_TABS, nextDesignBottomTabAfterAssetSelect } from "../../design/designWorkbenchTabs";
import { ReviewNotesPanel } from "../../design/ReviewNotesPanel";
import { RuntimeContractInspector, RuntimeContractSidebar } from "../../design/RuntimeContractPanel";
import { reviewNotesBadgeCount } from "../../design/reviewNotesModel";
import type { CommentAnchor, CommentRecord, CommentStage, HighlightRecord, CreateHighlightInput } from "../../state/useCollaboration";
import type { AuthorRole } from "../../state/useAuthor";
import { DesignA2ATab, type DesignA2AReviewRow } from "./DesignA2ATab";
import { AssetReviewDetail, AssetSidebar } from "./DesignAssetReview";
import type { SidebarTab } from "./designStageModel";

interface DesignBottomPanelProps {
  reqId: string;
  activeTab: SidebarTab;
  setActiveTab: Dispatch<SetStateAction<SidebarTab>>;
  analysis: AnalysisResult;
  graphIR: GraphIR | null;
  selectedReviewAsset: AssetCandidate | null;
  selectedContract: RuntimeContract | null;
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
  onSelectReviewAsset: (assetId: string) => void;
  onSelectionChange: (selection: Selection) => void;
  onSaveAsset: (assetId: string, asset: AssetCandidate) => void;
  onSelectContract: (contractId: string) => void;
  onSaveRuntimeContract: (contract: RuntimeContract) => void;
  onSelectA2AAsset: (assetId: string) => void;
  onCreateA2AContract: (candidate: AssetCandidate) => void;
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

type AssetReviewTabProps = Pick<
  DesignBottomPanelProps,
  | "analysis"
  | "graphIR"
  | "selectedReviewAsset"
  | "saving"
  | "onSelectReviewAsset"
  | "onSelectionChange"
  | "setActiveTab"
  | "onSaveAsset"
>;

export function DesignBottomPanel({
  reqId,
  activeTab,
  setActiveTab,
  analysis,
  graphIR,
  selectedReviewAsset,
  selectedContract,
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
  onSelectReviewAsset,
  onSelectionChange,
  onSaveAsset,
  onSelectContract,
  onSaveRuntimeContract,
  onSelectA2AAsset,
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
    <div className="af-design-bottom" aria-label="Assets·계약·검토 메모 패널">
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
      <div className={`af-design-sidebar-body${activeTab === "assets" ? " af-design-sidebar-body--assets" : ""}`}>
        {activeTab === "assets" ? (
          <AssetReviewTab
            analysis={analysis}
            graphIR={graphIR}
            selectedReviewAsset={selectedReviewAsset}
            saving={saving}
            onSelectReviewAsset={onSelectReviewAsset}
            onSelectionChange={onSelectionChange}
            setActiveTab={setActiveTab}
            onSaveAsset={onSaveAsset}
          />
        ) : null}
        {activeTab === "runtime" ? (
          <div className="af-runtime-tab-panel">
            <div className="af-runtime-tab-list">
              <RuntimeContractSidebar contracts={runtimeContracts} selectedContractId={selectedContractId} onSelect={onSelectContract} />
            </div>
            <div className="af-runtime-tab-editor">
              <RuntimeContractInspector
                key={selectedContract?.contract_id ?? "none"}
                contract={selectedContract}
                saving={saving}
                onSave={onSaveRuntimeContract}
                onCancel={() => undefined}
              />
            </div>
          </div>
        ) : null}
        {activeTab === "a2a" ? (
          <DesignA2ATab
            reqId={reqId}
            analysis={analysis}
            a2aContracts={a2aContracts}
            selectedA2ARow={selectedA2ARow}
            saving={saving}
            onSelectA2AAsset={onSelectA2AAsset}
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

function AssetReviewTab({
  analysis,
  graphIR,
  selectedReviewAsset,
  saving,
  onSelectReviewAsset,
  onSelectionChange,
  setActiveTab,
  onSaveAsset
}: AssetReviewTabProps) {
  return (
    <div className="af-asset-review-layout">
      <div className="af-asset-review-list-pane">
        <AssetSidebar
          assets={analysis.assetCandidates}
          selectedAssetId={selectedReviewAsset?.asset_id ?? null}
          onSelectAsset={(assetId) => {
            onSelectReviewAsset(assetId);
            if (!graphIR) return;
            const node = graphIR.nodes.find((item) => nodeAssetRef(item) === assetId);
            onSelectionChange({ nodeId: node?.id ?? null, edgeId: null });
            setActiveTab((currentTab) => nextDesignBottomTabAfterAssetSelect(currentTab));
          }}
        />
      </div>
      <AssetReviewDetail
        key={selectedReviewAsset?.asset_id ?? "none"}
        asset={selectedReviewAsset}
        saving={saving}
        onResolveMissing={(asset, item, note) => onSaveAsset(asset.asset_id, resolveMissingItem(asset, item, note))}
        onApprove={(candidate) => {
          const nextCandidate = approveCandidate(candidate);
          onSaveAsset(candidate.asset_id, nextCandidate);
        }}
        onDefer={(candidate) => onSaveAsset(candidate.asset_id, setCandidateStatus(candidate, "deferred"))}
        onReject={(candidate) => onSaveAsset(candidate.asset_id, setCandidateStatus(candidate, "rejected"))}
      />
    </div>
  );
}

function nodeAssetRef(node: GraphIR["nodes"][number]): string | null {
  if (node.node_kind === "agent") return node.agent_ref;
  if (node.node_kind === "tool") return node.tool_ref;
  if (node.node_kind === "subworkflow") return node.workflow_ref;
  return null;
}
