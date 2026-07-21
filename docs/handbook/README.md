# Agent Factory Handbook

> **원칙**
>
> Handbook = 어디를 볼 것인가<br>
> Source Code = 실제로 무엇이 구현되어 있는가

## 사용 순서

1. [Overview](overview.md)에서 전체 행동과 경계를 확인한다.
2. [Index](index.md)에서 필요한 Stage를 찾는다.
3. [Registers](registers.md)에서 Stage 사이의 상태와 artifact를 추적한다.
4. 관련 [Stage](stages/) 문서에서 L2 흐름과 L3 Source Map을 확인한다.
5. locator가 가리키는 실제 최신 소스를 열어 symbol과 동작을 다시 확인한다.
6. 확인한 현재 소스를 근거로 변경 계획을 세운다.

## Locator status

- `active`: 현재 snapshot에서 path와 stable anchor를 재검증했다.
- `needs-review`: path 또는 anchor는 확인했지만 호출 관계나 행동 일부를 정적으로 확정하지 못했다.
- `frozen`: 현재 repository에서 locator를 재검증하지 못해 탐색 시작점으로 사용하지 않는다.

Handbook은 행동과 소스 위치를 연결하는 탐색 지도다. 구현 사실의 최종 권위는 항상 현재 Source Code에 있다. line range가 있더라도 snapshot hint일 뿐 안정 locator가 아니다.

## 문서 층위

- L1: [Overview](overview.md)는 시스템 목적, 실행 흐름, 전역 artifact 흐름과 경계를 설명한다.
- L2: [Stage 문서](stages/)는 행동 단계별 책임, 입력·출력, 분기와 Register 관계를 설명한다.
- L3: 각 Stage의 Source Map은 실제 파일과 stable anchor를 탐색 시작점으로 제공한다.
- Register: [Registers](registers.md)는 Stage 경계를 넘어 읽고 쓰는 상태와 artifact를 producer·consumer 관점에서 연결한다.

Target의 Agent·Workflow·Tool 분류는 [Taxonomy](../workbench/taxonomy.md), Workflow 실행 구조는 [Graph IR](../workbench/graph-ir.md), 승인과 Handoff 원칙은 [Operating Model](../workbench/operating-model.md)이 소유한다. Handbook은 이 정의를 반복하지 않고 Current Implementation의 행동 위치만 연결한다.

## Source snapshot

- Repository: `gttmr/Agent-Factory`
- Baseline commit: `0cdcb82` + 2026-07-20 integrated worktree
- Checked date: `2026-07-20`
- Leaf mode: file-as-leaf + stable symbol/section anchors (line ranges are snapshot hints only)
- Coverage scope: `packages/web` (`src` + `server`), `packages/mock-lab`, `scripts`, `schemas`/`catalog`/`templates` as contract surfaces, Stage Runner의 canonical five-skill locators
- Known exclusions: stage-facing canonical skill locator를 제외한 `.agents/skills` 내부 authoring 절차, `generated/**`, `artifacts/**`, `docs/archive/**`, `docs/handoff/**`

실행 중 생성되는 `artifacts/**`와 `generated/**`는 경로 계약만 설명하며 snapshot 내용은 문서화하지 않는다.
