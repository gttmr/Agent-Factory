# Handbook Maintenance

Handbook은 자동 생성물이 아니라 현재 Source Code에 맞춰 수동으로 유지하는 행동 지도다. 변경 후 다음 순서를 지킨다.

1. 변경된 Source Code가 어느 행동 Stage에 속하는지 확인한다.
2. 관련 Register의 모든 producer와 consumer를 다시 검색하고 읽기·쓰기·교체 규칙의 영향을 확인한다.
3. 영향받은 L3 path와 stable symbol/section anchor를 현재 repository에서 다시 열어 검증한다.
4. 실제 행동이 달라졌다면 해당 Stage의 목적, 입력·출력, Main Flow, 분기와 실패 같은 L2 설명을 갱신한다.
5. Stage 수, L3 파일 수, Register 연결, locator status가 맞도록 [Index](index.md)와 [Coverage](coverage.md)를 갱신한다.
6. path나 anchor를 현재 소스에서 재검증할 수 없는 locator는 `frozen`으로 바꾸고 탐색 시작점에서 제외한다.
7. 문서와 소스가 다르면 Source Code가 최종 권위다. 문서의 추정으로 구현 사실을 덮어쓰지 않는다.

자동 재동기화, fingerprint 생성, drift detector 또는 Handbook 생성 script는 별도 후속 작업이다. 이 Handbook 유지 규칙은 그런 자동화가 이미 존재한다고 가정하지 않는다.
