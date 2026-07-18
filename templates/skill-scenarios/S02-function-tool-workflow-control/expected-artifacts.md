# Expected Structure and Behavior

- 설명 형태의 Compose 결과만 만들고 저장소 파일은 쓰지 않는다.
- reviewed Tool을 독립 callable contract로 유지하고 function Binding을 선택한다.
- 입력부터 계산과 출력까지의 순서를 Workflow가 소유하는 근거를 남긴다.
- Graph에는 계산 호출을 Tool Node로 배치하고 Invocation Control을 Workflow로 둔다.
- schema, invalid date, holiday source, timeout과 deterministic test 조건을 기록한다.
