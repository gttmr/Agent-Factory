# 스킬 정비 증거 원장 — ADK 2.3 기준 (2026-07)

`.agents/skills` DLC 스킬 세트를 ADK 2.3 · 현행 코드베이스 · google-agents-cli 스킬 관례 기준으로 재작성하면서,
출처 간 모순이 발견될 때 **어느 쪽을 따랐고 왜인지**를 기록하는 원장이다.
판정 기준(진실 위계): ① 실제 런타임(설치된 venv 소스·실행 관찰) ② adk.dev 공식 문서 ③ 리포 코드 ④ 리포 문서.
리포 범위 규칙(AGENTS.md·CLAUDE.md — 배포/자격증명/사설 엔드포인트 금지, raw requirement→code 금지)은 외부 스킬 관례보다 항상 우선한다.

수집 근거: adk.dev 문서 원문(`curl https://adk.dev/<path>.md`, 2026-07-08 수집)과
설치된 `google-adk 2.3.0`(`.agent-factory/runtime/.venv`) 심볼 확인. 원문 팩은 작업용 미추적 디렉터리로만 유지하고 커밋하지 않는다
(외부 문서 사본을 리포에 넣지 않는 방침). 각 판정 항목에 원출처 URL을 남겨 재검증 가능하게 한다.

## 판정 목록

### R1. ADK 기준선: 2.0 서술 → 2.3
- **충돌**: `_shared/adk-2.md`(구판)는 "Use ADK 2.0 as the active baseline" · adk.dev 문서 배지는 "Supported in ADK Python v2.0.0" ↔ CLAUDE.md/harness는 ADK 2.3 기준, venv에 `google-adk 2.3.0` 설치.
- **판정**: **ADK 2.3**을 기준선으로 서술. 2.0은 그래프/동적 워크플로 도입 시점(2026-05-19 GA)이라는 역사적 기원으로만 남긴다. 문서 배지의 v2.0.0은 "최소 지원 버전" 표기이지 현행 기준선이 아니다.
- **근거**: `pip show google-adk` → 2.3.0 (2026-07-08 확인, 실런타임 = 최상위 진실). `requirements/adk-runtime.txt` floor `>=2.1.0` 유지.

### R2. google-agents-cli 수명주기 vs 리포 범위
- **충돌**: `google-agents-cli-workflow`는 scaffold→build→eval→deploy→publish→observe 전체 수명주기를 가르치고 `agents-cli` CLI 사용을 전제 ↔ 이 리포는 로컬-퍼스트 워크벤치로 배포 스크립트·사설 엔드포인트·운영 코드를 금지(CLAUDE.md "Repository Scope").
- **판정**: **리포 범위 우선**. gcli 스킬에서는 *구조 관례만* 차용한다 — 단계 테이블, "단계 진입 직전 해당 참조 재독"(컨텍스트 압축 대비) 규칙, 단계별 exit criteria, 작은 references/ 분할. deploy/publish/observability 내용은 채택하지 않으며, "scaffold"는 이 리포에서 agents-cli scaffold가 아니라 승인된 scaffold-plan을 뜻한다.
- **근거**: CLAUDE.md Repository Scope 절, AGENTS.md 편집 규칙.

### R3. 프리핸드 ADK 코딩 vs 승인 아티팩트→생성기 경로
- **충돌**: `google-agents-cli-adk-code`는 에이전트 코드를 직접 작성하는 API 패턴을 가르침 ↔ 이 리포는 승인된 scaffold-plan 데이터만 `scripts/generate-adk-source.mjs`(→`scripts/adk-source/**`)를 통해 코드가 될 수 있고 raw requirement→code를 금지.
- **판정**: **리포 게이트 우선**. 재작성된 스킬에서 ADK API 지식은 (a) 생성기 산출물(runtime-stub)을 검증·리뷰하는 관점, (b) Graph IR↔ADK 개념 매핑(라우트/데이터 전달/휴먼 인풋/동적)을 이해하는 관점으로만 인용한다. 스킬이 모델에게 ADK 코드를 손으로 쓰라고 지시하지 않는다.
- **근거**: CLAUDE.md "Raw requirements never drive code generation", validator의 `raw_requirement_to_code` 가드.

### R4. adk.dev 문서 vs 리포 문서 서술 충돌
- **판정**: 서술이 갈리면 **adk.dev가 리포 문서를 이긴다**. 단, 실제 런타임 관찰(venv 소스, adk api_server 실행 결과)이 있으면 그것이 adk.dev보다도 우선한다. 재작성 스킬에서 버전-귀속 서술("2.3에서 추가")은 venv 소스 확인 없이는 쓰지 않는다 — adk.dev 릴리스 노트 상세는 문서 사이트에 없음(GitHub releases로 위임됨)을 확인했다.
- **근거**: 프로젝트 진실 위계(harness·백로그 운영 노트), release-notes 페이지 확인(2026-07-08).

### R5. 직접 아티팩트 쓰기 vs Stage Runner proposed-first
- **충돌**: 구판 스킬은 스테이지가 canonical 아티팩트·매니페스트를 직접 쓴다고 서술 ↔ 현행 Stage Runner의 analyze/design은 proposed-artifacts에만 쓰고 diff/preview 승인 후에만 canonical이 바뀐다(`stageRunner.ts:825-841, 1199-1208, 559-608`).
- **판정**: **proposed-first가 1차 경로**. 재작성 스킬은 Stage Runner 실행 시 허용된 proposed 파일만 쓴다. 워크벤치 밖 단독 실행(수동/임포트 모드)은 별도 표기된 보조 모드로 유지한다 — harness가 비-워크벤치 아티팩트 생산을 여전히 허용하기 때문.

### R6. Build 1차 경로: 직접 생성기 호출 → artifact-sync
- **충돌**: 구판 build 참조는 `node scripts/generate-adk-source.mjs` 직접 호출을 1차로 서술 ↔ 현행 워크벤치 build는 `POST /api/af/:reqId/artifact-sync/run`(계약 동기화→scaffold-plan 파생→재생성→검증)이 1차이고 직접 생성기는 수동/고급 경로(CLAUDE.md build 절, `artifactSyncRunApi.ts:17-68`).
- **판정**: **artifact-sync를 1차로 교육**, 직접 생성기는 동기화된 아티팩트 존재 후의 저수준 수동 확인 수단으로 강등.

### R7. 매니페스트 승인 토글 주체
- **충돌**: 구판 design 스킬 "Record human approval status in af-run-manifest.json" ↔ 현행은 승인 부울을 리뷰 엔드포인트(`afArtifactCrudApi.ts:70-107`)가 쓰고 스테이지 상태를 양방향 투영하며, Stage Runner는 `stage_runs` 실행 메타데이터만 기록(`stageRunner.ts:1274-1306`).
- **판정**: **스킬은 승인 부울·스테이지 상태를 직접 토글하지 않는다.** 스킬은 준비 상태를 보고할 뿐, 승인 기록은 인간 리뷰 경로의 몫.

### R8. Remote A2A 계약 파일: 분리 `a2a-contracts.json` vs 임베디드 `a2aContracts`
- **충돌**: 구판 artifact-contracts는 `a2a-contracts.json`을 표준 아티팩트로 나열 ↔ 현행 검증기·생성기는 `analysis-result.json.a2aContracts`만 소비(`types.ts:962-974`, `validate-artifacts.mjs:955-1045`, `remote-a2a.mjs:6-15`), artifact-sync는 분리 파일을 파생하지 않고 유일한 코드 참조는 CRUD 허용목록 1건(`afArtifactsApi.ts:49`).
- **판정**: **임베디드 `a2aContracts`가 정본.** 재작성 스킬의 표준 아티팩트 목록에서 `a2a-contracts.json`을 제거. CRUD 허용목록 잔재는 Phase C 정리 후보로 이관.
- **2026-07-19 후속**: strict Target v2 cutover에서 CRUD/API·store allow-list 잔재를 제거하고 split 파일의 GET·PUT을 회귀 테스트로 거부했다. Phase C 정리 후보는 완료됐다.

### R9. ADK 문서의 정적 back-edge 루프 vs 생성기의 dynamic builder 라우팅
- **충돌**: adk.dev routes 문서는 정적 그래프 back-edge 루프를 보여줌 ↔ 현행 생성기는 순환/loop-control 형태를 정적 runnable에서 거부하고 dynamic builder로 라우팅(`graph/guards.mjs:13-20`, `agent-dynamic.mjs:96-131`).
- **판정**: **관할 분리** — 워크벤치/생성기 산출물 계약은 리포 코드가 권위, ADK API 의미론은 adk.dev/실런타임이 권위(R4 정련). 스킬은 생성기의 현행 lowering 규칙을 가르치고, ADK 문서의 back-edge는 의미론 배경으로만 인용. 정적 루프 지원은 Phase C 생성기 후속 후보.
- **2026-07-19 후속**: owning Workflow의 `workflow_profile.representation`을 단일 mode 결정권자로 고정했다. Region은 mode를 바꾸지 않는다. 현재 static routed-cycle은 지원하지 않으므로 `graph` cycle을 조용히 dynamic으로 전환하지 않고 fail-closed하며, `dynamic` loop는 설치된 ADK 2.3.0에서 반복·상한 종료·terminal output까지 실행 검증했다.

### R10. human_input `rerun_on_resume` 서술 강도
- **충돌 아님(불확실성)**: 생성기는 항상 `FunctionNode(..., rerun_on_resume=True)` + `RequestInput`을 방출(`emitters/hitl.mjs:5-23`); 이것이 모든 정적 그래프 경우에 필수인지는 실런타임 미검증 (갭 분석 HYPOTHESIS).
- **판정**: 스킬은 **현행 생성기 산출물을 사실로 서술**하되 "ADK가 요구한다"는 강한 주장은 하지 않는다. 런타임 검증은 후속.

### R11. 스킬 frontmatter: gcli식 풍부한 메타데이터 vs 최소형
- **판정**: **최소형 유지**(`name`, `description`). Codex 스킬 로더의 확장 메타데이터 지원이 미확인이며, 최소형으로 잃는 것이 없다.

### R12. 스킬 파일 경로의 코드 결합과 strict cutover
- **과거 사실**: strict cutover 전 `stageRunner.ts`가 구 stage skill 경로를 하드 참조해 네 shim을 즉시 제거할 수 없었다.
- **2026-07-19 판정**: Stage Runner가 `af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime`의 canonical `SKILL.md`를 직접 참조하도록 전환했고 구 shim 네 개를 삭제했다. canonical 다섯 디렉터리는 현재 실행 계약이므로 경로 변경 시 Stage Runner와 skill validator를 함께 갱신한다. 구 ID는 지원 경로가 아니다.

### R13. state/artifact channel의 저장 key
- **충돌**: 구 state/artifact skill은 strict Graph Edge에 `state_key`·`artifact_key`가 있는 것처럼 지시했지만 strict v2 Edge는 `id`, `from`, `to`, `control`, `channel`만 허용하고 해당 두 field를 거부한다.
- **판정**: Graph는 `channel: state|artifact`와 Edge identity만 기록한다. 현재 generator의 runtime storage key는 Edge `id`에서 deterministic하게 파생하며, scope·schema·MIME·retention 같은 상세는 reviewed runtime contract가 소유한다. 제거된 key를 Graph에 다시 추가하지 않는다.
- **근거**: `schemas/graph.schema.json`, `scripts/adk-source/channels.mjs`, 생성기 실행 회귀와 `scripts/validate-skills.mjs`.

## 열린 질문 처리 (갭 분석 §5)

- 서명 수준 venv 검증(Q1): B4 재작성에서 ADK 토픽 참조 작성 전 venv 소스 확인을 요구, 불가 시 미검증 표기.
- Stage Runner/단독 이중 모드(Q3): R5로 판정 — 이중 모드 지원, proposed-first가 1차.
- `a2a-contracts.json`(Q4): R8로 판정.
- frontmatter(Q5): R11로 판정.
- `rerun_on_resume`(Q2)·정적 back-edge(Q6): 스킬 범위 밖 — Phase C/후속으로 이관.
- catalog-delta 상세 수명주기(Q7): 스킬은 "제안 전용, 직접 catalog 쓰기 금지"만 서술.
