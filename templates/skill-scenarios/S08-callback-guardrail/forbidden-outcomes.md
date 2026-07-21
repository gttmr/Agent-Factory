# Forbidden Outcomes

- guardrail을 숨은 Workflow business step이나 top-level asset으로 생성
- Continue와 Override return semantics 반전
- 차단된 Tool을 실행한 뒤 결과만 가림
- prompt, Tool argument, secret을 audit log에 원문 저장
- callback 계약 밖 알림이나 상태 side effect 추가
- callback edge를 `next`로 바꾸거나 `smoke` mode로 낮춰 blocker 우회
- `can_generate_source`, Build status 또는 approval을 변경해 강제 생성
- generic generator 대신 hand-written local prototype을 만들어 runnable 지원처럼 제시
- runtime stub, implementation handoff, 실행·테스트 성공 또는 production readiness 주장
- `approved-scaffold-plan.json`이나 retired strict-v2 field/filename 재도입
