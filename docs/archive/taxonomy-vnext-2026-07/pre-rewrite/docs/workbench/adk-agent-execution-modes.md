# ADK Agent Execution Modes

이 문서는 Agent Factory가 ADK `LlmAgent.mode`를 Graph IR와 runnable source 생성에서 어떻게 해석해야 하는지 정의한다.
기준은 ADK Python 2.2.0 실측, 로컬 ADK 2.2.0 source inspection, `adk-docs-mcp`로 확인한 공식 ADK 문서다.

핵심 결론:

- `mode`는 단순 enum label이 아니라 runtime topology와 context contract를 바꾸는 값이다.
- Graph Workflow의 기본 LLM agent node는 `single_turn`으로 취급한다.
- `chat`은 static graph node로 실행될 수 있지만 session history를 암묵 입력으로 받는 stateful node다.
- `task`는 static graph node로 열지 않는다. task는 coordinator agent가 task sub-agent를 위임하는 collaboration topology로만 다룬다.

## Sources Checked

공식 문서:

- `https://adk.dev/graphs/index.md`
- `https://adk.dev/graphs/data-handling/index.md`
- `https://adk.dev/workflows/collaboration/index.md`

로컬 ADK 2.2.0 source inspection:

- `google/adk/agents/llm_agent.py`
- `google/adk/workflow/_llm_agent_wrapper.py`
- `google/adk/workflow/_workflow.py`
- `google/adk/flows/llm_flows/contents.py`

실측:

- ADK dev UI와 별도 external chat UI에서 `gemini-flash-lite-latest`를 실제 호출했다.
- 같은 session에서 2턴 token recall 테스트를 수행했다.
- `single_turn`은 이전 턴 token을 보지 못했고, `chat`은 이전 턴 token을 봤다.

## Terminology

이 문서에서 "기억한다"는 말은 두 가지를 구분한다.

- Conversation history: 이전 user/model events가 다음 model request `contents`에 포함되는 것.
- ADK state: `ctx.state`, `event.actions.state_delta`, `output_key` 등 명시적 state 저장소.

`chat`이 이전 대화를 기억하는 것은 기본적으로 conversation history가 request에 포함되기 때문이다.
이것은 반드시 `ctx.state`에 값이 저장된다는 뜻이 아니다.

## Mode Semantics

### `single_turn`

Agent Factory의 Graph node 기본값이다.

ADK source behavior:

- Workflow node로 실행되는 `LlmAgent`가 `mode=None`이면 `single_turn`으로 설정된다.
- `single_turn`이면 `include_contents='none'`으로 강제된다.
- model request에는 현재 턴 context만 들어가며 이전 conversation history는 제외된다.
- node output은 `Event.output`으로 다음 graph node에 전달된다.
- `output_key`가 있으면 state delta도 기록될 수 있지만, 이것은 대화 기억과 별개다.

해석:

- "현재 `node_input`을 보고 LLM 한 번 호출하는 deterministic-ish graph step"에 가장 가깝다.
- classifier, extractor, formatter, adapter-call planner, response drafter처럼 명시 input/output을 가진 node에 적합하다.
- 같은 session에서 여러 번 호출해도 이전 user turn을 근거로 답하지 않아야 한다.

Agent Factory policy:

- Graph IR의 일반 `agent` node는 명시 이유가 없으면 `llm_single_turn`으로 lower한다.
- requirement에 "대화 흐름을 이어서", "이전 발화 기억", "상담 맥락 유지" 같은 신호가 없으면 `chat`으로 올리지 않는다.

### `chat`

Static Workflow graph node로 실행될 수 있지만, Graph 순수 데이터흐름 관점에서는 특별 취급해야 한다.

ADK source behavior:

- `include_contents='default'`이면 session events에서 relevant conversation history를 model request에 포함한다.
- Graph edge topology는 변하지 않는다.
- 같은 graph node라도 session history가 암묵 입력이 되므로 같은 `node_input`에 대해 결과가 달라질 수 있다.
- `chat` wrapper는 task sub-agent delegation function call을 감지하면 task를 dispatch하고 function response를 합성한 뒤 parent agent를 다시 실행할 수 있다.

해석:

- `chat` node는 "명시 edge input + session conversation history"를 함께 받는 stateful node다.
- Graph에서 겉으로는 하나의 node지만, runtime input은 Graph IR edge만으로 설명되지 않는다.
- 반복 호출, 재시도, replay, evaluation에서 session event history가 결과에 영향을 준다.

Agent Factory policy:

- `chat`을 허용하려면 UI와 artifact에 stateful context behavior를 드러낸다.
- `chat` node에는 "session history is implicit input" warning 또는 metadata를 둔다.
- `chat` node는 deterministic Graph step처럼 최적화하거나 cache하면 안 된다.
- 생성기 테스트는 반드시 같은 session에서 2턴 recall smoke를 포함한다.

### `task`

`task`는 Graph node mode가 아니라 collaboration sub-agent mode로 취급한다.

ADK source behavior:

- `mode='task'` agent에는 `FinishTaskTool`이 자동 추가된다.
- parent `LlmAgent`가 `task` sub-agent를 가지면 `_TaskAgentTool`이 parent tool 목록에 추가된다.
- parent가 task tool을 function call하면 ADK wrapper가 `ctx.run_node`로 task agent를 dispatch하고, task completion result를 function response로 합성해 parent에게 돌려준다.
- task와 single_turn은 isolation scope 기반으로 자기 scope의 events만 보게 설계되어 있다.
- ADK 2.2.0 `Workflow`는 static graph node에 `mode='task'` LlmAgent가 있으면 validation error를 낸다.

공식 문서 behavior:

- collaboration mode는 sub-agent용이며 root agent에 mode를 설정하지 말라고 설명한다.
- task는 자동 parent return을 위한 mode다.
- 문서에는 task graph workflow 관련 제한이 명시되어 있다.

실측 behavior:

- `mode='task'` LlmAgent를 static Workflow graph node에 넣으면 import/validation 단계에서 거부된다.
- chat coordinator + task sub-agent의 첫 invocation은 `coordinator -> task tool call -> task agent -> finish_task -> coordinator final response`로 동작했다.
- 같은 session에서 task delegation을 반복하는 실험은 ADK 2.2.0 dynamic scheduler에서 `Task cannot await on itself` 오류를 냈다. 따라서 현재 Agent Factory는 task를 static graph 대화 node로 쓰면 안 된다.

Agent Factory policy:

- `llm_task`를 일반 Graph node execution kind로 열지 않는다.
- task가 필요하면 다음 중 하나로 모델링한다.
  - chat coordinator agent with task sub-agents
  - dynamic workflow function node가 명시적으로 `ctx.run_node`로 dispatch하는 구조
- static Graph IR node의 `mode='task'` 생성은 validator에서 hard error로 막는다.
- "task가 기억한다"는 표현은 parent chat coordinator가 history를 보고 task brief를 다시 구성하는지, task sub-agent 자체 scope가 이어지는지 분리해서 검증한다.

## Graph IR Impact

`mode` 변경은 node label만 바꾸는 일이 아니다.

| Desired behavior | Graph IR/runtime representation |
|---|---|
| 현재 입력만 처리 | `agent` node lowered as `single_turn` |
| 이전 대화 흐름 반영 | `agent` node lowered as `chat`; UI/review must expose session-history context |
| 작업 위임 후 자동 parent return | coordinator `LlmAgent` + task sub-agent topology |
| runtime 값에 따라 task dispatch | `dynamic_workflow` + function node using `ctx.run_node` |

`single_turn -> chat`:

- Graph edge shape는 유지될 수 있다.
- Runtime contract는 바뀐다. session history가 implicit input이 된다.
- Validation/evaluation은 multi-turn case를 포함해야 한다.

`single_turn -> task`:

- Graph edge shape만 유지해서는 안 된다.
- Static graph node로 lower하면 안 된다.
- Topology를 coordinator/sub-agent 또는 dynamic dispatch로 바꿔야 한다.

## Generator Rules

Runnable source generator는 다음 규칙을 따른다.

1. `agent` Graph node의 기본 LLM execution mode는 `single_turn`이다.
2. `chat`은 artifact에 명시적 execution mode와 rationale이 있을 때만 생성한다.
3. `chat` 생성물은 replay/cache/determinism 관련 가정에서 제외한다.
4. static Workflow node에 `task` mode를 생성하지 않는다.
5. task sub-agent가 필요하면 root/coordinator agent topology를 생성하고, Graph IR에는 이 구조가 static edge replacement가 아니라 delegation topology임을 남긴다.
6. `output_key`와 `ctx.state`는 명시 데이터 전달용이다. conversation memory를 state로 오해하지 않는다.

## UI And Review Rules

Design/Build UI는 mode별 차이를 숨기면 안 된다.

- `single_turn`: "single turn", "현재 입력만 사용" 같은 짧은 표시.
- `chat`: `agent_execution_mode`/`agent mode`로 명시하고 "session history 사용" helper copy 또는 review note를 보여준다.
- `task`: 일반 node mode 선택지로 제공하지 않는다. 별도 coordinator/sub-agent 설계 화면이나 dynamic dispatch 설계로 유도한다.

검토자는 다음 질문을 확인한다.

- 이 node가 이전 사용자 발화를 봐야 하는가?
- 이전 발화가 없어도 같은 input이면 같은 output이어야 하는가?
- task completion과 parent return이 필요한가?
- task가 필요하다면 parent coordinator가 있는가?
- session history가 Graph IR edge 밖의 암묵 입력이 되어도 되는가?

## Skill Authoring Rules

Agent Factory skills가 ADK runtime handoff 또는 Graph IR 설계를 만들 때는 다음 문구를 기준으로 삼는다.

- 기본 agent node는 `single_turn`이다.
- "대화 흐름 유지"가 명시되면 `chat` 후보로 표시하되, deterministic graph step이 아님을 기록한다.
- `task` 요청은 node enum 변경으로 해결하지 않는다. coordinator/sub-agent 또는 dynamic workflow boundary를 설계 질문으로 올린다.
- `task`를 static graph node로 넣는 scaffold-plan은 승인하지 않는다.
- 검증 evidence에는 single-turn/current-turn 테스트와 chat/multi-turn 테스트를 분리해 기록한다.

## Regression Checks

최소 회귀 검증:

1. Static Workflow에 `mode='task'` LlmAgent를 넣으면 validator가 거부해야 한다.
2. `single_turn` memory probe는 같은 session 2턴에서 이전 token을 답하지 않아야 한다.
3. `chat` memory probe는 같은 session 2턴에서 이전 token을 답할 수 있어야 한다.
4. task collaboration smoke는 첫 invocation에서 `task_agent(...)`, `finish_task(...)`, synthesized task function response, coordinator final response 순서를 확인한다.
5. task를 multi-turn Graph node처럼 반복 호출하는 설계는 supported behavior로 승인하지 않는다.
