# Repository Strategy

이 문서는 Agent Factory 작업 저장소를 어떻게 취급할지 정리한다.
기준은 `README.md`, `AGENTS.md`, `docs/agent-factory-v1-goal.md`의 현재 정책이다.

## 단일 source of truth

Agent Factory의 단일 source of truth는 다음 저장소다.

- <https://github.com/gttmr/Agent-Factory>

워크벤치 코드, 스키마, 카탈로그, 템플릿, 문서, 번들 skill 자료는 이 저장소를 기준으로 관리한다.
이 저장소는 public skill-source 추출본만이 아니다.
요구사항 intake, 분석 검토, 프로세스 플로우, 공통화 검토, artifact export의 실제 작업대다.

## 대상 디렉터리 구조

현재 workbench 저장소의 주요 경계는 다음과 같다.

```text
agent-factory/
  README.md
  AGENTS.md
  packages/
    web/
  schemas/
  catalog/
  templates/
  docs/
  .agents/
    skills/
```

`README.md`는 사람을 위한 workbench 개요와 taxonomy 계약을 설명한다.
`AGENTS.md`는 모델을 위한 저장소 인덱스와 작업 규칙을 제공한다.
`packages/web`은 requirement intake, analysis review, process flow, artifact export UI의 구현 위치다.
`schemas`는 normalized requirement, module candidate, process flow, scaffold-plan 등 공유 artifact 형식을 정의한다.
`catalog`는 v1.0의 초기 YAML catalog 위치다.
`templates`는 generic artifact와 scaffold-plan template 위치다.
`docs`는 설계 노트, validation, scaffold bridge, taxonomy 설명의 문서 위치다.
`.agents/skills`는 동기화 가능한 skill 자료 위치지만 일반 taxonomy refactor의 기본 수정 대상은 아니다.

## 커밋하지 말아야 할 것

이 저장소에는 다음 항목을 커밋하지 않는다.

- private banking data
- real endpoints
- credentials
- deployment scripts
- organization-specific runtime code
- runnable business logic

Agent Factory v1.0은 은행 도메인을 첫 적용 대상으로 삼지만 실제 은행 배포 저장소가 아니다.
실제 고객 데이터, 실제 내부망 주소, 비밀키, 운영 배포 스크립트는 저장소 범위 밖이다.
Raw requirement에서 직접 runnable code를 생성하거나 저장하지 않는다.

## .agents/skills 정책

`.agents/skills`는 workbench와 함께 보관될 수 있는 skill 자료다.
하지만 workbench taxonomy refactor 중에는 기본적으로 수정하지 않는다.
작업이 명시적으로 skill-sync 단계를 요구할 때만 `.agents/skills`를 별도 범위로 다룬다.
이 정책은 taxonomy, schema, UI, docs 변경이 skill 자료까지 묵시적으로 번지지 않게 하기 위한 경계다.

## 과거 저장소의 지위

이전의 extract-only 저장소나 skill-only 저장소는 더 이상 primary input이 아니다.
필요하면 참고 자료로 볼 수는 있지만, 현재 분류 계약과 artifact 계약은 이 저장소에서 확인한다.
상충하는 내용이 있으면 `README.md`, `AGENTS.md`, `schemas`, `packages/web`, `docs`의 현재 내용을 우선한다.

## 운영 원칙

변경은 현재 요청된 workbench behavior에만 한정한다.
새 abstraction, configuration, extensibility는 현재 작업이 요구할 때만 추가한다.
Scaffolding은 raw request가 아니라 승인된 `scaffold-plan.json`과 `implementation-handoff.md`만 소비한다.
Remote A2A는 높은 마찰의 계약 경계로 유지하며, 다단계 로컬 workflow만으로 추론하지 않는다.
