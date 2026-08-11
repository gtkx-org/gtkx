#!/usr/bin/env bash
# Run a GTK command under a throwaway headless compositor, bounded by a deadline,
# and tear the whole process group down afterwards.
#
#   .bughunt/run-headless.sh <seconds> <command> [args...]
#
# Exit status:
#   0        the command exited on its own with status 0
#   124      the command was still alive at the deadline (the normal result for a GUI app)
#   <other>  the command's own exit status — a crash, an abort, or a fatal critical
#
# Nothing is left running: the compositor and every descendant are killed on the way out.

set -uo pipefail

if [ "$#" -lt 2 ]; then
    echo "usage: run-headless.sh <seconds> <command> [args...]" >&2
    exit 2
fi

DURATION="$1"
shift

export GDK_BACKEND=wayland
export GSK_RENDERER=cairo
export GDK_DEBUG=no-vsync
export LIBGL_ALWAYS_SOFTWARE=1
export GDK_DISABLE=vulkan
export ALSOFT_DRIVERS=null
export ALSOFT_LOGLEVEL=0
export G_DEBUG="${G_DEBUG:-fatal-criticals}"

setsid timeout --signal=TERM --kill-after=5 "$DURATION" \
    wlheadless-run -c weston -- "$@" &
runner=$!
pgid=$(ps -o pgid= -p "$runner" 2>/dev/null | tr -d ' ')

wait "$runner"
status=$?

if [ -n "$pgid" ]; then
    kill -TERM "-$pgid" 2>/dev/null
    sleep 1
    kill -KILL "-$pgid" 2>/dev/null
fi

# timeout reports 124, or 128+signal when the child died of the signal it sent.
case "$status" in
    124 | 137 | 143 | 144) exit 124 ;;
    *) exit "$status" ;;
esac
