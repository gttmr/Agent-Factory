# Agent Factory — 다음 세션 제안 백로그 (2026-07-04 작성)

> 2026-07-02~04 문서↔코드 모순 감사 + 수정 마라톤(PR #56, 클러스터 15개 + progress narrative)을 끝내며,
> 세션 중 실제로 관찰·판단한 근거를 바탕으로 "다음에 하면 좋은 일"을 우선순위로 정리한 파일.
> 다음 세션은 이 파일을 읽고 새로 계획을 세운다. (계획 이력: ~/.claude/plans/adk-concurrent-deer.md)

## 0. 종료 상태 스냅샷

- **PR #56 머지 완료** (2026-07-03T15:53Z): 감사 클러스터 15개 + Stage Runner progress narrative → 리모트 main = 로컬 main = `23dd34b`. narrative는 실제 gpt-5.5 SDK run으로 브라우저 검증(진행 메모 + 할 일 0/4 + 현재 항목 렌더링 확인, 스크린샷 /tmp/af-screens/narrative-agent-message.png) 후 반영.
- 워크트리/브랜치 정리 완료: 주 체크아웃(main)만 남음. 클러스터 브랜치 17개 + integration + PR 브랜치(로컬/리모트) 삭제. 보존: `docs/edge-data-passing-followups`(미머지, 이 감사 이전 브랜치 — 내용 확인 필요), `backup/taxonomy-axis-prework-20260620`(백업).
- 북극성 5개 기준(그래프 협업 · NL 생성 · 수동 편집 · 친화적 UX · adk web 실데모)은 **이미 실증 완료** — page-recommendation(기존)·vacation-approval(신규) 두 요구사항이 분석→검증→adk web 실행(Gemini 실추론 + Mock Lab MCP + HITL 3회)까지 UI로 완주.
- 남은 것은 "달성 가능"을 "매끄럽게 반복 가능"으로 만드는 UX/강건성 갭 소진.

## 1. 우선순위 제안 (판단 근거 포함)

### P1 — Design 계약 편집 경로 복원 (INSPECTOR_ENABLED 재검토)
- **관찰된 문제**: 신규 요구사항(req-vacation-approval) E2E에서 `runtime_contracts_approved` 게이트를 UI만으로 통과할 수 없었다. 인라인 계약 인스펙터가 `INSPECTOR_ENABLED=false`로 parked라 readiness issue(6계약 × 7~9건)를 해소할 경로가 "Design Stage Runner 재실행 또는 외부 편집"뿐.
- **판단**: 북극성 "비개발자 협업" 관점에서 가장 큰 실질 갭. Stage Runner 재실행은 11분+ 소요라 계약 필드 하나 고치는 수단으로 부적절.
- **제안**: (a) 인스펙터 재활성 + 계약 필드 편집 UX 정리, 또는 (b) Runtime 계약 탭에 최소 편집 폼. 설계 결정이므로 사용자와 방향 합의 후 codex 위임. decision-log 갱신 필수.

### P2 — 긴 실행 UX 후속 (부분 재실행 / 증분)
- **관찰**: gpt-5.5 분석 run 11.4분. 이번에 넣은 진행 narrative(진행 메모 + 할 일 N/M)로 "지금 뭐 하는지"는 보이게 됐지만, 재실행 비용 자체는 그대로.
- **제안 후보**: 분석 부분 재실행(모듈 후보만/그래프만), Design run에 기존 결과 시드, 혹은 run 중간 취소 후 부분 적용. 전부 설계 결정 성격 — 요구 수집 먼저.

### P3 — `.agents/skills/_shared/adk-2.md` stale baseline 갱신
- **관찰**: pre-push 감사에서 확인된 유일한 미수정 stale 문서. ADK 2.3 기준으로 갱신 필요.
- **차단 사유**: AGENTS.md 정책상 `.agents/skills`는 명시적 skill-sync 지시가 있어야 편집 가능. **다음 세션에서 사용자에게 지시를 받고 진행**.

### P4 — 테스트 강건화 (소규모, codex 반나절감)
- **인터셉터 테스트 실행형 전환**: 현 remote-a2a 테스트는 A2A auth 인터셉터의 소스 형태만 검사. 실제 실행(3-인자 튜플 계약) 검증으로 승격. (pre-push 감사 deferred 항목)
- **C1 NIT**: build/verify run-id 전용 유닛테스트 보강 (템플릿 기본 커버리지만 존재).
- **fake 러너 narrative 이벤트 단정**: fake 러너의 codex_event(agent_message/todo_list) 방출 배선은 PR #56에 포함됨. 다만 stageRunner.test.ts에 그 이벤트 방출을 단정하는 테스트는 아직 없음 — 회귀 방지용으로 추가 후보.

### P5 — Mock Lab 프로세스 수명주기 (dev 편의)
- **관찰**: Vite 미들웨어 HMR이 MockProcessRegistry 세대를 갈아치우며 고아 mock-server 자식이 남는다. 지금은 "서버 코드 머지 후 dev 서버 재시작" 수칙(dev note)으로 회피 중.
- **제안**: registry를 HMR-safe 전역(예: globalThis 앵커)으로 승격하거나 세대 교체 시 이전 세대 자식 정리. 낮은 위험·중간 가치.

### P6 — 미머지 브랜치 `docs/edge-data-passing-followups` 처분 결정
- **관찰**: 이 감사 이전부터 있던 로컬 브랜치. main 미포함 커밋 3개 — follow-up 브리프 10–14 문서 + `agent execution mode selection` 기능 커밋(generate-adk-source/validator/schema 등 32파일, +562) + graph UI dedup 가드레일 문서.
- **주의**: main은 이후 크게 진행돼(감사 15클러스터) 충돌/중복 가능성 큼. 특히 agent_execution_mode는 main에 이미 다른 형태로 존재(GraphElementEditor에 chat/single_turn). 문서 커밋의 브리프 10–14는 이번에 docs/archive로 이동한 것과 겹칠 수 있음.
- **제안**: 내용 대조 후 (a) 유효분만 체리픽/재구현, (b) 나머지 폐기 + 브랜치 삭제. 사용자 확인 필요.

### P7 — 데모 재현 가이드 고정
- **판단**: 북극성 실증이 세션 로그에만 존재. 신규 참여자가 30분 안에 같은 데모(스모크 시딩 → 4스테이지 → adk web 실행)를 재현할 수 있는 짧은 가이드(docs/workbench/ 아래)가 있으면 회귀 확인에도 쓸 수 있다.
- 주의: 기존 문서(harness, CLAUDE.md)와 중복되지 않게 "실행 순서 + 검증 포인트"만.

## 2. 운영 노트 (다음 세션에 그대로 적용)

- **진실 위계**: ① 실제 런타임(UI 포함) ② adk.dev 공식 문서 ③ 코드 ④ 리포 문서. 리포 문서는 절대적 권위 없음.
- **역할 분담**: 메인 세션(Fable 5) = 계획/판단/커밋/머지. 코드 탐색·구현·리뷰 = codex gpt-5.5 high(난이도 따라 xhigh). Claude 서브에이전트는 MCP 종속 작업만.
- **codex 위임 패턴**: 사이드 워크트리(`git worktree add -b <branch> /home/ilmaswsl/work/af-wt-X <base>`) + 프롬프트 선두 `--cwd <worktree> --model gpt-5.5 --effort high` + FORWARDER NOTE. node_modules는 주 체크아웃에서 심링크(gitignore 안 됨 — `git add -A` 금지, 경로 명시 스테이징). codex 샌드박스가 git 메타데이터 쓰기를 막으므로 커밋은 메인 세션이 수행.
- **생성기 검증 게이트**: generate-adk-source 변경은 유닛테스트/py_compile로 불충분 — **반드시 실 adk 런타임 실행**(InMemoryRunner 또는 adk api_server)으로 검증. LlmAgent로 흘러가는 node payload는 JSON 직렬화 가능해야 함(ADK가 node_input을 json.dumps).
- **UI 검증**: dev 서버 5173 고정, chrome-devtools MCP 스크린샷(/tmp/af-screens/) 필수. 서버 코드 머지 후에는 dev 서버 재시작(HMR 고아 프로세스).
- **런타임 환경**: ADK 2.3 venv `.agent-factory/runtime/.venv`, GOOGLE_API_KEY는 `.agent-factory/runtime.env`(출력 금지).
- **push 정책**: 사용자 확인 후 push. 커밋은 PR 경계당 1개, 커밋 경계마다 codex 리뷰.

## 3. 포인터

- 직전 계획/이력: `~/.claude/plans/adk-concurrent-deer.md`
- PR #56: https://github.com/gttmr/Agent-Factory/pull/56
- 프로젝트 하네스: `docs/workbench/agent-factory-harness.md` · 결정 로그: `docs/decision-log.md`
- 회귀 시나리오: `templates/regression-scenarios/` (HITL=scenario-g, remote-A2A=scenario-i)
