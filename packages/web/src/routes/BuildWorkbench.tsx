import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useApprovalGate } from "../state/useApprovalGate";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import {
  useBuildRuntimeStub,
  useRuntimeStub,
  useSaveScaffoldPlan,
  useScaffoldPlan,
  fetchRuntimeStubFile
} from "../state/useScaffoldPlan";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { buildScaffoldPlan } from "../analyzer/scaffoldPlan";
import type { CatalogEntry } from "../catalog/types";
import { loadSeedCatalog } from "../catalog/seed";

export default function BuildWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const navigate = useNavigate();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData } = useArtifactRoot(reqId);
  const { data: analysisData } = useAnalysisArtifact(reqId);
  const { data: scaffoldPlan, isLoading: scaffoldLoading } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const saveScaffold = useSaveScaffoldPlan(reqId);
  const buildStub = useBuildRuntimeStub(reqId);
  const approvalMutation = useApprovalGate(reqId);
  const handoffArtifact = useTextArtifact(reqId, "implementation-handoff.md");
  const saveHandoff = useSaveTextArtifact(reqId, "implementation-handoff.md");

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [handoffDraft, setHandoffDraft] = useState<string>("");
  const [handoffDirty, setHandoffDirty] = useState(false);

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;

  // catalog for buildScaffoldPlan
  const catalog = useQuery<CatalogEntry[]>({
    queryKey: ["af", "catalog-seed"] as const,
    queryFn: async () => loadSeedCatalog()
  });
  const catalogEntries = catalog.data ?? [];

  const generatedPlan = useMemo(() => {
    if (!analysis || !analysis.processFlow) return null;
    return buildScaffoldPlan({
      normalizedRequirement: analysis.normalizedRequirement,
      moduleCandidates: analysis.moduleCandidates,
      processFlow: analysis.processFlow,
      catalogEntries,
      runtimeContracts: analysis.runtimeContracts ?? []
    });
  }, [analysis, catalogEntries]);

  useEffect(() => {
    if (!handoffDirty && handoffArtifact.data) setHandoffDraft(handoffArtifact.data.content);
  }, [handoffArtifact.data, handoffDirty]);

  const filePreview = useQuery<string>({
    queryKey: ["af", reqId, "runtime-stub", "files", previewPath] as const,
    queryFn: async () => {
      if (!reqId || !previewPath) return "";
      return await fetchRuntimeStubFile(reqId, previewPath);
    },
    enabled: Boolean(reqId && previewPath)
  });

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  const boundariesApproved = manifest?.approvals.boundaries_approved ?? false;
  const runtimeApproved = manifest?.approvals.runtime_contracts_approved ?? false;
  const designGatesReady = boundariesApproved && runtimeApproved;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;
  const stubReady = (runtimeStub?.files?.length ?? 0) > 0;

  function handleSavePlan() {
    if (!generatedPlan) return;
    saveScaffold.mutate(generatedPlan, {
      onSuccess: () => setActionMessage("scaffold-plan.json 저장 완료"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "저장 실패")
    });
  }

  function handleBuildStub() {
    buildStub.mutate(undefined, {
      onSuccess: (result) =>
        setActionMessage(
          result.ok
            ? `runtime-stub 생성 완료 (${result.files.length} 파일)`
            : `runtime-stub 생성 실패 (exit ${result.exit_code ?? "?"})`
        ),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "runtime-stub 생성 실패")
    });
  }

  function handleToggleStubReady() {
    if (!manifest) return;
    approvalMutation.mutate(
      {
        gate: "stub_ready_for_followup",
        value: !manifest.approvals.stub_ready_for_followup,
        etag: manifestEtag
      },
      {
        onSuccess: () => setActionMessage("stub_ready_for_followup 갱신 완료"),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "갱신 실패")
      }
    );
  }

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

  const blockers = scaffoldPlan?.validation?.blockers ?? generatedPlan?.validation?.blockers ?? [];
  const warnings = scaffoldPlan?.validation?.warnings ?? generatedPlan?.validation?.warnings ?? [];

  return (
    <div className="af-stage-workspace">
      <Panel>
        <SectionHeader
          eyebrow={`af-build-runtime-stub · ${reqId}`}
          title="Runtime stub 생성"
          description="boundaries_approved 와 runtime_contracts_approved 가 모두 켜져 있어야 scaffold-plan 생성과 stub build 가 활성화됩니다. 원문 요구사항에서 직접 코드를 만들지 않습니다 — 승인된 scaffold-plan 만 입력으로 사용합니다."
          action={
            <div className="af-action-row">
              <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/design`}>Design 으로</Link>
              <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/verify`}>Verify 로</Link>
            </div>
          }
        />
        {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
        {!designGatesReady ? (
          <p className="af-landing-error">
            게이트 미충족: boundaries_approved={boundariesApproved ? "예" : "아니오"}, runtime_contracts_approved={runtimeApproved ? "예" : "아니오"}.
            Design 단계에서 게이트를 먼저 통과시키세요.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader
          title="Scaffold plan"
          description="approved 상태 모듈과 승인된 runtime contract 만 포함됩니다. blockers 가 비어 있어야 runtime-stub 생성이 가능합니다."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!generatedPlan || !designGatesReady || saveScaffold.isPending}
              onClick={handleSavePlan}
            >
              {saveScaffold.isPending ? "저장 중…" : scaffoldPlan ? "scaffold-plan 재생성" : "scaffold-plan 생성"}
            </Button>
          }
        />
        {scaffoldLoading ? <p className="af-landing-message">scaffold-plan 불러오는 중…</p> : null}
        {!generatedPlan ? (
          <EmptyState
            title="분석 결과가 없습니다"
            description="Analyze 단계에서 analysis-result.json 을 먼저 import 하세요."
          />
        ) : (
          <ul className="af-gate-summary">
            <li>모듈 후보 → 승인된 모듈 {generatedPlan.modules.length}개 / 제외 {generatedPlan.excluded_modules.length}개</li>
            <li>런타임 계약 {generatedPlan.runtime_contracts.length}개</li>
            <li>can_generate_source: {generatedPlan.validation.can_generate_source ? "예" : "아니오"}</li>
            <li>blockers: {generatedPlan.validation.blockers.length}건, warnings: {generatedPlan.validation.warnings.length}건</li>
          </ul>
        )}
        {blockers.length > 0 ? (
          <details open className="af-blocker-list">
            <summary>blockers ({blockers.length})</summary>
            <ul>
              {blockers.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {warnings.length > 0 ? (
          <details className="af-blocker-list">
            <summary>warnings ({warnings.length})</summary>
            <ul>
              {warnings.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {scaffoldPlan ? (
          <details className="af-blocker-list">
            <summary>scaffold-plan.json 상세</summary>
            <pre>{JSON.stringify(scaffoldPlan, null, 2)}</pre>
          </details>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader
          title="Runtime stub"
          description="scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 ADK 2.0 stub 을 생성합니다. business logic 은 TODO 로만 남습니다."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!planReady || !designGatesReady || buildStub.isPending}
              onClick={handleBuildStub}
            >
              {buildStub.isPending ? "생성 중…" : stubReady ? "runtime-stub 재생성" : "runtime-stub 생성"}
            </Button>
          }
        />
        {!stubReady ? (
          <EmptyState title="아직 runtime-stub 이 없습니다" description="scaffold-plan 을 저장한 뒤 위 버튼으로 생성하세요." />
        ) : (
          <div className="af-build-stub-grid">
            <ul className="af-build-file-list">
              {runtimeStub!.files.map((file) => (
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
              {previewPath ? (
                filePreview.isLoading ? (
                  <p className="af-landing-message">파일 불러오는 중…</p>
                ) : filePreview.error ? (
                  <p className="af-landing-error">{(filePreview.error as Error).message}</p>
                ) : (
                  <pre>{filePreview.data}</pre>
                )
              ) : (
                <p className="af-landing-message">왼쪽에서 파일을 선택하세요.</p>
              )}
            </div>
          </div>
        )}
        {buildStub.data?.stdout ? (
          <details className="af-blocker-list">
            <summary>generate-adk-source stdout</summary>
            <pre>{buildStub.data.stdout}</pre>
          </details>
        ) : null}
        {buildStub.data?.stderr ? (
          <details className="af-blocker-list">
            <summary>generate-adk-source stderr</summary>
            <pre>{buildStub.data.stderr}</pre>
          </details>
        ) : null}
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
          rows={10}
          className="af-markdown-editor"
          placeholder="# Implementation handoff&#10;&#10;- [ ] 모듈 A 의 runtime wiring …"
        />
      </Panel>

      {manifest ? (
        <Panel tone="muted">
          <SectionHeader
            title="Gate: stub_ready_for_followup"
            description={
              stubReady
                ? "runtime-stub 파일이 존재합니다. 후속 작업으로 인계할 준비가 되었다면 토글하세요."
                : "runtime-stub 을 먼저 생성해야 합니다."
            }
            action={
              <Button
                type="button"
                variant={manifest.approvals.stub_ready_for_followup ? "secondary" : "primary"}
                onClick={handleToggleStubReady}
                disabled={approvalMutation.isPending || (!manifest.approvals.stub_ready_for_followup && !stubReady)}
              >
                {approvalMutation.isPending
                  ? "갱신 중…"
                  : manifest.approvals.stub_ready_for_followup
                    ? "준비 표시 해제"
                    : "후속 인계 준비 완료"}
              </Button>
            }
          />
          <ul className="af-gate-summary">
            <li>boundaries_approved: {boundariesApproved ? "예" : "아니오"}</li>
            <li>runtime_contracts_approved: {runtimeApproved ? "예" : "아니오"}</li>
            <li>scaffold-plan can_generate_source: {planReady ? "예" : "아니오"}</li>
            <li>runtime-stub 파일: {runtimeStub?.files.length ?? 0}개</li>
          </ul>
          <div className="af-action-row">
            <Button type="button" variant="ghost" onClick={() => navigate(`/af/${reqId}/verify`)}>
              Verify 워크벤치로 이동
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
