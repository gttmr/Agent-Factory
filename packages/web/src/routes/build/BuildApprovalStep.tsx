import { useState } from "react";
import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";
import { useApprovalGate } from "../../state/useApprovalGate";
import { useArtifactRoot } from "../../state/useArtifactRoot";
import { useRuntimeStub, useScaffoldPlan } from "../../state/useScaffoldPlan";

interface BuildApprovalStepProps {
  readonly reqId: string;
}

export function BuildApprovalStep({ reqId }: BuildApprovalStepProps) {
  const { data: manifestData } = useArtifactRoot(reqId);
  const { data: scaffoldPlan } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const approvalMutation = useApprovalGate(reqId);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const manifest = manifestData?.manifest;
  const stubReady = (runtimeStub?.files ?? []).length > 0;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;

  if (!manifest) {
    return (
      <Panel>
        <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
      </Panel>
    );
  }

  const currentManifest = manifest;
  const boundariesApproved = currentManifest.approvals.boundaries_approved;
  const runtimeApproved = currentManifest.approvals.runtime_contracts_approved;

  function handleToggleStubReady() {
    approvalMutation.mutate(
      {
        gate: "stub_ready_for_followup",
        value: !currentManifest.approvals.stub_ready_for_followup,
        etag: manifestData?.etag ?? null
      },
      {
        onSuccess: () => setActionMessage("stub_ready_for_followup 갱신 완료"),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "갱신 실패")
      }
    );
  }

  return (
    <>
      {actionMessage ? <ApprovalNotice message={actionMessage} /> : null}
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
              variant={currentManifest.approvals.stub_ready_for_followup ? "secondary" : "primary"}
              onClick={handleToggleStubReady}
              disabled={approvalMutation.isPending || (!currentManifest.approvals.stub_ready_for_followup && !stubReady)}
            >
              {approvalMutation.isPending
                ? "갱신 중…"
                : currentManifest.approvals.stub_ready_for_followup
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
      </Panel>
    </>
  );
}

function ApprovalNotice({ message }: { readonly message: string }) {
  return (
    <div className="af-stage-notice" role="status">
      <span>{message}</span>
    </div>
  );
}
