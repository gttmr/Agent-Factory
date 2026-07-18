# Expected Structure and Behavior

- Workflow 필요성과 dynamic representation 선택 근거를 명시한다.
- reviewed Agent와 Tool, loop control 책임을 Graph 자산과 구분한다.
- 반복 body, 최대 4회 bound, back edge, success exit와 failure exit를 설계한다.
- timeout, cancellation, Tool failure와 loop exhaustion을 별도 경로로 둔다.
- current generator 지원 여부와 scaffold blocker를 검토한다.
