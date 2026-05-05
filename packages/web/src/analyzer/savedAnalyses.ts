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
    return parsed.filter(isSavedAnalysisRecord).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
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
