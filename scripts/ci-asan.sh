#!/usr/bin/env bash
#
# ci-asan.sh — build the native addon under AddressSanitizer and run the native
# vitest suite against it.
#
# The toggle-reference ref/unref accounting and the finalize teardown are where
# a double-unref or use-after-free would live; a sanitizer turns such a defect
# into a deterministic failure instead of a crash a user only hits "after GC".
#
# LeakSanitizer is left off (detect_leaks=0): Node reports benign exit-time
# leaks, so this job targets use-after-free and double-free, mirroring
# napi-rs's asan workflow. The prebuilt sanitizer runtime that ships with
# rust-std is preloaded so its symbols resolve before Node dlopens the
# instrumented `.node`.

set -euo pipefail

export RUSTUP_TOOLCHAIN=nightly
export RUSTFLAGS="-Zsanitizer=address -Cforce-frame-pointers=yes"
export ASAN_OPTIONS="detect_leaks=0:abort_on_error=1:detect_stack_use_after_return=1"

pushd packages/native >/dev/null
pnpm exec napi build --platform --release \
  --js native-binding.cjs --dts native-binding.d.cts
cp "native.linux-x64-gnu.node" "npm/linux-x64-gnu/"
popd >/dev/null

SYSROOT="$(rustc +nightly --print sysroot)"
ASAN_RT="$(find "$SYSROOT" -name '*_rt.asan.so' -print -quit 2>/dev/null || true)"
if [ -z "$ASAN_RT" ]; then
  echo "ci-asan: AddressSanitizer runtime not found under $SYSROOT; candidates:" >&2
  find "$SYSROOT" -iname '*asan*' 2>/dev/null >&2 || true
  exit 1
fi
export LD_PRELOAD="$ASAN_RT"

xvfb-run -a pnpm --filter @gtkx/native test
