import type { QueryClient } from "@tanstack/react-query";
import type { CatalogHubEntry } from "../../catalog/catalogIndex";
import type { LocalA2AProviderImport } from "../../analyzer/localA2aProvider";
import { importLocalA2AProvider } from "../../analyzer/localA2aProvider";
import { applyNodeReviewStatus } from "../../analyzer/moduleReview";
import { createA2AContractForCandidate } from "../../analyzer/a2aNormalize";
import { insertCatalogWorkflowNode, pruneDetachedCatalogWorkflowCandidates } from "../../analyzer/nestedWorkflowInsert";
import type { AnalysisResult, GraphIR, ModuleCandidate, ModuleStatus, RuntimeContract } from "../../analyzer/types";
import type { DesignBottomTab } from "../../design/designWorkbenchTabs";
import type { RuntimeA2aAgentCardResult } from "../../state/useRuntimeA2a";

const GRAPH_IR_SAVE_SUCCESS_MESSAGE =
  "Graph IR 저장 완료 — Build 에서 계약 동기화 + runtime-stub 재생성이 필요합니다.";

type MutationOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

type ApprovalGate = "boundaries_approved" | "runtime_contracts_approved";

type AnalysisQueryData = {
  readonly data: AnalysisResult;
};

interface DesignActionContext {
  reqId: string;
  analysis: AnalysisResult | null;
  runtimeContracts: RuntimeContract[];
  a2aContracts: AnalysisResult["a2aContracts"];
  queryClient: QueryClient;
  setActionMessage: (message: string | null) => void;
  setSelectedA2AModuleId: (id: string) => void;
  setSelectedReviewModuleId: (id: string) => void;
  setActiveTab: (tab: DesignBottomTab) => void;
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
    importLocalA2AProvider(provider: LocalA2AProviderImport) {
      if (!ctx.analysis) return;
      const imported = importLocalA2AProvider(ctx.analysis, provider);
      ctx.saveAnalysis(imported.analysis, {
        onSuccess: () => {
          ctx.setSelectedA2AModuleId(imported.candidateId);
          ctx.setActiveTab("a2a");
          ctx.setActionMessage(`${imported.contractId} local A2A provider 등록 완료 — 계약 검토와 승인이 필요합니다.`);
        },
        onError: (error) =>
          ctx.setActionMessage(error instanceof Error ? error.message : "Local A2A provider 등록 실패")
      });
    },
    async insertCatalogWorkflow(entry: CatalogHubEntry) {
      if (!ctx.analysis) return;
      if (isA2ACapableWorkflowEntry(entry)) {
        const providerReqId = entry.a2a_provider_req_id?.trim() ?? "";
        if (!providerReqId) {
          ctx.setActionMessage("Remote A2A workflow 항목에 a2a_provider_req_id 가 없습니다.");
          return;
        }

        try {
          const provider = await fetchCatalogWorkflowAgentCard(providerReqId);
          const currentAnalysis = latestAnalysis(ctx);
          if (!currentAnalysis) return;
          const imported = importLocalA2AProvider(currentAnalysis, {
            providerReqId: provider.provider_req_id,
            appName: provider.app_name,
            agentCardUrl: provider.agent_card_url,
            rpcUrl: provider.rpc_url,
            card: provider.card
          });
          ctx.saveAnalysis(imported.analysis, {
            onSuccess: () => {
              ctx.setSelectedA2AModuleId(imported.candidateId);
              ctx.setActiveTab("a2a");
              ctx.setCatalogWorkflowPickerOpen(false);
              ctx.setActionMessage(`${imported.contractId} Remote A2A facade 추가 완료 — 계약 검토와 승인이 필요합니다.`);
            },
            onError: (error) =>
              ctx.setActionMessage(error instanceof Error ? error.message : "Remote A2A facade 삽입 실패")
          });
        } catch (error) {
          ctx.setActionMessage(error instanceof Error ? error.message : "ADK A2A Agent Card 조회 실패");
        }
        return;
      }

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

function isA2ACapableWorkflowEntry(entry: CatalogHubEntry): boolean {
  return entry.runtime_binding === "remote_a2a" || entry.component_source === "remote_a2a";
}

function latestAnalysis(ctx: DesignActionContext): AnalysisResult | null {
  const cached = ctx.queryClient.getQueryData<AnalysisQueryData | null>(["af", ctx.reqId, "analysis-result"]);
  return cached?.data ?? ctx.analysis;
}

async function fetchCatalogWorkflowAgentCard(providerReqId: string): Promise<RuntimeA2aAgentCardResult> {
  const response = await fetch(`/api/af/${encodeURIComponent(providerReqId)}/runtime-a2a/agent-card`);
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(body) ?? "ADK A2A Agent Card 조회 실패");
  }
  if (!isRuntimeA2aAgentCardResult(body)) {
    throw new Error("ADK A2A Agent Card 응답 형식이 올바르지 않습니다.");
  }
  return body;
}

function errorMessage(value: unknown): string | null {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : null;
}

function isRuntimeA2aAgentCardResult(value: unknown): value is RuntimeA2aAgentCardResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "provider_req_id" in value &&
    typeof value.provider_req_id === "string" &&
    "app_name" in value &&
    typeof value.app_name === "string" &&
    "rpc_url" in value &&
    typeof value.rpc_url === "string" &&
    "agent_card_url" in value &&
    typeof value.agent_card_url === "string" &&
    "card" in value &&
    typeof value.card === "object" &&
    value.card !== null &&
    "name" in value.card &&
    typeof value.card.name === "string"
  );
}
