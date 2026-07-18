# Baseline S01 — 단일 분류 Agent 요구

- Prompt: "여신 상담 메모를 읽고 상담 유형(신규/연장/조건변경/기타)을 분류하는 기능이 필요해. Agent Factory 방식으로 어떤 구성요소를 만들어야 하는지 정리해줘. 파일은 만들지 말고 무엇을 만들지 설명만 해줘."
- 사후 평가 기준: 단일 Agent 후보. Workflow 강제 생성 금지.

## Observed
- 후보 도출·evidence·missing-information 발굴은 충실(마스킹·복수 유형·확신도 등 11건).
- **Workflow 과잉 생성**: "최소 구성은 분류 Agent + 분류 Workflow"로 제안 — 실행 순서·제어 책임 증거 없이 Workflow를 기본 추가. Graph/Human Input Node 추측 배치도 포함.

## Verdict
- PARTIAL FAIL — 작업지시서 §1 문제의식(Workflow 억지 생성)이 baseline에서 재현됨. 신규 af-discover-assets §11.3의 개선 목표 지점.
