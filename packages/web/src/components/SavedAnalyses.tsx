import type { SavedAnalysisRecord } from "../analyzer/savedAnalyses";

interface SavedAnalysesProps {
  records: SavedAnalysisRecord[];
  hasCurrentAnalysis: boolean;
  hasRunManifest: boolean;
  currentSavedId: string | null;
  actionMessage?: string;
  onSaveCurrent: () => void;
  onExportCurrent: () => void;
  onExportRunManifest: () => void;
  onLoad: (record: SavedAnalysisRecord) => void;
  onDelete: (id: string) => void;
}

export function SavedAnalyses({
  records,
  hasCurrentAnalysis,
  hasRunManifest,
  currentSavedId,
  actionMessage,
  onSaveCurrent,
  onExportCurrent,
  onExportRunManifest,
  onLoad,
  onDelete
}: SavedAnalysesProps) {
  return (
    <div className="stack">
      <section className="panel saved-analysis-panel">
        <div className="section-heading">
          <p className="eyebrow">Saved Analyses</p>
          <h2>저장된 분석</h2>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={onSaveCurrent} disabled={!hasCurrentAnalysis}>
            현재 분석 저장
          </button>
          <button type="button" onClick={onExportCurrent} disabled={!hasCurrentAnalysis}>
            analysis-result.json 내보내기
          </button>
          <button type="button" onClick={onExportRunManifest} disabled={!hasRunManifest}>
            af-run-manifest.json 내보내기
          </button>
          <span className="saved-analysis-count">{records.length}개 저장됨</span>
        </div>
        {actionMessage ? <p className="saved-analysis-message">{actionMessage}</p> : null}
      </section>

      <section className="saved-analysis-list" aria-label="저장된 분석 목록">
        {records.length ? (
          records.map((record) => (
            <article key={record.id} className="panel saved-analysis-card">
              <div>
                <p className="eyebrow">{formatSavedAt(record.savedAt)}</p>
                <h2>{record.title}</h2>
                <p>{record.analysis.normalizedRequirement.business_goal}</p>
              </div>
              <dl className="saved-analysis-meta">
                <div>
                  <dt>모듈</dt>
                  <dd>{record.moduleCandidates.length}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>{record.analysis.normalizedRequirement.status}</dd>
                </div>
                <div>
                  <dt>모델</dt>
                  <dd>{record.analyzerModel}</dd>
                </div>
              </dl>
              <div className="saved-analysis-actions">
                <button type="button" className="primary" onClick={() => onLoad(record)}>
                  열기
                </button>
                <button type="button" onClick={() => onDelete(record.id)}>
                  삭제
                </button>
                {currentSavedId === record.id ? <span className="tag">현재 열림</span> : null}
              </div>
            </article>
          ))
        ) : (
          <section className="panel empty-state">
            <p>아직 저장된 분석이 없습니다. 분석을 완료한 뒤 현재 분석 저장을 누르면 이 목록에 남습니다.</p>
          </section>
        )}
      </section>
    </div>
  );
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
