import { Codex, type CodexOptions } from "@openai/codex-sdk";
import {
  createAnalyzerError,
  isAnalyzerError,
  type AnalyzerDiagnostics,
  type CodexAnalyzerRunner,
  type CodexAnalyzerRunnerInput,
  type ProcessRunResult
} from "./codexAnalyzerRunner";
import { mapSdkAnalyzerEvent, stringifyRedacted } from "./codexAnalyzerSdkEvents";

const codexSdkConfig = {
  mcp_servers: {
    "chrome-devtools": { enabled: false },
    "adk-docs-mcp": { enabled: true }
  }
} satisfies NonNullable<CodexOptions["config"]>;

export class SdkCodexAnalyzerRunner implements CodexAnalyzerRunner {
  async run({
    repoRoot,
    model,
    prompt,
    outputSchema,
    timeoutMs,
    startedAt,
    onProgress
  }: CodexAnalyzerRunnerInput): Promise<ProcessRunResult> {
    const controller = new AbortController();
    const eventTypeCounts: Record<string, number> = {};
    let eventCount = 0;
    let lastEventType: string | undefined;
    let lastTraceTitle: string | undefined;
    let lastTraceSnippet: string | undefined;
    let finalResponse = "";
    let turnFailure: string | null = null;
    const rawEvents: string[] = [];
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const codex = new Codex({ config: codexSdkConfig });
      const thread = codex.startThread({
        model,
        workingDirectory: repoRoot,
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: false
      });
      const { events } = await thread.runStreamed(prompt, { outputSchema, signal: controller.signal });

      for await (const event of events) {
        rawEvents.push(stringifyRedacted(event));
        eventCount += 1;
        lastEventType = event.type;
        eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;
        if (event.type === "turn.failed") {
          turnFailure = event.error.message;
        } else if (event.type === "item.completed" && event.item.type === "agent_message") {
          finalResponse = event.item.text;
        }
        const progress = mapSdkAnalyzerEvent(event, {
          model,
          timeoutMs,
          startedAt,
          eventCount,
          lastEventType,
          eventTypeCounts
        });
        if (progress.traceKind) {
          lastTraceTitle = progress.title;
          lastTraceSnippet = progress.snippet;
          onProgress?.({
            ...progress,
            lastTraceTitle,
            lastTraceSnippet
          });
        }
      }

      const diagnostics = createDiagnostics({
        startedAt,
        eventCount,
        lastEventType,
        eventTypeCounts,
        lastTraceTitle,
        lastTraceSnippet
      });
      if (turnFailure) {
        throw createAnalyzerError("failed", `Codex SDK 분석 실패: ${turnFailure}`, {
          ...diagnostics,
          timeoutMs
        });
      }
      return {
        outputText: finalResponse,
        stdout: rawEvents.join("\n"),
        stderr: "",
        diagnostics
      };
    } catch (error) {
      const diagnostics = createDiagnostics({
        startedAt,
        eventCount,
        lastEventType,
        eventTypeCounts,
        lastTraceTitle,
        lastTraceSnippet
      });
      if (controller.signal.aborted) {
        throw createAnalyzerError(
          "timeout",
          `Codex SDK 분석 시간이 초과되었습니다. 제한 ${formatDuration(timeoutMs)}, 경과 ${formatDuration(
            Date.now() - startedAt
          )}, 마지막 활동 ${lastTraceTitle ?? lastEventType ?? "없음"}.`,
          {
            ...diagnostics,
            timeoutMs
          }
        );
      }
      if (isAnalyzerError(error)) throw error;
      throw createAnalyzerError(
        "failed",
        `Codex SDK 분석 실패: ${error instanceof Error ? error.message : String(error)}`,
        {
          ...diagnostics,
          timeoutMs
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function createDiagnostics({
  startedAt,
  eventCount,
  lastEventType,
  eventTypeCounts,
  lastTraceTitle,
  lastTraceSnippet
}: {
  startedAt: number;
  eventCount: number;
  lastEventType?: string;
  eventTypeCounts: Record<string, number>;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
}): AnalyzerDiagnostics {
  return {
    elapsedMs: Date.now() - startedAt,
    eventCount,
    lastEventType,
    eventTypeCounts: { ...eventTypeCounts },
    lastTraceTitle,
    lastTraceSnippet
  };
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}분 ${remainingSeconds}초` : `${minutes}분`;
}
