import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import { Button } from "../ui/primitives";
import { AfApiError } from "../state/apiClient";

interface RegisterProposalDrawerProps {
  reqId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const CATEGORY_OPTIONS = ["agent", "workflow", "adapter", "remote_a2a"] as const;

export function RegisterProposalDrawer({ reqId, onClose, onSaved }: RegisterProposalDrawerProps) {
  const queryClient = useQueryClient();
  const [existing, setExisting] = useState<{ content: string; etag: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("adapter");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/af/${encodeURIComponent(reqId)}/catalog-delta.yaml`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 404) {
          setExisting({ content: "", etag: null });
          return;
        }
        if (!response.ok) {
          throw new AfApiError(response.status, "catalog-delta 조회 실패");
        }
        const content = await response.text();
        setExisting({ content, etag: response.headers.get("etag") });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "catalog-delta 조회 실패");
      });
    return () => {
      cancelled = true;
    };
  }, [reqId]);

  async function handleSave() {
    if (!name.trim()) {
      setError("name 은 필수입니다.");
      return;
    }
    if (!existing) return;
    setError(null);
    setIsPending(true);
    try {
      const proposal = {
        category,
        name: name.trim(),
        ...(owner.trim() ? { owner_domain: owner.trim() } : {}),
        ...(responsibility.trim() ? { responsibility: responsibility.trim() } : {}),
        ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
        proposed_by: "reuse_hub",
        proposed_at: new Date().toISOString()
      };
      const next = appendProposal(existing.content, proposal);
      const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
      if (existing.etag) headers["If-Match"] = existing.etag;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/catalog-delta.yaml`, {
        method: "PUT",
        headers,
        body: next
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({ error: "catalog-delta 저장 실패" }))) as {
          error?: string;
        };
        throw new AfApiError(response.status, body.error ?? "catalog-delta 저장 실패");
      }
      await queryClient.invalidateQueries({ queryKey: ["af", reqId, "catalog-delta.yaml"] });
      onSaved(`${name.trim()} 을 catalog-delta.yaml 에 제안으로 추가했습니다.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "catalog-delta 저장 실패");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <aside className="af-drawer" role="dialog" aria-modal="true" aria-label="신규 catalog 등록 제안">
      <header className="af-drawer-header">
        <h2>신규 catalog 등록 제안</h2>
        <button type="button" className="af-modal-close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="af-drawer-body">
        <p className="af-drawer-hint">
          catalog/*.yaml 은 직접 편집하지 않습니다. 이 제안은 활성 root 의 <code>catalog-delta.yaml</code> 에만 기록되며,
          이후 Reuse Hub 의 등록 승인 흐름에서 검토자가 versioned catalog entry 로 publish 합니다.
        </p>
        {error ? <p className="af-landing-error">{error}</p> : null}
        <label className="ui-field">
          <span>category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>name (catalog id 로 사용 권장)</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: loan_doc_review_agent" />
        </label>
        <label className="ui-field">
          <span>owner_domain</span>
          <input type="text" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="예: 여신" />
        </label>
        <label className="ui-field">
          <span>responsibility</span>
          <textarea value={responsibility} onChange={(event) => setResponsibility(event.target.value)} rows={3} />
        </label>
        <label className="ui-field">
          <span>rationale (왜 등록이 필요한가)</span>
          <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} />
        </label>
      </div>
      <footer className="af-drawer-footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={isPending || !existing}>
          {isPending ? "저장 중…" : "catalog-delta 에 추가"}
        </Button>
      </footer>
    </aside>
  );
}

function appendProposal(existing: string, proposal: Record<string, unknown>): string {
  let parsed: unknown = {};
  if (existing.trim()) {
    try {
      parsed = parseYaml(existing);
    } catch (error) {
      throw new Error(`catalog-delta.yaml 파싱 실패: ${error instanceof Error ? error.message : "YAML 오류"}`);
    }
  }
  if (parsed === null || parsed === undefined) parsed = {};
  if (!isRecord(parsed)) {
    throw new Error("catalog-delta.yaml 은 YAML 객체여야 합니다.");
  }
  const additions = parsed.proposed_additions;
  if (additions !== undefined && !Array.isArray(additions)) {
    throw new Error("proposed_additions 는 배열이어야 합니다.");
  }
  parsed.proposed_additions = [...(Array.isArray(additions) ? additions : []), proposal];
  return dumpYaml(parsed, { lineWidth: -1, noRefs: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
