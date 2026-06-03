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
  echo "::group::valgrind diagnostic"
  valgrind --version || true
  echo "--- reproducing the runner's valgrind invocation on /bin/echo ---"
  setarch "$(uname -m)" --addr-no-randomize \
    valgrind --tool=callgrind --cache-sim=yes \
    --I1=32768,8,64 --D1=32768,8,64 --LL=8388608,16,64 \
    --fair-sched=yes --log-file=/tmp/vg-min.log /bin/echo hi 2>&1 | tail -20 || true
  echo "--- /tmp/vg-min.log ---"
  cat /tmp/vg-min.log 2>/dev/null || true
  echo "--- any runner valgrind*.log on disk ---"
  find / -name 'valgrind*.log' 2>/dev/null -print -exec tail -30 {} + 2>/dev/null || true
  echo "::endgroup::"
  exit "$status"
fi
