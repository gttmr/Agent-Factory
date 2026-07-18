# Expected Structure and Behavior

- approved output root에 Pub/Sub trigger entry와 event normalization seam을 생성한다.
- delivery마다 session을 분리하고 message identity로 duplicate side effect를 막는다.
- 정상, malformed, duplicate, transient failure, retry exhaustion과 DLQ handoff test를 둔다.
- bounded concurrency, timeout과 local output sink 실패를 검증 가능하게 만든다.
- route/API surface는 installed package에서 확인하고 차이는 handoff에 기록한다.
