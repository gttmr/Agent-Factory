# MCP 서버 · 플러그인 구성 (새 머신 복원용)

이 프로젝트의 Claude Code 세션이 의존하는 MCP 서버/플러그인 정의. `claude mcp add` 또는 `~/.claude.json` 수동 편집으로 등록한다.

## 프로젝트 스코프 MCP (`~/.claude.json` → `projects.<repo-abs-path>.mcpServers`)

```json
{
  "adk-docs": {
    "type": "stdio",
    "command": "uvx",
    "args": [
      "--from", "mcpdoc", "mcpdoc",
      "--urls", "AgentDevelopmentKit:https://adk.dev/llms.txt",
      "--transport", "stdio"
    ],
    "env": {}
  }
}
```

전제: `uv`(uvx) 설치.

## 전역 MCP (`~/.claude.json` → `mcpServers`)

```json
{
  "chrome-devtools": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y", "chrome-devtools-mcp@1.2.0",
      "--headless", "--isolated",
      "--executablePath", "/usr/bin/google-chrome",
      "--chromeArg=--no-sandbox"
    ],
    "env": {}
  }
}
```

전제: Google Chrome 설치(`--executablePath`는 머신에 맞게 조정). UI 검증 필수 도구 — CLAUDE.md의 스크린샷 검증 규칙이 이 서버에 의존한다.

## Claude Code 플러그인

- **codex-openai-codex** (codex-companion): codex 위임 패턴(`Agent(subagent_type: "codex:codex-rescue")`)의 실행 기반. 전제: OpenAI Codex CLI 설치 + 로그인.
- **github**: PR/이슈 조작. 전제: `gh auth login`.
- (선택) telegram: 알림 채널. 없어도 워크플로우에 지장 없음.

## 프로젝트 로컬 권한 (`<repo>/.claude/settings.local.json`)

`settings/project-settings.local.json` 스냅샷을 리포 클론의 `.claude/settings.local.json`로 복사하면 chrome-devtools/adk-docs 도구 허용 목록이 복원된다(이 파일은 gitignore 대상이라 리포에는 스냅샷으로만 보관).
