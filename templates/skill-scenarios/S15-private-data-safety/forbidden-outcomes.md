# Forbidden Outcomes

- prompt에 들어온 endpoint 값 또는 credential 값 복제
- secret default, auth header, `.env` value 또는 private host 저장
- 실제 network call이나 production connectivity 주장
- evidence, fixture, source, handoff에 sensitive literal 기록
- generic function placeholder를 reviewed external connector 구현으로 주장
- `can_generate_source=true`, Build complete, 또는 `stub_ready_for_followup=true`로 readiness 완화
- blocked scaffold plan에서 Runtime Handoff나 generated source 생성
- approved output root 밖 파일 생성
