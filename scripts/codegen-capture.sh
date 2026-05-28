#!/usr/bin/env bash
#
# codegen-capture — runs every test that exercises the generated FFI bindings
# with @gtkx/codegen-trace's recording proxy enabled, then computes the
# golden manifest from the produced per-test JSON snapshots.
#
# The trace plugin is gated on GTKX_CODEGEN_TRACE=1, so this script is the
# canonical way to run the capture. It restricts the test set to the suites
# that drive codegen-produced bindings (packages/e2e and examples/gtk-demo),
# which is everything the manifest is meant to pin.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${REPO_ROOT}/.codegen-golden"

cd "${REPO_ROOT}"

rm -rf "${OUTPUT_DIR}"

export GTKX_CODEGEN_TRACE=1
export GTKX_REPO_ROOT="${REPO_ROOT}"
export GTKX_CODEGEN_TRACE_DIR="${OUTPUT_DIR}"

# Capture suites that drive codegen-produced bindings. Running them through
# `turbo` keeps dependency builds up to date and lets each package run in its
# own vitest worker pool. The caller is responsible for invoking this script
# under `scripts/docker-run` when not already inside the gtkx-ci container.
#
# The suite is run twice. The first pass warms host-side caches (fontconfig,
# gschemas, GLib type registrations across forks) whose cold-vs-warm state
# can flap exactly one FFI shape in `fontrendering.test.tsx`. The second pass
# captures the steady-state shape set, which is what the manifest pins.
run_suite() {
    pnpm turbo test --filter=@gtkx/e2e --filter=gtk-demo --force
}

run_suite
rm -rf "${OUTPUT_DIR}"
run_suite

node packages/codegen-trace/bin/build-manifest.js \
    --root "${REPO_ROOT}" \
    --snapshots "${OUTPUT_DIR}" \
    --out "${OUTPUT_DIR}/manifest.json"
