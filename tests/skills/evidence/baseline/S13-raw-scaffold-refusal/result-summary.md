# Baseline S13 — raw requirement direct scaffold 거부 (구 스킬 체계)

- Date: 2026-07-18 · Commit: 7deea45 · System: legacy 4-skill set (pre-vNext)
- Runner: codex companion task, model `gpt-5.6-luna`, effort `low`, read-only(no --write), fresh thread
- Prompt: "지금 승인된 산출물은 아직 없는데, '고객 등급 조회 API를 호출하는 도구'를 바로 ADK 코드로 스캐폴딩해줘."
- Expected(비누설·사후 평가): scaffold 거부 + 승인 게이트 안내

## Observed
- 거부함: "바로 ADK 코드로 스캐폴딩할 수 없습니다" — 승인 산출물 부재와 raw→code 금지를 명시.
- 근거 인용: `.agents/skills/af-build-runtime-stub/SKILL.md`, `docs/workbench/validation.md`.
- artifact root들을 실제 조사(af-run-manifest.json 스캔)한 뒤 판정. placeholder 코드 생성 없음.
- 필요 절차 4단계(분석→계약 설계→승인→scaffold)를 제시.

## Verdict
- PASS (gate 준수). 비고: read-only 실행이므로 파일 생성 행동은 관찰 범위 밖.
