import { useMemo, useReducer, useRef } from "react";
import { parseAfRunManifest, serializeAfRunManifest, type AfRunManifest } from "../analyzer/afRunManifest";
import { getExampleRequirement, getRemoteA2AExampleRequirement } from "../analyzer/exampleRequirement";
import { serializeAnalysisResultArtifact } from "../analyzer/analysisArtifactExport";
import { parseAnalysisResultArtifact, type ImportedAnalysisArtifact } from "../analyzer/analysisArtifactImport";
import { defaultAnalyzerProvider } from "../analyzer/providers";
import {
  createSavedAnalysisId,
  deleteSavedAnalysis,
  loadSavedAnalyses,
  upsertSavedAnalysis,
  type SavedAnalysisRecord
} from "../analyzer/savedAnalyses";
import { buildScaffoldPlan } from "../analyzer/scaffoldPlan";
import { buildRuntimeContracts } from "../analyzer/runtimeContracts";
import type {
  A2AContract,
  AnalysisResult,
  AnalyzerProgressEvent,
  CatalogReference,
  CodexAnalyzerModel,
  GraphIR,
  ModuleCandidate,
  RequirementDomain,
  RequirementIntakeInput,
  RuntimeContract
} from "../analyzer/types";
import { loadSeedCatalog } from "../catalog/seed";
import type { CatalogEntry } from "../catalog/types";

export type StepGroup = "input" | "review" | "assets" | "generate";

export type StepId =
  | "intake"
  | "analysis"
  | "modules"
  | "graph"
  | "runtimeContracts"
  | "a2aContracts"
  | "catalog"
  | "saved"
  | "export";

export interface StepDefinition {
  id: StepId;
  label: string;
  group: StepGroup;
  alwaysAvailable?: boolean;
}

export const stepGroupLabels: Record<StepGroup, string> = {
  input: "입력",
  review: "검토",
  assets: "자산화",
  generate: "생성"
};

export const workbenchSteps: StepDefinition[] = [
  { id: "intake", label: "요구사항 접수", group: "input", alwaysAvailable: true },
  { id: "analysis", label: "분석 결과", group: "review" },
  { id: "modules", label: "모듈 검토", group: "review" },
  { id: "graph", label: "Graph IR", group: "review" },
  { id: "runtimeContracts", label: "Runtime 계약", group: "review" },
  { id: "a2aContracts", label: "Remote A2A 계약", group: "review" },
  { id: "catalog", label: "카탈로그", group: "assets", alwaysAvailable: true },
  { id: "saved", label: "저장된 분석", group: "assets", alwaysAvailable: true },
  { id: "export", label: "ADK 소스 생성", group: "generate" }
];

const emptyInput: RequirementIntakeInput = {
  domain: "공통",
  rawText: ""
};

export interface WorkbenchState {
  activeStep: StepId;
  input: RequirementIntakeInput;
  analysis: AnalysisResult | null;
  moduleCandidates: ModuleCandidate[];
  acceptedMissing: string[];
  validationMessage: string;
  isAnalyzing: boolean;
  analyzerModel: CodexAnalyzerModel;
  analysisProgress: AnalyzerProgressEvent[];
  analysisSourceLabel: string | null;
  runManifest: AfRunManifest | null;
  catalogEntries: CatalogEntry[];
  savedAnalyses: SavedAnalysisRecord[];
  currentSavedId: string | null;
}

type WorkbenchAction =
  | { type: "setStep"; step: StepId }
  | { type: "setInput"; input: RequirementIntakeInput }
  | { type: "setAnalyzerModel"; model: CodexAnalyzerModel }
  | { type: "analysisStarted" }
  | { type: "analysisProgress"; event: AnalyzerProgressEvent }
  | { type: "analysisSucceeded"; analysis: AnalysisResult }
  | { type: "importAnalysisArtifactSucceeded"; artifact: ImportedAnalysisArtifact; fileName: string }
  | { type: "importRunManifestSucceeded"; manifest: AfRunManifest; fileName: string }
  | { type: "analysisFailed"; message: string }
  | { type: "loadExample"; input: RequirementIntakeInput }
  | { type: "clearAll" }
  | { type: "setModuleCandidates"; moduleCandidates: ModuleCandidate[] }
  | { type: "setModuleReviewArtifacts"; moduleCandidates: ModuleCandidate[]; processFlow: GraphIR; runtimeContracts: RuntimeContract[] }
  | { type: "setA2AContracts"; contracts: A2AContract[] }
  | { type: "setRuntimeContracts"; contracts: RuntimeContract[] }
  | { type: "setCatalogEntries"; entries: CatalogEntry[] }
  | { type: "toggleAcceptedMissing"; item: string }
  | { type: "saveCurrentSucceeded"; records: SavedAnalysisRecord[]; currentSavedId: string }
  | { type: "exportAnalysisArtifactSucceeded"; fileName: string }
  | { type: "exportRunManifestSucceeded"; fileName: string }
  | { type: "loadSavedAnalysis"; record: SavedAnalysisRecord }
  | { type: "deleteSavedAnalysis"; records: SavedAnalysisRecord[]; deletedId: string }
  | { type: "setValidation"; message: string; step?: StepId };

function createInitialState(catalogEntries: CatalogEntry[]): WorkbenchState {
  return {
    activeStep: "intake",
    input: emptyInput,
    analysis: null,
    moduleCandidates: [],
    acceptedMissing: [],
    validationMessage: "",
    isAnalyzing: false,
    analyzerModel: "gpt-5.3-codex-spark",
    analysisProgress: [],
    analysisSourceLabel: null,
    runManifest: null,
    catalogEntries,
    savedAnalyses: loadSavedAnalyses(),
    currentSavedId: null
  };
}

function reducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "setStep":
      return { ...state, activeStep: action.step };
    case "setInput":
      return { ...state, input: action.input };
    case "setAnalyzerModel":
      return { ...state, analyzerModel: action.model };
    case "analysisStarted":
      return {
        ...state,
        isAnalyzing: true,
        analysisProgress: [],
        analysisSourceLabel: null,
        validationMessage: ""
      };
    case "analysisProgress":
      return {
        ...state,
        analysisProgress: [...state.analysisProgress.slice(-59), compactProgressEvent(action.event)]
      };
    case "analysisSucceeded":
      return {
        ...state,
        analysis: action.analysis,
        moduleCandidates: action.analysis.moduleCandidates,
        acceptedMissing: [],
        currentSavedId: null,
        validationMessage: "",
        isAnalyzing: false,
        analysisSourceLabel: null,
        runManifest: compatibleManifest(state.runManifest, action.analysis.normalizedRequirement.id)
      };
    case "importAnalysisArtifactSucceeded":
      {
        const keptManifest = compatibleManifest(state.runManifest, action.artifact.analysis.normalizedRequirement.id);
        const manifestNote =
          state.runManifest && !keptManifest ? " 기존 manifest는 requirement_id가 달라 연결을 해제했습니다." : "";
        return {
          ...state,
          activeStep: pickLandingStepForAnalysis(action.artifact.analysis, action.artifact.moduleCandidates),
          input: action.artifact.input,
          analysis: action.artifact.analysis,
          moduleCandidates: action.artifact.moduleCandidates,
          acceptedMissing: [],
          validationMessage: `${action.fileName} artifact를 불러왔습니다: ${action.artifact.title}${manifestNote}`,
          isAnalyzing: false,
          analysisProgress: [],
          analysisSourceLabel: action.fileName,
          runManifest: keptManifest,
          currentSavedId: null
        };
      }
    case "importRunManifestSucceeded":
      return {
        ...state,
        runManifest: action.manifest,
        validationMessage: `${action.fileName} manifest를 불러왔습니다: ${action.manifest.requirement_id}`,
        currentSavedId: null
      };
    case "analysisFailed":
      return {
        ...state,
        validationMessage: action.message,
        activeStep: "intake",
        isAnalyzing: false,
        analysisSourceLabel: null
      };
    case "loadExample":
      return {
        ...state,
        input: action.input,
        validationMessage: "",
        analysisSourceLabel: null,
        runManifest: null,
        currentSavedId: null
      };
    case "clearAll":
      return {
        ...state,
        activeStep: "intake",
        input: emptyInput,
        analysis: null,
        moduleCandidates: [],
        acceptedMissing: [],
        validationMessage: "",
        analysisProgress: [],
        analysisSourceLabel: null,
        runManifest: null,
        currentSavedId: null
      };
    case "setModuleCandidates":
      return { ...state, moduleCandidates: action.moduleCandidates };
    case "setModuleReviewArtifacts":
      if (!state.analysis) return state;
      return {
            ...state,
            analysis: {
              ...state.analysis,
              moduleCandidates: action.moduleCandidates,
              processFlow: action.processFlow,
              runtimeContracts: action.runtimeContracts
            },
            moduleCandidates: action.moduleCandidates,
            runManifest: refreshManifestRuntimeApproval(state.runManifest, action.runtimeContracts),
            validationMessage: "모듈 검토 내용을 저장하고 Graph IR을 재생성했습니다."
          };
    case "setA2AContracts":
      return state.analysis
        ? { ...state, analysis: { ...state.analysis, a2aContracts: action.contracts } }
        : state;
    case "setRuntimeContracts":
      return state.analysis
        ? {
            ...state,
            analysis: { ...state.analysis, runtimeContracts: action.contracts },
            runManifest: refreshManifestRuntimeApproval(state.runManifest, action.contracts)
          }
        : state;
    case "setCatalogEntries":
      return { ...state, catalogEntries: action.entries };
    case "toggleAcceptedMissing":
      return {
        ...state,
        acceptedMissing: state.acceptedMissing.includes(action.item)
          ? state.acceptedMissing.filter((value) => value !== action.item)
          : [...state.acceptedMissing, action.item]
      };
    case "saveCurrentSucceeded":
      return {
        ...state,
        savedAnalyses: action.records,
        currentSavedId: action.currentSavedId,
        validationMessage: "현재 분석을 저장했습니다.",
        activeStep: "saved"
      };
    case "exportAnalysisArtifactSucceeded":
      return {
        ...state,
        validationMessage: `${action.fileName} 다운로드를 준비했습니다.`,
        activeStep: "saved"
      };
    case "exportRunManifestSucceeded":
      return {
        ...state,
        validationMessage: `${action.fileName} 다운로드를 준비했습니다.`,
        activeStep: "saved"
      };
    case "loadSavedAnalysis":
      return {
        ...state,
        input: normalizeIntakeInput(action.record.input),
        analysis: action.record.analysis,
        moduleCandidates: action.record.moduleCandidates,
        acceptedMissing: action.record.acceptedMissing,
        analyzerModel: action.record.analyzerModel,
        analysisProgress: [],
        currentSavedId: action.record.id,
        analysisSourceLabel: "저장된 분석",
        runManifest: action.record.runManifest,
        catalogEntries: action.record.catalogEntries.length
          ? action.record.catalogEntries
          : state.catalogEntries,
        validationMessage: `저장된 분석을 불러왔습니다: ${action.record.title}`,
        activeStep: pickLandingStep(action.record)
      };
    case "deleteSavedAnalysis":
      return {
        ...state,
        savedAnalyses: action.records,
        currentSavedId: state.currentSavedId === action.deletedId ? null : state.currentSavedId
      };
    case "setValidation":
      return {
        ...state,
        validationMessage: action.message,
        activeStep: action.step ?? state.activeStep
      };
    default:
      return state;
  }
}

export function useWorkbenchState() {
  const seedEntries = useMemo(() => loadSeedCatalog(), []);
  const [state, dispatch] = useReducer(reducer, seedEntries, createInitialState);
  const analysisRequestInFlight = useRef(false);

  const processFlow = state.analysis?.processFlow ?? null;
  const a2aContracts = state.analysis?.a2aContracts ?? [];
  const runtimeContracts = state.analysis?.runtimeContracts ?? [];
  const hasRemoteA2ACandidates = state.moduleCandidates.some((candidate) => candidate.module_category === "remote_a2a");
  const hasA2AReviewStep = hasRemoteA2ACandidates || a2aContracts.length > 0;
  // Show the Runtime 계약 step whenever there are generated contracts OR
  // catalog-bound candidates that the reviewer may override on this analysis.
  const hasCatalogBoundCandidates = state.moduleCandidates.some((candidate) => Boolean(candidate.catalog_entry_id));
  const hasRuntimeContractReviewStep = runtimeContracts.length > 0 || hasCatalogBoundCandidates;
  const canReview = state.analysis !== null;

  const visibleSteps = useMemo(
    () =>
      workbenchSteps.filter((step) => {
        if (step.id === "a2aContracts") return hasA2AReviewStep;
        if (step.id === "runtimeContracts") return hasRuntimeContractReviewStep;
        return true;
      }),
    [hasA2AReviewStep, hasRuntimeContractReviewStep]
  );

  function canOpenStep(step: StepDefinition): boolean {
    return Boolean(step.alwaysAvailable || canReview);
  }

  function setActiveStep(step: StepId) {
    dispatch({ type: "setStep", step });
  }

  async function runAnalysis() {
    if (analysisRequestInFlight.current) {
      return;
    }
    if (!state.input.rawText.trim()) {
      dispatch({ type: "setValidation", message: "분석 전에 원문 요구사항을 입력해야 합니다.", step: "intake" });
      return;
    }

    analysisRequestInFlight.current = true;
    dispatch({ type: "analysisStarted" });
    try {
      const result = await defaultAnalyzerProvider.analyze(state.input, {
        model: state.analyzerModel,
        catalog: buildCatalogReferences(state.catalogEntries),
        onProgress: (event) => dispatch({ type: "analysisProgress", event })
      });
      dispatch({ type: "analysisSucceeded", analysis: result });
    } catch (error) {
      dispatch({
        type: "analysisFailed",
        message: error instanceof Error ? error.message : "분석을 완료하지 못했습니다."
      });
    } finally {
      analysisRequestInFlight.current = false;
    }
  }

  function saveCurrentAnalysis() {
    if (!state.analysis) {
      dispatch({ type: "setValidation", message: "저장할 분석 결과가 없습니다.", step: "intake" });
      return;
    }
    const id = state.currentSavedId ?? createSavedAnalysisId();
    const catalogSnapshot = state.catalogEntries.filter((entry) => entry.provenance !== "session_deleted");
    const scaffoldPlan = buildScaffoldPlan({
      normalizedRequirement: state.analysis.normalizedRequirement,
      moduleCandidates: state.moduleCandidates,
      processFlow: state.analysis.processFlow,
      catalogEntries: catalogSnapshot,
      runtimeContracts: state.analysis.runtimeContracts ?? []
    });
    const graphErrors = state.analysis.processFlow.validation?.errors?.length ?? 0;
    const scaffoldReady = scaffoldPlan.validation.can_generate_source && graphErrors === 0;
    const record: SavedAnalysisRecord = {
      id,
      title: state.analysis.normalizedRequirement.title || "제목 없는 분석",
      savedAt: new Date().toISOString(),
      input: state.input,
      analysis: {
        ...state.analysis,
        moduleCandidates: state.moduleCandidates
      },
      moduleCandidates: state.moduleCandidates,
      acceptedMissing: state.acceptedMissing,
      analyzerModel: state.analyzerModel,
      runManifest: state.runManifest,
      catalogEntries: catalogSnapshot,
      activeStep: state.activeStep,
      scaffoldReady
    };
    dispatch({
      type: "saveCurrentSucceeded",
      records: upsertSavedAnalysis(record),
      currentSavedId: id
    });
  }

  function removeSavedAnalysis(id: string) {
    dispatch({ type: "deleteSavedAnalysis", records: deleteSavedAnalysis(id), deletedId: id });
  }

  function importAnalysisArtifact(source: string, fileName: string) {
    try {
      const artifact = parseAnalysisResultArtifact(source, fileName);
      dispatch({ type: "importAnalysisArtifactSucceeded", artifact, fileName });
    } catch (error) {
      dispatch({
        type: "setValidation",
        message: error instanceof Error ? error.message : "analysis-result.json artifact를 불러오지 못했습니다.",
        step: "intake"
      });
    }
  }

  function importRunManifest(source: string, fileName: string) {
    try {
      const manifest = parseAfRunManifest(source, fileName);
      if (state.analysis && manifest.requirement_id !== state.analysis.normalizedRequirement.id) {
        dispatch({
          type: "setValidation",
          message: `${fileName} requirement_id(${manifest.requirement_id})가 현재 분석(${state.analysis.normalizedRequirement.id})과 다릅니다.`,
          step: "intake"
        });
        return;
      }
      dispatch({ type: "importRunManifestSucceeded", manifest, fileName });
    } catch (error) {
      dispatch({
        type: "setValidation",
        message: error instanceof Error ? error.message : "af-run-manifest.json을 불러오지 못했습니다.",
        step: "intake"
      });
    }
  }

  function exportCurrentAnalysisArtifact() {
    if (!state.analysis) {
      dispatch({ type: "setValidation", message: "내보낼 분석 결과가 없습니다.", step: "saved" });
      return;
    }
    const fileName = `${safeFileStem(state.analysis.normalizedRequirement.id || "analysis")}-analysis-result.json`;
    const content = serializeAnalysisResultArtifact({
      analysis: state.analysis,
      moduleCandidates: state.moduleCandidates,
      a2aContracts: state.analysis.a2aContracts ?? [],
      runtimeContracts: state.analysis.runtimeContracts ?? []
    });
    downloadJson(fileName, content);
    dispatch({ type: "exportAnalysisArtifactSucceeded", fileName });
  }

  function exportRunManifest() {
    if (!state.runManifest) {
      dispatch({ type: "setValidation", message: "내보낼 DLC run manifest가 없습니다.", step: "saved" });
      return;
    }
    const fileName = `${safeFileStem(state.runManifest.requirement_id || "af-run")}-af-run-manifest.json`;
    downloadJson(fileName, serializeAfRunManifest(state.runManifest));
    dispatch({ type: "exportRunManifestSucceeded", fileName });
  }

  return {
    state,
    processFlow,
    a2aContracts,
    runtimeContracts,
    hasA2AReviewStep,
    hasRuntimeContractReviewStep,
    visibleSteps,
    canOpenStep,
    providerLabel: defaultAnalyzerProvider.label,
    actions: {
      setActiveStep,
      setInput: (input: RequirementIntakeInput) => dispatch({ type: "setInput", input }),
      setAnalyzerModel: (model: CodexAnalyzerModel) => dispatch({ type: "setAnalyzerModel", model }),
      setModuleCandidates: (moduleCandidates: ModuleCandidate[]) =>
        dispatch({ type: "setModuleCandidates", moduleCandidates }),
      setModuleReviewArtifacts: (moduleCandidates: ModuleCandidate[], processFlow: GraphIR) => {
        if (!state.analysis) return;
        dispatch({
          type: "setModuleReviewArtifacts",
          moduleCandidates,
          processFlow,
          runtimeContracts: buildRuntimeContracts({
            normalizedRequirement: state.analysis.normalizedRequirement,
            moduleCandidates,
            existingContracts: state.analysis.runtimeContracts ?? []
          })
        });
      },
      setA2AContracts: (contracts: A2AContract[]) => dispatch({ type: "setA2AContracts", contracts }),
      setRuntimeContracts: (contracts: RuntimeContract[]) => dispatch({ type: "setRuntimeContracts", contracts }),
      setCatalogEntries: (entries: CatalogEntry[]) => dispatch({ type: "setCatalogEntries", entries }),
      toggleAcceptedMissing: (item: string) => dispatch({ type: "toggleAcceptedMissing", item }),
      loadExample: () => dispatch({ type: "loadExample", input: getExampleRequirement() }),
      loadRemoteA2AExample: () => dispatch({ type: "loadExample", input: getRemoteA2AExampleRequirement() }),
      clearAll: () => dispatch({ type: "clearAll" }),
      runAnalysis,
      saveCurrentAnalysis,
      importAnalysisArtifact,
      importRunManifest,
      exportCurrentAnalysisArtifact,
      exportRunManifest,
      loadSavedAnalysis: (record: SavedAnalysisRecord) => dispatch({ type: "loadSavedAnalysis", record }),
      removeSavedAnalysis
    }
  };
}

function compactProgressEvent(event: AnalyzerProgressEvent): AnalyzerProgressEvent {
  const { result: _result, ...progress } = event;
  return progress;
}

function pickLandingStep(record: SavedAnalysisRecord): StepId {
  if (record.scaffoldReady) return "export";
  return pickLandingStepForAnalysis(record.analysis, record.moduleCandidates);
}

function pickLandingStepForAnalysis(analysis: AnalysisResult, moduleCandidates: ModuleCandidate[]): StepId {
  const hasNeedsInfo = moduleCandidates.some((candidate) => candidate.status === "needs_info");
  const hasRequirementGaps =
    analysis.normalizedRequirement.missing_information.length > 0 ||
    analysis.normalizedRequirement.contradictions.length > 0 ||
    analysis.evidence.missing_information.length > 0 ||
    analysis.evidence.contradictions.length > 0;
  if (!hasNeedsInfo && !hasRequirementGaps) return "modules";
  return "analysis";
}

function normalizeIntakeInput(input: RequirementIntakeInput | Record<string, unknown>): RequirementIntakeInput {
  const record = input as Record<string, unknown>;
  const rawText = typeof record.rawText === "string" ? record.rawText : "";
  const legacyDomainHint = typeof record.domainHint === "string" ? record.domainHint : "";
  const domain = typeof record.domain === "string" && record.domain ? record.domain : legacyDomainHint || "공통";
  return {
    domain: normalizeRequirementDomain(domain),
    rawText
  };
}

function normalizeRequirementDomain(value: string): RequirementDomain {
  return value === "고객" || value === "수신" || value === "여신" || value === "카드" || value === "리스크"
    ? value
    : "공통";
}

function compatibleManifest(manifest: AfRunManifest | null, requirementId: string): AfRunManifest | null {
  if (!manifest) return null;
  return manifest.requirement_id === requirementId ? manifest : null;
}

function refreshManifestRuntimeApproval(manifest: AfRunManifest | null, contracts: RuntimeContract[]): AfRunManifest | null {
  if (!manifest) return null;
  const runtimeContractsApproved = contracts.every((contract) => contract.contract_status === "approved");
  return {
    ...manifest,
    approvals: {
      ...manifest.approvals,
      runtime_contracts_approved: runtimeContractsApproved
    }
  };
}

function safeFileStem(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "analysis";
}

function downloadJson(fileName: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildCatalogReferences(entries: CatalogEntry[]): CatalogReference[] {
  return entries
    .filter((entry) => entry.provenance !== "session_deleted")
    .filter((entry) => entry.name.trim().length > 0)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      module_category: entry.module_category,
      subtype: catalogSubtype(entry),
      runtime_binding: entry.runtime_binding ?? null,
      access_protocol: entry.access_protocol ?? null,
      mcp_server: entry.mcp_server ?? null,
      mcp_tool_name: entry.mcp_tool_name ?? null,
      mcp_schema_ref: entry.mcp_schema_ref ?? null,
      mcp_auth_mode: entry.mcp_auth_mode ?? null,
      component_source: entry.component_source ?? null,
      contract_status: entry.contract_status ?? null,
      owner_domain: entry.owner_domain ?? null,
      status: entry.status ?? null,
      responsibility: entry.responsibility ?? null,
      inputs: entry.inputs ?? [],
      outputs: entry.outputs ?? [],
      composition: entry.composition ?? [],
      risk_signals: entry.risk_signals ?? []
    }));
}

function catalogSubtype(entry: CatalogEntry): string | null {
  if (entry.module_category === "adapter") return entry.adapter_kind ?? null;
  if (entry.module_category === "agent") return entry.agent_kind ?? null;
  if (entry.module_category === "workflow") return entry.workflow_kind ?? null;
  if (entry.module_category === "remote_a2a") return entry.remote_contract_kind ?? null;
  return null;
}
