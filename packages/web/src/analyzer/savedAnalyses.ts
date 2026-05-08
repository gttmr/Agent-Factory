import { normalizeGraphIRForRuntime } from "./graphMigration";
import type {
  AnalysisResult,
  CodexAnalyzerModel,
  ModuleCandidate,
  RequirementIntakeInput
} from "./types";

const STORAGE_KEY = "agent-factory.saved-analyses.v1";
const MAX_RECORDS = 50;

export interface SavedAnalysisRecord {
  id: string;
  title: string;
  savedAt: string;
  input: RequirementIntakeInput;
  analysis: AnalysisResult;
  moduleCandidates: ModuleCandidate[];
  acceptedMissing: string[];
  analyzerModel: CodexAnalyzerModel;
}

export function loadSavedAnalyses(): SavedAnalysisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(normalizeSavedAnalysisRecord).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

// Older saved records pre-date the a2aContracts field. Default to an empty
// array on load so they satisfy the AnalysisResult type.
function backfillA2AContracts(record: SavedAnalysisRecord): SavedAnalysisRecord {
  if (record.analysis && !Array.isArray((record.analysis as { a2aContracts?: unknown }).a2aContracts)) {
    return {
      ...record,
      analysis: { ...record.analysis, a2aContracts: [] }
    };
  }
  return record;
}

// Older saved records also pre-date the GraphIR shape on processFlow. If the
// stored shape is a legacy stage flow (no `containers`/`lanes` arrays), run
// the migration adapter so the workbench can render it without crashing.
export function backfillAnalysisShape(record: SavedAnalysisRecord): SavedAnalysisRecord {
  const withContracts = backfillA2AContracts(record);
  const analysis = withContracts.analysis as AnalysisResult | undefined;
  if (!analysis) return withContracts;
  const flow = (analysis as { processFlow?: unknown }).processFlow;
  const requirementId =
    (analysis as { normalizedRequirement?: { id?: string } }).normalizedRequirement?.id ?? "req-001";
  const migrated = normalizeGraphIRForRuntime(flow, requirementId);
  return {
    ...withContracts,
    analysis: { ...analysis, processFlow: migrated }
  };
}

export function upsertSavedAnalysis(record: SavedAnalysisRecord): SavedAnalysisRecord[] {
  const current = loadSavedAnalyses();
  const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, MAX_RECORDS);
  persistSavedAnalyses(next);
  return next;
}

export function deleteSavedAnalysis(id: string): SavedAnalysisRecord[] {
  const next = loadSavedAnalyses().filter((item) => item.id !== id);
  persistSavedAnalyses(next);
  return next;
}

export function createSavedAnalysisId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function persistSavedAnalyses(records: SavedAnalysisRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeSavedAnalysisRecord(value: unknown): SavedAnalysisRecord[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Partial<SavedAnalysisRecord>;
  const valid =
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.savedAt === "string" &&
    Boolean(record.input) &&
    Boolean(record.analysis) &&
    Array.isArray(record.acceptedMissing) &&
    typeof record.analyzerModel === "string";
  if (!valid) return [];
  const analysis = record.analysis as AnalysisResult;
  const moduleCandidates = Array.isArray(record.moduleCandidates)
    ? record.moduleCandidates
    : Array.isArray((analysis as { moduleCandidates?: unknown }).moduleCandidates)
      ? ((analysis as { moduleCandidates: ModuleCandidate[] }).moduleCandidates)
      : [];
  return [
    backfillAnalysisShape({
      id: record.id as string,
      title: record.title as string,
      savedAt: record.savedAt as string,
      input: record.input as RequirementIntakeInput,
      analysis,
      moduleCandidates,
      acceptedMissing: record.acceptedMissing as string[],
      analyzerModel: record.analyzerModel as CodexAnalyzerModel
    })
  ];
}
