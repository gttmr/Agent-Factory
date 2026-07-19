# Agent Factory Handbook Overview

## 목적과 저장소 경계

Agent Factory는 raw requirement를 즉시 코드로 바꾸는 생성기가 아니다. 요구사항의 근거와 미결 정보를 분석하고, Agent·Workflow·Tool 후보와 Graph IR 및 실행 계약을 검토 가능한 artifact로 만들며, 사람이 승인한 계약에서 Runtime Handoff를 준비하고 검증·재사용 판단까지 연결하는 workbench다.

저장소 경계는 요구사항 접수, artifact 중심 검토, 승인 상태 보존, Runtime Handoff 생성, 로컬 실행 증명, synthetic Tool test double, Catalog 환류까지다. production deployment, 조직 전용 runtime 구현, private endpoint·credential·실고객 데이터 관리는 경계 밖이다.

## 주요 사용자

- 개발 리더는 승인 gate, 잔존 위험, 재사용 및 Handoff 준비 상태를 검토한다.
- 검토자는 근거, missing information, Graph와 계약, validation evidence를 확인하고 명시적으로 승인하거나 보완을 요청한다.
- coding agent와 신규 개발자는 Handbook locator에서 시작해 현재 Source Code를 다시 열고 행동의 실제 구현 위치를 찾는다.

## 전체 운영 흐름

요구사항 수신 → 분석 proposal과 검토 → 경계·Graph·계약 설계 검토 → 명시적 승인 → Runtime Handoff 생성·검토 → 검증 evidence 기록 → Catalog 재사용·게시 환류 순서로 진행한다. Mock Lab과 로컬 Runtime은 필요한 단계에서 계약을 검증하는 보조 실행 경계이며 production 운영 단계가 아니다.

## 주요 실행 Stage

- [request-intake-artifact-root — 요구사항 접수와 Artifact Root](stages/request-intake-artifact-root.md): requirement identity와 검토용 artifact root를 만들고 Analyze 진입점을 연다.
- [analyze-review-gate — 분석 제안·검토·승인](stages/analyze-review-gate.md): 분석 proposal을 검토·적용하고 missing information 수용 뒤 분석 gate를 결정한다.
- [design-boundary-contract — 경계·Graph·계약 설계](stages/design-boundary-contract.md): 후보 책임, Graph IR, runtime/A2A 계약과 검토 의견을 함께 다룬다.
- [runtime-handoff-build — 동기화와 Runtime Handoff](stages/runtime-handoff-build.md): 승인된 artifact를 동기화하고 scaffold plan, runtime bundle, Handoff 문서를 준비한다.
- [verify-feedback — 검증 증거와 피드백](stages/verify-feedback.md): 허용된 검증을 실행하고 report와 Catalog delta를 검토 가능한 evidence로 남긴다.
- [catalog-publication — Catalog 재사용 환류와 게시](stages/catalog-publication.md): root-scoped 제안을 검증해 versioned Catalog entry로 게시한다.
- [runtime-execution — 로컬 Runtime 실행 증명](stages/runtime-execution.md): generated bundle을 로컬 ADK chat/A2A 경계에서 시작·관찰·재개한다.
- [mock-tool-integration — Synthetic Mock Tool 연결](stages/mock-tool-integration.md): synthetic MockSpec의 draft·저장·실행·smoke·MCP 연결 lifecycle을 운영한다.

## Artifact와 상태의 전역 흐름

한 requirement의 전역 기준점은 artifact root다. 입력과 분석 결과, 설계 상태, 승인 gate, Stage Runner evidence, scaffold plan, Runtime Handoff, validation report와 Catalog delta는 같은 root의 provenance를 유지한다. proposal과 run evidence는 명시적 apply 전까지 canonical artifact가 아니며, 파일 존재나 실행 성공은 승인 gate를 대신하지 않는다.

브라우저 cache와 process memory는 탐색·실행을 돕는 임시 상태다. durable 판단은 artifact root, manifest, Catalog 또는 Mock Lab artifact에 남아야 한다. Register별 producer·consumer와 교체 규칙은 [Registers](registers.md)에서 확인한다.

## 외부 경계

- Codex SDK 실행: Analyze·Design proposal과 MockSpec draft를 만들지만 canonical 적용과 승인을 대신하지 않는다.
- ADK runtime: generated Runtime Handoff의 chat, Agent Card, A2A message와 resume를 로컬에서 증명한다.
- Mock Lab MCP: synthetic saved spec을 stdio child와 Streamable HTTP bridge로 노출한다.
- 로컬 파일시스템: artifact root, Stage Runner ledger, Runtime Handoff, Catalog와 Mock Lab 상태를 보존한다.
- 브라우저: Workbench 화면, local query cache, 최근 root와 작성자 편의를 제공하되 canonical store가 아니다.

## 설계 원칙

- 승인 gate는 사람이 명시적으로 결정한다. proposal 생성, artifact 저장, validation 성공은 gate를 자동으로 만들지 않는다.
- raw requirement에서 code로 직접 건너뛰지 않는다. Runtime Handoff는 검토·승인된 artifact와 scaffold plan을 소비한다.
- 로컬 우선(local-first) 검토·검증을 사용하며 Runtime Handoff나 Mock Lab 성공을 production deployment로 해석하지 않는다.
- Target Contract와 Current Implementation을 분리한다. 현재 소스의 legacy `module_category`, legacy `adapter`, legacy `remote_a2a`, legacy `processFlow`는 Target 정의가 이미 구현되었다는 뜻이 아니다.

## 진입·종료 조건

진입에는 requirement identity와 raw requirement 또는 검토 가능한 기존 분석 artifact가 필요하다. Stage가 진행될수록 선행 artifact와 해당 approval gate가 추가 진입 조건이 된다.

종료는 하나의 전역 boolean이 아니다. 분석·설계·Handoff gate, 검증 evidence, 필요한 Catalog 환류 또는 로컬 실행 증명이 목적에 맞게 닫혀야 한다. unresolved 정보, 실패한 검증, 미승인 계약, production 운영 준비는 남은 항목으로 명시한다.

## Source snapshot

- Repository: `gttmr/Agent-Factory`
- Snapshot commits: docs `0ee7784` → skills `b3911fd` → code `a4f55a0`
- Checked date: `2026-07-18~19`
- Leaf mode: file-as-leaf + stable symbol/section anchors (line ranges are snapshot hints only)
- Coverage scope: `packages/web` (`src` + `server`), `packages/mock-lab`, `scripts`, `schemas`/`catalog`/`templates` as contract surfaces, stage-facing `.agents/skills` shim→canonical locators
- Known exclusions: stage-facing shim→canonical locator를 제외한 `.agents/skills` 내부 구현, `generated/**`, `artifacts/**`, `docs/archive/**`, `docs/handoff/**`
