export function resolveAnalyzeRawText(draftText: string, fallbackRawText: string): string {
  const trimmedDraft = draftText.trim();
  if (trimmedDraft) return trimmedDraft;
  return fallbackRawText.trim();
}
