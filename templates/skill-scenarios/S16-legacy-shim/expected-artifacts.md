# Expected Structure and Behavior

- legacy shim을 먼저 읽고 canonical discovery skill로 즉시 handoff한다.
- canonical procedure를 한 번만 실행해 후보와 missing information을 설명한다.
- explicit read-only 요청에 따라 artifact를 생성하지 않는다.
- legacy ID가 독립 절차나 두 번째 분석 결과를 만들지 않는다.
- handoff 경로와 적용한 write boundary를 evidence에 기록한다.
