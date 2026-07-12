# Claude 세션 환경 핸드오프 스냅샷

새 머신에서 이 리포지토리를 클론했을 때, 기존 머신의 `~/`(Claude Code 홈)에만 있던 프로젝트 관련 컨텍스트를 복원하기 위한 스냅샷이다. **살아있는 원본은 각 머신의 `~/.claude/**`이며, 이 디렉터리는 수동으로 동기화하는 사본이다** (마지막 동기화: 2026-07-12).

## 구성

| 경로 | 원본 위치 (머신 로컬) | 내용 |
| --- | --- | --- |
| `memory/` | `~/.claude/projects/<이스케이프된-리포-절대경로>/memory/` | 프로젝트 메모리 (피드백 규칙, 프로젝트 상태, ADK 제약 레퍼런스) |
| `plans/` | `~/.claude/plans/` | AF 관련 플랜 파일 (다음 백로그 `af-next-steps-*`, 감사 이력 `adk-concurrent-deer`, 미머지 브랜치 원계획 `hazy-meandering-ocean` 등) |
| `global/CLAUDE.md` | `~/.claude/CLAUDE.md` | 사용자 전역 개발 헌장 (모든 프로젝트 공통 작업 규칙) |
| `settings/project-settings.local.json` | `<repo>/.claude/settings.local.json` | 프로젝트 로컬 권한 허용 목록 (gitignore 대상) |
| `settings/mcp-servers.md` | `~/.claude.json` 발췌 | adk-docs·chrome-devtools MCP 정의 + 플러그인 전제 |
| `evidence/` | 각 워크트리 미추적 노트 | 캠페인 설계·구현 증거 (dynamic 재작성 승인 설계 `d0-dynamic-design.md` 등 — `STATUS-*.md` 참조) |
| `STATUS-2026-07-12.md` | (세션 산출) | 크로스호스트 인계 브리프: 완료/진행 중/다음 작업/운영 노트 |

## 새 머신 복원 절차

1. **메모리**: 메모리 디렉터리 이름은 리포 절대경로의 `/`를 `-`로 치환한 것이다. 예: 리포가 `/home/USER/work/Agent-Factory`면 대상은 `~/.claude/projects/-home-USER-work-Agent-Factory/memory/`.
   ```bash
   DEST=~/.claude/projects/$(pwd | tr '/' '-')/memory
   mkdir -p "$DEST" && cp docs/handoff/claude-home/memory/*.md "$DEST/"
   ```
2. **플랜**: `cp docs/handoff/claude-home/plans/*.md ~/.claude/plans/`
3. **전역 헌장**: `~/.claude/CLAUDE.md`가 없으면 `global/CLAUDE.md`를 복사. 이미 있으면 내용 비교 후 수동 병합.
4. **권한**: `cp docs/handoff/claude-home/settings/project-settings.local.json .claude/settings.local.json`
5. **MCP/플러그인**: `settings/mcp-servers.md` 참조.

## 스냅샷에 담기지 **않는** 로컬 전용 요소 (수동 준비 필요)

- **`.agent-factory/runtime.env`** — `GOOGLE_API_KEY=...` 한 줄. 시크릿이므로 절대 커밋하지 않는다. 새 머신에서 직접 생성.
- **`.agent-factory/runtime/.venv`** — ADK 2.3 런타임 venv. 재구축:
  ```bash
  python3 -m venv .agent-factory/runtime/.venv
  .agent-factory/runtime/.venv/bin/pip install -r requirements/adk-runtime.txt
  ```
- **`artifacts/af/*`** — 아티팩트 루트는 의도적으로 gitignore(로컬 검토 산출물). 기존 데모 상태(`req-vacation-approval`, `req-page-recommendation-*`)가 필요하면 이전 머신에서 `artifacts/` 디렉터리를 직접 복사한다. 새로 시작해도 됨 — `templates/regression-scenarios/`가 리포에 있으므로 CLAUDE.md의 스모크 시딩 패턴으로 재구성 가능.
- **`node_modules`** — `cd packages/web && npm install` (mock-lab도 동일).
- **Codex CLI 로그인, `gh auth login`, Chrome 설치** — codex 위임·GitHub 조작·UI 검증의 전제.

## 동기화 규칙

`~/.claude`의 메모리/플랜이 의미 있게 바뀌면 이 디렉터리로 재복사해 커밋한다(“핸드오프 스냅샷 동기화” 요청으로 Claude에게 시키면 된다). 이 디렉터리는 세션 환경 스냅샷이며, 워크벤치 제품 문서가 아니다 — 문서 감사(doc audit) 대상에서 제외한다.
