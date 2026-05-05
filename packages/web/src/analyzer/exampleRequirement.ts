import type { RequirementIntakeInput } from "./types";

const defaultExample: RequirementIntakeInput = {
  domain: "고객",
  rawText:
    "접수된 고객 불만을 처리하는 복잡한 업무 흐름이 필요합니다. 먼저 불만 내용을 읽고, 고객 식별자가 있으면 고객 프로필을 확인합니다. 동시에 응답 가이드도 찾아서 상담원이 사용할 수 있는 근거를 준비해야 합니다. 두 결과를 함께 보고 이슈를 분류한 뒤, 라우팅 규칙 저장소의 우선순위 기준에 따라 다음 경로를 결정합니다. 우선순위가 높으면 사람 승인 단계로 보내고, 우선순위가 낮으면 바로 응답 초안을 생성합니다. 고객 정보가 부족하거나 분류 신뢰도가 낮으면 고객에게 추가 확인을 요청하고, 답변이 들어오면 다시 필요한 정보를 수집해서 검토해야 합니다. 같은 라우팅 규칙은 다른 지원 업무 흐름에서도 재사용할 수 있어야 합니다. 정확한 불만 분류 체계는 아직 확정되지 않았고, 시스템 접근 방식도 아직 미정입니다."
};

export function getExampleRequirement(): RequirementIntakeInput {
  return defaultExample;
}
