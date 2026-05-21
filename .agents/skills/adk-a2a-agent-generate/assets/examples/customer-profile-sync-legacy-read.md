# Customer Profile Sync Legacy Read

## Requirement

```yaml
requirement:
  title: "고객 프로필 조회"
  description: "상담 중 고객 기본 프로필과 상품 보유 현황을 조회해 요약한다."
  domain: "customer"
  systems:
    - "EAI"
    - "Customer Legacy"
  operation_type: "read"
  callback_expected: false
  human_approval_required: false
  customer_impact: false
```

## Expected Classification

```json
[
  {
    "name": "customer_profile_summary_agent",
    "module_category": "agent",
    "agent_kind": "specialist",
    "responsibility": "legacy 조회 결과를 상담용 요약으로 변환한다.",
    "risk_level": "medium",
    "status": "draft"
  },
  {
    "name": "customer_profile_eai_adapter",
    "module_category": "adapter",
    "adapter_kind": "legacy_api",
    "responsibility": "EAI를 통해 고객 프로필을 조회한다.",
    "risk_level": "medium",
    "status": "draft"
  }
]
```

## Decisions

- 단순 read-only 조회이므로 sync MCP/ADK tool 가능.
- 고객정보이므로 masking, audit, access control 필요.
- Callback Broker와 Context Manager는 optional.
- Remote A2A 아님.

## Runtime Contracts

- `eai_legacy_adapter`: required
- `adk_callback`: recommended for masking/audit
- `context_manager`: optional unless the read becomes async or approval-gated
