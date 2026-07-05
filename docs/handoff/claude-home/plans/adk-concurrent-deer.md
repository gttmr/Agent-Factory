# Agent Factory 목표 주도 반복 개선 계획

## Context
- 수많은 세션을 거치며 문서(활성 39개 + 잔재 `.omo/**` 221개 등 md 347개)와 코드가 어긋난 상태. **리포 문서는 절대 권위가 없다** — 진실 위계: ① 실제 실행 결과 ② adk.dev 공식 문서(adk-docs MCP) ③ 코드 ④ 리포 문서(현실에 맞게 갱신되는 대상).
- 이 세션(오케스트레이터)은 계획·판단·검증만. 탐색·구현은 **codex gpt-5.5 (high, 어려우면 xhigh)** 기본. Claude 서브에이전트는 MCP 필요 작업(adk-docs, chrome-devtools)만.
- 기준: main == 57e7532. 탐색(문서 인벤토리 1회 + codex 감사 2회) 완료, 백로그 시드 확보됨.

## 북극성 목표 = 루프 종료 조건
개발자·현업이 함께 쓰는 협업 도구로서 아래 5개가 실데모로 통과:
1. 시각화된 그래프를 보며 협업 (리뷰/코멘트/승인 흐름 포함)
2. 자연어 입력(기존 skill 경로: 요구사항→분석→그래프 생성, 부분 재실행 포함)으로 노드/엣지 생성
3. 캔버스 수동 편집
4. 사용자 친화적 UI/UX
5. adk web(`adk api_server --with_ui`, 8765) 연동으로 생성된 워크플로우 실데모 — **Gemini 실호출 포함** (사용자가 API 키 제공)

## 확정 정책 (사용자 답변)
- NL 노드/엣지 생성: 신규 캔버스 어시스턴트 아님. 기존 skill 기반 생성의 품질·부분 재생성 UX 개선.
- 모순 판정: 실행 결과 > adk.dev > 코드 > 문서 순으로 실증, decision-log 기록.
- 브랜치: main에서 클러스터별 `codex/<topic>` 브랜치, PR 경계당 1커밋, codex 리뷰를 커밋 경계마다, **push/PR 전 사용자 확인**.
- 잔재 문서: 꼼꼼히 읽고 유용 정보 회수 후 docs/archive/ 이동.

## Phase A — 실증 기반선 (승인 후 즉시)
1. [완료 2026-07-02] **ADK 주장 23건 검증** — venv 2.3.0 라이브 인트로스펙션+실행으로 22건 CONFIRMED, 1건 CONTRADICTED:
   - **C9 신규 code-bug**: emitAuthInterceptor(remote-a2a.mjs:107)가 2-인자/Event 반환 훅을 생성하나 2.3은 `before_request(ctx, a2a_request, params)` → `(message|Event, params)` 튜플 계약. bearer_env/metadata_env 번들은 원격 호출 즉시 TypeError. → codex 위임 완료(브랜치 codex/a2a-interceptor-adk23-contract).
   - a2a-launcher 호환 패치는 2.3.0에서도 **여전히 필요** (get_fast_api_app의 function-local `import json` 버그 라이브 재현, 패치 적용 시 A2A 라우트 복구 확인) — 제거하지 말 것.
   - `Event(route=...)`는 before-validator로 정상 지원(라이브 라우팅 실행 검증). RequestInput/FunctionNode/@node/ctx.run_node/save·load_artifact/api_server 플래그/get_fast_api_app kwargs/agent card 0.3.0 모두 정상.
   - 버전 이력: 2.0(05-19)·2.1(05-23)·2.2(06-04)·2.3(06-18), 관련 API rename 없음. 잔여 스테일: taxonomy.md "2.0 baseline" 스냅샷, 생성 코드 "ADK 2.1 워크플로우" 라벨 → C3에 편입.
   원 체크리스트: codex가 수집한 체크리스트 — `Workflow(edges=)`, `LlmAgent(output_key=)`, `McpToolset(connection_params=StreamableHTTPConnectionParams)`, `FunctionNode(func=, rerun_on_resume=)`, `JoinNode`, `RequestInput(message=,payload=,response_schema=)`, `adk_request_input` resume, `Event(route=)`, `ctx.state`/`save_artifact`/`load_artifact`/`types.Part`, `RemoteA2aAgent(timeout=, use_legacy=False)`, `A2aRemoteAgentConfig(request_interceptors=)`, `@node`/`ctx.run_node`, `adk api_server` 플래그, `get_fast_api_app(web=,a2a=,use_local_storage=)`, agent card `protocolVersion 0.3.0`, ADK 2.2/2.3 호환 패치 — 대조 페이지: graphs/{data-handling,dynamic,human-input,routes}, a2a/*, runtime/api-server, sessions/state, artifacts, release-notes.
   - **ADK 버전 표기 불일치 해소 방향 결정**: 문서 "ADK 2.0 baseline" vs `requirements/adk-runtime.txt`의 `google-adk[a2a,mcp]>=2.1.0` vs 2.2/2.3 패치 주석.
2. [완료] **런타임 환경 점검**: venv 유효, **google-adk 2.3.0 설치**, GOOGLE_API_KEY는 `.agent-factory/runtime.env`에 존재. **사용자 결정: ADK 2.3 기준으로 작업** → C3 방향 확정 (docs "2.0 baseline"·requirements ">=2.1.0"·2.2/2.3 패치 주석을 2.3 기준으로 정합).
3. **E2E 워크스루** (chrome-devtools, 5173 고정 포트): 신규 요구사항 1건을 분석→설계(그래프 검토·편집)→빌드(runnable)→verify→run(adk web 실데모)까지 실제 통과 시도. 끊기는 지점·불친절 UX 전부 스크린샷과 함께 기록. scenario-g(HITL)·scenario-i(remote A2A, mock_remote 서버) runnable 생성→실행 확인.
→ 결과를 백로그에 병합하고 우선순위 확정본을 사용자에게 보고.

## 진행 로그 (2026-07-03 새벽 기준)
- **E2E 실데모 성공 (북극성 기준 5 실증)**: req-page-recommendation-required 루트로 adk api_server(2.3.0) + ADK dev UI에서 전체 워크플로우 완주 — Mock Lab MCP 어댑터 호출, Gemini 실추론 3회(목적 분류·인자 생성·결과 종합, 실제 인사이트 생성), `adk_request_input` HITL 일시정지/재개 3회, 병렬 fan-out/join, 27 이벤트, state 채널 13개 기록. 스크린샷 /tmp/af-screens/e2e-01~10.
- **신규 요구사항 E2E**(req-vacation-approval): 분석→설계 승인까지 UI로 완주. 빌드에서 C10 버그 발견(모듈 재사용 심볼 충돌). C10 수정 후 생성 성공 확인.
- **수정 완료 브랜치 3개** (커밋·검증 완료, 리뷰·머지·push 대기):
  - codex/validator-stage-run-ids 987c02a (C1)
  - codex/a2a-interceptor-adk23-contract 06f0d35 (C9)
  - codex/runnable-node-symbol-collision 749b070 (C10, scenario-k 회귀 포함)
  - 주의: C9·C10이 scripts/adk-source/remote-a2a.mjs 동시 수정 — 머지 시 상호작용 확인.
- **codex 리뷰 보류**: 커밋 경계 리뷰 시도 중 세션 한도 메시지(reset 4:10am KST) — 재개 후 재실행 (기존 피드백: codex 탓 아님, 재시도 금지 후 재개 시 자유 재실행).
- **운영 패턴 확립**: codex는 사이드 워크트리 + `--cwd` 라우팅으로 위임 (Agent worktree 격리 비상속). codex 샌드박스가 worktree의 git 메타데이터 쓰기를 막을 수 있음 → 커밋은 내가 수행.

## 진행 로그 추가 (2026-07-03 오전)
- **통합 브랜치 `integration/c1-c9-c10`** 생성: C1(FF)+C9+C10 머지. 충돌 3건 수동 해소 — decision-log 2건(항목 순서), remote-a2a.mjs 1건(C9의 3-인자 계약 + C10의 per-node 심볼명 = target 기준으로 통합, 미사용 `module` 변수 제거). 통합 후 전체 테스트 green: 생성기 38 pass, validator 17 pass, remote-a2a 6 pass, validate-artifacts OK. **C9·C10 상호작용 확인됨**(인터셉터 함수명이 이제 per-node target 기준).
- **휴가 루트 E2E UI 완주**: build(runnable, C10 생성기로 26 stub 파일, per-node 심볼 확인) → verify(validate-artifacts exit 0). 신규 요구사항이 분석→검증까지 UI만으로 통과.
- **C2 위임 중**: codex가 af-wt-c2에서 승인 revoke 시 stage status demotion 수정 중.
- **커밋 경계 리뷰**: codex 3커밋 리뷰 재기동(task-mr45532z), 결과 대기.

## 워크스루 최종 확인 (2026-07-03, task A3 완료)
북극성 5개 기준 실증 완료:
1. **그래프 협업**: 15노드 Graph IR 렌더링, 노드/엣지 선택 인스펙터, 모듈 검토 승인/보류/반려, 해소 메모 흐름 — 모두 동작. (①)
2. **자연어 생성**: 요구사항 텍스트 → Analyze/Design skill(gpt-5.5)이 그래프+계약 생성. (②, 기존 skill 경로)
3. **수동 편집**: 편집 모드 노드 종류 팔레트(판단/API·도구/조건분기/사람입력/병합/반복/서브워크플로우/외부Agent/대기)로 노드 추가→라이브 검증(미연결 노드 오류 1 표시)→저장/취소 확인. 취소 시 원복. (③)
4. **UX**: 스테이지 게이트·스텝 레일·라이브 상태 배지 동작. goal-gap 백로그(C7) 별도. (④)
5. **adk web 실데모**: adk api_server 2.3.0 + dev UI, Mock Lab MCP 실호출, Gemini 실추론 3회, HITL 3회, 완주. (⑤)
→ 두 요구사항(page-recommendation 기존 빌드, vacation-approval 신규) 모두 실증. **북극성 목표 자체는 이미 달성 가능**; 남은 것은 발견된 결함/UX 갭 소진.

## C8·C14 완료 (2026-07-03 오후) — 백로그 소진
integration @1637477 = **13개 클러스터**. C8 3커밋(validator loop-decision parity → scenario-d import 200 실증 · subtypeGlyph satisfies Record · useAnalyze 훅 제거) + C14 1커밋(Run 화면 `Mock Lab: … 중지됨 [시작]` → 클릭 → `준비됨`, 브라우저 검증, 스크린샷 c14-prereq-*.png). 빌드+테스트 green.
- 개발 환경 노트: 서버 코드 머지 시 Vite 미들웨어 HMR이 MockProcessRegistry 세대를 갈아 고아 mock 프로세스 발생 → dev 서버 재기동 후 검증(메모리 기록).
- 잔여: push(사용자 트리거 시 Phase C 최종 감사 후 일괄) · C7 #5(DESIGN-DECISION 보류).

## 사용자 결정 (2026-07-03 오후)
- push는 나중에 일괄. C14는 가벼운 UX만. C8은 계획대로. 중요 판단은 Fable 5(메인 세션).
- 진행: C8(af-wt-c8, 3커밋: validator parity + subtypeGlyph typed Record + useAnalyze 훅 제거) · C14(af-wt-c14, 1커밋: Run 화면 Mock Lab prerequisite + 시작 버튼) codex 위임 중.
- C8에 부수 발견 폴딩: codexAnalyzer.ts:1566/1576이 route 엣지만 허용 vs graphMigration.ts:1064 "route or loop decision" → scenario-d import 422.

## 최종 상태 (2026-07-03) — 11개 클러스터 통합·검증 완료, push 대기
`integration/c1-c9-c10` = 390d7a3. 전체 green: web build, generator 40, validator 17, remote-a2a 6, runtime-robustness 1, terminal-output 1, validate-artifacts OK. 모든 워크트리 정리(주 체크아웃만).
- **코드/계약(6)**: C1 validator run-id · C2 승인 revoke 투영 · C9 A2A 인터셉터 · C10 노드 심볼 충돌 · **C11a 어댑터 우아한 실패(JSON-safe, 실 adk 런타임 검증)** · **C11b 종료 완료 이벤트(Event content, JSON-safe return)**
- **문서(4)**: C3 ADK 2.3 · C4 CLAUDE.md/harness · C5 taxonomy enum · C6 잔재 archive
- **UI(2)**: C12 설계 step(#1·#4, 브라우저 검증) · C13 키보드 노드 이동(#3, 브라우저 검증)
- **남음**: C14(#2a Run prerequisite UI — C11로 크래시 해결돼 UX-nice로 강등) · C8(마이너: subtypeGlyph typed Record, 레거시 훅) · C7 #5(긴 실행 부분결과 = DESIGN-DECISION, 사용자 보류) · **push 결정(A/B/C 미응답)**
- **부수 발견**: scenario-d 템플릿이 파일 validator는 통과하나 서버 import validator는 `route_aliases` 로 422 거부 — 두 검증 표면 불일치(미처리, C8과 함께 검토 후보).
- **핵심 교훈(메모리 기록)**: 생성기 변경은 py_compile/유닛테스트 불충분 — 반드시 실 adk 런타임 실행 검증. ADK가 LlmAgent node_input에 json.dumps → 노드 반환 payload는 JSON 직렬화 가능해야 함.

## C7 진행 (2026-07-03) — 확정 버그 수정
- **C12 완료·검증·머지**: #1 설계 실행 step false-complete + #4 활성 승인 step "잠김" 수정. 브라우저 검증 통과(imported graph → 실행=대기; ?step=approve → 승인=현재). integration에 머지.
- **C11 재작업 중(v2)**: 첫 시도가 generator 유닛테스트+py_compile 통과했으나 **adk 런타임에서 크래시** — 강력한 교훈. 근본 원인: ADK가 LlmAgent node_input에 `json.dumps`를 함(`_llm_agent_wrapper.py:197`). 따라서 **LlmAgent로 흘러가는 모든 node return payload는 JSON 직렬화 가능해야 함**. C11a 버그(degraded payload에 `"previous": node_input` 포함 — 첫 노드에선 node_input이 genai Content = 직렬화 불가)와 C11b 버그(FunctionNode가 `types.Content` 반환 → downstream node_input으로 전파되어 크래시) 둘 다 이 원인. → integration에서 C11 전체 롤백(현재 C1-C6,C9,C10,C12만), v2 재위임에 **필수 런타임 실행 게이트** 추가(InMemoryRunner로 Content 초기입력 실행, 미도달 MCP 케이스 크래시 없음 증명 요구).
- **핵심 검증 원칙 확립**: 생성기 변경은 py_compile/유닛테스트로 불충분 — 반드시 adk 런타임으로 실제 실행해야 함.

## 통합 완료 상태 (2026-07-03) — 8개 클러스터
`integration/c1-c9-c10` = C1·C2·C9·C10(code) + C3·C4·C5(docs) + C6(잔재 archive). 전체 검증 green. 워크트리 모두 정리(주 체크아웃만 남음). 클러스터 브랜치는 PR 단위로 보존.
- C6: 브리프 00-16+_perf-notes → docs/archive/follow-ups/ (100% rename, 이력 보존), 활성 follow-ups = 17+INDEX+STATUS, 루트 STATUS.md 07-03 갱신·모순 제거, 머신 경로 스크럽.
- **남음**: C7(goal-gap UX 7건 — 북극성 경험), C8(마이너), push 결정(A/B/C 미응답).

## (이전) 통합 상태 (2026-07-03, `integration/c1-c9-c10` = 주 체크아웃 현재 브랜치)
- 머지 완료 + 전체 검증 green: C1(validator run-id) · C9(A2A 인터셉터 ADK2.3) · C10(노드 심볼 충돌) · C2(승인 revoke stage status). 빌드/생성기38/validator17/remote-a2a6/crud test/validate-artifacts 모두 통과.
- 커밋 경계 codex 리뷰: C1/C9/C10 각각 clean, 유일 SHOULD-FIX(C9·C10 remote-a2a.mjs 결합)는 통합 시 이미 정확히 반영. C1 NIT(build/verify run-id 전용 유닛테스트 부재)는 템플릿 기본 커버리지 존재 → 선택적 강화.
- **push 대기**: 사용자 confirm-before-push 정책. 브랜치 5개(clusters) + integration 1개 로컬 존재. push/PR 방식(개별 PR 5개 vs integration 1개 PR) 사용자 결정 필요.
- 진행 중: `codex/docs-reconcile-adk23`(af-wt-docs, integration 기반)에서 C3+C4+C5 문서 정합 3커밋 작성 중.

## Phase B — 반복 수정 루프 (백로그 소진+목표 달성까지)
iteration = 클러스터 1개:
1. codex(gpt-5.5 high/xhigh)에 구현 위임 (읽기 전용 아님, 해당 브랜치에서)
2. 실증 검증: `npm run build` + `node scripts/validate-artifacts.mjs` + `npm run test:analyzer` + **해당 흐름 실제 구동** (UI면 chrome-devtools 스크린샷 /tmp/af-screens/, 런타임이면 adk 실행)
3. ADK 동작 관련이면 adk.dev 재확인
4. 활성 문서 동기 갱신(같은 변경셋) + 설계 결정이면 decision-log 추가
5. 커밋(PR 경계당 1개) → codex 리뷰 → 수정 반영 → push 여부 사용자 확인
6. 북극성 5개 기준 재평가, 백로그·이 계획 파일 갱신
페이스: 세션 내 연속 진행. 대기(외부 확인 등)로 세션이 늘어지면 /loop dynamic(ScheduleWakeup, 유휴 1200s+)로 지속.

## 초기 백로그 (Phase A 결과로 확정, 현재 우선순위)
- **C1 code-bug**: validator run-id 패턴이 `(analyze|design)`만 허용 — 서버는 build/verify run 기록 (`scripts/artifact-validation/constants.mjs:203` vs `packages/web/server/stageRunner.ts:32`). build/verify 이력 있는 루트 검증 실패. +회귀 테스트.
- **C2 code-bug**: 승인 true→false 재토글 시 `stages.<stage>.status`가 complete 잔존 (`packages/web/server/afArtifactCrudApi.ts:83-94`). 승인 불리언의 순수 투영으로 수정. +회귀.
- **C3 adk-mismatch/버전**: ADK 버전 표기 정합(2.0 문서 vs 2.1 requirements vs 2.2/2.3 패치) — Phase A 검증 결과에 따라 문서·requirements·주석 일치화. `[a2a]` extra "조건부" 문서 주장 vs 무조건 설치 현실도 함께.
- **C4 doc-stale (CLAUDE.md/harness)**: Stage Runner 4스테이지 반영, Build primary 경로(artifact-sync run), `/mock-lab` 라우트, 누락 훅 7개, StageShell 표현, "proposed-first" build 예외, harness의 artifact-sync Graph IR 문구.
- **C5 doc-stale (taxonomy.md)**: `mcp` runtime binding 추가, `runtime_contract_kind`·`node_kind`·`edge_kind`·`invoke_binding`/`decision_owner`/`call_control` enum 테이블 완성.
- **C6 잔재 정리** (스코프 정정 2026-07-03): `.omo/**` 221개는 **gitignored 로컬 omo 플러그인 캐시 — 리포 콘텐츠 아님, 대상 제외**. `.debug-journal.md`도 untracked → 제외. 실제 대상 = git-tracked 잔재만: 루트 STATUS.md ↔ docs/workbench/follow-ups/STATUS.md 모순 해소(단일 소스, follow-ups 07-02판이 코드 정합·최신), follow-ups 21개(00-16 구현완료·17 잔여) 유용 정보 회수→docs/archive/ 이동, 머신 종속 절대경로 제거.
- **C7+ goal-gap**: Phase A 워크스루에서 나온 UX/기능 개선. 진행 중 발견(req-vacation-approval, 신규 요구사항 E2E):
  - **[중대] runtime_contracts_approved 게이트가 신규 요구사항에서 UI만으로 통과 불가** — 계약 인라인 인스펙터 parked 상태에서 readiness issue(6계약×7~9건) 해소 경로가 "Stage Runner 재실행 또는 외부 편집"뿐. Design Skill Runner 재실행으로 보완되는지 검증 중.
  - 분석 run 11.4분 소요(gpt-5.5) — events 스트림은 좋으나 긴 대기. 부분 재실행/증분 UX 후보.
  - 키보드 노드 이동(화살표)은 position 저장 안 됨(마우스 드래그의 onNodeDragStop만 저장 추정) — a11y/UX 갭.
  - 승인 step 활성 중에도 step nav가 "잠김" 표시(게이트 미완료 시) — 라벨 파생 버그 의심.
  - 긍정 확인: 분석 품질(모듈 9개·A2A 과잉 제안 없음·근거 있는 가정), Graph IR 품질(15노드 병렬/조인/라우터/HITL 정확), 모듈↔노드 상태 미러링, missing-info 소프트/하드 게이트 동작, diff-후-적용 흐름 모두 양호.
  - 워크스루 잔여: Design run 재실행으로 계약 보완 → 계약 승인 → build(runnable) → verify → run(adk web+Gemini 실호출) → 구조적 수동 편집(노드/엣지 추가) 검증.
  - **C7 진행 중(2026-07-03)**: codex 읽기전용 조사로 7건 분류 중(CONFIRMED-BUG/DESIGN-DECISION/ADK-BEHAVIOR). 라이브 확인 완료: #2 Run 화면이 venv prerequisite만 노출, **Mock Lab MCP prerequisite는 미노출** → adapter가 미기동 MCP 호출 시 adk web에서 불투명 ExceptionGroup(409). 문서화된 의도(prerequisite/blocked+start action 노출)와 불일치 = 실제 갭. 수정은 CONFIRMED-BUG만, DESIGN-DECISION은 사용자 보류.
- **마이너**: subtypeGlyph typed Record/테스트, `useAnalyze`·runtime-chat 레거시 잔존물 처리 판단.

## Phase C — 최종 감사
codex + 서브에이전트 whole-repo 문서/계약 감사 1회 → E2E 데모 최종 재현(Gemini 실호출) → STATUS.md/핸드오프 갱신 → 워크트리/브랜치 정리.

## 검증 방법 (매 iteration 공통)
- 빌드/정적: `cd packages/web && npm run build`, `node scripts/validate-artifacts.mjs`, `npm run test:analyzer`
- UI: dev 서버 5173 고정(`lsof` 선확인), chrome-devtools MCP 스크린샷 필수
- 런타임: `.agent-factory/runtime/.venv`으로 `adk api_server --with_ui`(8765) 구동, ADK dev UI를 브라우저로 조작해 워크플로우 실행 확인
- 스모크 시딩: `POST /api/af {requirement_id}` + fixture, 종료 후 임시 artifact root 삭제

## 승인 후 즉시 할 일
1. 메모리 갱신: "서브에이전트는 codex gpt-5.5 high/xhigh 기본"(기존 opus 메모리 대체), "리포 문서 비권위·실증 우선", "북극성 목표 5개"
2. Phase A 착수
