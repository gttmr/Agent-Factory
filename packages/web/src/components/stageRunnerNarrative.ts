export interface StageRunnerNarrativeEvent {
  readonly phase?: string;
  readonly title?: string;
  readonly message?: string;
  readonly itemType?: string;
  readonly snippet?: string;
}

export interface StageRunnerTodoProgress {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly currentItem: string | null;
}

export interface StageRunnerNarrative {
  readonly agentMessage: string | null;
  readonly todoProgress: StageRunnerTodoProgress | null;
}

interface TodoItem {
  readonly text: string;
  readonly completed: boolean;
}

export function selectStageRunnerNarrative(events: readonly StageRunnerNarrativeEvent[]): StageRunnerNarrative {
  const agentMessage = latestSnippet(events, "agent_message");
  const todoSnippet = latestSnippet(events, "todo_list");
  return {
    agentMessage,
    todoProgress: todoSnippet ? parseTodoProgress(todoSnippet) : null
  };
}

export function stageRunCompletionMessage(stage: StageRunStage): string {
  return stage === "build"
    ? "runtime-stub이 canonical 경로에 생성되고 run 이력이 기록되었습니다. Build에는 별도 제안 적용 단계가 없습니다."
    : "run output 이 생성되었습니다. canonical artifact 는 아직 변경되지 않았습니다.";
}

export function selectProcessLog(events: readonly StageRunnerNarrativeEvent[]): string | null {
  const processEvents: Array<{ readonly stream: string; readonly snippet: string }> = [];
  for (const event of events) {
    if (event.phase !== "process_event" || typeof event.snippet !== "string" || event.snippet === "") continue;
    processEvents.push({ stream: event.title ?? "stdout", snippet: event.snippet });
  }

  const keptEvents = processEvents.slice(-200);
  const firstEvent = keptEvents[0];
  if (!firstEvent) return null;
  let processLog = "";
  if (keptEvents.every((event) => event.stream === firstEvent.stream)) {
    processLog = keptEvents.map((event) => event.snippet).join("");
  } else {
    let previousStream: string | null = null;
    for (const event of keptEvents) {
      if (event.stream !== previousStream) {
        if (processLog !== "" && !processLog.endsWith("\n")) processLog += "\n";
        processLog += `[${event.stream}]\n`;
        previousStream = event.stream;
      }
      processLog += event.snippet;
    }
  }

  let truncated = keptEvents.length < processEvents.length;
  if (processLog.length > 100000) {
    processLog = processLog.slice(-100000);
    truncated = true;
  }
  return truncated ? `[이전 출력 생략]\n${processLog}` : processLog;
}

function latestSnippet(events: readonly StageRunnerNarrativeEvent[], itemType: string): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const snippet = event?.itemType === itemType ? event.snippet?.trim() : "";
    if (snippet) return snippet;
  }
  return null;
}

function parseTodoProgress(snippet: string): StageRunnerTodoProgress | null {
  const items = snippet
    .split(/\r?\n/)
    .map((line) => parseTodoLine(line.trim()))
    .filter(isTodoItem);
  if (items.length === 0) return null;
  const completedCount = items.filter((item) => item.completed).length;
  return {
    completedCount,
    totalCount: items.length,
    currentItem: items.find((item) => !item.completed)?.text ?? null
  };
}

function parseTodoLine(line: string): TodoItem | null {
  if (!line) return null;
  const doneMatch = /^(?:done|completed)\s+(.+)$/i.exec(line);
  if (doneMatch?.[1]) return { text: doneMatch[1].trim(), completed: true };
  const todoMatch = /^(?:todo|pending|started|in_progress)\s+(.+)$/i.exec(line);
  if (todoMatch?.[1]) return { text: todoMatch[1].trim(), completed: false };
  const checkedMatch = /^(?:[-*]\s*)?\[[xX]\]\s+(.+)$/.exec(line);
  if (checkedMatch?.[1]) return { text: checkedMatch[1].trim(), completed: true };
  const uncheckedMatch = /^(?:[-*]\s*)?\[\s\]\s+(.+)$/.exec(line);
  if (uncheckedMatch?.[1]) return { text: uncheckedMatch[1].trim(), completed: false };
  return { text: line, completed: false };
}

function isTodoItem(item: TodoItem | null): item is TodoItem {
  return item !== null;
}
import type { StageRunStage } from "../state/apiClient";
