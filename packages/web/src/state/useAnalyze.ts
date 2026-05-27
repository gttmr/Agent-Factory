import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalysisResult, AnalyzerProgressEvent, CodexAnalyzerModel } from "../analyzer/types";
import { normalizeAnalysisResultForWorkbench } from "../analyzer/analysisResultNormalization";
import { putArtifactJson } from "./apiClient";

export type AnalyzeStatus = "idle" | "running" | "completed" | "failed" | "timeout" | "aborted";

export interface AnalyzeCatalogEntry {
  id?: string;
  name: string;
  module_category: "agent" | "workflow" | "adapter" | "remote_a2a";
  subtype?: string | null;
  [key: string]: unknown;
}

export interface AnalyzeStartInput {
  rawText: string;
  domain: string;
  model: CodexAnalyzerModel;
  catalog: AnalyzeCatalogEntry[];
}

export function useAnalyze(reqId: string | undefined) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<AnalyzerProgressEvent[]>([]);
  const [status, setStatus] = useState<AnalyzeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setEvents([]);
    setStatus("idle");
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (input: AnalyzeStartInput) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      if (!input.rawText.trim()) throw new Error("원문 요구사항(raw_text)이 비어 있습니다.");
      setEvents([]);
      setStatus("running");
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/analyze-requirement", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({
            input: { domain: input.domain, rawText: input.rawText },
            model: input.model,
            catalog: input.catalog,
            streamProgress: true
          }),
          signal: controller.signal
        });
        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Codex 분석 요청 실패 (HTTP ${response.status})`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let terminalEvent: AnalyzerProgressEvent | null = null;
        let savedResult: AnalysisResult | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separatorIndex = buffer.indexOf("\n\n");
          while (separatorIndex !== -1) {
            const chunk = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);
            const parsed = parseSseChunk(chunk);
            if (parsed) {
              setEvents((prev) => [...prev, parsed]);
              if (
                parsed.phase === "completed" &&
                parsed.result &&
                typeof parsed.result === "object"
              ) {
                const normalized = normalizeAnalysisResultForWorkbench(parsed.result as AnalysisResult);
                await putArtifactJson(reqId, "analysis-result.json", normalized, null);
                savedResult = normalized;
                terminalEvent = parsed;
              } else if (parsed.phase === "failed" || parsed.phase === "timeout") {
                terminalEvent = parsed;
              }
            }
            separatorIndex = buffer.indexOf("\n\n");
          }
        }
        if (terminalEvent?.phase === "completed" && savedResult) {
          await queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
          await queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
          setStatus("completed");
        } else if (terminalEvent?.phase === "failed") {
          setStatus("failed");
          setError(terminalEvent.message);
        } else if (terminalEvent?.phase === "timeout") {
          setStatus("timeout");
          setError(terminalEvent.message);
        } else {
          setStatus("failed");
          setError("Codex CLI 가 종료 이벤트를 보내지 않고 스트림이 끊겼습니다.");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("aborted");
          return;
        }
        const message = err instanceof Error ? err.message : "Codex CLI 분석에 실패했습니다.";
        setStatus("failed");
        setError(message);
      } finally {
        abortRef.current = null;
      }
    },
    [reqId, queryClient]
  );

  return { events, status, error, start, abort, reset } as const;
}

function parseSseChunk(chunk: string): (AnalyzerProgressEvent & { result?: unknown }) | null {
  const lines = chunk.split("\n");
  let dataLine: string | null = null;
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
      break;
    }
  }
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine);
  } catch {
    return null;
  }
}
