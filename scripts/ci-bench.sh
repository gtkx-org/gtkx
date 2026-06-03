#!/usr/bin/env bash
#
# ci-bench.sh — run the marshalling and reconciler benchmarks under the CodSpeed
# runner from inside the CI container.
#
# The container is Ubuntu-based, the only platform the CodSpeed runner supports,
# so the runner executes directly here instead of on the host wrapping a nested
# docker-run. A single `codspeed run` instruments both the Rust (cargo-codspeed)
# and the TypeScript (vitest) suites in one process tree, so they upload as one
# report. The reconciler benches render real widgets, so the vitest suite runs
# under Xvfb with the software renderer; its @codspeed/core addon needs a V8 that
# Node 26 has dropped, so it runs on the secondary Node 22 in /opt/node22.

set -euo pipefail

# Pin the profile folder so the Valgrind log can be surfaced when the runner
# fails during measurement, before it would have uploaded anything.
export CODSPEED_PROFILE_FOLDER="${CODSPEED_PROFILE_FOLDER:-/tmp/codspeed-profile}"
mkdir -p "$CODSPEED_PROFILE_FOLDER"

status=0
codspeed run -m simulation -- bash -c '
  set -e
  (cd packages/native && cargo codspeed run)
  xvfb-run -a env \
    GSK_RENDERER=cairo \
    LIBGL_ALWAYS_SOFTWARE=1 \
    PATH="/opt/node22/bin:$PATH" \
    pnpm --filter @gtkx/e2e bench
' || status=$?

if [ "$status" -ne 0 ]; then
  echo "::group::valgrind.log"
  find "$CODSPEED_PROFILE_FOLDER" -name 'valgrind*.log' -print -exec cat {} + 2>/dev/null || true
  echo "::endgroup::"
  exit "$status"
fi
