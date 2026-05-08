import type { RequirementIntakeInput } from "./types";

const defaultExample: RequirementIntakeInput = {
  domain: "고객",
  rawText:
    "접수된 고객 불만을 처리하는 복잡한 업무 흐름이 필요합니다. 먼저 불만 내용을 읽고, 고객 식별자가 있으면 고객 프로필을 확인합니다. 동시에 응답 가이드도 찾아서 상담원이 사용할 수 있는 근거를 준비해야 합니다. 두 결과를 함께 보고 이슈를 분류한 뒤, 라우팅 규칙 저장소의 우선순위 기준에 따라 다음 경로를 결정합니다. 우선순위가 높으면 사람 승인 단계로 보내고, 우선순위가 낮으면 바로 응답 초안을 생성합니다. 고객 정보가 부족하거나 분류 신뢰도가 낮으면 고객에게 추가 확인을 요청하고, 답변이 들어오면 다시 필요한 정보를 수집해서 검토해야 합니다. 같은 라우팅 규칙은 다른 지원 업무 흐름에서도 재사용할 수 있어야 합니다. 정확한 불만 분류 체계는 아직 확정되지 않았고, 시스템 접근 방식도 아직 미정입니다."
};

const remoteA2AExample: RequirementIntakeInput = {
  domain: "고객",
  rawText:
    "사내 상담 워크플로에서 일부 복잡한 신용 분석 업무를 외부 파트너 팀이 독립적으로 운영하는 원격 신용 분석 에이전트에 위임해야 합니다. 이 원격 에이전트는 우리 팀이 아닌 별도 조직(파트너사 'CreditInsightCo')이 소유하며, 자체 클라우드 환경에 별도로 배포되어 운영됩니다. 원격 에이전트는 공개된 Agent Card(에이전트 카드 디스커버리 문서)를 통해 발견되며, 우리는 해당 Agent Card URL을 등록해 사용해야 합니다. 두 시스템 사이의 통신은 A2A 프로토콜로 이루어져야 하고, 내부 호출이 아닌 원격 에이전트 간 호출 경계로 명확히 분리되어야 합니다. 인증은 파트너사가 발급한 OAuth2 클라이언트 자격 증명을 사용해 단기 토큰으로 호출해야 하며, 작업은 비동기 task 생명주기로 제출/진행/완료 상태를 추적해야 합니다. 응답이 늦어질 수 있어 60초 타임아웃과 최대 2회 재시도, 실패 시 사람 검토로 폴백하는 정책이 필요합니다. 모든 호출은 감사 로그에 기록되어야 하고, 개인정보가 포함된 입력은 토큰화 후 전송하는 데이터 정책을 따라야 합니다. 정확한 Agent Card 버전, 스킬 목록, 스트리밍 지원 여부, 푸시 알림 정책 등 일부 프로토콜 세부 내용은 파트너사와 추가 협의가 필요합니다."
};

export function getExampleRequirement(): RequirementIntakeInput {
  return defaultExample;
}

export function getRemoteA2AExampleRequirement(): RequirementIntakeInput {
  return remoteA2AExample;
}
