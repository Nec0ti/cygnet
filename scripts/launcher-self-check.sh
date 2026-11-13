#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
temp="$(mktemp -d)"
read -r api_port web_port < <(node --input-type=module -e 'import net from "node:net"; const get=()=>new Promise((r,j)=>{const s=net.createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>r(p))});s.on("error",j)}); console.log(await get(),await get())')
log="$temp/launcher.log"
CYGNET_DATA_DIR="$temp/data" CYGNET_PORT="$api_port" CYGNET_WEB_PORT="$web_port" CYGNET_NO_OPEN=1 "$root/cygnet.sh" >"$log" 2>&1 &
launcher_pid=$!
cleanup() {
  kill -TERM "$launcher_pid" 2>/dev/null || true
  wait "$launcher_pid" 2>/dev/null || true
  rm -rf "$temp"
}
trap cleanup EXIT
wait_url() {
  local url="$1"
  for _ in {1..100}; do
    kill -0 "$launcher_pid" 2>/dev/null || { cat "$log"; return 1; }
    if node -e 'fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' "$url"; then return 0; fi
    sleep 0.1
  done
  cat "$log"
  return 1
}
wait_url "http://127.0.0.1:$api_port/api/usage"
wait_url "http://127.0.0.1:$web_port"
for _ in {1..30}; do grep -q 'Cygnet is ready' "$log" && break; sleep 0.1; done
grep -q 'Cygnet is ready' "$log"
kill -TERM "$launcher_pid"
wait "$launcher_pid"
launcher_pid=''
is_down() { node -e 'fetch(process.argv[1]).then(()=>process.exit(1)).catch(()=>process.exit(0))' "$1"; }
for _ in {1..40}; do
  if is_down "http://127.0.0.1:$api_port/api/usage" && is_down "http://127.0.0.1:$web_port"; then
    echo 'Isolated launcher start and graceful stop check passed.'
    exit 0
  fi
  sleep 0.1
done
cat "$log"
echo 'Launcher left an HTTP service running after shutdown.' >&2
exit 1
