import assert from "node:assert/strict";
import { selectStageRunnerNarrative } from "./stageRunnerNarrative.ts";

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
