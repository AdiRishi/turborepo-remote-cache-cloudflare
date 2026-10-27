#!/usr/bin/env sh
# Starts the built Worker under `wrangler dev`, runs the contract tests and a real `turbo` round trip
# against it, and stops it again. Run it through `pnpm test:e2e` at the root, which builds first.
set -eu

cd "$(dirname "$0")/.."
base_url=http://localhost:8787

# Another server on the port would answer instead of this build.
if curl --silent --output /dev/null "$base_url"; then
  echo "Something is already listening on $base_url. Stop it and run again."
  exit 1
fi

log="$(mktemp)"

# Job control gives the Worker its own process group, so stopping it also stops workerd.
set -m
pnpm preview > "$log" 2>&1 &
worker=$!
set +m

stop() {
  status=$?
  kill -TERM -- "-$worker" 2> /dev/null || true
  if [ "$status" -ne 0 ]; then
    cat "$log"
  fi
  rm -f "$log"
}
trap stop EXIT

attempts=0
until curl --silent --fail "$base_url/ping" > /dev/null; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo 'The Worker did not start within 60 seconds'
    exit 1
  fi
  sleep 1
done

CONTRACT_BASE_URL="$base_url" pnpm exec vitest run tests/contract
sh e2e/turbo-roundtrip.sh "$base_url"
