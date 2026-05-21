# Loan Limit Change EAI Callback

## Requirement

```yaml
requirement:
  title: "대출 한도 변경 요청 처리"
  description: "고객 요청을 받아 내부 심사 상태를 조회하고 조건 충족 시 한도 변경 신청을 EAI로 접수한다. 실제 결과는 legacy callback으로 수신한다."
  domain: "loan"
  systems:
    - "EAI"
    - "Loan Legacy"
    - "Customer Legacy"
  operation_type: "write"
  callback_expected: true
  human_approval_required: true
  customer_impact: true
```

## Expected Classification

```json
[
  {
    "name": "loan_limit_change_agent",
    "module_category": "agent",
    "agent_kind": "specialist",
    "responsibility": "사용자 요청을 해석하고 한도 변경 신청 흐름을 안내한다.",
    "risk_level": "high",
    "status": "draft"
  },
  {
    "name": "loan_limit_change_workflow",
    "module_category": "workflow",
    "workflow_kind": "graph",
    "responsibility": "조회, 승인, EAI 접수, callback 대기, resume, 결과 안내 흐름을 Graph IR로 표현한다.",
    "risk_level": "high",
    "status": "draft"
  },
  {
    "name": "loan_limit_change_eai_adapter",
    "module_category": "adapter",
    "adapter_kind": "legacy_api",
    "responsibility": "EAI를 통해 Loan Legacy 한도 변경 신청을 접수한다.",
    "risk_level": "critical",
    "status": "draft"
  }
]
```

## Runtime Contracts

- `eai_legacy_adapter`: required
- `context_manager`: required
- `callback_broker`: required
- `adk_callback`: required
- `async_resume`: required

## Remote A2A Decision

`remote_a2a` 아님. EAI/Legacy callback이 있다는 이유만으로 독립 remote agent boundary가 생기지 않는다. Remote A2A는 다른 부서가 독립 Agent Runtime, owner, Agent Card, task lifecycle, auth, timeout, retry, fallback, audit contract를 제공할 때만 사용한다.

## Graph IR Notes

- legacy submit node: `SUBMITTED_TO_EAI`
- approval wait node: `APPROVAL_PENDING`
- callback wait node: `WAITING_LEGACY_CALLBACK`
- resume requested node: `RESUME_REQUESTED`
- manual review node: `MANUAL_REVIEW_REQUIRED`
- compensation node: `COMPENSATION_REQUIRED`
