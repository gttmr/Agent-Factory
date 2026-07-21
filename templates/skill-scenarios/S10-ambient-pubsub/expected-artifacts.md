# Expected Structure and Behavior

- strict Target Contract v2 analysis, split artifacts, reviewed boundary, scaffold plan과 manifest를 predecessor gate로 검증한다.
- Asset은 `Workflow` 하나뿐이며 Ambient와 Pub/Sub를 Asset 또는 Graph Node로 승격하지 않는다.
- `pubsub-event.json`을 opaque 합성 test input으로만 확인하고 cloud connection 설정으로 해석하지 않는다.
- approved target runtime contract와 Current Implementation의 generator capability를 분리한다.
- `can_generate_source: false`, Build `blocked`, Scaffold Readiness `Not Ready`를 존중해 source, runtime stub, test 또는 implementation handoff를 생성하지 않는다.
- event-source, delivery identity, retry/error lowering과 external DLQ handoff 지원이 필요하다는 blocker와 unblock 조건을 보고하고 중단한다.
