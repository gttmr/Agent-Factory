import { useEffect, useMemo, useState } from "react";
import { deleteMock, fetchCatalogPrefill, fetchMockDetail, listMocks, createMock, saveMockSpec } from "./api/mockLabClient";
import AppShell from "./components/AppShell";
import CodexGeneratePanel from "./components/CodexGeneratePanel";
import MockServerPanel from "./components/MockServerPanel";
import MockSpecEditor from "./components/MockSpecEditor";
import SavedMocksPanel from "./components/SavedMocksPanel";
import SmokeTestPanel from "./components/SmokeTestPanel";
import StatusBadge from "./components/StatusBadge";
import { resolveCatalogPrefillSpec } from "./catalogPrefillSelection";
import { createEmptyMockSpec, type CatalogPrefillPayload, type MockServerStatus, type MockSpec } from "./types/mockSpec";
import { validateMockSpec } from "../server/schemaValidation";

interface MockListItem {
  mock_id: string;
  server_name: string;
  updated_at: string | null;
}

export default function App() {
  const [mocks, setMocks] = useState<MockListItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogPrefillPayload>({ entries: [], loaded_at: "", source_file: "" });
  const [spec, setSpec] = useState<MockSpec>(() => createEmptyMockSpec());
  const [serverStatus, setServerStatus] = useState<MockServerStatus | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savedSpecFingerprint, setSavedSpecFingerprint] = useState<string | null>(null);

  const validation = useMemo(() => validateMockSpec(spec), [spec]);
  const specFingerprint = useMemo(() => fingerprintMockSpec(spec), [spec]);
  const specDirty = savedSpecFingerprint !== specFingerprint;

  useEffect(() => {
    void refreshInitial();
  }, []);

  async function refreshInitial() {
    setLoading(true);
    try {
      const [nextCatalog, nextMocks] = await Promise.all([fetchCatalogPrefill(), listMocks()]);
      setCatalog(nextCatalog);
      setMocks(nextMocks);
      const requestedPrefill = resolveCatalogPrefillSpec(nextCatalog, readRequestedAdapterName());
      if (requestedPrefill) {
        const existing = nextMocks.find(
          (mock) => mock.mock_id === requestedPrefill.mock_id || mock.server_name === requestedPrefill.server_name
        );
        if (existing) {
          await loadMock(existing.mock_id);
        } else {
          setSpec(requestedPrefill);
          setServerStatus(null);
          setSavedSpecFingerprint(null);
          setMessage(`${requestedPrefill.mock_id} catalog prefill 불러옴`);
        }
        return;
      }
      if (nextMocks[0]) await loadMock(nextMocks[0].mock_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초기 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMock(mockId: string) {
    const detail = await fetchMockDetail(mockId);
    setSpec(detail.spec);
    setServerStatus(detail.server_status);
    setSavedSpecFingerprint(fingerprintMockSpec(detail.spec));
  }

  async function handleSave() {
    setLoading(true);
    try {
      await saveMockSpec(spec.mock_id, spec);
      setSavedSpecFingerprint(specFingerprint);
      setMessage("Mock spec 저장 완료");
      setMocks(await listMocks());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mock spec 저장 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const mockId = `mock-${Date.now().toString(36)}`;
    const created = await createMock(mockId);
    setSpec(created.spec);
    setSavedSpecFingerprint(fingerprintMockSpec(created.spec));
    setMocks(await listMocks());
    setMessage("새 Mock spec 생성 완료");
  }

  async function handleDeleteMock(mockId: string) {
    if (!window.confirm(`${mockId} mock server를 삭제할까요?`)) return;
    setLoading(true);
    try {
      await deleteMock(mockId);
      const nextMocks = await listMocks();
      setMocks(nextMocks);
      if (spec.mock_id === mockId) {
        if (nextMocks[0]) {
          await loadMock(nextMocks[0].mock_id);
        } else {
          const draft = createEmptyMockSpec(`mock-${Date.now().toString(36)}`);
          setSpec(draft);
          setServerStatus(null);
          setSavedSpecFingerprint(null);
        }
      }
      setMessage(`${mockId} 삭제 완료`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mock 삭제 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      header={
        <div className="afml-header">
          <div>
            <p className="eyebrow">Agent Factory</p>
            <h1>Mock Lab</h1>
          </div>
          <div className="header-actions">
            <StatusBadge tone={loading ? "warning" : validation.ok && specDirty ? "warning" : validation.ok ? "success" : "error"}>
              {loading ? "working" : validation.ok && specDirty ? "unsaved draft" : validation.ok ? "spec valid" : "spec invalid"}
            </StatusBadge>
            <button className="button secondary" type="button" onClick={handleCreate}>
              새 Mock
            </button>
          </div>
        </div>
      }
      catalog={
        <SavedMocksPanel
          mocks={mocks}
          selectedMockId={spec.mock_id}
          onSelectMock={(mockId) => void loadMock(mockId)}
          onDeleteMock={(mockId) => void handleDeleteMock(mockId)}
        />
      }
      editor={<MockSpecEditor catalog={catalog} spec={spec} validation={validation} onChange={setSpec} onSave={() => void handleSave()} />}
      generate={
        <CodexGeneratePanel
          mockId={spec.mock_id}
          specValid={validation.ok && !specDirty}
          blockedReason={validation.ok && specDirty ? "저장되지 않은 draft입니다. Mock spec 저장 후 생성할 수 있습니다." : undefined}
          onMessage={setMessage}
        />
      }
      server={
        <MockServerPanel
          mockId={spec.mock_id}
          status={serverStatus}
          onStatus={setServerStatus}
          onMessage={setMessage}
        />
      }
      smoke={<SmokeTestPanel mockId={spec.mock_id} onMessage={setMessage} />}
      footer={
        message ? (
          <div className="toast" role="status">
            <span>{message}</span>
            <button className="toast-close" type="button" aria-label="안내 메시지 닫기" onClick={() => setMessage("")}>
              x
            </button>
          </div>
        ) : null
      }
    />
  );
}

function fingerprintMockSpec(spec: MockSpec): string {
  return JSON.stringify(spec);
}

function readRequestedAdapterName(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("adapter");
}
