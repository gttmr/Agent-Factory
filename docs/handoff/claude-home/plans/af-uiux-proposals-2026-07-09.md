# Agent Factory UI/UX 개선 제안 (2026-07-09, 결정 대기)

북극성 5기준(그래프 협업 · NL 생성 · 수동 편집 · 친화적 UX · adk web 실데모) 관점에서, 이번 전체 리뷰 캠페인의 **코드 증거**와 백로그(P1·P2)를 결합한 제안. 구현은 사용자 방향 결정 후 codex 위임.

## 제안 1 — 계약 편집 경로 복원: 편집기를 살아있는 탭으로 이동 (백로그 P1 해소)

**증거** (C3 리뷰, `.evidence-reviews/c3-graph-ui.md`):
- 런타임 계약 **편집기는 이미 구현돼 있으나**(`RuntimeContractPanel.tsx:88-277`, 172줄) `INSPECTOR_ENABLED=false`로 파킹된 우측 페인에서만 렌더됨 — 도달 불가.
- 살아있는 하단 Runtime 계약 탭은 읽기 전용 `RuntimeContractSidebar`에서 멈춤(`DesignBottomPanel.tsx:131-133`).
- 실측 결과: 신규 요구사항 E2E에서 `runtime_contracts_approved` 게이트를 UI만으로 통과 불가 — readiness issue 해소 수단이 "11분+ Stage Runner 재실행 또는 외부 편집"뿐 (2026-07-04 백로그 P1 관찰).

**옵션**:
- **A (권장)**: `RuntimeContractInspector/Editor`를 하단 Runtime 계약 탭으로 이동 + 우측 페인 잔재(-약 130줄: 분기 32 + SelectionHeader 36 + CSS 10 + 프롭 배선 45) 삭제. P1 갭 해소와 LOC 감소를 동시에 달성. 이동 시 기존 cast 정리(`RuntimeContractPanel.tsx:105-107`) 포함.
- B: 우측 인스펙터 통째 부활(플래그 제거, -15줄) — 3열 레이아웃 복귀. 화면 밀도 부담이 커서 비권장.
- C: 영구 삭제(-약 300줄) — 계약 편집이 계속 외부 편집에 의존하게 됨. 북극성 "비개발자 협업"에 역행하므로 비권장.

## 제안 2 — 장기 실행 UX: 부분 재실행/시드 (백로그 P2)

분석 run 11.4분(gpt-5.5 실측). 진행 narrative는 PR #56에서 해결됐지만 재실행 비용은 그대로. 제안 1이 채택되면 "계약 필드 하나 고치려고 재실행"하는 최빈 케이스는 사라지므로, 남는 시나리오(모듈 후보만 재분석, Design run에 기존 결과 시드)는 요구 수집 후 별도 설계. **제안 1 채택 시 우선순위 하향 권장.**

## 제안 3 — 실패한 verify의 apply 의미론 명시화 (C2 리뷰 발견)

**증거** (`.evidence-reviews/c2-server.md` §Correctness 2): verify run이 커맨드 실패(`validation.ok === false`)여도 `status: completed`가 되고, 서버·UI apply 게이트 모두 `validation.ok`를 보지 않아 실패 증거 아티팩트(validation-report.md)를 canonical로 apply 가능. 실패 증거 보존이 의도라면 UI 라벨을 "증거 저장"으로 바꾸고, 통과만 apply가 의도라면 게이트에 `validation.ok` 추가. **어느 쪽이 의도인지 결정 필요** — 코드 원저자 의도는 테스트(`stageRunner.test.ts:298-320`)상 전자로 보임.

## 참고: 결정 대기 중인 비-UI 항목 (같은 캠페인에서 나옴)

1. graphMigration legacy stage-flow 변환 제거 (-180줄) — 구버전 외부 아티팩트 브라우저 임포트 호환을 끊을지.
2. Stage Runner 정의 테이블 통합(-80~150줄) + validateAnalysisResult 모듈 분리 — 중규모 내부 재구조.
3. GraphCanvas(1.1k)·GraphElementEditor(0.9k)·A2AContractPanel(0.8k) 파일 분할.
4. Mock Lab HMR 고아 프로세스 수정(globalThis 앵커, 백로그 P5) — C2 리뷰가 구현 방안 확인, 승인만 남음.
