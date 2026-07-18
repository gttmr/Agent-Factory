# Expected Structure and Behavior

- approved output root에 Human Input pause와 API-based resume seam을 생성한다.
- stable interrupt ID, payload, response mapping과 resume correlation을 구현한다.
- valid, invalid, wrong-ID, duplicate, timeout, reject와 abandoned request test를 둔다.
- completed work replay와 incomplete work rerun을 구분하고 Tool at-least-once를 보호한다.
- unsupported Web UI/CLI resume를 usable path로 제시하지 않는다.
