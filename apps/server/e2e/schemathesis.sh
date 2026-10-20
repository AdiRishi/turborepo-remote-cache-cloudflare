#!/usr/bin/env sh
# Fuzzes a running server against the vendored Remote Cache spec.
# Usage: sh e2e/schemathesis.sh [base URL]   (default http://localhost:8787, token test-token)
set -eu

base_url="${1:-http://localhost:8787}"
spec="$(mktemp)"
trap 'rm -f "$spec"' EXIT

# HTTP clients derive Content-Length from the body. A generated value would only break request framing.
jq '(.paths["/artifacts/{hash}"].put.parameters) |= map(select(.name != "Content-Length"))' \
  "$(dirname "$0")/../openapi/turborepo.openapi.json" > "$spec"

# Excluded checks, all on purpose:
# - positive_data_acceptance: team identifiers with control characters are rejected, though the
#   spec types them as plain strings, because S3-compatible listings cannot carry them.
# - negative_data_rejection: it treats an undeclared header (User-Agent) or a missing body (the same
#   bytes on the wire as an empty artifact) as invalid input.
# - unsupported_method: the /v8 catch-all answers undeclared methods with the API's JSON 404.
# SCHEMATHESIS_MODE=positive skips invalid inputs. Use it against `wrangler dev`, which fails the
# request after one that the Worker answers without reading a large body.
# The spec's paths omit the /v8 prefix that every client uses.
uvx schemathesis@4.32.1 run "$spec" \
  --url "$base_url/v8" \
  --header "Authorization: Bearer test-token" \
  --mode "${SCHEMATHESIS_MODE:-all}" \
  --checks all \
  --exclude-checks positive_data_acceptance,negative_data_rejection,unsupported_method \
  --max-examples 50 \
  --request-timeout 10 \
  --seed "${SCHEMATHESIS_SEED:-20261020}"
