import { legacyStageToGraphIR } from "./graphMigration";
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
    return parsed.filter(isSavedAnalysisRecord).slice(0, MAX_RECORDS).map(backfillAnalysisShape);
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
  const isLegacyShape =
    flow !== null &&
    typeof flow === "object" &&
    !Array.isArray(flow) &&
    (!Array.isArray((flow as { containers?: unknown }).containers) ||
      !Array.isArray((flow as { lanes?: unknown }).lanes));
  if (!isLegacyShape) return withContracts;
  const requirementId =
    (analysis as { normalizedRequirement?: { id?: string } }).normalizedRequirement?.id ?? "req-001";
  const migrated = legacyStageToGraphIR(flow, requirementId);
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

function isSavedAnalysisRecord(value: unknown): value is SavedAnalysisRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SavedAnalysisRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.savedAt === "string" &&
    Boolean(record.input) &&
    Boolean(record.analysis) &&
    Array.isArray(record.moduleCandidates) &&
    Array.isArray(record.acceptedMissing) &&
    typeof record.analyzerModel === "string"
  );
}
