# Analysis Result Review Brief Design

## Purpose

`분석 결과` 페이지는 분석 보고서가 아니라 모듈 검토로 넘어가기 전의 검토 착수 화면이다.
사용자는 이 페이지에서 Codex가 요구사항을 제대로 이해했는지만 빠르게 확인한다.
위험 신호, 가정, 누락 정보, 원본 JSON은 결정을 막는 경고가 아니라 필요할 때 확인하는 보조 근거다.

## Decisions

- 선택한 방향: `Decision Brief + Evidence Drawer`
- 상단 핵심 계약: 목표, 도메인, 입력, 출력, 시스템
- 통과 방식: 별도 확인 체크 없이 `모듈 검토로 이동` 버튼을 누르는 것이 이해 확인이다.
- 보조 근거 순서: 가정, 누락 정보, 모순, 위험 신호, JSON
- JSON 표시: 기본 접힘 technical detail

## Visual Thesis

조용한 운영 콘솔처럼, 상단은 “이 분석이 요구사항을 맞게 이해했는가”만 묻고, 근거는 낮은 위계의 접힌 레이어로 물러난다.

## Content Plan

1. `이해 확인` 상단 요약
   - 분석 제목 또는 business goal을 가장 먼저 보여준다.
   - 도메인과 후보 모듈 수를 함께 보여줘 다음 단계의 규모를 알게 한다.
   - 설명 문구는 한 문장으로 제한한다: “아래 5개 계약이 맞으면 모듈 검토로 이동합니다.”

2. 핵심 계약 5개
   - 목표: `evidence.requested_goal` 또는 `normalizedRequirement.business_goal`
   - 도메인: `normalizedRequirement.domain` 또는 `evidence.business_domain_hint`
   - 입력: `evidence.input_data`와 `normalizedRequirement.inputs`
   - 출력: `evidence.output_data`와 `normalizedRequirement.outputs`
   - 시스템: `evidence.systems_mentioned`와 `normalizedRequirement.systems`

3. 보조 근거 drawer
   - 가정: `evidence.assumptions`
   - 누락 정보: `evidence.missing_information`
   - 모순: `evidence.contradictions`
   - 위험 신호: `evidence.risk_signals`
   - JSON: `normalizedRequirement`

4. 하단 행동
   - `다시 분석`
   - `모듈 검토로 이동`

## Information Hierarchy

상단에는 사용자가 반드시 읽어야 하는 것만 둔다.
위험 신호는 대부분의 은행 도메인 요구사항에서 많이 발생하므로 주요 경고처럼 다루지 않는다.
위험 신호는 모듈 검토와 A2A/Graph 검토에서 다시 다룰 보조 근거로 표시한다.

`부족한 정보`도 이 페이지의 통과 조건이 아니다.
부족 정보는 분석의 한계와 다음 검토에서 확인할 항목을 알려주는 설명 자료다.
따라서 기존 체크박스 중심 UI는 제거하거나 drawer 내부의 낮은 위계 확인 요소로 낮춘다.

## Interaction Thesis

1. 메인 흐름은 빠르다.
   - 사용자는 핵심 계약 5개를 확인하고 바로 `모듈 검토로 이동`한다.

2. 근거는 필요할 때만 펼친다.
   - 보조 근거 drawer는 기본적으로 요약 상태다.
   - 각 섹션은 count와 짧은 preview를 보여주고, 클릭하면 상세를 펼친다.

3. Technical detail은 방해하지 않는다.
   - JSON은 drawer의 마지막 항목으로 기본 접힘 상태다.
   - JSON 영역은 개발자/디버깅용이며 일반 검토 흐름을 밀어내지 않는다.

## Layout

상단은 하나의 작업 표면으로 구성한다.
왼쪽에는 제목, 도메인, “모듈 검토로 이동” 행동을 둔다.
오른쪽에는 후보 모듈 수, Remote A2A 후보 수, 누락 정보 수 같은 짧은 상태 숫자를 둔다.
숫자는 판단 보조 정보일 뿐 경고 배너처럼 보이면 안 된다.

핵심 계약 5개는 카드 모자이크가 아니라 밀도 있는 row 또는 two-column definition layout으로 표시한다.
각 항목은 label, 요약 값, 원천 hint를 갖는다.
긴 입력/출력 목록은 2-3개까지만 먼저 보이고 나머지는 `+N` 형태로 축약한다.

보조 근거 drawer는 상단 계약 아래에 배치한다.
기본 화면에서 JSON이 바로 보이지 않아야 한다.

## Copy Guidelines

- 화면 제목: `분석 이해 확인`
- 상단 설명: `아래 계약이 요구사항과 맞으면 모듈 검토로 이동합니다. 위험 신호와 가정은 보조 근거에서 확인할 수 있습니다.`
- 핵심 계약 label: `목표`, `도메인`, `입력`, `출력`, `시스템`
- 보조 근거 label: `가정`, `누락 정보`, `모순`, `위험 신호`, `정규화 JSON`
- Primary CTA: `모듈 검토로 이동`
- Secondary CTA: `다시 분석`

## Out Of Scope

- 이 페이지에서 module candidate를 편집하지 않는다.
- 이 페이지에서 risk signal을 승인/반려하지 않는다.
- 이 페이지에서 normalized requirement JSON을 직접 수정하지 않는다.
- 이 페이지에서 Remote A2A 계약 검토를 시작하지 않는다.

## Validation

구현 후 다음을 확인한다.

- `packages/web/src/components/AnalysisResult.tsx`가 핵심 계약 5개를 상단에 보여준다.
- 위험 신호는 메인 게이트가 아니라 보조 근거에 있다.
- JSON은 기본 접힘 상태다.
- `모듈 검토로 이동` 버튼은 추가 체크박스 없이 동작한다.
- `cd packages/web && npm run build`가 통과한다.
- UI 변경이므로 Vite dev server와 브라우저 스크린샷으로 desktop 화면을 확인한다.
