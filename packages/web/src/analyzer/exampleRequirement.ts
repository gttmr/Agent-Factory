import type { RequirementIntakeInput } from "./types";

const defaultExample: RequirementIntakeInput = {
  domain: "여신",
  rawText:
    "개인사업자 운전자금 대출 신청이 들어오면 신청서, 사업자등록증, 소득 증빙, 계좌 거래 내역 PDF를 함께 검토하는 사전 심사 흐름이 필요합니다. 제출 문서는 공통 문서 intake workflow를 사용해서 OCR과 문서 context를 만들고, 고객 식별자가 있으면 레거시 코어 DB에서 기존 여신, 연체, 최근 심사 이력을 read-only SQL로 조회해야 합니다. 동시에 고객/계좌 요약도 조회하고, 여신 정책 문서와 사전 심사 rule set을 찾아서 필수 서류 누락, 금액/기간 조건, 보완 요청 필요 여부를 판단해야 합니다. 서류 검토 Agent는 누락 서류와 불일치 항목을 정리하고, 리스크 판단 Agent는 사람 승인 필요성과 검토자 메모를 설명해야 합니다. 보완이 필요하면 등록된 템플릿에서 고객 안내 문구를 가져와야 합니다. 다만 매출 변동성 분석은 아직 catalog에 없으므로 새 모듈로 제안할지 검토하고 싶습니다. 실제 승인/거절 자동 결정과 거래 write는 이번 범위에서 제외합니다."
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
