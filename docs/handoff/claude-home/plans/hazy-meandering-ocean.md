# Edge 데이터 전달 방식 선택 (per-edge data-passing) — 구현 plan

## Context
Design 캔버스 편집 모드에서 노드(기존 워크플로우/모듈)를 추가·엣지 연결할 수 있게 됐다.
사용자 요구: **각 엣지가 생성 ADK 코드에서 데이터를 어떻게 주고받을지 화면에서 선택 → 실제 코드 반영**
(A2A 원격 vs 내부 연결). 조사 결과 선택지(edge_kind 10종)와 UI 피커는 이미 있으나 **생성기가 무시**해서
선택이 장식적이다. 핵심 작업은 **생성기가 edge_kind를 실제 ADK 메커니즘으로 lowering**하는 것.

## 결정 (사용자 선택)
- 범위: **Phase 1(내부) + Phase 2(A2A) 모두**. route/loop는 dynamic-workflow 후속으로 분리 유지.
- 상태키 전달: **명시 매핑 우선 + 기존 {module_id}_output 컨벤션 fallback**(하위호환).
- **제네레이터 구조 강건화 우선**: 이 작업 직후 dynamic-workflow용 제네레이터 **대규모 개편**이 예정 →
  지금 변경/기능추가에 강건한 구조(전략 dispatch)로 먼저 정비한 뒤 새 기능을 얹는다.
- 실행: 서브에이전트 + codex 스킬을 **최대한 활용**(굵은 코드 위임→검증·통합, 경계마다 codex 리뷰).

## 조사 근거 (요약)
- `edge_kind`(`analyzer/types.ts:600-611`) ↔ ADK 2.x 메커니즘: event_output(기본 `Event(output)`→node_input),
  event_message, session/temp/user/app_state(`session.state` + 스코프 prefix), artifact(save/load_artifact),
  route(`Event(route)`), control(순서만), remote_a2a(`RemoteA2aAgent`, 네트워크).
- UI 피커 `GraphElementEditor.tsx` EdgeForm(225-307) 존재 / 검증 `graphMigration.ts` kind별 필수필드 존재.
- 생성기 `generate-adk-source.mjs`: 엣지=bare `(from,to)`만, 데이터는 `{module_id}_output` 상태 컨벤션
  (`_collect_tool_inputs` priority1=agents.config.yaml input_map → priority2=ctx.state → priority3=*_output 이름매칭…),
  state_key/artifact_key/a2a_contract_id/route_condition/port 전부 미사용. route/remote_a2a/boundary/loop는
  `assertRunnableGraphSupported`에서 거부(smoke 전용).
- ADK 문서 확인: 그래프 노드는 agents/tools/code/nested-Workflow. RemoteA2aAgent는 예제상 sub_agent로만 →
  **그래프 직속 노드 가능 여부는 Phase 2 spike로 실측**. A2A 스모크엔 원격 서버 필요(`adk api_server --a2a`).

---

## Phase 0 — 제네레이터 구조 정비 (behavior-preserving, PR-0)
목표: 새 edge-kind lowering(Phase 1/2)과 **장차 dynamic-workflow 개편**이 invasive 수정 없이 *얹히도록* 구조화.
- `scripts/generate-adk-source.mjs`의 lowering을 책임 분리:
  (1) graph resolve/검증, (2) **edge-kind별 데이터전달 전략**, (3) **node-kind별 선언 emit**, (4) 텍스트 조립.
- edge-kind/node-kind → 핸들러 **dispatch 테이블**(레지스트리)로 정리. 현재 분기(if/switch 산재)를 표로 흡수해
  `route`/`remote_a2a`/`*_state`/`artifact`/장래 loop·dynamic 추가가 "핸들러 1개 추가"로 끝나게.
- smoke/runnable 경로 공통화 가능한 부분만 추출(과도한 추상화 금지 — 사용자 요청한 확장점에 한정).
- **검증: 기존 regression-scenarios 전부 생성물 동일**(diff 0) — 동작 불변 증명. validate-artifacts/build/ast.parse.
- codex-rescue에 리팩터 초안 위임 → 내가 동작불변 검증·통합. codex 리뷰 1회.

## Phase 1 — 내부 전달 lowering + UI 정교화  (PR-A)
### 1A. UI 피커 (`packages/web/src/components/GraphElementEditor.tsx`)
- edge_kind 드롭다운을 "데이터 전달 방식"으로 재구성: `<optgroup>` 내부(event_output 기본/event_message/
  session·temp·user·app_state/artifact) · 제어(route/control) · 원격(remote_a2a). 옵션별 한 줄 설명 + 선택 시
  필수필드(state_key/artifact_key/route_condition/a2a_contract_id) 인라인 힌트(기존 조건부 렌더 확장).
- `GraphInspector.tsx`(읽기) 라벨 동기화. Korean copy 유지. chrome-devtools 스모크.
### 1B. 생성기 내부 lowering (Phase 0 dispatch에 핸들러 추가)
- **소비측(명시 우선)**: incoming 엣지가 `*_state`면 `state_key`(+스코프 prefix: session=무, temp/user/app)를
  입력 소스로 명시 매핑(기존 `_collect_tool_inputs` input_map 경로 재사용), `artifact`면 `ctx.load_artifact(artifact_key)`.
  미지정/event_output/control은 **현 컨벤션 fallback 유지**.
- **생산측**: outgoing 엣지가 키 지정 시 그 키로 기록(agent `output_key=<state_key>`, function `ctx.state[...]`/
  `ctx.save_artifact(artifact_key,…)`), 아니면 기존 `{module_id}_output`. **키 다른 다중 out-state 엣지**는 검증 감지(경고/거부).
- event_message는 `Event(message=)` 매핑. state/artifact는 이미 supported(route/remote_a2a/loop 거부 유지).
### 1C. 검증·테스트·문서
- 회귀 시나리오 `scenario-h-*`(state_key + artifact). validate-artifacts + 생성 번들 ast.parse + ADK api_server 스모크.
- 생성기 lowering 헬퍼 단위 점검, graphMigration 검증 보강.
- 문서: `CLAUDE.md`(build 불릿), `docs/workbench/validation.md`, `agent-factory-harness.md`, `docs/decision-log.md`.

## Phase 2 — A2A runnable lowering  (PR-B, high-friction)
### 2A. Spike (코드 前 게이트)
- google-adk[a2a] 설치 후 **RemoteA2aAgent를 그래프 `Workflow` 노드로 직접 쓸 수 있는지** 실측.
  가능→노드 직접 emit / 불가→래핑(LlmAgent sub_agent 또는 호출 FunctionNode) 확정.
### 2B. 생성기 (dispatch에 remote_a2a 핸들러 추가)
- `RemoteA2aAgent(name, description, agent_card=<a2a_contract.agent_card.agent_card_url>, use_legacy=False)`.
  엣지 `a2a_contract_id`→계약 조회(`a2a-contracts.json`/AnalysisResult.a2aContracts). auth/timeout/retry/fallback는
  config/interceptor 매핑 또는 명시 TODO. remote 거부 게이트 완화. a2aContracts approved 게이트 유지.
### 2C. mock 원격 + 시나리오
- 로컬 mock A2A 서버 예제(localhost agent-card.json + synthetic, **private endpoint/cred 금지**, runtime_mock 정책 일치).
- `scenario-i-remote-a2a-*`. E2E: mock 서버(`adk api_server --a2a --port 8001`) + 생성 소비 번들 → 원격 호출 성공.
### 2D. 문서·decision-log 갱신.

## 오케스트레이션 (Tier 3)
- 격리 worktree(꼬임 방지). 굵은 코드(Phase 0 리팩터, 생성기 lowering)는 서브에이전트/codex-rescue 위임→검증·통합.
- 커밋 경계마다 codex 리뷰(동작불변/엣지 lowering 정합/엔진·UI 경계/회귀). 문서 lockstep.
- PR 3개: PR-0(구조 정비) → PR-A(내부) → PR-B(A2A). 푸시/PR은 사용자 승인 시.

## 리스크
- RemoteA2aAgent 그래프-노드 가용성(→2A spike 선검증). 다중 out-state 키 충돌(→검증 차단).
- 컨벤션 fallback 회귀(→하위호환 테스트). Phase 0 동작변화 위험(→생성물 diff 0 게이트).
- A2A 스모크 별도 서버 필요(codex 샌드박스 TCP 불가 → 내 환경 실행).

## 실행 0단계 (git)
로컬 `main`=65abb4c, PR #30 원격 머지됨(로컬 미반영). `git checkout main && git pull` 후
worktree/브랜치 `refactor/adk-generator-structure`(PR-0)부터 시작. 현재 체크아웃 feat/adk-human-input-runnable.

## Out of scope
route/loop runnable lowering(dynamic 후속), 카탈로그 YAML 직접 편집, .agents/skills, docs/archive.

## 검증(공통)
`cd packages/web && npm run build`; `npm run test:analyzer`; `node scripts/validate-artifacts.mjs`;
생성 번들 `ast.parse` + ADK api_server 스모크; chrome-devtools EdgeForm 렌더/검증.
