#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WEB_ROOT="$REPO_ROOT/packages/web"
PORT=5173

usage() {
  cat <<'EOF'
Usage: ./scripts/start-manual-web-test.sh

Starts the Agent Factory workbench on http://127.0.0.1:5173/.
This script does not create, reset, or delete artifact roots.
EOF
}

while (($#)); do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf '지원하지 않는 인자입니다: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

for command_name in node npm curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '필수 명령을 찾을 수 없습니다: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ ! -x "$WEB_ROOT/node_modules/.bin/vite" ]]; then
  printf 'packages/web 의존성이 없어 npm install을 실행합니다.\n'
  (cd "$WEB_ROOT" && npm install)
fi

print_ready_url() {
  cat <<'EOF'

수동 테스트 URL: http://127.0.0.1:5173/
EOF
}

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if curl --silent --fail --max-time 2 "http://127.0.0.1:$PORT/api/af" >/dev/null; then
    printf 'Agent Factory가 이미 %s 포트에서 응답하고 있습니다.\n' "$PORT"
    print_ready_url
    exit 0
  fi
  printf '%s 포트를 다른 프로세스가 사용 중이거나 Agent Factory API가 응답하지 않습니다.\n' "$PORT" >&2
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
  exit 1
fi

print_ready_url
printf '\n서버를 종료하려면 이 터미널에서 Ctrl+C를 누르세요.\n\n'

cd "$WEB_ROOT"
exec npm run dev -- --configLoader runner --host 0.0.0.0 --port "$PORT" --strictPort
