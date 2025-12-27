#!/usr/bin/env bash
set -euo pipefail

export GDK_BACKEND=x11
export GSK_RENDERER=cairo
export LIBGL_ALWAYS_SOFTWARE=1
export NO_AT_BRIDGE=1

if [ -n "${CI:-}" ]; then
    exec vitest run "$@"
else
    exit_code=0
    xvfb-run -a vitest run "$@" || exit_code=$?
    if [ $exit_code -ne 0 ]; then
        exit $exit_code
    fi
fi
