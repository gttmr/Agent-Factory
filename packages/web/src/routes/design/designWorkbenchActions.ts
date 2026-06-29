import type { QueryClient } from "@tanstack/react-query";
import { applyNodeReviewStatus } from "../../analyzer/moduleReview";
import { createA2AContractForCandidate } from "../../analyzer/a2aNormalize";
import { insertCatalogWorkflowNode, pruneDetachedCatalogWorkflowCandidates } from "../../analyzer/nestedWorkflowInsert";
import type { AnalysisResult, GraphIR, ModuleCandidate, ModuleStatus, RuntimeContract } from "../../analyzer/types";
import type { SidebarTab } from "./designStageModel";
import { GRAPH_IR_SAVE_SUCCESS_MESSAGE } from "./designStageModel";

type MutationOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

type ApprovalGate = "boundaries_approved" | "runtime_contracts_approved";

interface DesignActionContext {
  reqId: string;
  analysis: AnalysisResult | null;
  runtimeContracts: RuntimeContract[];
  a2aContracts: AnalysisResult["a2aContracts"];
  queryClient: QueryClient;
  setActionMessage: (message: string | null) => void;
  setSelectedA2AModuleId: (id: string) => void;
  setSelectedReviewModuleId: (id: string) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setCatalogWorkflowPickerOpen: (open: boolean) => void;
  saveAnalysis: (analysis: AnalysisResult, options: MutationOptions) => void;
  approveGate: (gate: ApprovalGate, value: boolean, options: MutationOptions) => void;
}

export function createDesignWorkbenchActions(ctx: DesignActionContext) {
  function saveAnalysis(nextAnalysis: AnalysisResult, successMessage: string, fallbackError: string) {
    ctx.saveAnalysis(nextAnalysis, {
      onSuccess: () => ctx.setActionMessage(successMessage),
      onError: (error) => ctx.setActionMessage(error instanceof Error ? error.message : fallbackError)
    });
  }

  return {
    toggleApproval(gate: ApprovalGate, value: boolean) {
      ctx.approveGate(gate, value, {
        onSuccess: () => ctx.setActionMessage(`${gate} 갱신 완료`),
        onError: (error) =>
          ctx.setActionMessage(error instanceof Error ? error.message : "approval gate 갱신 실패")
      });
    },
    saveRuntimeContract(next: RuntimeContract) {
      if (!ctx.analysis) return;
      saveAnalysis(
        {
          ...ctx.analysis,
          runtimeContracts: ctx.runtimeContracts.map((contract) =>
            contract.contract_id === next.contract_id ? next : contract
          )
        },
        `${next.contract_id} 저장 완료`,
        "runtime contract 저장 실패"
      );
    },
    saveA2AContract(next: AnalysisResult["a2aContracts"][number]) {
      if (!ctx.analysis) return;
      const replaced = ctx.a2aContracts.some((contract) => contract.contract_id === next.contract_id);
      saveAnalysis(
        {
          ...ctx.analysis,
          a2aContracts: replaced
            ? ctx.a2aContracts.map((contract) => (contract.contract_id === next.contract_id ? next : contract))
            : [...ctx.a2aContracts, next]
        },
        `${next.contract_id} 저장 완료`,
        "A2A contract 저장 실패"
      );
    },
    createA2AContract(candidate: ModuleCandidate) {
      if (!ctx.analysis || candidate.module_category !== "remote_a2a") return;
      const nextAnalysis = createA2AContractForCandidate(ctx.analysis, candidate.id);
      const contractId = nextAnalysis.moduleCandidates.find((item) => item.id === candidate.id)?.a2a_contract_id;
      ctx.saveAnalysis(nextAnalysis, {
        onSuccess: () => {
          ctx.setSelectedA2AModuleId(candidate.id);
          ctx.setActionMessage(`${contractId} 새 계약 생성 완료`);
        },
        onError: (error) =>
          ctx.setActionMessage(error instanceof Error ? error.message : "A2A contract 생성 실패")
      });
    },
    insertCatalogWorkflow(entry: Parameters<typeof insertCatalogWorkflowNode>[1]) {
      if (!ctx.analysis) return;
      const nextAnalysis = insertCatalogWorkflowNode(ctx.analysis, entry, ctx.reqId);
      if (nextAnalysis === ctx.analysis) {
        ctx.setActionMessage("processFlow 가 없어 노드를 추가하지 못했습니다.");
        return;
      }
      const insertedCandidate = nextAnalysis.moduleCandidates[nextAnalysis.moduleCandidates.length - 1] ?? null;
      ctx.saveAnalysis(nextAnalysis, {
        onSuccess: () => {
          if (insertedCandidate) {
            ctx.setSelectedReviewModuleId(insertedCandidate.id);
            ctx.setActiveTab("modules");
          }
          ctx.setCatalogWorkflowPickerOpen(false);
          ctx.setActionMessage("노드가 추가되었습니다 — 엣지 연결과 모듈 승인이 필요합니다.");
        },
        onError: (error) =>
          ctx.setActionMessage(error instanceof Error ? error.message : "카탈로그 workflow 삽입 실패")
      });
    },
    saveGraphIR(nextGraph: GraphIR) {
      if (!ctx.analysis) return;
      const nextAnalysis = pruneDetachedCatalogWorkflowCandidates({ ...ctx.analysis, processFlow: nextGraph });
      ctx.saveAnalysis(nextAnalysis, {
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
    saveCandidate(candidateId: string, nextCandidate: ModuleCandidate, syncStatus?: ModuleStatus) {
      if (!ctx.analysis) return;
      ctx.setSelectedReviewModuleId(candidateId);
      saveAnalysis(
        {
          ...ctx.analysis,
          moduleCandidates: ctx.analysis.moduleCandidates.map((candidate) =>
            candidate.id === candidateId ? nextCandidate : candidate
          ),
          processFlow:
            syncStatus && ctx.analysis.processFlow
              ? applyNodeReviewStatus(ctx.analysis.processFlow, candidateId, syncStatus)
              : ctx.analysis.processFlow
        },
        `${nextCandidate.name} 모듈 검토 저장 완료`,
        "모듈 검토 저장 실패"
      );
    }
  };
}
