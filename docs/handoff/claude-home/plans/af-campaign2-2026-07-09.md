# AF 캠페인 2 — 결정 반영 후속 작업 계획 (2026-07-09 확정)

> 캠페인 1(스킬 정비 + 클러스터 리뷰, PR #59~64) 후속. 사용자 결정 4건 반영:
> ① INSPECTOR → **편집기 하단 탭 이동** ② 생성기 중립성 → **지금 별도 캠페인** ③ 스테퍼 → **계약대로 수정**
> ④ 구조 리팩터 → **Stage Runner 테이블화+validator 분리 / Verify 단일화+Panel config / graphMigration legacy 제거** 선택.
> 실행 방식 동일: 메인 세션 오케스트레이션·판정·커밋, codex **gpt-5.6**(id `gpt-5.6-sol`, 2026-07-10 사용자 지시로 5.5 대체; config 기본값) xhigh(난이도별 high) 구현·리뷰. PR당 1커밋, 커밋마다 codex 리뷰, push는 확인 후.

## Phase 0 — 전제: PR #59~64 머지 + 머지 후 감사

- [x] 0a. PR #59→60→61→62→63→64 순서 머지 (60·61 codexAnalyzer.ts 충돌 시 양쪽 유지, 62·64는 독립 파일)
- [x] 0b. 워크트리 정리: af-wt-{skills,c1,c2,c3,c4,c5} — 머지 확인 후 `git worktree remove` + 로컬 브랜치 삭제 + prune (AGENTS.md Worktree Hygiene)
- [x] 0c. **C6 문서 통화성 감사** (캠페인 1 이관분): 활성 docs/** ↔ 머지된 코드 대조, codex xhigh 리뷰 → 수정 PR. CLAUDE.md의 스킬 서술(구 "Required Reading" 시대 문구 잔재 여부) 포함
- [x] 0d. handoff 스냅샷 동기화: 메모리 2건 신규 + 플랜 3개 갱신됨 → `docs/handoff/claude-home/` 재복사 커밋

## Phase 1 — WP-1: Design 계약 편집 UX (결정 ①+③, PR 1개)

북극성 "비개발자 협업" 최대 갭 해소. 증거: `.evidence-reviews/c3-graph-ui.md` §Dead/flag-parked, `.evidence-reviews/c4-routes-state.md` §Contract drift 1.

- [x] 1a. `RuntimeContractInspector`/`RuntimeContractEditor`(RuntimeContractPanel.tsx:88-277)를 하단 **Runtime 계약 탭**으로 이동 (DesignBottomPanel의 RuntimeContractSidebar 옆/아래). 이동 시 null-cast 정리(RuntimeContractPanel.tsx:105-107)
- [x] 1b. 우측 페인 잔재 삭제: INSPECTOR_ENABLED 플래그·재export·조건 클래스, DesignGraphPanel 176-207 분기, SelectionHeader(36줄), no-inspector CSS(design.css:81-86, 436-439), 분기 전용 프롭 배선 — 약 -130줄. A2AContractInspector·CommentThread는 살아있는 경로 보유 → 유지
- [x] 1c. 스테퍼 step 상태 파생 수정: DesignWorkbench.tsx:91-97의 candidate.status 기반 `reviewReady`를 step 상태 계산에서 분리 — step 상태는 manifest.approvals + 아티팩트 존재만, 승인 버튼 활성화·지표는 현행 유지 (C4 리뷰 fix direction)
- [x] 1d. 검증: build/test:analyzer + **E2E 스크린샷**: 계약 readiness issue가 있는 루트에서 하단 탭 편집 → 저장 → readiness 해소 → `runtime_contracts_approved` 토글까지 UI만으로 완주
- [x] 1e. 문서: harness의 "인스펙터 파킹(INSPECTOR_ENABLED=false)" 서술 전면 갱신 + CLAUDE.md 해당 절 + decision-log 항목 (UX 계약 변경)

## Phase 2 — WP-4: graphMigration legacy 변환 제거 (결정 ④, PR 1개, 소형)

- [x] 2a. `legacyStageToGraphIR`의 구 `type`/`data_channel`/`edge_type` 변환 분기 삭제(graphMigration.ts:448-663 중 legacy 부분, 약 -180줄) + 관련 테스트 정리
- [x] 2b. 임포트 거부 UX: 구버전 파일 임포트 시 명확한 에러 메시지("native Graph IR 필요, 구버전 형식 미지원") — 침묵 실패 금지
- [x] 2c. 검증: 리포 내 전 아티팩트/템플릿 native 확인 재실행(rg 증거), test:analyzer, validator. decision-log 항목 (임포트 계약 변경)

## Phase 3 — WP-3: 서버·Verify 구조 리팩터 (결정 ④, PR 2개)

- [x] 3a. **PR A (서버)**: Stage Runner 단일 `STAGE_DEFINITIONS` 테이블 — skillName/skillPath·runner kind(codex|runtime_stub|verify)·허용 proposed 파일·diff/apply 모드·커맨드 라벨을 한 곳으로 (현재 stageRunner.ts:35-52, 285-328, 623-627, 1201-1208 4곳 분산). `validateAnalysisResult`를 전용 모듈로 분리(codexAnalyzer.ts:1210~에서 추출, validators.ts 경유 소비자 유지). 동작 보존 — stageRunner.test.ts 전체 그린 필수
- [x] 3b. **PR B (UI)**: Verify 이중 실행 표면 단일화 — VerifyRunStep 직접 실행 레인 삭제, Stage Runner 경로 + `StageRunnerPanel.controls`로 커맨드 선택 통합. 4개 스테이지 화면의 반복 config를 공유 헬퍼로 추출(applyMode는 명시 유지). manifest.validation 직접 상태와 stage_runs 이력의 이중 "실행됨" 개념 단일화. **UI 변경 → 스크린샷 검증**
- [x] 3c. 문서: harness의 Verify 절·Stage Runner 절 갱신 + decision-log (3b 커밋에 포함)

> Phase 3 완료 (2026-07-12): 3a = PR #67, 3b+3c = PR #68 (bcfbed1, 7회 codex 리뷰 라운드 — 실행 로그 표면·landing pin·버퍼 캡·이벤트 영속 직렬화 하드닝 포함). 운영 노트: codex omo 플러그인 codegraph MCP가 이 리포에서 리뷰 세션을 행업시켜 `~/.codex/config.toml`에서 임시 비활성(백업 `config.toml.bak-codegraph`).

## Phase 4 — WP-2: 생성기 중립성 캠페인 (결정 ②, PR 1~2개, 최중량)

증거: `.evidence-reviews/c5-generator.md` §Neutrality. 원칙(AGENTS.md): 도메인 리터럴은 생성기가 아니라 reviewed 아티팩트/카탈로그가 소유.

- [ ] 4a. **계약 설계 (메인 세션 판정, codex 초안)**: 
  - `analysis_input_bundle`: PAYLOAD_WRAPPER_KEYS에서 제거. 대체 — scaffold-plan 모듈의 reviewed `input_mapping`/출력명 기반 일반 래퍼 키 해석 (스키마에 필드 추가가 필요한지 기존 필드로 표현 가능한지 먼저 판정)
  - `agent_registry_snapshot`: 특수분기 제거. 대체 — runtime contract 또는 module capability의 일반 필드(예: `emits_registry_snapshot` 성격의 reviewed 플래그) 설계
  - "Super Agent" 지시문: `${module.name}` 치환 (즉시 가능, 설계 불요)
- [ ] 4b. 구현: schema/types/validator/생성기 관통 + 회귀 시나리오 아티팩트 갱신 (wf-page-recommendation-required, cdp-a2a-* 픽스처)
- [ ] 4c. 중립성 테스트 강화: 고정 토큰 목록 → 아티팩트-유래 검증(생성기 소스에 등장하는 스네이크케이스 리터럴을 알려진 계약 어휘 화이트리스트와 대조하는 방식) — 이번 3건을 못 잡은 구조적 원인 해소
- [ ] 4d. **실 adk 런타임 검증 (필수 게이트)**: 갱신된 회귀 시나리오를 InMemoryRunner 또는 `adk api_server`로 실행 — 유닛테스트만으로 완료 선언 금지 (LlmAgent 노드 JSON-직렬화 제약 메모리 준수)
- [ ] 4e. brittle 테스트 완화 동시 진행: 라우터/dynamic/terminal의 exact-string 단정을 행동 검증(AST/py_compile/evaluateGeneratedRoute)으로 전환 — 중립성 수정이 어차피 exact-string 테스트를 깨므로 같은 변경 세트가 효율적
- [ ] 4f. decision-log + harness/스키마 문서 갱신

## 명시적 보류 (이번 캠페인 제외)

- Mock Lab HMR 고아 프로세스 수정 (미선택 — 방안은 c2 리뷰에 보존됨)
- GraphCanvas/GraphElementEditor/A2AContractPanel 파일 분할, RuntimeChat→RuntimeProcess 명명 정리, stage별 캐시 무효화 축소
- run-manifest 승인 자동 기록 계층 변경 (현행 유지 — 새 스킬이 side effect를 사실대로 문서화했고, WP-3a 테이블화 시 자연스러운 재검토 지점이 생김)
- dynamic edge-driven 전환 + join 정합 — 예정된 dynamic 대형 재작성에서 (WP-2의 계약 설계 결과를 입력으로 사용)

## 순서·의존성

Phase 0(머지+감사) → 1(UX 최대 가치) → 2(소형 삭제) → 3(구조) → 4(최중량, 실런타임 검증 세션 필요).
2는 1과 병렬 가능. 3a는 0a 머지 후에만(#61이 stageRunner 인접 수정). 4는 3a의 테이블화가 끝나면 생성기 호출 경계가 더 명확해져 유리.
예상 PR: 0c(1) + 1(1) + 2(1) + 3(2) + 4(1~2) = 6~7개.
