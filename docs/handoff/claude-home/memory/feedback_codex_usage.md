---
name: Use Codex skill actively during code/doc generation
description: User wants the codex skill (codex:setup / codex:rescue / codex:codex-rescue agent) used proactively when writing code or generating non-trivial drafts, not as a last resort
type: feedback
originSessionId: 72ed13e2-9078-4f0f-bb83-d6580f1916c8
---
코드 작성 과정에서 codex 스킬을 적극 활용한다.

**Why:** 사용자가 plan mode 검토 시 명시적으로 지시함 — "코드 작성 과정에서 codex 스킬을 적극활용하라". Codex 를 회복용 백업이 아니라 1차 작성 도구 중 하나로 쓰겠다는 의도.

**How to apply:**
- 분량 있는 신규 파일 (수십 줄 이상의 문서, 새 모듈, 스키마 초안 등) 작성 시 기본적으로 `Skill codex:rescue` 또는 `Agent subagent_type=codex:codex-rescue` 로 초안을 위임하고, Claude 는 검증/통합/보완을 담당한다.
- Codex 호출 전 첫 진입에서 `Skill codex:setup` 로 가용성을 한 번 확인한다 (세션당 한 번).
- Codex prompt 는 CLAUDE.md 룰대로 `Goal / Context / Constraints / Done when` 4부 구조를 사용한다.
- 짧은 1~2줄 편집, 인덱스 업데이트, 파일 검증, taxonomy 글자 단위 매칭 같은 정밀 작업은 Claude 가 직접 한다 — Codex 호출이 오버헤드가 더 큰 경우.
- Codex 결과물은 그대로 반영하지 않고, v1.0 결정사항 / 프로젝트 제약 (private data 금지, taxonomy enum 일치 등) 누락 여부를 review 한 후 보완 편집한다.
- Codex 가 막히거나 제약을 어기면 `codex:codex-rescue` 서브에이전트로 진단을 위임하고, 회복 불가 시 Claude 가 직접 작성한다.
- **항상 등록된 codex 스킬(`codex:rescue` 등)로만 호출한다 — codex CLI(`codex exec` 등)를 Bash 로 직접 실행하지 않는다.** 사용자 명시 교정(2026-06-03): "codex cli를 직접 실행하는 것은 위험성이 크다 skill로 등록된 codex:rescue 등을 이용하는 것이 훨씬 안전하다". 직접 실행은 sandbox/approval 우회 위험이 있고 출력도 불완전했다.
- forked `codex:rescue` 가 "done" 으로 찍혔는데 findings(최종 텍스트)가 relay 되지 않으면: 왜 멈췄는지 간단히만 확인하고(태스크/세션 유무), 누락이면 **스킬을 다시 호출**해 받는다. 원시 CLI 우회로 빠지지 말 것. [[feedback_codex_retry_loop]] 와 함께 적용.
