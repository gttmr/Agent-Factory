# Forbidden Outcomes

- guardrail을 숨은 Workflow business step이나 top-level asset으로 생성
- Continue와 Override return semantics 반전
- 차단된 Tool을 실행한 뒤 결과만 가림
- prompt, Tool argument, secret을 audit log에 원문 저장
- callback 계약 밖 알림이나 상태 side effect 추가
