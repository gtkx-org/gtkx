#!/usr/bin/env bash
#
# codegen-verify — captures a fresh manifest and compares it against the
# committed golden at `codegen-manifest.json`. Exits 0 when nothing drifted,
# 1 when the FFI surface changed, 2 on a missing golden (use
# `pnpm codegen:promote` to establish one).
#
# Run under `scripts/docker-run` so the capture happens in the gtkx-ci
# container.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOLDEN="${REPO_ROOT}/codegen-manifest.json"
FRESH="${REPO_ROOT}/.codegen-golden/manifest.json"

if [ ! -f "${GOLDEN}" ]; then
    echo "No golden manifest at ${GOLDEN}." >&2
    echo "Run 'pnpm codegen:capture' on the baseline branch, then 'pnpm codegen:promote' to establish one." >&2
    exit 2
fi

"${REPO_ROOT}/scripts/codegen-capture.sh"

node "${REPO_ROOT}/packages/codegen-trace/bin/diff-manifest.js" \
    --golden "${GOLDEN}" \
    --fresh "${FRESH}"
