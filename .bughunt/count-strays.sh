#!/usr/bin/env bash
# Count processes GTKX is responsible for cleaning up. Run before and after an
# operation; a positive delta that never settles is a process leak.
#
#   .bughunt/count-strays.sh

set -uo pipefail

printf 'weston=%s\n' "$(pgrep -c -x weston 2>/dev/null || echo 0)"
printf 'wlheadless=%s\n' "$(pgrep -c -f wlheadless-run 2>/dev/null || echo 0)"
printf 'vitest_workers=%s\n' "$(pgrep -c -f 'vitest/dist/workers' 2>/dev/null || echo 0)"
printf 'gtkx_apps=%s\n' "$(pgrep -c -f 'dist/bundle.mjs' 2>/dev/null || echo 0)"
printf 'vite=%s\n' "$(pgrep -c -f 'vite' 2>/dev/null || echo 0)"
