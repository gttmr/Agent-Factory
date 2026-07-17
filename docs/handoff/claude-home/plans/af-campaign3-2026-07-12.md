# AF 캠페인 3 — 백로그 3건 (2026-07-12 결정 확정)

> 캠페인 2(PR #65~69) 후속. 사용자 결정 4건:
> **순서 ②→③→①** · **run-manifest = 옵션2(호출자 소유)** · **파일 분할 = UI 3종만** · **dynamic = 2-PR 단계형**.
> 실행 방식 동일: 메인 세션 오케스트레이션·판정·커밋, codex gpt-5.6(config 기본값) xhigh/high 구현·리뷰, PR당 1커밋, 커밋마다 codex 리뷰 + 스톨 워치독, 실런타임 게이트는 생성기 변경 시 필수.

## Phase M — ② run-manifest 승인 계층 (옵션2: 호출자 소유, PR 1개, 소형)

증거: `.evidence-reviews/c5-generator.md` §Manifest side-effect options.

- [x] M1. 생성기 순수화: `generate-adk-source.mjs` CLI에서 `af-run-manifest.json` 변이 제거 (`run-manifest.mjs`의 stage complete + `approvals.stub_ready_for_followup: true` 자동 설정 삭제). 게이트 원칙: approvals는 reviewer 결정만.
- [x] M2. 호출자 갱신: 서버 Build primitive(`runRuntimeStubBuild`)/artifact-sync가 생성 성공 후 오케스트레이션 메타데이터(`stages.build.outputs`, `current_stage`)만 기록. stage status는 기존 approvals PATCH 양방향 프로젝션 유지 — 생성이 stage complete/approval을 켜지 않음 (동작 변경, decision-log 필수).
- [x] M3. 테스트 이동: assertions.mjs의 생성기 side-effect 단정 → 호출 계층 테스트로. `normalizeRunStage` 메타데이터 드롭 리스크 해소 여부 확인.
- [x] M4. 문서: harness Build 절 + CLAUDE.md 해당 절 + decision-log. 검증: 전체 게이트 + BuildWorkbench 브라우저 스모크(수동 재생성이 승인을 안 켜는지).

> Phase M 완료 (2026-07-12): PR #70 (198db20→bd39a86). 리뷰 클린(0건). 실서버 API 스모크로 게이트 불변 확인. `.agents` 스킬 참조는 메인 세션이 직접 수정(codex 샌드박스 제약).

## Phase D — ③ dynamic edge-driven 재작성 (2-PR 단계형, 최중량)

증거: `.evidence-reviews/c5-generator.md` §비교표·§68-76 (리졸버 3중 중복, 노드 배열 순서 실행, join 미lowering, edge-kind 중복). WP-2 계약(선택자·공유 호환성 헬퍼)이 입력.

- [x] D0. codex xhigh 설계 초안 → 메인 세션 판정 (PR-A/PR-B 경계 확정 포함)
- [x] D1. **PR-A (정확성)**: 엣지 기반 실행 순서(토폴로지 검증 — static의 reachability/acyclic 패스와 정합), dynamic join lowering(fan-in), 도달성/엣지 순서 가드. scenario-d 등 회귀 + **실 ADK 런타임 게이트**.
- [x] D2. **PR-B (구조)**: 엔드포인트/런타임 심볼 리졸버 3중 중복 → edge/node-kind 디스패치 단일화 (메모리: 추가 = 핸들러 1개 원칙). 산출물 동일성/행동 검증 + 실 ADK 런타임 게이트.
- [x] D3. 문서·decision-log 각 PR 동일 변경 세트. (PR-A분 #71, PR-B분 #74에 포함)

> Phase D PR-A 완료 (2026-07-12): PR #71 (2d1154e→521a764). 리뷰 3라운드(P1 2건 포함) — 전부 정직한 plan-시점 거부로 수정. D8 실 ADK RED/GREEN resume 증명 통과, smoke/static SHA-256 불변. 승인 설계·증거는 docs/handoff/claude-home/evidence/. PR-B(D2)와 D3의 PR-B분은 다음 세션.
>
> 보안 후속 완료 (2026-07-17): **PR #72** (d9c9bb5→4e4cd04) — terminal-output 노드 ID를 `toPyStr` 경유 `_node_id` 로컬 바인딩으로 f-string 주입 차단, 적대적 ID py_compile 회귀 추가, 중립성 allowlist `terminal_output_node_id` 등재. 부수 발견: PR-A SHA-256 baseline이 환경 의존 README 2개를 핀(클린 main에서도 실패) → `assertBundleSha256Manifest`에서 제외. 리뷰 클린(0건).
>
> Phase D PR-B 완료 (2026-07-17): **PR #74** (823f2f2→fb7b99a) — dispatch 레지스트리(노드 17·엣지 10 각 1행) + 공통 collector, 리졸버 3중/kind-switch 제거, 어셈블러 kind-switch 제로. 바이트 불변 3중 증명(순정 HEAD 매니페스트 / 시나리오 3종 실서버 경로 main↔브랜치 81파일 diff -r 동일 / D8 실 ADK 게이트 재실행 PASS). 리뷰 클린(0건). 증거: evidence/d2-impl-notes.md.

## Phase S — ① 대형 파일 분할 (UI 3종, PR 1개, 기계적)

- [ ] S1. GraphCanvas.tsx(1220) / GraphElementEditor.tsx(940) 분할 — 기존 `components/graph/*` 레이어 관례를 따름, 동작 보존(빌드 산출물 비교), design-system 준수. ~~A2AContractPanel.tsx(810)~~ → **PR #73 완료 (2026-07-17)**: façade 유지 + Model + 뷰 6종(최대 308줄), analyzer 132/132, 브라우저 스모크(Remote A2A 탭) 통과, 리뷰 클린. 방법 노트: docs/handoff/claude-home/evidence/s1-a2a-split-notes.md.
- [ ] S2. 검증: build/test:analyzer + 스크린샷 스모크(Design 검토 화면). 문서 영향 없으면 decision-log 불필요.

## 보류 유지

- Mock Lab HMR, RuntimeChat 명명, stage별 캐시 무효화, run-manifest 외 승인 UX 변경 없음.
