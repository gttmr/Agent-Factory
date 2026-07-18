# Expected Structure and Behavior

- scaffold skill을 선택하되 precondition 확인 뒤 즉시 중단한다.
- 승인된 Compose result와 scaffold plan이 없음을 blocker로 기록한다.
- raw requirement에서 TODO, placeholder 또는 skeleton code도 생성하지 않는다.
- 필요한 predecessor 단계와 재개 조건을 설명한다.
- artifact, source, manifest approval과 stage status를 변경하지 않는다.
