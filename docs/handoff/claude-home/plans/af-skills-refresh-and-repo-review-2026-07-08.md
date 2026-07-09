# AF 스킬 정비 + 전체 리뷰 캠페인 실행 계획 (2026-07-08)

> **For agentic workers:** 이 계획은 오케스트레이션 계획이다. 메인 세션(Fable 5)이 단계를 순서대로 실행하며,
> 코드/문서 작성과 리뷰는 codex gpt-5.5 xhigh 서브에이전트에 위임한다(사용자 지시). 체크박스로 진행을 추적한다.

**Goal:** (1) `.agents/skills` DLC 스킬 4종 + `_shared`를 ADK 2.3 · 현행 코드베이스 · google-agents-cli 스킬 관례 기준으로 재작성하고(저성능·짧은 컨텍스트 모델이 단계별로 소비 가능한 구조), 모순 판정 증거를 남긴다. (2) 리포를 클러스터로 쪼개 리뷰하여 slop 제거·단순화하고 UI/UX 개선 제안서를 만든다.

**Architecture:** 메인 세션이 MCP 종속 작업(adk.dev 문서 수집, 스크린샷)과 판단/커밋을 담당. codex xhigh가 사이드 워크트리에서 갭 분석→초안→구현→리뷰. 진실 위계: ① 실제 런타임 ② adk.dev 공식 문서 ③ 코드 ④ 리포 문서. 리포 범위 규칙(AGENTS.md·CLAUDE.md)은 google-agents-cli 관례보다 우선.

**Tech Stack:** codex CLI(gpt-5.5 xhigh, 사이드 워크트리), adk-docs MCP, chrome-devtools MCP, node scripts/validate-artifacts.mjs, npm run build / test:analyzer.

## Global Constraints

- ADK 기준선: **ADK 2.3** (`google-adk` 2.3.0, venv `.agent-factory/runtime/.venv`). requirements floor는 `>=2.1.0` 유지.
- `raw_requirement_to_code=false` 불변. 스킬·문서 어디에서도 raw requirement → 코드 경로를 허용하지 않는다.
- 리포 범위: 배포 스크립트·private endpoint·credential·운영 코드 금지. google-agents-cli의 deploy/publish/observability 수명주기는 **채택하지 않는다**(구조·교육 방식만 차용).
- 스킬 소비자 = 저성능·짧은 컨텍스트 모델: SKILL.md는 짧게, 단계 진입 시 해당 단계 참조 1개만 읽는 progressive-disclosure 구조. "Required Reading N개 선독" 패턴 금지.
- 모순 발견 시: 증거 원장(`docs/workbench/skill-refresh-evidence-2026-07.md`)에 [출처 A vs 출처 B → 판정 + 근거] 기록. 설계 결정은 `docs/decision-log.md`에도 항목 추가.
- 커밋: PR 경계당 1개, 커밋 경계마다 codex 리뷰. **push는 사용자 확인 후**.
- 스킬/생성기 계약이 바뀌면 schemas·validator·docs 동일 변경 세트에서 갱신 (AGENTS.md 규칙).
- 워크트리: `git worktree add -b <branch> /home/ilmaswsl/work/af-wt-<name> main`. node_modules는 주 체크아웃에서 심링크(`git add -A` 금지, 경로 명시 스테이징).

---

## Phase A — ADK 2.3 근거 팩 수집 (메인 세션, MCP 종속)

- [x] **A1.** adk-docs MCP로 `https://adk.dev/llms.txt` fetch → graphs 관련 페이지 URL 목록 확정.
- [x] **A2.** 다음 페이지를 fetch해 워크트리 내 미추적 디렉터리 `.evidence-adk23/`에 저장 (커밋 안 함, codex 입력용):
  - `graphs/routes`, `graphs/data-handling`, `graphs/human-input`, `graphs/dynamic` (사용자 명시 4종)
  - `graphs/` index, A2A 관련 1~2페이지 (remote_a2a 스킬 근거)
- [x] **A3.** 각 문서에서 스킬에 반영할 핵심 사실(요약 + 버전 조건)을 `evidence-pack-summary.md`로 정리 (codex에 함께 전달).

## Phase B — 스킬 정비 (PR-1: `codex/skills-adk23-refresh`)

- [x] **B1. 워크트리 생성** `af-wt-skills`, 브랜치 `codex/skills-adk23-refresh`.
- [x] **B2. codex 갭 분석 (xhigh):** 현행 4 스킬 + `_shared` 5파일을 다음과 대조:
  - 현행 코드: `packages/web/server/stageRunner.ts`, `scripts/adk-source/**`, `scripts/validate-artifacts.mjs`, `schemas/**`, artifact-sync 흐름
  - Phase A 근거 팩 (ADK 2.3 graphs/routes/data-handling/human-input/dynamic)
  - `~/.agents/skills/google-agents-cli-*` 구조 관례 (phase 테이블, 단계 직전 재독 규칙, exit criteria, references/ 분할 크기)
  - 산출물: `기존 서술 ↔ 현행 사실` 불일치 목록 + 스킬 재구성안(파일 맵) + 모순 후보 표 (판정은 메인 세션 몫)
- [x] **B3. 모순 판정 (메인 세션):** B2 모순 표를 진실 위계로 판정, `docs/workbench/skill-refresh-evidence-2026-07.md` 초안 확정. 사전 확정 판정:
  1. `adk-2.md` "ADK 2.0 baseline" vs CLAUDE.md/venv "ADK 2.3" → **2.3** (venv 실런타임 + CLAUDE.md).
  2. google-agents-cli 수명주기(scaffold→deploy→publish→observe) vs AF 리포 범위 → **AF 범위 우선**, 구조만 차용.
  3. google-agents-cli-adk-code "직접 ADK 코드 작성" vs AF "승인 아티팩트→생성기만 코드 생성" → **AF 게이트 우선**; adk-code 지식은 생성기 산출물 검증 관점으로만 인용.
  4. adk.dev 문서 vs 리포 문서 서술 충돌 → **adk.dev** (단, 실런타임 관찰이 있으면 그것이 최상위).
- [x] **B4. codex 재작성 (xhigh):** 4 SKILL.md + `_shared` 재작성. 요구 구조:
  - 각 SKILL.md: 트리거/개요 ≤10줄 + 번호 단계. 각 단계 = [이 단계에서만 읽을 참조 1개 → 행동 → 검증 커맨드 → gate/stop 조건].
  - `_shared/adk-2.md` → ADK 2.3 기준 문서로 교체(이름 포함 재검토), graphs 4 주제별 참조 분리 (routes / data-handling / human-input / dynamic — 짧은 파일 여러 개).
  - 현행 사실 반영: `scripts/adk-source/` 모듈 구조, Stage Runner 계약(`/api/af/:reqId/stages/:stage/*`, proposed-artifacts→apply), artifact-sync, edge state_key 채널 규칙, human_input RequestInput, RemoteA2aAgent 정책, runnable/dynamic 모드.
  - 게이트 불변식 유지: 스테이지 순서, missing_information 2층 게이트, Remote A2A 고마찰 계약, raw→code 금지.
- [x] **B5. 검증:** `node scripts/validate-artifacts.mjs`, `git diff --check`; 스킬이 인용하는 모든 파일 경로·커맨드 실재 확인(codex가 스크립트로 체크). CLAUDE.md/AGENTS.md/harness의 스킬 서술 문구 동기화 여부 확인.
- [x] **B6. codex 교차 리뷰** (작성자와 다른 세션, xhigh) → 수정 반영.
- [x] **B7. 커밋 (메인 세션)** + decision-log 항목 + 증거 원장 커밋 포함. PR-1 경계.

## Phase C — 전체 리뷰·단순화 (PR-2..N, 클러스터별)

- [x] **C1. 클러스터 확정** (초안, B 진행 중 조정 가능):
  1. analyzer core: `src/analyzer/*`(types/scaffoldPlan/runtimeContracts/graphMigration) + `schemas/` + `validate-artifacts.mjs` 정합
  2. server: `server/stageRunner.ts`(1.4k) · `server/codexAnalyzer.ts`(1.8k) · `runtimeChat.ts` · mock-lab 서버부
  3. graph UI: `GraphCanvas`(1.2k) · `components/graph/*` · `GraphElementEditor`(1.0k) · `GraphInspector`(parked INSPECTOR 포함)
  4. workbench routes/state: `routes/*` · `state/*` 훅 · StageShell/스테퍼
  5. generator: `scripts/adk-source/**` + `adk-source-test/**`
  6. docs currency: 활성 `docs/**` ↔ 코드 (handoff/claude-home 제외)
- [~] **C2. 클러스터별 루프** (2026-07-09 상태):
  - [x] C-1 analyzer: 리뷰 → PR-2 `3c437d3` (af-wt-c1, dead 3파일 삭제 + enum 중복 통합 + 정합성 테스트) + 커밋 리뷰 클린
  - [x] C-2 server: 리뷰 → PR-3 `ffbf990` (af-wt-c2, runtime-chat dead 삭제 + HTTP 헬퍼 통합 + 테스트 픽스처 이식성) + 리뷰 지적 1건(P3, 테스트 배선) amend 반영
  - [x] C-3 graph UI: 리뷰 → PR-4 `1e431af` (af-wt-c3, 헬퍼 통합 + dead 편집 경로 삭제 + design-system 드리프트 수정) + 스크린샷 검증(/tmp/af-screens/c3-*) + 커밋 리뷰 클린
  - [x] C-5 generator: 리뷰 → PR-5 `44ca649` (af-wt-c5, export 강등 + 애그리게이터 삭제, 산출물 바이트 동일 검증) + 커밋 리뷰 클린. **중립성 위반 3건 발견 → 결정 목록**
  - [x] C-4 routes/state: 리뷰 → PR-6 `886b1a9` (af-wt-c4, 타입 셸 삭제 + 로그 포매터/센티널 dedup; fetchRuntimeA2aAgentCard 삭제는 재검증에서 살아있는 소비자 발견돼 스킵) + 커밋 리뷰 클린. **스테퍼 상태 파생 계약 드리프트 → 결정 목록**
  - [ ] C-6 docs currency: **PR 1~5 머지 후로 이관** (머지 전 main 기준 리뷰는 오탐 양산; 머지 후 전체 감사 관례를 따름)
- [x] **C3. UI/UX 제안서:** `~/.claude/plans/af-uiux-proposals-2026-07-09.md` — 제안 1(계약 편집기를 살아있는 탭으로 이동, 권장) / 제안 2(부분 재실행, 제안 1 채택 시 하향) / 제안 3(verify 실패 apply 의미론).

### 사용자 결정 대기 목록 (증거는 .evidence-reviews/*)
1. INSPECTOR_ENABLED: 편집기 탭 이동(권장) vs 부활 vs 삭제(-300줄) — 제안서 참조
2. graphMigration legacy stage-flow 변환 제거(-180줄) — 구버전 임포트 호환 계약
3. Stage Runner 정의 테이블 통합 + validateAnalysisResult 분리 (중규모 재구조)
4. verify 실패 시 apply 의미론 (게이트 추가 vs "증거 저장" 라벨)
5. 생성기 중립성 위반 수정: analysis_input_bundle·agent_registry_snapshot·"Super Agent" 리터럴 — 일반 계약 필드 설계 + 아티팩트 갱신 + 실 adk 런타임 검증 필요
6. run-manifest 승인 자동 기록의 소유 계층 (C5 리뷰 §Manifest 4옵션)
7. Mock Lab HMR 고아 프로세스 수정 (globalThis 앵커, 구현 방안 확정됨 — 승인만 필요)
8. GraphCanvas/GraphElementEditor/A2AContractPanel 파일 분할

## Phase D — 마무리

- [ ] **D1.** STATUS/handoff 브리프 갱신, `docs/decision-log.md` 최종 확인.
- [ ] **D2.** 메모리·플랜 갱신 시 `docs/handoff/claude-home/` 스냅샷 동기화 여부 판단.
- [ ] **D3.** 최종 보고: 변경/검증/미검증/후속. push 여부 사용자 확인.

## 세션 경계 메모

한 세션에 전부 끝나지 않을 규모다. 우선순위: Phase A+B(스킬, PR-1) 완주 → C 클러스터 순차. 세션이 끊기면 이 파일의 체크박스와 워크트리 상태에서 재개한다.
