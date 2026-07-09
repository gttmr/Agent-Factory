import assert from "node:assert/strict";
import test from "node:test";
import { selectProcessLog, selectStageRunnerNarrative } from "./stageRunnerNarrative.ts";

const events = [
  {
    phase: "codex_event",
    message: "older note",
    itemType: "agent_message",
    snippet: "이전 검토 메모"
  },
  {
    phase: "codex_event",
    message: "todo list started",
    itemType: "todo_list",
    snippet: "todo 입력 계약 확인\ntodo Graph IR 검토\ntodo Runtime 계약 정리"
  },
  {
    phase: "codex_event",
    message: "latest note",
    itemType: "agent_message",
    snippet: "현재 분석 결과의 누락 정보와 Graph IR 연결을 대조하고 있습니다."
  },
  {
    phase: "codex_event",
    message: "todo list updated",
    itemType: "todo_list",
    snippet: "done 입력 계약 확인\ntodo Graph IR 검토\ntodo Runtime 계약 정리"
  }
];

assert.deepEqual(selectStageRunnerNarrative(events), {
  agentMessage: "현재 분석 결과의 누락 정보와 Graph IR 연결을 대조하고 있습니다.",
  todoProgress: {
    completedCount: 1,
    totalCount: 3,
    currentItem: "Graph IR 검토"
  }
});

assert.deepEqual(
  selectStageRunnerNarrative([
    {
      phase: "codex_event",
      message: "todo list completed",
      itemType: "todo_list",
      snippet: "done 분석 산출물 작성\ndone diff 요약 생성"
    }
  ]),
  {
    agentMessage: null,
    todoProgress: {
      completedCount: 2,
      totalCount: 2,
      currentItem: null
    }
  }
);

test("selectProcessLog concatenates process chunks in event order", () => {
  const processLog = selectProcessLog([
    { phase: "process_event", snippet: "first line\n" },
    { phase: "process_event", snippet: "second line\n" }
  ]);

  assert.equal(processLog, "first line\nsecond line\n");
});

test("selectProcessLog excludes codex event snippets", () => {
  const processLog = selectProcessLog([
    { phase: "process_event", snippet: "process output\n" },
    { phase: "codex_event", snippet: "internal narrative\n" },
    { phase: "process_event", snippet: "process error\n" }
  ]);

  assert.equal(processLog, "process output\nprocess error\n");
});

test("selectProcessLog returns null when there are no process events", () => {
  assert.equal(selectProcessLog([]), null);
});

test("selectProcessLog labels transitions when stdout and stderr are mixed", () => {
  const processLog = selectProcessLog([
    { phase: "process_event", title: "stdout", snippet: "ok" },
    { phase: "process_event", title: "stderr", snippet: "warning\n" }
  ]);

  assert.equal(processLog, "[stdout]\nok\n[stderr]\nwarning\n");
});

test("selectProcessLog preserves whitespace-only chunks in a single stream", () => {
  const processLog = selectProcessLog([
    { phase: "process_event", title: "stdout", snippet: " " },
    { phase: "process_event", title: "stdout", snippet: "x" }
  ]);

  assert.equal(processLog, " x");
});

test("selectProcessLog keeps only the latest 200 process chunks", () => {
  const processLog = selectProcessLog(
    Array.from({ length: 250 }, (_, index) => ({
      phase: "process_event",
      title: "stdout",
      snippet: `c${index}\n`
    }))
  );

  assert.ok(processLog?.startsWith("[이전 출력 생략]\n"));
  assert.ok(processLog?.includes("c249\n"));
  assert.ok(!processLog?.includes("c0\n"));
});

assert.deepEqual(
  selectStageRunnerNarrative([
    {
      phase: "codex_event",
      message: "blank snippets are ignored",
      itemType: "agent_message",
      snippet: "   "
    }
  ]),
  {
    agentMessage: null,
    todoProgress: null
  }
);
