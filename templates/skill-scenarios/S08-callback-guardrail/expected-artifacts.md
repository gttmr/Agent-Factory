# Expected Structure and Behavior

- strict Target Contract v2 analysis, derived artifact, 승인 manifest, boundary design, scaffold plan을 predecessor evidence로 확인한다.
- `adk_callback` 계약이 설계 검토됐다는 사실과 generic runnable generator가 callback control을 지원하지 않는다는 사실을 분리한다.
- `scaffold-plan.json`의 `can_generate_source: false`, callback lowerer blocker, Build `blocked`, `stub_ready_for_followup: false`를 그대로 보고한다.
- `af-scaffold-runtime`은 source generation 전에 중단하고 Scaffold `Not Ready` 판정을 반환한다.
- runtime stub, implementation handoff, local callback prototype 또는 runnable command를 생성하지 않는다.
- 향후 구현해야 할 Continue, Override, pre-Tool short-circuit, fail-closed error, redacted state/audit 의미를 blocker로 보존한다.
