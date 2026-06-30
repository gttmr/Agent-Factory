import { useMemo, useState } from "react";
import type { LocalA2AProviderImport } from "../analyzer/localA2aProvider";
import { useArtifactRoots } from "../state/useArtifactRoot";
import { fetchRuntimeA2aAgentCard } from "../state/useRuntimeA2a";
import { Button, Field } from "../ui/primitives";

interface LocalA2AProviderImportProps {
  currentReqId: string;
  saving: boolean;
  onImport: (provider: LocalA2AProviderImport) => void;
}

export function LocalA2AProviderImport({ currentReqId, saving, onImport }: LocalA2AProviderImportProps) {
  const { data: roots = [], isLoading } = useArtifactRoots();
  const options = useMemo(
    () => roots.filter((root) => root.requirement_id !== currentReqId && root.approvals.stub_ready_for_followup),
    [currentReqId, roots]
  );
  const [providerReqId, setProviderReqId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = providerReqId || options[0]?.requirement_id || "";

  async function handleImport() {
    if (!selected) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await fetchRuntimeA2aAgentCard(selected);
      onImport({
        providerReqId: result.provider_req_id,
        appName: result.app_name,
        agentCardUrl: result.agent_card_url,
        rpcUrl: result.rpc_url,
        card: result.card
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent Card 불러오기 실패");
    } finally {
      setPending(false);
    }
  }

  if (isLoading) return <p className="af-design-empty">Local A2A provider 목록을 불러오는 중입니다.</p>;
  if (!options.length) {
    return <p className="af-design-empty">등록 가능한 local A2A provider artifact 가 없습니다. Build 단계에서 runtime-stub 을 먼저 생성하세요.</p>;
  }

  return (
    <div className="af-a2a-provider-import">
      <Field label="local provider artifact">
        <select value={selected} onChange={(event) => setProviderReqId(event.target.value)} disabled={saving || pending}>
          {options.map((root) => (
            <option key={root.requirement_id} value={root.requirement_id}>
              {root.requirement_id}
            </option>
          ))}
        </select>
      </Field>
      <Button type="button" variant="secondary" disabled={saving || pending || !selected} onClick={handleImport}>
        {pending ? "불러오는 중…" : "Agent Card 불러오기"}
      </Button>
      {message ? <p className="af-landing-error">{message}</p> : null}
    </div>
  );
}
