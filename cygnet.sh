#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(realpath "$0")")"

case "${1:-start}" in
  check)
    (cd server && npm run check)
    node engine/self-check.mjs
    node seed/self-check.mjs
    node web/src/platform-usage-self-check.mjs
    (cd web && npm run build)
    ./scripts/launcher-self-check.sh
    ;;
  benchmark)
    (cd server && npm run benchmark)
    ;;
  browser-e2e)
    node scripts/browser-e2e.mjs
    ;;
  start)
    if ! node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=5)?0:1)"; then
      echo "Cygnet needs Node.js 22.5 or newer." >&2
      exit 1
    fi
    if [[ ! -x web/node_modules/.bin/vite ]]; then (cd web && npm ci); fi

    api_port="${CYGNET_PORT:-4179}"
    web_port="${CYGNET_WEB_PORT:-5173}"
    node server/src/server.js & api_pid=$!
    (cd web && exec ./node_modules/.bin/vite --host 127.0.0.1 --port "$web_port" --strictPort) & web_pid=$!
    cleanup() {
      trap - EXIT INT TERM
      kill "$web_pid" "$api_pid" 2>/dev/null || true
      wait "$web_pid" 2>/dev/null || true
      wait "$api_pid" 2>/dev/null || true
    }
    trap cleanup EXIT
    trap 'exit 0' INT TERM
    wait_url() {
      local url="$1" pid="$2"
      for _ in {1..100}; do
        kill -0 "$pid" 2>/dev/null || return 1
        if node -e "fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "$url"; then return 0; fi
        sleep 0.1
      done
      return 1
    }
    if ! wait_url "http://127.0.0.1:$api_port/api/usage" "$api_pid"; then echo "Cygnet API did not start on port $api_port." >&2; exit 1; fi
    if ! wait_url "http://127.0.0.1:$web_port" "$web_pid"; then echo "Cygnet web app did not start on port $web_port." >&2; exit 1; fi
    url="http://127.0.0.1:$web_port"
    echo "Cygnet is ready at $url. Press Ctrl+C to stop both services."
    if [[ "${CYGNET_NO_OPEN:-0}" != 1 ]] && command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true; fi
    wait -n "$api_pid" "$web_pid"
    ;;
  *) echo "Usage: ./cygnet.sh [start|check|benchmark|browser-e2e]" >&2; exit 2 ;;
esac
