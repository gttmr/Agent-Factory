import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";
import { fetchRuntimeStubFile, useRuntimeStub } from "../../state/useScaffoldPlan";
import { useSaveTextArtifact, useTextArtifact } from "../../state/useTextArtifact";

interface BuildReviewStepProps {
  readonly reqId: string;
}

export function BuildReviewStep({ reqId }: BuildReviewStepProps) {
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const handoffArtifact = useTextArtifact(reqId, "implementation-handoff.md");
  const saveHandoff = useSaveTextArtifact(reqId, "implementation-handoff.md");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [handoffDraft, setHandoffDraft] = useState("");
  const [handoffDirty, setHandoffDirty] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const runtimeStubFiles = runtimeStub?.files ?? [];
  const stubReady = runtimeStubFiles.length > 0;

  useEffect(() => {
    if (!handoffDirty && handoffArtifact.data) setHandoffDraft(handoffArtifact.data.content);
  }, [handoffArtifact.data, handoffDirty]);

  const filePreview = useQuery<string>({
    queryKey: ["af", reqId, "runtime-stub", "files", previewPath] as const,
    queryFn: async () => {
      if (!previewPath) return "";
      return await fetchRuntimeStubFile(reqId, previewPath);
    },
    enabled: Boolean(previewPath)
  });

  function handleSaveHandoff() {
    saveHandoff.mutate(
      { content: handoffDraft, etag: handoffArtifact.data?.etag ?? null },
      {
        onSuccess: () => {
          setActionMessage("implementation-handoff.md 저장 완료");
          setHandoffDirty(false);
        },
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "implementation-handoff.md 저장 실패")
      }
    );
  }

  return (
    <>
      {actionMessage ? <ReviewNotice message={actionMessage} /> : null}
      <Panel>
        <SectionHeader title="Runtime stub 파일" description="생성된 stub 파일을 열어 ADK Workflow·Tool 연결·테스트 구성을 확인하세요." />
        {!stubReady ? (
          <EmptyState title="아직 runtime-stub 이 없습니다" description="‘1. 실행’에서 scaffold-plan 저장 후 stub 을 생성하세요." />
        ) : (
          <div className="af-build-stub-grid">
            <ul className="af-build-file-list">
              {runtimeStubFiles.map((file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    className={`af-build-file-button${previewPath === file.path ? " af-build-file-button-active" : ""}`}
                    onClick={() => setPreviewPath(file.path)}
                  >
                    <code>{file.path}</code>
                    <small>{file.bytes.toLocaleString()} bytes</small>
                  </button>
                </li>
              ))}
            </ul>
            <div className="af-build-file-preview">
              <RuntimeStubPreview previewPath={previewPath} filePreview={filePreview} />
            </div>
          </div>
        )}
      </Panel>
      <Panel>
        <SectionHeader
          title="implementation-handoff.md"
          description="다음 구현자가 받아야 할 TODO 목록과 범위 밖 항목을 markdown 으로 정리하세요."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={saveHandoff.isPending || !handoffDirty}
              onClick={handleSaveHandoff}
            >
              {saveHandoff.isPending ? "저장 중…" : "저장"}
            </Button>
          }
        />
        <textarea
          value={handoffDraft}
          onChange={(event) => {
            setHandoffDraft(event.target.value);
            setHandoffDirty(true);
          }}
          rows={12}
          className="af-markdown-editor"
          placeholder="# Implementation handoff&#10;&#10;- [ ] 모듈 A 의 runtime wiring …"
        />
      </Panel>
    </>
  );
}

function RuntimeStubPreview({
  filePreview,
  previewPath
}: {
  readonly filePreview: ReturnType<typeof useQuery<string>>;
  readonly previewPath: string | null;
}) {
  if (!previewPath) return <p className="af-landing-message">왼쪽에서 파일을 선택하세요.</p>;
  if (filePreview.isLoading) return <p className="af-landing-message">파일 불러오는 중…</p>;
  if (filePreview.error) {
    return <p className="af-landing-error">{filePreview.error instanceof Error ? filePreview.error.message : "파일 조회 실패"}</p>;
  }
  return <pre>{filePreview.data}</pre>;
}

function ReviewNotice({ message }: { readonly message: string }) {
  return (
    <div className="af-stage-notice" role="status">
      <span>{message}</span>
    </div>
  );
}
