import StatusBadge from "./StatusBadge";

export default function SavedMocksPanel({
  mocks,
  selectedMockId,
  onSelectMock,
  onDeleteMock
}: {
  mocks: Array<{ mock_id: string; server_name: string; updated_at: string | null }>;
  selectedMockId: string;
  onSelectMock: (mockId: string) => void;
  onDeleteMock: (mockId: string) => void;
}) {
  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Saved Mocks</h2>
          <p>artifacts/mock-lab</p>
        </div>
        <StatusBadge tone="purple">{mocks.length}</StatusBadge>
      </div>

      <div className="saved-mock-list">
        {mocks.length ? (
          mocks.map((mock) => (
            <div
              className={`saved-mock-item ${mock.mock_id === selectedMockId ? "active" : ""}`}
              key={mock.mock_id}
            >
              <button className="saved-mock-select" type="button" onClick={() => onSelectMock(mock.mock_id)}>
                <span className="saved-mock-main">
                  <strong>{mock.mock_id}</strong>
                  <span>{mock.server_name}</span>
                </span>
              </button>
              <span className="saved-mock-actions">
                <span className="saved-mock-time">{formatUpdatedAt(mock.updated_at)}</span>
                <button
                  aria-label={`${mock.mock_id} 삭제`}
                  className="inline-x-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteMock(mock.mock_id);
                  }}
                >
                  x
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">저장된 Mock이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "no timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}
