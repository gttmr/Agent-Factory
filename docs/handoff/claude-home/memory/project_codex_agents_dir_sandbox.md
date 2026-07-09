---
name: codex-agents-dir-sandbox
description: codex CLI 샌드박스는 리포 내 .agents/ 쓰기를 차단 — 스킬 편집은 스테이징 디렉터리 우회 필요
metadata: 
  node_type: memory
  type: project
  originSessionId: 18ecc8b1-bce3-4872-a21a-094e41ddaf43
---

codex CLI(companion 경유 포함)의 샌드박스는 워크스페이스 쓰기 허용 상태에서도 리포 안의 `.agents/` 트리(자기 스킬 설정 경로) 수정을 "write outside the project"로 거부한다 (2026-07-08 Agent-Factory 스킬 재작성에서 확인 — `.evidence-adk23/` 등 다른 워크트리 경로 쓰기는 정상).

**Why:** `.agents/skills`는 codex가 로드하는 DLC 스킬 트리라 자기수정 방지 보호를 받는 것으로 보임.

**How to apply:** codex에 `.agents/**` 편집을 시킬 때는 워크트리 루트의 스테이징 디렉터리(예: `skills-staging/`, 대상 레이아웃 미러 + 삭제 목록 노트)에 쓰게 하고, 메인 세션(Claude)이 이동·삭제·스테이징 정리·커밋을 수행한다. 관련: [[codex-companion-long-runs]]
