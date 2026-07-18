# Synthetic Reviewed Candidates

- OCR callable contract는 독립 Owner와 input/output/error 경계를 가진 reviewed Tool이다.
- OCR 결과의 공백·줄바꿈 정규화는 해당 Workflow 내부에서만 쓰는 deterministic transform이다.
- 실행 순서는 입력 수신, OCR 호출, 정규화, 검토 전달이다.
- endpoint와 credential은 제공하지 않으며 설계 단계에서 코드 생성은 허용하지 않는다.
