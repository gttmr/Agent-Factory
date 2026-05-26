import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useArtifactRoots } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import {
  AfApiError,
  createArtifactRoot,
  putArtifactJson,
  type ArtifactRootSummary
} from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: roots = [], isLoading, error: rootsError, refetch } = useArtifactRoots();
  const { entries: recent, touch, remove } = useRecentRoots();
  const queryClient = useQueryClient();
  const [requirementId, setRequirementId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (reqId?: string) => createArtifactRoot(reqId?.trim() || undefined),
    onSuccess: async (created) => {
      setMessage(`새 artifact root 생성: ${created.requirement_id}`);
      setRequirementId("");
      touch(created.requirement_id);
      await queryClient.invalidateQueries({ queryKey: ["af", "roots"] });
      navigate(`/af/${created.requirement_id}/analyze`);
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  });

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = parseAnalysisResultArtifact(text, file.name);
      const reqId = parsed.analysis.normalizedRequirement.id;
      if (!reqId) throw new Error("normalizedRequirement.id가 없습니다.");
      try {
        await createArtifactRoot(reqId);
      } catch (createError) {
        if (!(createError instanceof AfApiError) || createError.status !== 409) {
          throw createError;
        }
      }
      await putArtifactJson(reqId, "analysis-result.json", parsed.analysis, null);
      touch(reqId);
      setMessage(`Imported analysis-result.json → ${reqId}`);
      await queryClient.invalidateQueries({ queryKey: ["af", "roots"] });
      navigate(`/af/${reqId}/analyze`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import 실패");
    }
  }

  return (
    <div className="af-landing">
      <Panel>
        <SectionHeader
          eyebrow="Landing"
          title="Agent Factory Workbench"
          description="요구사항 단위로 정리된 artifact root를 선택하거나 새로 만드세요. 각 root는 analyze → design → build → verify 4 단계의 산출물을 담습니다."
        />

        <div className="af-landing-grid">
          <Panel tone="muted">
            <SectionHeader title="새 artifact root 만들기" />
            <div className="af-landing-form">
              <label className="ui-field">
                <span>requirement_id (선택, 비우면 자동 부여)</span>
                <input
                  type="text"
                  value={requirementId}
                  onChange={(event) => setRequirementId(event.target.value)}
                  placeholder="예: req-001"
                  pattern="[a-z0-9][a-z0-9_-]{0,63}"
                />
                <small>소문자 영문/숫자/하이픈/언더스코어. 최대 64자.</small>
              </label>
              <div className="af-landing-form-actions">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => createMutation.mutate(requirementId)}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "생성 중…" : "Artifact root 생성"}
                </Button>
                <label className="ui-button ui-button-secondary af-import-button">
                  분석 결과 import…
                  <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
                </label>
              </div>
              {message ? <p className="af-landing-message">{message}</p> : null}
              {importError ? <p className="af-landing-error">Import 실패: {importError}</p> : null}
            </div>
          </Panel>

          <Panel tone="muted">
            <SectionHeader
              title="최근 root"
              description="브라우저 localStorage에 캐시된 최근 열어본 root입니다."
            />
            {recent.length === 0 ? (
              <EmptyState title="최근 기록 없음" description="root를 한 번 열면 여기에 표시됩니다." />
            ) : (
              <ul className="af-recent-list">
                {recent.map((entry) => (
                  <li key={entry.requirement_id}>
                    <Link to={`/af/${entry.requirement_id}/analyze`} onClick={() => touch(entry.requirement_id)}>
                      {entry.requirement_id}
                    </Link>
                    <span className="af-recent-time">{new Date(entry.last_opened).toLocaleString()}</span>
                    <button
                      type="button"
                      className="af-recent-remove"
                      aria-label={`${entry.requirement_id} 최근 기록 삭제`}
                      onClick={() => remove(entry.requirement_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title="저장된 artifact root"
          description={`artifacts/af/ 디렉터리에서 읽어옵니다. (${roots.length}개)`}
          action={
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              새로고침
            </Button>
          }
        />
        {isLoading ? (
          <p className="af-landing-message">목록 불러오는 중…</p>
        ) : rootsError ? (
          <p className="af-landing-error">목록 조회 실패: {(rootsError as Error).message}</p>
        ) : roots.length === 0 ? (
          <EmptyState
            title="아직 artifact root가 없습니다"
            description="위에서 새로 만들거나 분석 결과를 import 하세요."
          />
        ) : (
          <table className="af-root-table">
            <thead>
              <tr>
                <th scope="col">requirement_id</th>
                <th scope="col">단계</th>
                <th scope="col">승인</th>
                <th scope="col">갱신</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {roots.map((root) => (
                <RootRow key={root.requirement_id} root={root} onOpen={() => touch(root.requirement_id)} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function RootRow({ root, onOpen }: { root: ArtifactRootSummary; onOpen: () => void }) {
  const approvalCount = Object.values(root.approvals).filter(Boolean).length;
  return (
    <tr>
      <td>
        <code>{root.requirement_id}</code>
      </td>
      <td>{root.current_stage}</td>
      <td>
        {approvalCount} / 4
      </td>
      <td>{new Date(root.updated_at).toLocaleString()}</td>
      <td>
        <Link className="ui-button ui-button-ghost" to={`/af/${root.requirement_id}/analyze`} onClick={onOpen}>
          열기
        </Link>
      </td>
    </tr>
  );
}
