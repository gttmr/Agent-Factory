import { useMemo, useReducer, useRef } from "react";
import { getExampleRequirement, getRemoteA2AExampleRequirement } from "../analyzer/exampleRequirement";
import { defaultAnalyzerProvider } from "../analyzer/providers";
import {
  createSavedAnalysisId,
  deleteSavedAnalysis,
  loadSavedAnalyses,
  upsertSavedAnalysis,
  type SavedAnalysisRecord
} from "../analyzer/savedAnalyses";
import type {
  A2AContract,
  AnalysisResult,
  AnalyzerProgressEvent,
  CatalogReference,
  CodexAnalyzerModel,
  ModuleCandidate,
  RequirementDomain,
  RequirementIntakeInput
} from "../analyzer/types";
import { loadSeedCatalog } from "../catalog/seed";
import type { CatalogEntry } from "../catalog/types";

export type StepGroup = "input" | "review" | "assets" | "generate";

export type StepId =
  | "intake"
  | "analysis"
  | "modules"
  | "graph"
  | "a2aContracts"
  | "reuse"
  | "domainMap"
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
  { id: "a2aContracts", label: "Remote A2A 계약", group: "review" },
  { id: "reuse", label: "재사용 히트맵", group: "assets" },
  { id: "domainMap", label: "도메인 맵", group: "assets" },
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
  | { type: "analysisFailed"; message: string }
  | { type: "loadExample"; input: RequirementIntakeInput }
  | { type: "clearAll" }
  | { type: "setModuleCandidates"; moduleCandidates: ModuleCandidate[] }
  | { type: "setA2AContracts"; contracts: A2AContract[] }
  | { type: "setCatalogEntries"; entries: CatalogEntry[] }
  | { type: "toggleAcceptedMissing"; item: string }
  | { type: "saveCurrentSucceeded"; records: SavedAnalysisRecord[]; currentSavedId: string }
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
        isAnalyzing: false
      };
    case "analysisFailed":
      return {
        ...state,
        validationMessage: action.message,
        activeStep: "intake",
        isAnalyzing: false
      };
    case "loadExample":
      return {
        ...state,
        input: action.input,
        validationMessage: "",
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
        currentSavedId: null
      };
    case "setModuleCandidates":
      return { ...state, moduleCandidates: action.moduleCandidates };
    case "setA2AContracts":
      return state.analysis
        ? { ...state, analysis: { ...state.analysis, a2aContracts: action.contracts } }
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
        validationMessage: `저장된 분석을 불러왔습니다: ${action.record.title}`,
        activeStep: "analysis"
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
  const hasRemoteA2ACandidates = state.moduleCandidates.some((candidate) => candidate.module_category === "remote_a2a");
  const hasA2AReviewStep = hasRemoteA2ACandidates || a2aContracts.length > 0;
  const canReview = state.analysis !== null;

  const visibleSteps = useMemo(
    () => workbenchSteps.filter((step) => (step.id === "a2aContracts" ? hasA2AReviewStep : true)),
    [hasA2AReviewStep]
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
      analyzerModel: state.analyzerModel
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

  return {
    state,
    processFlow,
    a2aContracts,
    hasA2AReviewStep,
    visibleSteps,
    canOpenStep,
    providerLabel: defaultAnalyzerProvider.label,
    actions: {
      setActiveStep,
      setInput: (input: RequirementIntakeInput) => dispatch({ type: "setInput", input }),
      setAnalyzerModel: (model: CodexAnalyzerModel) => dispatch({ type: "setAnalyzerModel", model }),
      setModuleCandidates: (moduleCandidates: ModuleCandidate[]) =>
        dispatch({ type: "setModuleCandidates", moduleCandidates }),
      setA2AContracts: (contracts: A2AContract[]) => dispatch({ type: "setA2AContracts", contracts }),
      setCatalogEntries: (entries: CatalogEntry[]) => dispatch({ type: "setCatalogEntries", entries }),
      toggleAcceptedMissing: (item: string) => dispatch({ type: "toggleAcceptedMissing", item }),
      loadExample: () => dispatch({ type: "loadExample", input: getExampleRequirement() }),
      loadRemoteA2AExample: () => dispatch({ type: "loadExample", input: getRemoteA2AExampleRequirement() }),
      clearAll: () => dispatch({ type: "clearAll" }),
      runAnalysis,
      saveCurrentAnalysis,
      loadSavedAnalysis: (record: SavedAnalysisRecord) => dispatch({ type: "loadSavedAnalysis", record }),
      removeSavedAnalysis
    }
  };
}

function compactProgressEvent(event: AnalyzerProgressEvent): AnalyzerProgressEvent {
  const { result: _result, ...progress } = event;
  return progress;
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

function buildCatalogReferences(entries: CatalogEntry[]): CatalogReference[] {
  return entries
    .filter((entry) => entry.provenance !== "session_deleted")
    .filter((entry) => entry.name.trim().length > 0)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      module_category: entry.module_category,
      subtype: catalogSubtype(entry),
      access_protocol: entry.access_protocol ?? null,
      mcp_server: entry.mcp_server ?? null,
      mcp_tool_name: entry.mcp_tool_name ?? null,
      mcp_schema_ref: entry.mcp_schema_ref ?? null,
      mcp_auth_mode: entry.mcp_auth_mode ?? null,
      component_source: entry.component_source ?? null,
      package_name: entry.package_name ?? null,
      package_version: entry.package_version ?? null,
      import_path: entry.import_path ?? null,
      callable_name: entry.callable_name ?? null,
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
