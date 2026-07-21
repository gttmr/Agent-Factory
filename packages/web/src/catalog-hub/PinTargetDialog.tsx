import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/primitives";
import { CategoryBadge } from "../components/CategoryBadge";
import { AfApiError, fetchArtifactJson, putArtifactJson } from "../state/apiClient";
import type { CatalogHubEntry } from "../catalog/catalogIndex";
import type { AnalysisResult } from "../analyzer/types";
import { applyCatalogPin, catalogEntryAssetType, isCatalogPinCompatible } from "../catalog/catalogPin";

interface PinTargetDialogProps {
  reqId: string;
  entry: CatalogHubEntry;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function PinTargetDialog({ reqId, entry, onClose, onSaved }: PinTargetDialogProps) {
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<{ data: AnalysisResult; etag: string | null } | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchArtifactJson<AnalysisResult>(reqId, "analysis-result.json")
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError("activeroot 에 analysis-result.json 이 없습니다. Analyze 단계에서 import 하세요.");
          return;
        }
        setAnalysis({ data: result.data, etag: result.etag });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "분석 결과를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [reqId]);

  const entryAssetType = catalogEntryAssetType(entry);
  const candidates = (analysis?.data.assetCandidates ?? []).filter((candidate) =>
    isCatalogPinCompatible(candidate, entry)
  );

  async function handlePin() {
    if (!analysis || !selectedAssetId) return;
    setIsPending(true);
    setError(null);
    try {
      const next = applyCatalogPin(analysis.data, selectedAssetId, entry);
      await putArtifactJson(reqId, "analysis-result.json", next, analysis.etag);
      await queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
      onSaved(`${entry.name} 을 ${selectedAssetId} 에 바인딩했습니다.`);
      onClose();
    } catch (err) {
      setError(err instanceof AfApiError ? err.message : err instanceof Error ? err.message : "핀 저장 실패");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="af-modal-backdrop" role="dialog" aria-modal="true" aria-label="catalog 항목 핀 대상 선택">
      <div className="af-modal">
        <header className="af-modal-header">
          <h2>
            {entry.name} 을 {reqId} 의 자산 후보에 바인딩
          </h2>
          <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="af-modal-body">
          {error ? <p className="af-landing-error">{error}</p> : null}
          {!analysis && !error ? <p className="af-landing-message">분석 결과 불러오는 중…</p> : null}
          {analysis && candidates.length === 0 ? (
            <p className="af-landing-message">
              현재 root에 asset_type={entryAssetType}인 후보가 없습니다. Analyze/Design에서 후보를 먼저 만들어야 합니다.
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <ul className="af-pin-list">
              {candidates.map((candidate) => (
                <li key={candidate.asset_id}>
                  <label className="af-pin-row">
                    <input
                      type="radio"
                      name="pin-target"
                      value={candidate.asset_id}
                      checked={selectedAssetId === candidate.asset_id}
                      onChange={() => setSelectedAssetId(candidate.asset_id)}
                    />
                    <span className="af-pin-row-header">
                      <CategoryBadge category={candidate.asset_type} />
                      <strong>{candidate.name}</strong>
                      <code>{candidate.asset_id}</code>
                    </span>
                    <small>
                      status: {candidate.status}
                      {candidate.catalog_entry_id ? ` · 현재 바인딩: ${candidate.catalog_entry_id}` : ""}
                    </small>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <footer className="af-modal-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="button" variant="primary" onClick={handlePin} disabled={!selectedAssetId || isPending}>
            {isPending ? "저장 중…" : "바인딩 저장"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
