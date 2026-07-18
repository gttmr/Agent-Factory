# R2 — 공식 소스 조사 (ADK 런타임 패턴 추가분 + 코딩 에이전트 스킬 작성 표준)

## 확인 메타데이터

- 확인일: **2026-07-18**
- 도구: `adk-docs` MCP (`list_doc_sources` → `fetch_docs`, 소스: `https://adk.dev/llms.txt`), GitHub API(`gh api`, openai/codex), WebFetch(platform.claude.com / code.claude.com / agentskills.io)
- 범위: 이전 조사(agents/workflows/graphs/routes/human-input/function-tools/mcp/a2a)에서 다루지 않은 ADK 런타임 페이지 + Codex/Anthropic/Claude Code 스킬 작성 표준
- 문서 표기 원칙: "문서가 명시(docs state)"한 내용만 사실로 기록. 미확인 항목은 마지막 섹션에 분리.

## ADK Callbacks

**Fetch한 URL**
- `https://adk.dev/callbacks/index.md` (개요, 전체 읽음)
- `https://adk.dev/callbacks/types-of-callbacks/index.md` (115K chars — 구조/Purpose/시그니처 라인만 추출, 다국어 코드 전문은 미독)
- `https://adk.dev/plugins/index.md` (전체 읽음 — callbacks 문서가 plugin을 참조하므로 포함)
- 참고: `https://adk.dev/callbacks/design-patterns-and-best-practices/index.md` 페이지가 존재함(미fetch)

**docs state — Callback 종류 (6종, 3그룹)**
- Agent Lifecycle: `Before Agent` / `After Agent` — 해당 요청에 대한 에이전트의 전체 작업(모델 호출·툴 사용·결과 조합)을 감싸는 훅
- LLM Interaction: `Before Model` / `After Model` — LLM 요청/응답 검사·수정
- Tool Execution: `Before Tool` / `After Tool` — 툴 인자 검증·인가, 결과 후처리

**docs state — Continue vs Override 시맨틱**
- Python: `return None` = 기본 동작 계속(Continue). 특정 타입 객체 반환 = Override.
  - `before_agent_callback` → `Content` 반환 시 에이전트 실행 자체를 스킵하고 그 Content가 최종 출력
  - `before_model_callback` → `LlmResponse` 반환 시 실제 LLM 호출 스킵 (guardrail/캐시 용도)
  - `before_tool_callback` → `dict`(Map) 반환 시 툴 실행 스킵, 그 dict가 툴 결과로 사용
  - `after_agent_callback` → `Content` 반환 시 에이전트 출력 **교체**; `after_model` → `LlmResponse` 교체; `after_tool` → dict 교체
- 언어별 표현: Java `Optional.empty()`/`Optional.of(...)`, Kotlin `CallbackChoice.Continue(value)`/`CallbackChoice.Break(value)`, TS `undefined`/객체, Go `nil, nil`/non-nil 응답

**docs state — Context 객체와 시그니처 (Python)**
- Agent/Model 콜백은 `CallbackContext`(`google.adk.agents.callback_context`) — `agent_name`, `invocation_id`, `state` 접근
- Tool 콜백은 `ToolContext`(`google.adk.tools.tool_context`)
- `before_model_callback(callback_context: CallbackContext, llm_request: LlmRequest) -> Optional[LlmResponse]`
- `after_model_callback(callback_context, llm_response: LlmResponse)`
- `before_tool_callback(tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext) -> Optional[Dict]`
- `after_tool_callback(tool, args, tool_context, tool_response: Dict)`
- 등록은 `LlmAgent(before_model_callback=fn, ...)` 형태 (에이전트 생성 시 파라미터)

**docs state — Plugins (별도 페이지, Python v1.7.0+)**
- `BasePlugin` 상속 + `Runner(plugins=[...])`(Python `InMemoryRunner(plugins=...)`)로 등록. 스코프는 **글로벌** — 그 Runner의 모든 agent/tool/LLM 호출에 적용
- Plugin 콜백은 Agent/Model/Tool 레벨 콜백보다 **먼저** 실행되고, non-None 반환 시 객체 레벨 콜백은 **스킵됨**
- Plugin 전용 훅(객체 콜백에는 없는 것 포함): `on_user_message_callback`, `before_run_callback`(Content 반환 시 조기 종료), `before/after_agent`, `before/after_model`, **`on_model_error_callback`**(LlmResponse 반환 시 예외 억제+fallback), `before/after_tool`, **`on_tool_error_callback`**(dict 반환 시 예외 억제), `on_event_callback`(Event 교체 가능), `after_run_callback`(teardown 전용, 결과 변경 불가)
- 보안 guardrail은 Callbacks보다 Plugins 사용을 권장한다고 명시(safety 문서 링크)

## ADK Event Loop/Runtime

**Fetch한 URL**: `https://adk.dev/runtime/event-loop/index.md` (전체 읽음)

**docs state**
- 핵심 패턴: `Runner` ↔ Execution Logic(Agents/Tools/Callbacks) 간 **Event Loop**. 에이전트 로직은 `Event`를 `yield`하고 **즉시 pause** → Runner가 `SessionService.append_event()`로 `event.actions`(`state_delta`, `artifact_delta`)를 커밋하고 upstream(UI)으로 전달 → 그 후에만 에이전트가 resume
- **State commit 타이밍 규칙**: `context.state['k']=v` 변경은 invocation 로컬 기록이며, 해당 `state_delta`를 실은 Event가 yield되어 Runner가 처리한 **후**에만 영속 보장. resume 후 코드는 직전 yield 이벤트의 상태 커밋을 신뢰 가능
- **Dirty read**: 같은 invocation 안에서 yield 이전이라도 이후 실행되는 콜백/툴은 미커밋 로컬 변경을 읽을 수 있음(문서가 "dirty read"로 명명). invocation 실패 시 유실 위험 경고
- **partial vs final**: streaming 시 `partial=True` 이벤트 다수 yield — Runner는 즉시 upstream 전달하되 `actions` 처리는 **스킵**. `partial=False`(또는 `turn_complete=True`)인 최종 이벤트만 완전 처리하여 `state_delta`/`artifact_delta` 커밋 (원자적 1회 적용)
- 구성요소 정의: `Runner`(`google.adk.runners.runner`, `run_async`가 primary / `run`은 편의 sync 래퍼), Agent의 `_run_async_impl`이 이벤트 yield, `Event`(content + `actions`), Services(`SessionService`/`ArtifactService`/`MemoryService`), `Session`(state + event history), `Invocation`(단일 사용자 쿼리 전체, `invocation_id`로 묶임; **`temp:` state는 invocation 단위로 폐기**)
- 세션 vs invocation 스코프: Session은 대화 1개의 컨테이너, Invocation은 쿼리 1개 처리 전체(에이전트 이관/AgentTool 포함 다수 agent run 가능). 부모→서브에이전트는 같은 `InvocationContext`(같은 invocation_id, 같은 `temp:` state)를 공유(state 문서와 교차 확인)

## ADK Ambient Agents

**Fetch한 URL**: `https://adk.dev/runtime/ambient-agents/index.md` (전체 읽음; 제목 "Trigger actions with ambient agents", Python v1.29.0 / Go v1.1.0)

**docs state**
- 두 가지 구축 방식: **`/run` endpoint** vs **Trigger endpoints**
  - `/run`: 임의 이벤트 소스(웹훅/cron/커스텀). `adk api_server --auto_create_session`으로 세션 자동 생성. payload 파싱·재시도·동시성은 사용자 책임. 경로 `POST /apps/{app_name}/run` + `app_name`/`user_id`/`session_id`/`new_message` 직접 지정
  - Trigger endpoints: `/apps/{app_name}/trigger/pubsub`(Pub/Sub push), `/apps/{app_name}/trigger/eventarc`(CloudEvents, binary/structured 모두). `--trigger_sources "pubsub,eventarc"` 플래그(기본 비활성) 또는 `get_fast_api_app(trigger_sources=[...])`
- **One-session-per-event**: trigger endpoint는 이벤트마다 UUID 세션을 **항상 새로 생성**. `user_id`는 Pub/Sub `subscription` 필드 / Eventarc `ce-source` 헤더에서 유도. 메시지는 `{"data": ..., "attributes": {...}}` JSON으로 정규화되어 user message로 전달(Base64 자동 디코딩)
- **Idempotency/Retry/DLQ**: 응답 200=ack, 400=malformed(재시도 없음), 500=실패→소스가 retry policy대로 재전송. 내장 재시도: transient 오류(예: 429)에 exponential backoff+jitter — `ADK_TRIGGER_MAX_RETRIES`(기본 3), `ADK_TRIGGER_RETRY_BASE_DELAY`(1.0s), `ADK_TRIGGER_RETRY_MAX_DELAY`(30.0s). 동시성 semaphore `ADK_TRIGGER_MAX_CONCURRENT`(기본 10, 프로세스별). 재시도 소진 시 **Pub/Sub dead-letter queue** 구성 권장. 재전송마다 새 세션 = "Trigger workloads are stateless by design"
- 처리 시간 상한: 동기 처리, 업스트림 ack deadline **10분**. 10분 초과 장기 작업은 pull subscription / Cloud Run Jobs / worker pool 사용하라고 명시
- **Output sinks**: Structured logging(+Cloud Monitoring 알림), Pub/Sub topic publish, Application Integration(email/Jira 등) — 문서가 명시한 3가지 패턴
- 배포: `adk deploy cloud_run --trigger_sources=...`; 세션 저장은 구성된 `SessionService` 따름(기본 InMemory=ephemeral, `DatabaseSessionService`면 감사용 영속)

## ADK Resume/Human-Input 재확인

**Fetch한 URL**: `https://adk.dev/runtime/resume/index.md` (전체 읽음; Python v1.14.0+, resumable 구성은 ADK Python 1.16+, Kotlin experimental)

**docs state**
- 활성화: `App(name=..., root_agent=..., resumability_config=ResumabilityConfig(is_resumable=True))`
- 재개 방법: `POST /run_sse`에 `app_name/user_id/session_id` + **`invocation_id`** (Event history에서 확인) / 또는 `runner.run_async(user_id=..., session_id=..., invocation_id=...)`. 문서 주석: "`new_message`를 function response로 설정하면 long-running function을 resume하는 것" — RequestInput/long-running tool 재개가 이 경로임을 재확인
- ADK Web UI와 CLI에서의 resume은 **현재 미지원**이라고 명시
- 동작 원리: 완료된 태스크를 Events/EventActions로 로깅 → 재시작 시 완료 이벤트를 재적재(reinstate)하고 부분 완료 상태에서 재개. Sequential은 `current_sub_agent`, Loop는 `current_sub_agent`+`times_looped`, Parallel은 미완료 sub-agent만 재실행
- **Rerun-on-resume 시맨틱**: 툴은 "**at least once**" 실행 보장 — resume 시 중복 실행될 수 있으므로 구매 등 부작용 툴은 중복 방지 로직을 넣으라고 경고. 성공한 툴 A·B 결과는 재적재되고 실패한 툴 C부터 재실행
- 중단된 워크플로를 resume 전에 수정(에이전트 추가/삭제)하는 것은 미지원
- Custom Agent는 기본 미지원 — `BaseAgentState` 확장 + `_load_agent_state(ctx, ...)` + 단계마다 `_create_agent_state_event(ctx, agent_state)` yield + 완료 시 `end_of_agent=True` 필요
- 우리 generator의 "loop-body RequestInput 부모 rerun 시 완료된 child run replay" 이해와 방향 일치(단, 문서는 ADK 자체 워크플로 클래스 기준 설명)

## ADK State/Artifacts

**Fetch한 URL**
- `https://adk.dev/sessions/state/index.md` (전체 읽음)
- `https://adk.dev/artifacts/index.md` (61K chars — 헤딩 + 핵심 API 라인 추출, 다국어 코드 전문은 미독)

**docs state — State**
- `session.state`는 직렬화 가능한 key-value(문자열 키, 기본 타입 값만; 복합 객체 저장 금지)
- **Prefix 스코프 4종**:
  - 무접두(prefix 없음) = **Session** 스코프 (해당 session id 한정)
  - `user:` = **User** 스코프 (같은 app_name의 그 user_id 전 세션 공유)
  - `app:` = **App** 스코프 (앱 전체 공유)
  - `temp:` = **Invocation** 스코프 (invocation 종료 시 폐기, 영속 안 됨)
- 영속성은 SessionService 구현에 의존: `InMemorySessionService` 비영속 / `DatabaseSessionService`·`VertexAiSessionService` 영속
- 갱신 경로 3가지(권장): ① `LlmAgent(output_key=...)` — 최종 텍스트를 state에 자동 저장, ② `EventActions(state_delta={...})` + `session_service.append_event()`, ③ 콜백/툴 내 `callback_context.state[...]`/`tool_context.state[...]` 직접 대입(프레임워크가 자동으로 state_delta 반영)
- SessionService에서 직접 얻은 Session 객체의 `state`를 컨텍스트 밖에서 직접 수정하는 것은 강력 비권장(이벤트 이력·영속·스레드 안전성 우회)
- Instruction 템플릿: `{key}` 주입, `{key?}` 옵셔널, `InstructionProvider` 함수는 주입 미수행, `instructions_utils.inject_session_state`로 선택적 주입

**docs state — Artifacts**
- Artifact = 이름·버전 있는 바이너리 데이터, `types.Part`(주로 `inline_data` Blob; `types.Part.from_bytes(data=..., mime_type=...)`)로 표현
- `BaseArtifactService`(`google.adk.artifacts`) 인터페이스: Save / Load / List artifact keys / Delete / List versions. 구현체: `InMemoryArtifactService`, `GcsArtifactService`. `Runner(artifact_service=...)`로 주입해야 컨텍스트 메서드 사용 가능
- 컨텍스트 API: `context.save_artifact(filename=..., artifact=...)` → **버전 int 반환**(0부터 자동 증가), `context.load_artifact(filename=..., version=None)` → 최신(또는 지정 버전), `list_artifacts`(툴은 `LoadArtifactsTool`도 제공)
- 저장 후 생성 이벤트에 `event.actions.artifact_delta == {"filename": version}` 기록
- **Namespace**: 일반 filename(`"report.pdf"`) = session 스코프(app_name+user_id+session_id); **`"user:"` prefix**(`"user:settings.json"`) = user 스코프(그 user의 전 세션 접근 가능) — state와 동일한 prefix 규약

## Codex skill-creator 기준

**소스**: 로컬 플러그인 캐시 `~/.claude/plugins/cache/openai-codex/`에는 skill-creator 샘플 **없음**(Claude Code용 codex 플러그인만 존재; `claude-plugins-official/skill-creator`는 Anthropic 것). → GitHub에서 직접 확인: `https://github.com/openai/codex` `codex-rs/skills/src/assets/samples/skill-creator/` (SKILL.md 전문 + `references/openai_yaml.md` 전문 + scripts 목록, `gh api`로 fetch)

**docs state — Frontmatter**
- 필수 필드는 `name`, `description` 두 개뿐이고 "Do not include any other fields in YAML frontmatter" 명시. (샘플 자체는 `metadata.short-description`도 사용 — metadata 맵은 Agent Skills 표준의 확장 슬롯)
- `description`이 유일한 트리거링 메커니즘: what + when(트리거 상황)을 모두 포함. "When to Use" 정보는 body가 아니라 description에 — body는 트리거 후에만 로드됨
- Naming: 소문자·숫자·하이픈만, **64자 미만**, 동사 주도 짧은 구, 도구 네임스페이스 허용(`gh-address-comments`), **폴더명 = 스킬명**

**docs state — 디렉터리 구성**
```
skill-name/
├── SKILL.md            # 필수 (frontmatter: name, description)
├── agents/openai.yaml  # 권장 — UI 메타데이터 (에이전트가 아닌 harness가 읽음)
├── scripts/            # 결정적 실행이 필요하거나 반복 재작성되는 코드
├── references/         # 필요 시 컨텍스트로 로드되는 문서
└── assets/             # 출력물에 쓰이는 파일(로드하지 않음)
```
- `agents/openai.yaml` 필드(references/openai_yaml.md): `interface.display_name`, `interface.short_description`(**25–64자**), `interface.default_prompt`(1문장, `$skill-name` 명시 필수), `icon_small/icon_large`(`./assets/` 상대경로), `brand_color`(hex), `dependencies.tools[]`(현재 `type: mcp`만), `policy.allow_implicit_invocation`(false면 자동 주입 제외, `$skill` 명시 호출만; 기본 true). 문자열 값은 따옴표, 키는 비따옴표

**docs state — 명시 규칙**
- Progressive disclosure 3단계: metadata(~100 words, 상시) → SKILL.md body(**<5k words, 500라인 미만** 유지, 근접 시 분할) → bundled resources(무제한; script는 읽지 않고 실행 가능)
- references는 SKILL.md에서 **1단계 깊이**만; 100라인 초과 reference엔 TOC; **10k words 초과 파일은 SKILL.md에 grep 패턴 명시**; SKILL.md와 references 간 정보 중복 금지
- 금지: README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md 등 부수 문서 생성
- 프로세스: 구체 예시 이해 → 재사용 리소스 계획 → `scripts/init_skill.py <name> --path ...` 초기화(기본 위치 `$CODEX_HOME/skills`, 미설정 시 `~/.codex/skills`) → 편집(스크립트는 실제 실행 테스트) → `scripts/quick_validate.py` 검증 → 반복
- Forward-testing: 서브에이전트에 "스킬을 테스트하라"가 아니라 사용자처럼 "`$skill-x`를 써서 문제 y를 풀라"로 지시. 정답·의도한 수정·진단을 유출하지 말 것, 반복 간 아티팩트 정리
- 작성 문체: imperative/infinitive form
- BOM·인코딩 규칙: 명시 없음(미확인 섹션 참조)

## Anthropic Skill 기준

**소스**: `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices` (WebFetch, 전문 확인) + Agent Skills 표준 `https://agentskills.io/specification` (전문 확인)

**docs state — Frontmatter 검증 규칙**
- `name`: **최대 64자**, 소문자·숫자·하이픈만, XML 태그 금지, 예약어 **"anthropic"/"claude" 금지**. (표준 스펙 추가: 하이픈 시작/끝 금지, 연속 하이픈 `--` 금지, **부모 디렉터리명과 일치해야 함**)
- `description`: 비어있으면 안 되고 **최대 1,024자**, XML 태그 금지, **3인칭으로 작성**("I can help..." / "You can use..." 금지 — system prompt 주입 시 시점 불일치가 발견 문제를 유발), what + when + 구체 키워드 포함
- 표준 스펙의 선택 필드: `license`, `compatibility`(최대 500자), `metadata`(임의 string map), `allowed-tools`(공백 구분, experimental)

**docs state — 작성 규칙**
- Naming: gerund form 권장(`processing-pdfs`), 명사구/동사형 허용, `helper`/`utils` 같은 모호명 금지
- **SKILL.md body 500라인 미만**; 초과 전 분할. Progressive disclosure 패턴 3종(고수준 가이드+references / 도메인별 분리 / 조건부 상세). reference는 1단계 깊이, 100라인 초과 파일은 TOC
- Degrees of freedom 매칭: high(텍스트 지침)/medium(의사코드)/low(정확한 스크립트) — 작업의 fragility에 맞춤
- Workflows: 복잡 작업은 체크리스트 복사 패턴; validator 실행→수정→반복 feedback loop
- 콘텐츠: 시간 민감 정보 금지(old patterns 섹션으로 격리), 용어 일관성, 선택지 과다 제시 금지(기본값+escape hatch), Windows 경로 금지(항상 `/`)
- Scripts: "solve, don't defer"(에러를 스크립트가 처리), voodoo constant 금지(상수 근거 주석), 실행 vs 참조 의도를 명시("Run X" vs "See X"), 의존 패키지 명시(환경별: claude.ai는 설치 가능, API는 네트워크 없음)
- MCP 툴 참조는 fully qualified `ServerName:tool_name`
- 테스트: **문서 작성 전에 평가부터**(eval-driven: 갭 식별→시나리오 3개 이상→베이스라인→최소 지침→반복), 사용할 모든 모델(Haiku/Sonnet/Opus)로 테스트, Claude A(작성)/Claude B(사용) 반복 루프, Claude의 탐색 경로 관찰(안 읽는 파일 = 제거/신호 개선 후보)
- Plan-validate-execute 패턴: 중간 산출물(예: changes.json)을 스크립트로 검증 후 실행 — 배치/파괴적/고위험 작업에

## Claude Code 스킬 발견 경로

**소스**: `https://code.claude.com/docs/en/skills` (WebFetch, 66KB 전문 저장 후 관련 라인 전수 grep)

**docs state — 발견 위치 (문서의 표 그대로)**
| Location | Path | Applies to |
|---|---|---|
| Enterprise | managed settings 참조 | 조직 전체 |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | 모든 프로젝트 |
| Project | `.claude/skills/<skill-name>/SKILL.md` | 해당 프로젝트 |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | 플러그인 활성 범위 |

- 우선순위: 같은 이름 충돌 시 **enterprise > personal > project**, 어떤 레벨이든 bundled skill을 override. plugin은 `plugin-name:skill-name` 네임스페이스라 충돌 없음. skill과 `.claude/commands/` 커맨드 이름 충돌 시 skill 우선(커맨드는 스킬로 통합됨)
- 중첩 발견: 시작 디렉터리부터 repo root까지 **상위 디렉터리의 `.claude/skills/`** 로드 + 하위 디렉터리 파일 작업 시 그 하위의 `.claude/skills/`를 on-demand 발견(모노레포 지원, 충돌 시 `apps/web:deploy` 형태). `--add-dir`/`/add-dir`로 추가한 디렉터리의 `.claude/skills/`도 로드(단 `permissions.additionalDirectories` 설정은 로드 안 함). 라이브 감시로 세션 중 변경 반영
- **`.agents/skills`는 이 문서 어디에도 발견 경로로 등장하지 않음.** Agent Skills 표준 스펙(agentskills.io)도 디스크 상 발견 위치를 정의하지 않음(스킬 디렉터리 내부 구조만 정의). → Claude Code가 `.agents/skills`를 스킬 발견 경로로 지원한다는 공식 문서 근거는 **없음** (이 리포의 `.agents/skills`는 Stage Runner가 DLC 스킬을 직접 실행하는 리포 자체 규약이지, Claude Code 스킬 발견 대상이라는 문서 근거 없음 — unverified)
- Claude Code frontmatter 필드(문서 표 기준): `name`(표시명; 디렉터리명이 기본, 호출명은 원칙적으로 디렉터리명에서), `description`(**`when_to_use`와 합쳐 1,536자에서 truncate**), `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context: fork`(+`agent`), `hooks`, `paths`(glob 한정 활성화), `shell`. 치환자: `$ARGUMENTS`, `$N`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`
- 참고: cloud/Cowork 세션은 로컬 `~/.claude/skills/`를 읽지 않고, 리포에 커밋된 `.claude/skills/`와 리포 선언 플러그인만 로드

## 미확인/불확실

- **ADK**: `callbacks/design-patterns-and-best-practices` 페이지는 존재 확인만 하고 내용 미fetch. `runtime/runconfig`, `runtime/api-server`, `runtime/cancel`, `sessions/session`(rewind/migrate), `context/`(caching/compaction), `events/` 페이지 미fetch. `types-of-callbacks`(115K)와 `artifacts`(61K)는 헤딩·Purpose·API 라인 추출 방식으로 읽었고 다국어 코드 블록 전문은 읽지 않음 — 요약된 정의·시그니처는 추출 라인에서 직접 인용했으나 코드 세부(예: 각 언어별 시그니처 차이 전부)는 미검증
- **Resume**: RequestInput 자체 문서(`graphs/human-input`)는 이번 라운드에서 재fetch하지 않음(이전 조사 범위). resume 문서의 "new_message = function response로 long-running function resume" 서술로 교차 확인만 함. `RunConfig` 수준의 resume 옵션 존재 여부 미확인
- **Ambient agents**: 명시적 "idempotency key" 메커니즘은 문서에 없음 — 문서는 at-least-once 전달을 전제로 stateless 설계 + DLQ 구성만 안내(멱등성 구현은 사용자 책임으로 읽히나 명시 문구는 없음)
- **Codex skill-creator**: 라인 수 상한은 "500라인 미만/<5k words"만 명시, BOM·인코딩·파일명 케이스 규칙 없음. `scripts/init_skill.py`·`quick_validate.py` 소스 내용은 미fetch(파일 존재만 확인). Codex 런타임이 스킬을 발견하는 경로는 skill-creator 문서상 `$CODEX_HOME/skills`(기본 `~/.codex/skills`) 서술뿐 — Codex 공식 런타임 문서로는 별도 확인 안 함
- **Claude Code**: Enterprise managed 경로의 구체 파일 경로는 settings 문서로 위임되어 있어 미확인. `.agents/skills`가 미래에 지원될지·다른 도구(예: Codex의 `.agents/`)와의 관계는 어떤 문서에서도 확인 못 함 — 부정 근거(문서에 없음)만 확보
- **버전 주의**: adk.dev 문서는 다언어(Python/TS/Go/Java/Kotlin) 통합 서술이라 "Supported in ADK Python vX" 배지를 기록했지만, 이 리포의 venv(google-adk 2.3.0)에서 각 API가 동일 시그니처로 존재하는지는 런타임 검증하지 않음(문서 조사 태스크 범위 밖)
