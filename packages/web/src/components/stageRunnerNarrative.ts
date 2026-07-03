export interface StageRunnerNarrativeEvent {
  readonly phase?: string;
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
