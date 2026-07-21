import type { QueryClient } from "@tanstack/react-query";
import { createA2AContractForCandidate } from "../../analyzer/a2aContracts";
import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import { importLocalA2AProvider } from "../../analyzer/localA2aProvider";
import { insertCatalogWorkflowNode, pruneDetachedCatalogWorkflowCandidates } from "../../analyzer/nestedWorkflowInsert";
import type { AnalysisResult, AssetCandidate, GraphIR, RuntimeContract } from "../../analyzer/types";
import type { CatalogHubEntry } from "../../catalog/catalogIndex";
import type { DesignBottomTab } from "../../design/designWorkbenchTabs";
import { GRAPH_IR_SAVE_SUCCESS_MESSAGE } from "./designStageModelCore";

type MutationOptions = { onSuccess?: () => void; onError?: (error: unknown) => void };
type ApprovalGate = "boundaries_approved" | "runtime_contracts_approved";

interface DesignActionContext {
  reqId: string;
  analysis: AnalysisResult | null;
  runtimeContracts: RuntimeContract[];
  a2aContracts: AnalysisResult["a2aContracts"];
  queryClient: QueryClient;
  setActionMessage: (message: string | null) => void;
  setSelectedA2AAssetId: (id: string) => void;
  setSelectedReviewAssetId: (id: string) => void;
  setActiveTab: (tab: DesignBottomTab) => void;
  setCatalogWorkflowPickerOpen: (open: boolean) => void;
  saveAnalysis: (analysis: AnalysisResult, options: MutationOptions) => void;
  approveGate: (gate: ApprovalGate, value: boolean, options: MutationOptions) => void;
}

export function createDesignWorkbenchActions(ctx: DesignActionContext) {
  const save = (analysis: AnalysisResult, success: string, fallback: string) => ctx.saveAnalysis(analysis, {
    onSuccess: () => ctx.setActionMessage(success),
    onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : fallback)
  });

  return {
    toggleApproval(gate: ApprovalGate, value: boolean) {
      ctx.approveGate(gate, value, {
        onSuccess: () => ctx.setActionMessage(`${gate} 갱신 완료`),
        onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : "approval gate 갱신 실패")
      });
    },
    saveRuntimeContract(next: RuntimeContract) {
      if (!ctx.analysis) return;
      save({ ...ctx.analysis, runtimeContracts: ctx.runtimeContracts.map((contract) => contract.contract_id === next.contract_id ? next : contract) }, `${next.contract_id} 저장 완료`, "Runtime 계약 저장 실패");
    },
    saveA2AContract(next: AnalysisResult["a2aContracts"][number]) {
      if (!ctx.analysis) return;
      const replaced = ctx.a2aContracts.some((contract) => contract.contract_id === next.contract_id);
      save({ ...ctx.analysis, a2aContracts: replaced ? ctx.a2aContracts.map((contract) => contract.contract_id === next.contract_id ? next : contract) : [...ctx.a2aContracts, next] }, `${next.contract_id} 저장 완료`, "A2A 계약 저장 실패");
    },
    createA2AContract(asset: AssetCandidate) {
      if (!ctx.analysis || asset.asset_type !== "agent") return;
      const next = createA2AContractForCandidate(ctx.analysis, asset.asset_id);
      const contractRef = next.assetCandidates.find((candidate) => candidate.asset_id === asset.asset_id)?.binding;
      const contractId = contractRef?.kind === "a2a" ? contractRef.contract_ref : "A2A";
      ctx.saveAnalysis(next, {
        onSuccess: () => { ctx.setSelectedA2AAssetId(asset.asset_id); ctx.setActionMessage(`${contractId} 새 계약 생성 완료`); },
        onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : "A2A 계약 생성 실패")
      });
    },
    importLocalA2AProvider(provider: LocalA2AProviderImport) {
      if (!ctx.analysis) return;
      const imported = importLocalA2AProvider(ctx.analysis, provider);
      ctx.saveAnalysis(imported.analysis, {
        onSuccess: () => { ctx.setSelectedA2AAssetId(imported.assetId); ctx.setActiveTab("a2a"); ctx.setActionMessage(`${imported.contractId} A2A Agent 등록 완료 — 계약 검토가 필요합니다.`); },
        onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : "A2A Agent 등록 실패")
      });
    },
    async insertCatalogWorkflow(entry: CatalogHubEntry) {
      if (!ctx.analysis) return;
      const next = insertCatalogWorkflowNode(ctx.analysis, entry);
      if (next === ctx.analysis) return ctx.setActionMessage("Workflow asset을 추가하지 못했습니다.");
      const inserted = next.assetCandidates[next.assetCandidates.length - 1] ?? null;
      ctx.saveAnalysis(next, {
        onSuccess: () => {
          if (inserted) { ctx.setSelectedReviewAssetId(inserted.asset_id); ctx.setActiveTab("assets"); }
          ctx.setCatalogWorkflowPickerOpen(false);
          ctx.setActionMessage("Workflow asset과 subworkflow Node를 추가했습니다. Edge 연결을 검토하세요.");
        },
        onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : "Workflow asset 삽입 실패")
      });
    },
    saveGraphIR(graph: GraphIR) {
      if (!ctx.analysis) return;
      const next = pruneDetachedCatalogWorkflowCandidates({ ...ctx.analysis, graph });
      ctx.saveAnalysis(next, {
        onSuccess: () => {
          void Promise.all([
            ctx.queryClient.invalidateQueries({ queryKey: ["af", ctx.reqId, "scaffold-plan"] }),
            ctx.queryClient.invalidateQueries({ queryKey: ["af", ctx.reqId, "runtime-stub"] })
          ]);
          ctx.setActionMessage(GRAPH_IR_SAVE_SUCCESS_MESSAGE);
        },
        onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : "Graph IR 저장 실패")
      });
    },
    saveAsset(assetId: string, nextAsset: AssetCandidate) {
      if (!ctx.analysis) return;
      ctx.setSelectedReviewAssetId(assetId);
      save({
        ...ctx.analysis,
        assetCandidates: ctx.analysis.assetCandidates.map((asset) => asset.asset_id === assetId ? nextAsset : asset)
      }, `${nextAsset.name} Asset 검토 저장 완료`, "Asset 검토 저장 실패");
    }
  };
}
