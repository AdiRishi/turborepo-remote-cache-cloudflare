#!/usr/bin/env sh
# Builds a fixture repo with the real `turbo` CLI against a running server, twice, with signed
# artifacts, and asserts that the second run restores the build from the remote cache.
# Usage: sh e2e/turbo-roundtrip.sh [base URL]   (default http://localhost:8787, token test-token)
set -eu

e2e_dir="$(cd "$(dirname "$0")" && pwd)"
turbo="$e2e_dir/../../../node_modules/.bin/turbo"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp -R "$e2e_dir/turbo-fixture/." "$work"
cd "$work"
git init --quiet
git add --all
git -c user.name=e2e -c user.email=e2e@example.com -c commit.gpgsign=false commit --quiet --message fixture

export TURBO_API="${1:-http://localhost:8787}"
export TURBO_TOKEN=test-token
# A fresh team per run guarantees the first build misses the remote cache.
export TURBO_TEAM="team_e2e_$(date +%s)_$$"
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=e2e-signature-key-of-at-least-32-bytes
export TURBO_TELEMETRY_DISABLED=1

"$turbo" run build --summarize
jq --exit-status '.tasks[0].cache.status == "MISS"' .turbo/runs/*.json > /dev/null

rm -rf .turbo dist
"$turbo" run build --summarize
jq --exit-status '.tasks[0].cache | .status == "HIT" and .source == "REMOTE"' .turbo/runs/*.json > /dev/null
test -s dist/output.txt

echo 'turbo restored the build from the remote cache'
