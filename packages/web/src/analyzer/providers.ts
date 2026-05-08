import type {
  AnalysisResult,
  AnalyzerProgressEvent,
  CatalogReference,
  CodexAnalyzerModel,
  RequirementIntakeInput
} from "./types";
import { normalizeA2A } from "./a2aNormalize";

export interface AnalyzerRunOptions {
  model: CodexAnalyzerModel;
  catalog?: CatalogReference[];
  onProgress?: (event: AnalyzerProgressEvent) => void;
}

export interface AnalyzerProvider {
  readonly id: string;
  readonly label: string;
  analyze(input: RequirementIntakeInput, options: AnalyzerRunOptions): Promise<AnalysisResult>;
}

export interface OpenAICompatibleAnalyzerOptions {
  endpoint?: "/api/analyze-requirement";
}

export class OpenAICompatibleAnalyzerProvider implements AnalyzerProvider {
  readonly id = "codex-cli-live-analyzer";
  readonly label = "Codex CLI live analyzer";
  readonly options: OpenAICompatibleAnalyzerOptions;

  constructor(options: OpenAICompatibleAnalyzerOptions = { endpoint: "/api/analyze-requirement" }) {
    this.options = options;
  }

  async analyze(input: RequirementIntakeInput, options: AnalyzerRunOptions): Promise<AnalysisResult> {
    const response = await fetch(this.options.endpoint ?? "/api/analyze-requirement", {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input,
        model: options.model,
        catalog: options.catalog ?? [],
        streamProgress: true
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : "Codex CLI live 분석을 완료하지 못했습니다.";
      throw new Error(message);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      const payload = await response.json().catch(() => null);
      return ensureA2AContractsField(payload as AnalysisResult);
    }

    return ensureA2AContractsField(await readProgressStream(response.body, options.onProgress));
  }
}

// Boundary helper: defend the client AnalysisResult shape regardless of
// whether the server-side normalization ran. Mirrors the same placeholder-fill
// and orphan-drop rules via the shared a2aNormalize module so the UI never
// has to handle missing fields. Diagnostics are dropped here — the server
// already emits them onto the SSE diagnostic channel; the client boundary is
// the silent backstop.
function ensureA2AContractsField(result: AnalysisResult): AnalysisResult {
  if (!result || typeof result !== "object") {
    return result;
  }
  return normalizeA2A(result).result;
}

export const defaultAnalyzerProvider: AnalyzerProvider = new OpenAICompatibleAnalyzerProvider();

async function readProgressStream(
  body: ReadableStream<Uint8Array>,
  onProgress?: (event: AnalyzerProgressEvent) => void
): Promise<AnalysisResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalysisResult | null = null;

  const consumeBlock = (block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed) {
      return;
    }
    onProgress?.(parsed.payload);
    if (parsed.event === "completed") {
      if (!parsed.payload.result) {
        throw new Error("Codex CLI 분석 결과가 스트림에 포함되지 않았습니다.");
      }
      result = parsed.payload.result;
      return;
    }
    if (parsed.event === "failed" || parsed.event === "timeout") {
      throw new Error(parsed.payload.message || "Codex CLI live 분석을 완료하지 못했습니다.");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const block = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      consumeBlock(block);
      boundaryIndex = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consumeBlock(buffer);
  }

  if (!result) {
    throw new Error("Codex CLI 분석 스트림이 결과 없이 종료되었습니다.");
  }
  return result;
}

function parseSseBlock(block: string): { event: string; payload: AnalyzerProgressEvent } | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  const payload = JSON.parse(dataLines.join("\n")) as AnalyzerProgressEvent;
  return { event, payload };
}
